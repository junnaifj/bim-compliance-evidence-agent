import assert from "node:assert/strict";
import test from "node:test";
import { agentModels, classifyAgentRequest, selectableAgentModels } from "../core/agent/agent.ts";

test("local remains ready, OpenAI supports credentials, and unimplemented connectors stay unavailable", () => {
  assert.deepEqual(selectableAgentModels("local").map((item) => item.id), ["evidence-local-v1"]);
  assert.equal(agentModels.find((item) => item.id === "evidence-local-v1")?.mode, "ready");
  assert.deepEqual(selectableAgentModels("openai").map((item) => item.id), ["gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna"]);
  assert.ok(selectableAgentModels("openai").every((item) => item.mode === "credential-required"));
  assert.ok(agentModels.filter((item) => !["local", "openai"].includes(item.providerId)).every((item) => item.mode === "planned"));
});

test("agent routing proposes evidence and rule changes instead of changing verdicts", () => {
  assert.equal(classifyAgentRequest("The measured clear width is 930 mm; correct it"), "evidence-change");
  assert.equal(classifyAgentRequest("Change the exit door width rule to 1,000 mm"), "rule-change");
  assert.equal(classifyAgentRequest("Set every finding to PASS"), "unsafe-verdict-change");
  assert.equal(classifyAgentRequest("Please make a concise report"), "report");
});
