import assert from "node:assert/strict";
import test from "node:test";
import { buildReport, builtinRules, verifyReport } from "../lib/compliance.ts";
import { confirmOverride, currentReview, effectiveModel, interpretEvidenceChange, previewOverride, revertLatestOverride, saveReview, validateOverride } from "../lib/human-review.ts";

const model = { id:"m", name:"Review fixture", filename:"m.ifc", schema:"IFC4", units:"mm", storeys:1, source:"uploaded", spaces:[], doors:[{ expressId:1, globalId:"DOOR-GLOBAL-ID-00000001", name:"D1", widthMm:800, widthSource:"overall_width_proxy", isExit:true }] };
const validDraft = { elementId:model.doors[0].globalId, field:"clearWidth", value:930, provenance:"FIELD_MEASUREMENT", reason:"Site measurement sheet M-12", reviewer:"A. Reviewer" };

test("override validation requires a current target, reviewer, reason and plausible value", () => {
  assert.deepEqual(validateOverride(model, validDraft), []);
  assert.ok(validateOverride(model, { ...validDraft, value:20, reason:"", reviewer:"" }).length >= 3);
  assert.match(validateOverride(model, { ...validDraft, elementId:"INVENTED" }).join(" "), /current model/);
});

test("an evidence override previews impact and applies only after confirmation", () => {
  const impact = previewOverride(model, [], validDraft, builtinRules, "en");
  assert.equal(impact.draft.status, "PROPOSED"); assert.equal(impact.before[0].status, "REVIEW"); assert.equal(impact.after[0].status, "PASS");
  assert.equal(effectiveModel(model, []).doors[0].widthMm, 800);
  const applied = confirmOverride([], impact); const effective = effectiveModel(model, applied);
  assert.equal(effective.doors[0].widthMm, 930); assert.equal(effective.doors[0].widthEvidencePath, "HumanEvidence.FIELD_MEASUREMENT"); assert.equal(model.doors[0].widthMm, 800);
});

test("revert restores source evidence without mutating the IFC-derived model", () => {
  const applied = confirmOverride([], previewOverride(model, [], validDraft, builtinRules, "en")); const reverted = revertLatestOverride(applied, model.doors[0].globalId);
  assert.equal(effectiveModel(model, reverted).doors[0].widthMm, 800); assert.equal(reverted[0].status, "REVERTED"); assert.equal(model.doors[0].widthMm, 800);
});

test("human disposition remains separate and notes are required for judgement calls", () => {
  const records = saveReview([], { elementId:model.doors[0].globalId, disposition:"CONFIRMED", reviewer:"A. Reviewer", note:"" });
  assert.equal(currentReview(records, model.doors[0].globalId)?.disposition, "CONFIRMED");
  assert.throws(() => saveReview(records, { elementId:model.doors[0].globalId, disposition:"ACCEPTED_WITH_NOTE", reviewer:"A. Reviewer", note:"" }), /note is required/);
});

test("agent language becomes a proposal and cannot target an absent element", () => {
  assert.deepEqual(interpretEvidenceChange("The measured clear width is 0.93 m", model.doors[0].globalId), { elementId:model.doors[0].globalId, field:"clearWidth", value:930 });
  assert.equal(interpretEvidenceChange("Set everything to pass", undefined), null);
});

test("verified reports disclose human disposition and applied correction separately", () => {
  const impact = previewOverride(model, [], validDraft, builtinRules, "en"); const applied = confirmOverride([], impact); const findings = impact.after;
  const report = buildReport(effectiveModel(model, applied), findings, "en", { reviews:[{ elementId:model.doors[0].globalId, disposition:"CONFIRMED" }], overrides:applied });
  assert.match(report, /Human review and evidence corrections/); assert.match(report, /human disposition CONFIRMED/); assert.match(report, /clearWidth · FIELD_MEASUREMENT/);
  assert.equal(verifyReport(report, findings).valid, true);
});
