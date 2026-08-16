import type { RuleDefinition } from "./compliance";
import type { ElementEvidenceOverride, HumanReviewRecord } from "./human-review";
import type { RulePackage } from "./rule-packages";

export type AuditEvent = { id: string; at: string; actor: "user" | "orchestrator" | "model-intake" | "document-agent" | "rule-agent" | "rule-engine" | "verifier" | "report-agent"; kind: string; summary: string; evidence?: string };
export type ProjectMemory = { projectId: string; jurisdiction: string; reportLanguage: "en" | "zh"; rules: RuleDefinition[]; decisions: { at: string; decision: string; ruleId: string }[]; events: AuditEvent[]; reportBrief?: Record<string, unknown>; reportMessages?: { role: "agent" | "user"; text: string }[]; humanReviews?: HumanReviewRecord[]; evidenceOverrides?: ElementEvidenceOverride[]; rulePackages?: RulePackage[]; selectedRulePackageId?: string; agentSelection?: { agentId: string; providerId: string; modelId: string } };

const key = (projectId: string) => `evidence-agent:memory:${projectId}`;
export function emptyMemory(projectId = "assessment-workspace"): ProjectMemory { return { projectId, jurisdiction: "Project", reportLanguage: "en", rules: [], decisions: [], events: [] }; }
export function loadMemory(projectId = "assessment-workspace"): ProjectMemory {
  if (typeof window === "undefined") return emptyMemory(projectId);
  try { const value = localStorage.getItem(key(projectId)); return value ? JSON.parse(value) as ProjectMemory : emptyMemory(projectId); } catch { return emptyMemory(projectId); }
}
export function saveMemory(memory: ProjectMemory): void { if (typeof window !== "undefined") localStorage.setItem(key(memory.projectId), JSON.stringify(memory)); }
export function clearMemory(projectId = "assessment-workspace"): void { if (typeof window !== "undefined") localStorage.removeItem(key(projectId)); }
export function audit(actor: AuditEvent["actor"], kind: string, summary: string, evidence?: string): AuditEvent { return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), actor, kind, summary, evidence }; }
