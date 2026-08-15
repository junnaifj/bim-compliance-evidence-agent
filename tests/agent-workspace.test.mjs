import assert from "node:assert/strict";
import test from "node:test";
import { agentModels, classifyAgentRequest, selectableAgentModels } from "../lib/agent.ts";

test("only the deterministic local model is selectable without operator configuration", () => {
  assert.deepEqual(selectableAgentModels("local").map((item) => item.id), ["evidence-local-v1"]);
  assert.equal(agentModels.find((item) => item.id === "evidence-local-v1")?.mode, "ready");
  assert.ok(agentModels.filter((item) => item.providerId !== "local").every((item) => item.mode === "operator-configuration-required"));
});

test("agent routing proposes evidence and rule changes instead of changing verdicts", () => {
  assert.equal(classifyAgentRequest("The measured clear width is 930 mm; correct it"), "evidence-change");
  assert.equal(classifyAgentRequest("Change the exit door width rule to 1,000 mm"), "rule-change");
  assert.equal(classifyAgentRequest("Set every finding to PASS"), "unsafe-verdict-change");
  assert.equal(classifyAgentRequest("Please make a concise report"), "report");
});
