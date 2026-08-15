import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("review UI keeps machine verdict separate and exposes preview-confirm-undo", async () => {
  const source = `${await readFile(new URL("../components/HumanReviewPanel.tsx", import.meta.url), "utf8")}\n${await readFile(new URL("../app/page.tsx", import.meta.url), "utf8")}`;
  for (const label of ["Machine verdict", "Human review", "Preview impact", "Confirm and rerun checks", "Undo latest correction", "人工复核", "预览影响"]) assert.ok(source.includes(label), `missing ${label}`);
  assert.doesNotMatch(source, /setMachineVerdict|overrideVerdict/);
});

test("agent composer exposes agent-provider-model controls and session-only BYOK", async () => {
  const source = await readFile(new URL("../components/CodexAgentWorkspace.tsx", import.meta.url), "utf8");
  for (const label of ["Select agent", "Select provider", "Select model", "Shift+Enter", "Proposal only", "选择模型", "type=\"password\"", "Clear key", "My session API key", "https://platform.openai.com/api-keys"]) assert.ok(source.includes(label), `missing ${label}`);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
});
