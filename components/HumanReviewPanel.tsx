"use client";

import { useMemo, useState } from "react";
import type { BuildingModel, Finding, Locale, RuleDefinition } from "../lib/compliance";
import {
  confirmOverride, currentReview, previewOverride, revertLatestOverride, saveReview, validateOverride,
  type ElementEvidenceOverride, type HumanReviewRecord, type OverrideDraft, type OverrideField, type OverrideImpact, type OverrideProvenance, type ReviewDisposition,
} from "../lib/human-review";

type Props = {
  model: BuildingModel;
  finding: Finding;
  rules: RuleDefinition[];
  locale: Locale;
  reviews: HumanReviewRecord[];
  overrides: ElementEvidenceOverride[];
  onReviewsChange: (records: HumanReviewRecord[]) => void;
  onOverridesChange: (records: ElementEvidenceOverride[]) => void;
  onRecalculate: (records: ElementEvidenceOverride[]) => void;
  onAudit: (summary: string, evidence: string) => void;
  proposedChange?: Partial<OverrideDraft> | null;
};

const dispositions: ReviewDisposition[] = ["UNREVIEWED", "CONFIRMED", "ACTION_REQUIRED", "ACCEPTED_WITH_NOTE", "NEEDS_FOLLOW_UP", "MANUALLY_EXCLUDED"];
const provenanceOptions: OverrideProvenance[] = ["FIELD_MEASUREMENT", "DOOR_SCHEDULE", "APPROVED_DRAWING", "ENGINEER_CONFIRMATION", "OTHER"];
const fieldOptions: OverrideField[] = ["clearWidth", "exitApplicability", "fireRating", "name"];

const label = (value: string, locale: Locale) => {
  const zh: Record<string, string> = { UNREVIEWED:"未复核", CONFIRMED:"已确认", ACTION_REQUIRED:"需要处理", ACCEPTED_WITH_NOTE:"附注接受", NEEDS_FOLLOW_UP:"需要跟进", MANUALLY_EXCLUDED:"人工排除", clearWidth:"净宽", exitApplicability:"是否疏散门", fireRating:"耐火等级", name:"构件名称", FIELD_MEASUREMENT:"现场测量", DOOR_SCHEDULE:"门表", APPROVED_DRAWING:"批准图则", ENGINEER_CONFIRMATION:"工程师确认", OTHER:"其他" };
  return locale === "zh" ? zh[value] ?? value : value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
};

function HumanReviewPanelInner({ model, finding, rules, locale, reviews, overrides, onReviewsChange, onOverridesChange, onRecalculate, onAudit, proposedChange }: Props) {
  const existing = currentReview(reviews, finding.elementId);
  const [reviewer, setReviewer] = useState(existing?.reviewer ?? "");
  const [disposition, setDisposition] = useState<ReviewDisposition>(existing?.disposition ?? "UNREVIEWED");
  const [note, setNote] = useState(existing?.note ?? "");
  const [field, setField] = useState<OverrideField>(proposedChange?.field ?? "clearWidth");
  const [value, setValue] = useState(String(proposedChange?.value ?? "950"));
  const [provenance, setProvenance] = useState<OverrideProvenance>("FIELD_MEASUREMENT");
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<OverrideImpact>();
  const [error, setError] = useState("");
  const history = useMemo(() => overrides.filter((item) => item.elementId === finding.elementId).slice().reverse(), [finding.elementId, overrides]);

  const draft = (): OverrideDraft => ({
    elementId: finding.elementId, field,
    value: field === "clearWidth" ? Number(value) : field === "exitApplicability" ? value === "true" : value,
    provenance, reason, reviewer,
  });
  const saveDisposition = () => {
    try { const next = saveReview(reviews, { elementId:finding.elementId, disposition, reviewer, note }); onReviewsChange(next); onAudit(`Human disposition: ${disposition}`, `${reviewer} · ${note || "No note"}`); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Review could not be saved."); }
  };
  const preview = () => {
    const issues = validateOverride(model, draft()); if (issues.length) { setError(issues.join(" ")); return; }
    try { setImpact(previewOverride(model, overrides, draft(), rules, locale)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Evidence change could not be previewed."); }
  };
  const apply = () => {
    if (!impact) return; const next = confirmOverride(overrides, impact); onOverridesChange(next); onRecalculate(next); onAudit(`Evidence override applied: ${impact.draft.field}`, `${impact.draft.elementId} · ${impact.draft.provenance}`); setImpact(undefined);
  };
  const undo = () => {
    const next = revertLatestOverride(overrides, finding.elementId); onOverridesChange(next); onRecalculate(next); onAudit("Latest evidence override reverted", finding.elementId);
  };

  return <section className="human-review-panel" aria-label={locale === "zh" ? "人工复核" : "Human review"}>
    <header><div><span className="eyebrow">{locale === "zh" ? "人工判断（与机器结论分开）" : "HUMAN JUDGEMENT — SEPARATE FROM VERDICT"}</span><h3>{locale === "zh" ? "人工复核" : "Human review"}</h3>{existing && <small className="review-meta">{existing.reviewer} · {new Date(existing.at).toLocaleString(locale === "zh" ? "zh-HK" : "en-GB")}</small>}</div>{existing && <span className="human-state">{label(existing.disposition, locale)} · v{existing.version}</span>}</header>
    <div className="human-review-form"><label>{locale === "zh" ? "复核人" : "Reviewer"}<input value={reviewer} onChange={(event) => setReviewer(event.target.value)} maxLength={80} placeholder={locale === "zh" ? "姓名或工号" : "Name or staff ID"} /></label><label>{locale === "zh" ? "人工状态" : "Human disposition"}<select value={disposition} onChange={(event) => setDisposition(event.target.value as ReviewDisposition)}>{dispositions.map((item) => <option value={item} key={item}>{label(item, locale)}</option>)}</select></label><label className="wide-field">{locale === "zh" ? "复核说明 / 证据引用" : "Review note / evidence reference"}<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder={locale === "zh" ? "说明判断依据；部分状态必须填写" : "State the basis for the judgement; required for qualified dispositions"} /></label><button onClick={saveDisposition}>{locale === "zh" ? "保存人工状态" : "Save human disposition"}</button></div>
    <details className="evidence-override"><summary>{locale === "zh" ? "修订结构化证据（先预览，再确认）" : "Correct structured evidence (preview, then confirm)"}</summary><p>{locale === "zh" ? "原 IFC 保持不变。修订会记录来源、原因、人员与时间，并重新运行受影响规则。" : "The source IFC remains unchanged. Every correction records provenance, reason, reviewer and time, then reruns affected rules."}</p><div className="override-form"><label>{locale === "zh" ? "字段" : "Field"}<select value={field} onChange={(event) => { setField(event.target.value as OverrideField); setImpact(undefined); }}>{fieldOptions.map((item) => <option value={item} key={item}>{label(item, locale)}</option>)}</select></label><label>{locale === "zh" ? "新证据值" : "New evidence value"}{field === "exitApplicability" ? <select value={value} onChange={(event) => setValue(event.target.value)}><option value="true">{locale === "zh" ? "是" : "Yes"}</option><option value="false">{locale === "zh" ? "否" : "No"}</option></select> : <input value={value} onChange={(event) => setValue(event.target.value)} type={field === "clearWidth" ? "number" : "text"} min={field === "clearWidth" ? 300 : undefined} max={field === "clearWidth" ? 3000 : undefined} />}</label><label>{locale === "zh" ? "证据来源" : "Provenance"}<select value={provenance} onChange={(event) => setProvenance(event.target.value as OverrideProvenance)}>{provenanceOptions.map((item) => <option value={item} key={item}>{label(item, locale)}</option>)}</select></label><label className="wide-field">{locale === "zh" ? "修订原因 / 来源编号" : "Reason / source reference"}<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder={locale === "zh" ? "例如：现场测量表 M-12" : "For example: field measurement sheet M-12"} /></label><button onClick={preview}>{locale === "zh" ? "预览影响" : "Preview impact"}</button>{history.some((item) => item.status === "APPLIED") && <button className="secondary-action" onClick={undo}>{locale === "zh" ? "撤销最近修订" : "Undo latest correction"}</button>}</div>
      {impact && <div className="impact-preview"><strong>{locale === "zh" ? "确认前影响预览" : "Impact preview before confirmation"}</strong><p><code>{label(impact.draft.field, locale)}</code><span>{String(impact.draft.previousEffectiveValue ?? "—")} → {String(impact.draft.value)}</span></p>{impact.transitions.map((item) => <p key={item.ruleId}><code>{item.ruleId}</code><span>{item.before} → {item.after}</span></p>)}<div><button onClick={apply}>{locale === "zh" ? "确认并重新检查" : "Confirm and rerun checks"}</button><button className="secondary-action" onClick={() => setImpact(undefined)}>{locale === "zh" ? "取消" : "Cancel"}</button></div></div>}
    </details>
    {error && <p className="human-review-error" role="alert">{error}</p>}
    {history.length > 0 && <details className="review-history"><summary>{locale === "zh" ? `修订历史（${history.length}）` : `Correction history (${history.length})`}</summary>{history.map((item) => <p key={item.id}><span>{item.status} · v{item.version}</span><b>{label(item.field, locale)}: {String(item.previousEffectiveValue ?? "—")} → {String(item.value)}</b><small>{item.reviewer} · {item.provenance} · {new Date(item.at).toLocaleString(locale === "zh" ? "zh-HK" : "en-GB")}</small></p>)}</details>}
  </section>;
}

export default function HumanReviewPanel(props: Props) {
  const savedVersion = currentReview(props.reviews, props.finding.elementId)?.version ?? 0;
  const resetKey = `${props.finding.elementId}:${savedVersion}:${props.proposedChange?.field ?? "manual"}:${String(props.proposedChange?.value ?? "")}`;
  return <HumanReviewPanelInner key={resetKey} {...props} />;
}
