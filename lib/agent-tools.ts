import type { AgentContext } from "./agent-contract.ts";

export const agentToolDefinitions = [
  {
    type: "function", name: "inspect_selected_finding", description: "Read one existing deterministic finding and its evidence. This never changes the finding.", strict: true,
    parameters: { type: "object", properties: { elementId: { type: "string", description: "Existing IFC GlobalId from the supplied context." } }, required: ["elementId"], additionalProperties: false },
  },
  {
    type: "function", name: "summarise_review_state", description: "Count existing deterministic findings by status. This is read-only.", strict: true,
    parameters: { type: "object", properties: { statusFilter: { type: "string", enum: ["ALL", "PASS", "FAIL", "REVIEW", "NOT_APPLICABLE"] } }, required: ["statusFilter"], additionalProperties: false },
  },
  {
    type: "function", name: "draft_evidence_correction", description: "Create an uncommitted evidence-correction proposal for Human Review. Never apply it.", strict: true,
    parameters: { type: "object", properties: { elementId: { type: "string" }, field: { type: "string", enum: ["clearWidth", "fireRating", "name", "isExit"] }, value: { type: "string" }, source: { type: "string" } }, required: ["elementId", "field", "value", "source"], additionalProperties: false },
  },
  {
    type: "function", name: "draft_rule_change", description: "Create an uncommitted rule proposal for Rule Studio. Never activate or replace a rule.", strict: true,
    parameters: { type: "object", properties: { requirement: { type: "string" }, target: { type: "string", enum: ["IfcDoor", "IfcSpace"] }, scope: { type: "string" } }, required: ["requirement", "target", "scope"], additionalProperties: false },
  },
  {
    type: "function", name: "draft_report_brief", description: "Create an editable report-brief proposal. Never rewrite findings or verdicts.", strict: true,
    parameters: { type: "object", properties: { audience: { type: "string" }, language: { type: "string", enum: ["en", "zh", "bilingual"] }, focus: { type: "string" } }, required: ["audience", "language", "focus"], additionalProperties: false },
  },
] as const;

type ToolResult = Record<string, unknown> & { proposalOnly?: boolean };
const text = (value: unknown, max = 2_000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function executeAgentTool(name: string, args: Record<string, unknown>, context: AgentContext): ToolResult {
  if (name === "inspect_selected_finding") {
    const finding = context.findings.find((item) => item.elementId === text(args.elementId, 160));
    return finding ? { found: true, finding } : { found: false, error: "Element is absent from the supplied deterministic findings." };
  }
  if (name === "summarise_review_state") {
    const filter = text(args.statusFilter, 30); const findings = filter === "ALL" ? context.findings : context.findings.filter((item) => item.status === filter);
    return { total: findings.length, counts: Object.fromEntries(["PASS", "FAIL", "REVIEW", "NOT_APPLICABLE"].map((status) => [status, findings.filter((item) => item.status === status).length])), reviewCount: context.reviewCount, overrideCount: context.overrideCount };
  }
  if (name === "draft_evidence_correction") {
    const elementId = text(args.elementId, 160); const finding = context.findings.find((item) => item.elementId === elementId);
    return { proposalOnly: true, kind: "evidence", validTarget: Boolean(finding), elementId, field: text(args.field, 80), value: text(args.value), source: text(args.source), currentFinding: finding ?? null, instruction: "Send to Human Review for named reviewer, provenance, impact preview and confirmation." };
  }
  if (name === "draft_rule_change") return { proposalOnly: true, kind: "rule", requirement: text(args.requirement), target: text(args.target, 80), scope: text(args.scope), existingRules: context.rules.map((rule) => ({ id: rule.id, version: rule.version, threshold: rule.threshold, unit: rule.unit, scope: rule.scope, status: rule.status })), instruction: "Send to Rule Studio for feasibility, conflict review and explicit activation decision." };
  if (name === "draft_report_brief") return { proposalOnly: true, kind: "report", audience: text(args.audience, 300), language: text(args.language, 30), focus: text(args.focus), instruction: "Send to the editable Report Brief; findings remain immutable." };
  return { error: "Unknown or unauthorised tool." };
}
