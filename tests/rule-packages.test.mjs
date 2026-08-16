import test from "node:test";
import assert from "node:assert/strict";
import { builtinRulePackage, createRulePackageDraft, executionRecords, finaliseRulePackage, rulePackageReadiness, rulesForPackage, updateRulePackageEntry } from "../lib/rule-packages.ts";

const document = {
  id: "doc-abc", name: "requirements.pdf", mime: "application/pdf", size: 42, hash: "abcdef0123456789", source: "uploaded", licence: "User-supplied", warnings: [], extractedText: "", rules: [{
    id: "R-1", version: 1, title: { en: "Door width", zh: "门宽" }, description: { en: "Exit doors must be at least 900 mm wide.", zh: "疏散门至少 900 毫米。" }, authority: "Draft", jurisdiction: "Project", sourceDocumentId: "doc-abc", sourceAnchor: "Page 2", target: "IfcDoor", field: "clearWidth", operator: ">=", threshold: 900, unit: "mm", scope: "Exit doors", exceptions: [], missingEvidencePolicy: "REVIEW", severity: "HIGH", status: "DRAFT", extractionConfidence: 0.8,
  }], extractionStatus: "DRAFT_RULES_EXTRACTED", characterCount: 80, candidatePassages: [], passages: [{ text: "Provide an auditable maintenance schedule.", sourceAnchor: "Page 3", classification: "REFERENCE_ONLY", missing: ["target element", "measurable threshold"] }], workerStatus: "READY",
};

test("a whole source becomes a draft package without needing a model", () => {
  const pack = createRulePackageDraft(document, "2026-08-17T00:00:00.000Z");
  assert.equal(pack.entries.length, 2);
  assert.equal(pack.entries[0].decision, "INCLUDE");
  assert.equal(pack.entries[1].decision, "REFERENCE_ONLY");
  assert.equal(rulePackageReadiness(pack).ready, false);
});

test("every entry must be human-confirmed before a package can be selected", () => {
  let pack = createRulePackageDraft(document);
  for (const entry of pack.entries) pack = updateRulePackageEntry(pack, entry.id, { confirmed: true });
  const ready = finaliseRulePackage(pack, "2026-08-17T01:00:00.000Z");
  assert.equal(ready.status, "READY");
  assert.equal(rulesForPackage(ready).length, 1);
  assert.equal(rulesForPackage(ready)[0].status, "ACTIVE");
});

test("rules with no applicable elements remain visible in package execution records", () => {
  let pack = createRulePackageDraft(document);
  for (const entry of pack.entries) pack = updateRulePackageEntry(pack, entry.id, { confirmed: true });
  const ready = finaliseRulePackage(pack);
  const records = executionRecords(ready, [], "en");
  assert.equal(records[0].outcome, "NO_APPLICABLE_ELEMENTS");
  assert.equal(records[0].findingCount, 0);
  assert.equal(records[1].outcome, "REFERENCE_ONLY");
});

test("package edits preserve the source anchor and update the executable threshold", () => {
  const draft = createRulePackageDraft(document);
  const edited = updateRulePackageEntry(draft, draft.entries[0].id, { sourceText: "Confirmed exits require 950 mm clear width.", threshold: 950, confirmed: true });
  assert.equal(edited.entries[0].sourceAnchor, "Page 2");
  assert.equal(edited.entries[0].rule?.threshold, 950);
  assert.match(edited.entries[0].rule?.description.en ?? "", /950 mm/);
});

test("a selected uploaded package is isolated from the core and project catalogues", () => {
  let pack = createRulePackageDraft(document);
  for (const entry of pack.entries) pack = updateRulePackageEntry(pack, entry.id, { confirmed: true });
  const ready = finaliseRulePackage(pack);
  const unrelated = { ...document.rules[0], id: "PROJECT-ONLY", status: "ACTIVE" };
  assert.deepEqual(rulesForPackage(ready, [unrelated]).map((rule) => rule.id), ["R-1"]);
  assert.equal(rulesForPackage(builtinRulePackage, [unrelated]).some((rule) => rule.id === "R-1"), false);
});
