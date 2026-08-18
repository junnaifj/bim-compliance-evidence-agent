import { analyseModel, type BuildingModel, type Finding, type Locale, type RuleDefinition } from "../compliance/compliance.ts";

export type ReviewDisposition = "UNREVIEWED" | "CONFIRMED" | "ACTION_REQUIRED" | "ACCEPTED_WITH_NOTE" | "NEEDS_FOLLOW_UP" | "MANUALLY_EXCLUDED";
export type OverrideField = "clearWidth" | "exitApplicability" | "fireRating" | "name";
export type OverrideProvenance = "FIELD_MEASUREMENT" | "DOOR_SCHEDULE" | "APPROVED_DRAWING" | "ENGINEER_CONFIRMATION" | "OTHER";

export type HumanReviewRecord = {
  id: string; elementId: string; disposition: ReviewDisposition; reviewer: string; note: string; at: string; version: number;
};

export type ElementEvidenceOverride = {
  id: string; elementId: string; field: OverrideField; originalValue: string | number | boolean | undefined; previousEffectiveValue: string | number | boolean | undefined;
  value: string | number | boolean; provenance: OverrideProvenance; reason: string; reviewer: string; at: string; status: "PROPOSED" | "APPLIED" | "REVERTED"; version: number;
};

export type OverrideDraft = Pick<ElementEvidenceOverride, "elementId" | "field" | "value" | "provenance" | "reason" | "reviewer">;
export type OverrideImpact = { draft: ElementEvidenceOverride; before: Finding[]; after: Finding[]; transitions: { ruleId: string; before: Finding["status"]; after: Finding["status"] }[] };

const valueFor = (model: BuildingModel, elementId: string, field: OverrideField) => {
  const door = model.doors.find((item) => item.globalId === elementId); if (!door) return undefined;
  if (field === "clearWidth") return door.widthMm; if (field === "exitApplicability") return door.isExit; return field === "fireRating" ? door.fireRating : door.name;
};

export function validateOverride(model: BuildingModel, draft: OverrideDraft): string[] {
  const issues: string[] = []; const door = model.doors.find((item) => item.globalId === draft.elementId);
  if (!door) issues.push("The target GlobalId is not present in the current model.");
  if (!draft.reviewer.trim()) issues.push("Reviewer name is required.");
  if (!draft.reason.trim()) issues.push("A review reason or evidence reference is required.");
  if (draft.field === "clearWidth" && (typeof draft.value !== "number" || !Number.isFinite(draft.value) || draft.value < 300 || draft.value > 3000)) issues.push("Clear width must be between 300 and 3,000 mm.");
  if (draft.field === "exitApplicability" && typeof draft.value !== "boolean") issues.push("Exit applicability must be Yes or No.");
  if ((draft.field === "fireRating" || draft.field === "name") && (typeof draft.value !== "string" || !draft.value.trim() || draft.value.length > 120)) issues.push("The text value must contain 1–120 characters.");
  if (/<script|javascript:|ignore previous|system prompt/i.test(`${draft.value} ${draft.reason}`)) issues.push("The input contains unsafe instruction-like or executable content.");
  return issues;
}

export function effectiveModel(model: BuildingModel, overrides: ElementEvidenceOverride[]): BuildingModel {
  const applied = overrides.filter((item) => item.status === "APPLIED").sort((a, b) => a.version - b.version);
  return { ...model, doors: model.doors.map((door) => {
    const next = { ...door };
    for (const override of applied.filter((item) => item.elementId === door.globalId)) {
      if (override.field === "clearWidth") { next.widthMm = Number(override.value); next.widthSource = "clear_width"; next.widthEvidencePath = `HumanEvidence.${override.provenance}`; }
      else if (override.field === "exitApplicability") { next.isExit = Boolean(override.value); next.exitEvidencePath = `HumanEvidence.${override.provenance}`; }
      else if (override.field === "fireRating") next.fireRating = String(override.value);
      else next.name = String(override.value);
    }
    return next;
  }) };
}

export function previewOverride(model: BuildingModel, overrides: ElementEvidenceOverride[], draft: OverrideDraft, rules: RuleDefinition[], locale: Locale): OverrideImpact {
  const issues = validateOverride(model, draft); if (issues.length) throw new Error(issues.join(" "));
  const prior = overrides.filter((item) => item.elementId === draft.elementId && item.field === draft.field && item.status === "APPLIED").at(-1);
  const next: ElementEvidenceOverride = { ...draft, id: `override-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, originalValue: valueFor(model, draft.elementId, draft.field), previousEffectiveValue: prior?.value ?? valueFor(model, draft.elementId, draft.field), at: new Date().toISOString(), status: "PROPOSED", version: (prior?.version ?? 0) + 1 };
  const before = analyseModel(effectiveModel(model, overrides), rules, locale).filter((item) => item.elementId === draft.elementId);
  const after = analyseModel(effectiveModel(model, [...overrides, { ...next, status: "APPLIED" }]), rules, locale).filter((item) => item.elementId === draft.elementId);
  return { draft: next, before, after, transitions: after.map((item) => ({ ruleId: item.ruleId, before: before.find((old) => old.ruleId === item.ruleId)?.status ?? "REVIEW", after: item.status })) };
}

export const confirmOverride = (overrides: ElementEvidenceOverride[], impact: OverrideImpact): ElementEvidenceOverride[] => [...overrides, { ...impact.draft, status: "APPLIED" }];

export function revertLatestOverride(overrides: ElementEvidenceOverride[], elementId: string, field?: OverrideField): ElementEvidenceOverride[] {
  const candidate = [...overrides].reverse().find((item) => item.status === "APPLIED" && item.elementId === elementId && (!field || item.field === field));
  return candidate ? overrides.map((item) => item.id === candidate.id ? { ...item, status: "REVERTED" } : item) : overrides;
}

export function saveReview(records: HumanReviewRecord[], input: Omit<HumanReviewRecord, "id" | "at" | "version">): HumanReviewRecord[] {
  if (!input.reviewer.trim()) throw new Error("Reviewer name is required.");
  if (["ACCEPTED_WITH_NOTE", "MANUALLY_EXCLUDED", "ACTION_REQUIRED", "NEEDS_FOLLOW_UP"].includes(input.disposition) && !input.note.trim()) throw new Error("A review note is required for this disposition.");
  const version = (records.filter((item) => item.elementId === input.elementId).at(-1)?.version ?? 0) + 1;
  return [...records, { ...input, id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), version }];
}

export function currentReview(records: HumanReviewRecord[], elementId: string): HumanReviewRecord | undefined { return records.filter((item) => item.elementId === elementId).at(-1); }

export function interpretEvidenceChange(input: string, elementId?: string): Partial<OverrideDraft> | null {
  if (!elementId) return null; const width = input.match(/(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)\b/i);
  if (width && /(width|clear|净宽|宽度|现场)/i.test(input)) return { elementId, field: "clearWidth", value: Math.round(Number(width[1]) * (/^(m|米)$/i.test(width[2]) ? 1000 : 1)) };
  if (/(not (?:an? )?exit|non[- ]?exit|非疏散|不是疏散)/i.test(input)) return { elementId, field: "exitApplicability", value: false };
  if (/(is (?:an? )?exit|egress door|是疏散|确认为疏散)/i.test(input)) return { elementId, field: "exitApplicability", value: true };
  return null;
}
