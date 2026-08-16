import { builtinRules, type Finding, type Locale, type RuleDefinition } from "./compliance.ts";
import type { RequirementPassage, RuleDocument } from "./document-intelligence.ts";

export type RulePackageDecision = "INCLUDE" | "REFERENCE_ONLY" | "EXCLUDE";
export type RulePackageStatus = "DRAFT" | "READY";

export type RulePackageEntry = {
  id: string;
  sourceAnchor: string;
  sourceText: string;
  classification: RequirementPassage["classification"];
  decision: RulePackageDecision;
  confirmed: boolean;
  reviewerNote: string;
  rule?: RuleDefinition;
};

export type RulePackage = {
  id: string;
  name: string;
  version: number;
  status: RulePackageStatus;
  sourceDocumentId: string;
  sourceName: string;
  sourceHash: string;
  sourceLicence: string;
  createdAt: string;
  confirmedAt?: string;
  entries: RulePackageEntry[];
};

export type RuleExecutionRecord = {
  entryId: string;
  ruleId?: string;
  title: string;
  decision: RulePackageDecision;
  outcome: "EXECUTED" | "NO_APPLICABLE_ELEMENTS" | "REFERENCE_ONLY" | "EXCLUDED";
  findingCount: number;
};

const normalise = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

export const builtinRulePackage: RulePackage = {
  id: "package-assessment-core",
  name: "Assessment core evidence checks",
  version: 1,
  status: "READY",
  sourceDocumentId: "assessment-pack",
  sourceName: "Assessment core",
  sourceHash: "built-in",
  sourceLicence: "Project-authored",
  createdAt: "2026-08-15T00:00:00.000Z",
  confirmedAt: "2026-08-15T00:00:00.000Z",
  entries: builtinRules.map((rule, index) => ({ id: `assessment-core-${index + 1}`, sourceAnchor: rule.sourceAnchor, sourceText: rule.description.en, classification: "EXECUTABLE", decision: "INCLUDE", confirmed: true, reviewerNote: "Built-in assessment rule", rule })),
};

export function createRulePackageDraft(document: RuleDocument, now = new Date().toISOString()): RulePackage {
  const entries: RulePackageEntry[] = document.rules.map((rule, index) => ({
    id: `${document.id}-rule-${index + 1}`,
    sourceAnchor: rule.sourceAnchor,
    sourceText: rule.description.en,
    classification: "EXECUTABLE",
    decision: "INCLUDE",
    confirmed: false,
    reviewerNote: "",
    rule: { ...rule, status: "DRAFT" },
  }));
  const knownText = new Set(entries.map((entry) => normalise(entry.sourceText)));
  for (const [index, passage] of document.passages.entries()) {
    if (knownText.has(normalise(passage.text))) continue;
    entries.push({
      id: `${document.id}-passage-${index + 1}`,
      sourceAnchor: passage.sourceAnchor,
      sourceText: passage.text,
      classification: passage.classification,
      decision: passage.classification === "EXECUTABLE" ? "INCLUDE" : "REFERENCE_ONLY",
      confirmed: false,
      reviewerNote: "",
    });
  }
  return {
    id: `package-${document.hash.slice(0, 12)}`,
    name: document.name.replace(/\.[^.]+$/, "") || "Uploaded rule source",
    version: 1,
    status: "DRAFT",
    sourceDocumentId: document.id,
    sourceName: document.name,
    sourceHash: document.hash,
    sourceLicence: document.licence,
    createdAt: now,
    entries,
  };
}

export function updateRulePackageEntry(
  rulePackage: RulePackage,
  entryId: string,
  patch: Partial<Pick<RulePackageEntry, "sourceText" | "decision" | "confirmed" | "reviewerNote">> & { threshold?: number },
): RulePackage {
  if (rulePackage.status !== "DRAFT") return rulePackage;
  return {
    ...rulePackage,
    entries: rulePackage.entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const nextRule = entry.rule ? {
        ...entry.rule,
        description: patch.sourceText === undefined ? entry.rule.description : { en: patch.sourceText, zh: patch.sourceText },
        threshold: patch.threshold === undefined || !Number.isFinite(patch.threshold) ? entry.rule.threshold : Math.round(patch.threshold),
      } : undefined;
      return { ...entry, ...patch, rule: nextRule };
    }),
  };
}

export function rulePackageReadiness(rulePackage: RulePackage): { ready: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!rulePackage.entries.length) issues.push("No reviewable requirement passages were extracted from the source.");
  if (rulePackage.entries.some((entry) => !entry.confirmed)) issues.push("Every extracted entry requires an explicit human decision.");
  for (const entry of rulePackage.entries) {
    if (entry.decision === "INCLUDE" && !entry.rule) issues.push(`${entry.sourceAnchor} is marked for execution but has no deterministic rule structure.`);
    if (entry.decision === "INCLUDE" && entry.rule?.field === "clearWidth" && (!entry.rule.threshold || entry.rule.threshold < 300 || entry.rule.threshold > 3_000)) issues.push(`${entry.sourceAnchor} has an implausible door-width threshold.`);
  }
  return { ready: issues.length === 0, issues };
}

export function finaliseRulePackage(rulePackage: RulePackage, now = new Date().toISOString()): RulePackage {
  const readiness = rulePackageReadiness(rulePackage);
  if (!readiness.ready) throw new Error(readiness.issues.join(" "));
  return {
    ...rulePackage,
    status: "READY",
    confirmedAt: now,
    entries: rulePackage.entries.map((entry) => ({
      ...entry,
      rule: entry.rule ? { ...entry.rule, status: entry.decision === "INCLUDE" ? "ACTIVE" : "DRAFT", approvedAt: entry.decision === "INCLUDE" ? now : undefined } : undefined,
    })),
  };
}

export function rulesForPackage(rulePackage: RulePackage, fallback: RuleDefinition[] = []): RuleDefinition[] {
  if (rulePackage.id === builtinRulePackage.id) return fallback.filter((rule) => rule.status === "ACTIVE");
  if (rulePackage.status !== "READY") return [];
  return rulePackage.entries.flatMap((entry) => entry.decision === "INCLUDE" && entry.confirmed && entry.rule?.status === "ACTIVE" ? [entry.rule] : []);
}

export function executionRecords(rulePackage: RulePackage, findings: Finding[], locale: Locale): RuleExecutionRecord[] {
  return rulePackage.entries.map((entry) => {
    const count = entry.rule ? findings.filter((finding) => finding.ruleId === entry.rule?.id && finding.ruleVersion === entry.rule.version).length : 0;
    const title = entry.rule?.title[locale] ?? entry.sourceText.slice(0, 120);
    const outcome = entry.decision === "EXCLUDE" ? "EXCLUDED" : entry.decision === "REFERENCE_ONLY" ? "REFERENCE_ONLY" : count ? "EXECUTED" : "NO_APPLICABLE_ELEMENTS";
    return { entryId: entry.id, ruleId: entry.rule?.id, title, decision: entry.decision, outcome, findingCount: count };
  });
}
