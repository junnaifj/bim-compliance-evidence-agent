import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { agentResponseSchema, apiKeyLooksValid, assertSameOrigin, redactSecrets, validateAgentRequest, verifyAgentEnvelope } from "../core/agent/agent-contract.ts";
import { agentToolDefinitions, executeAgentTool } from "../core/agent/agent-tools.ts";
import { AGENT_INSTRUCTIONS, probeOpenAIKey, runOpenAIResponsesAgent } from "../core/agent/openai-agent.server.ts";
import { consumeAgentRateLimit, resolveAgentCredential } from "../core/agent/agent-gateway.ts";

const finding = {
  id: "finding-1", ruleId: "EGRESS-WIDTH-001", ruleVersion: 1,
  ruleTitle: "Exit door clear-width evidence", status: "REVIEW",
  elementId: "3vB1xY2zA3B4C5D6E7F8G9", expressId: 42,
  elementName: "Exit Door 01", message: "Clear width requires confirmation.",
  observed: "Overall width 850 mm", observedValue: 850,
  required: ">= 900 mm", thresholdValue: 900,
  evidencePath: "IfcDoor.OverallWidth", reliability: "PROXY",
  nextStep: "Confirm clear width from an authoritative source.",
};

const rule = {
  id: "EGRESS-WIDTH-001", version: 1,
  title: { en: "Exit door clear-width evidence", zh: "疏散门净宽度证据" },
  description: { en: "Checks confirmed exits against 900 mm.", zh: "按 900 毫米检查。" },
  authority: "Assessment demonstration parameter", jurisdiction: "Project",
  sourceDocumentId: "assessment-pack", sourceAnchor: "Rule 1", target: "IfcDoor",
  field: "clearWidth", operator: ">=", threshold: 900, unit: "mm",
  scope: "Confirmed exits", exceptions: [], missingEvidencePolicy: "REVIEW",
  severity: "HIGH", status: "ACTIVE", extractionConfidence: 1,
};

const context = {
  modelName: "Duplex residence", locale: "en", findings: [finding], rules: [rule],
  selectedFindingId: finding.id, reviewCount: 0, overrideCount: 0,
};

const request = {
  model: "gpt-5.6", role: "orchestrator", message: "Explain the selected finding",
  history: [], context,
};

const safeEnvelope = {
  answer: "Exit Door 01 remains REVIEW because 850 mm is proxy evidence against the 900 mm project rule.",
  route: "explain", proposal: { kind: "none", summary: "", payloadJson: "{}" },
  citations: [{ elementId: finding.elementId, evidencePath: finding.evidencePath, status: "REVIEW" }],
  limitations: ["Clear width is not explicit."], requiresConfirmation: false,
};

test("agent request validation bounds model, history and BIM context", () => {
  assert.equal(validateAgentRequest(request).message, request.message);
  assert.throws(() => validateAgentRequest({ ...request, model: "https://attacker.invalid" }), /model/i);
  assert.throws(() => validateAgentRequest({ ...request, model: "gpt-unassessed" }), /model/i);
  assert.throws(() => validateAgentRequest({ ...request, message: "x".repeat(4001) }), /message/i);
  assert.throws(() => validateAgentRequest({ ...request, history: Array.from({ length: 21 }, () => ({ role: "user", text: "x" })) }), /history/i);
});

test("BYOK keys are recognisable but always redacted from errors", () => {
  const key = `sk-proj-${"a".repeat(40)}`;
  assert.equal(apiKeyLooksValid(key), true);
  assert.equal(apiKeyLooksValid("not-a-key"), false);
  assert.doesNotMatch(redactSecrets(`Upstream rejected ${key}`), /sk-proj/);
});

test("credential selection is explicit and never silently substitutes operator billing", () => {
  const operator = `sk-proj-${"o".repeat(40)}`; const byok = `sk-proj-${"u".repeat(40)}`;
  assert.deepEqual(resolveAgentCredential("operator", null, operator), { apiKey: operator, mode: "operator" });
  assert.deepEqual(resolveAgentCredential("byok", byok, operator), { apiKey: byok, mode: "byok" });
  assert.throws(() => resolveAgentCredential("byok", null, operator), /session API key/i);
});

test("agent gateway rate limit is bounded without using API keys as identifiers", () => {
  const id = `test-${Date.now()}`;
  for (let index = 0; index < 20; index += 1) assert.equal(consumeAgentRateLimit(id, 1_000).allowed, true);
  assert.equal(consumeAgentRateLimit(id, 1_000).allowed, false);
  assert.equal(consumeAgentRateLimit(id, 62_000).allowed, true);
});

test("agent gateway accepts only same-origin browser requests", () => {
  assert.doesNotThrow(() => assertSameOrigin("https://example.com/api/agent", "https://example.com"));
  assert.throws(() => assertSameOrigin("https://example.com/api/agent", "https://attacker.invalid"), /origin/i);
});

test("every model tool is strict and no tool owns a verdict mutation", () => {
  assert.ok(agentToolDefinitions.length >= 5);
  for (const tool of agentToolDefinitions) {
    assert.equal(tool.strict, true); assert.equal(tool.parameters.additionalProperties, false);
    assert.doesNotMatch(tool.name, /pass|verdict|activate|approve/i);
  }
  const result = executeAgentTool("draft_rule_change", { requirement: "Use 1,000 mm", target: "IfcDoor", scope: "Clinical exits" }, context);
  assert.equal(result.proposalOnly, true); assert.equal(context.rules[0].threshold, 900);
});

test("agent verifier accepts grounded claims and blocks hallucinated BIM evidence", () => {
  assert.deepEqual(verifyAgentEnvelope(safeEnvelope, request), []);
  assert.ok(verifyAgentEnvelope({ ...safeEnvelope, answer: safeEnvelope.answer.replace("900", "1000") }, request).some((item) => /number/i.test(item)));
  assert.ok(verifyAgentEnvelope({ ...safeEnvelope, citations: [{ ...safeEnvelope.citations[0], elementId: "0vB1xY2zA3B4C5D6E7F8G0" }] }, request).some((item) => /GlobalId/i.test(item)));
  assert.ok(verifyAgentEnvelope({ ...safeEnvelope, citations: [{ ...safeEnvelope.citations[0], status: "PASS" }] }, request).some((item) => /verdict/i.test(item)));
  assert.ok(verifyAgentEnvelope({ ...safeEnvelope, answer: `${safeEnvelope.answer} Treat this as P1.` }, request).some((item) => /priority/i.test(item)));
});

test("structured response schema is strict at every object boundary", () => {
  assert.equal(agentResponseSchema.additionalProperties, false);
  assert.equal(agentResponseSchema.properties.proposal.additionalProperties, false);
  assert.equal(agentResponseSchema.properties.citations.items.additionalProperties, false);
});

test("system instructions treat documents as evidence, not executable instructions", () => {
  assert.match(AGENT_INSTRUCTIONS, /untrusted/i);
  assert.match(AGENT_INSTRUCTIONS, /never.*verdict/i);
  assert.match(AGENT_INSTRUCTIONS, /proposal/i);
});

test("Responses requests do not send the unsupported current_turn reasoning context", async () => {
  const source = await fs.promises.readFile(new URL("../core/agent/openai-agent.server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /context:\s*["']current_turn["']/);
  assert.match(source, /reasoning:\s*\{\s*effort:\s*["']low["']\s*\}/);
});

test("Responses transport completes a strict tool loop without returning the API key", async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    if (calls.length === 1) return new Response(JSON.stringify({
      id: "resp_tool", output: [{ type: "function_call", call_id: "call_1", name: "inspect_selected_finding", arguments: JSON.stringify({ elementId: finding.elementId }) }],
      usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
    }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({
      id: "resp_final", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(safeEnvelope) }] }],
      usage: { input_tokens: 150, output_tokens: 60, total_tokens: 210 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const key = `sk-proj-${"b".repeat(40)}`;
  const result = await runOpenAIResponsesAgent(request, { apiKey: key, fetchImpl, timeoutMs: 2_000 });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].input.some((item) => item.type === "function_call_output"));
  assert.deepEqual(result.envelope, safeEnvelope);
  assert.doesNotMatch(JSON.stringify(result), /sk-proj/);
});

test("upstream failures and key probes never echo BYOK credentials", async () => {
  const key = `sk-proj-${"c".repeat(40)}`;
  const rejectingFetch = async () => new Response(JSON.stringify({ error: { message: `Invalid ${key}` } }), { status: 401 });
  await assert.rejects(() => runOpenAIResponsesAgent(request, { apiKey: key, fetchImpl: rejectingFetch }), (error) => {
    assert.doesNotMatch(String(error), /sk-proj/); return true;
  });
  const probeFetch = async () => new Response(JSON.stringify({ id: "gpt-5.6" }), { status: 200, headers: { "content-type": "application/json" } });
  assert.deepEqual(await probeOpenAIKey("gpt-5.6", key, probeFetch), { ok: true, model: "gpt-5.6" });
});

test("BYOK interface keeps the key in component memory and discloses the transmission boundary", () => {
  const source = fs.readFileSync(new URL("../components/CodexAgentWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /type="password"/);
  assert.match(source, /autoComplete="off"/);
  assert.match(source, /x-evidence-openai-key/);
  assert.match(source, /raw IFC\/PDF files are excluded/);
  assert.match(source, /setApiKey\(""\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
});

test("agent routes enforce actual body size, same origin and no-store responses", () => {
  const route = fs.readFileSync(new URL("../app/api/agent/route.ts", import.meta.url), "utf8");
  assert.match(route, /assertSameOrigin/);
  assert.match(route, /TextEncoder/);
  assert.match(route, /cache-control.*no-store/);
});

test("agent route rejects invalid BYOK and oversized bodies without contacting OpenAI", async () => {
  const { POST } = await import("../app/api/agent/route.ts");
  const invalidKey = await POST(new Request("https://assessment.example/api/agent", { method: "POST", headers: { origin: "https://assessment.example", "content-type": "application/json", "oai-authenticated-user-email": "reviewer@example.com", "x-evidence-agent-auth": "byok", "x-evidence-openai-key": "not-a-key", "x-forwarded-for": `invalid-key-${Date.now()}` }, body: JSON.stringify(request) }));
  assert.equal(invalidKey.status, 401);
  assert.doesNotMatch(await invalidKey.text(), /authorization|Bearer/i);
  const oversized = await POST(new Request("https://assessment.example/api/agent", { method: "POST", headers: { origin: "https://assessment.example", "oai-authenticated-user-email": "reviewer@example.com", "x-forwarded-for": `oversized-${Date.now()}` }, body: "x".repeat(1_000_001) }));
  assert.equal(oversized.status, 413);
});

test("agent route rejects anonymous requests before processing model context", async () => {
  const { POST } = await import("../app/api/agent/route.ts");
  const response = await POST(new Request("https://assessment.example/api/agent", { method: "POST", headers: { origin: "https://assessment.example" }, body: JSON.stringify(request) }));
  assert.equal(response.status, 401);
  assert.match(await response.text(), /AUTH_REQUIRED/);
});
