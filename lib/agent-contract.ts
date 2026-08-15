import type { Finding, RuleDefinition } from "./compliance.ts";
import type { AgentRole } from "./agent.ts";

export type AgentHistoryMessage = { role: "user" | "assistant"; text: string };
export type AgentContext = {
  modelName: string;
  locale: "en" | "zh";
  findings: Finding[];
  rules: RuleDefinition[];
  selectedFindingId?: string;
  reviewCount: number;
  overrideCount: number;
};
export type AgentRequest = {
  model: string;
  role: AgentRole;
  message: string;
  history: AgentHistoryMessage[];
  context: AgentContext;
};
export type AgentProposal = { kind: "none" | "evidence" | "rule" | "report"; summary: string; payloadJson: string };
export type AgentCitation = { elementId: string; evidencePath: string; status: Finding["status"] };
export type AgentEnvelope = {
  answer: string;
  route: "explain" | "review" | "evidence-proposal" | "rule-proposal" | "report-proposal" | "general";
  proposal: AgentProposal;
  citations: AgentCitation[];
  limitations: string[];
  requiresConfirmation: boolean;
};
export type AgentTraceEntry = { stage: "request" | "model" | "tool" | "verification"; summary: string; detail?: string };
export type AgentRunResult = { envelope: AgentEnvelope; trace: AgentTraceEntry[]; responseId: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } };

const roles: AgentRole[] = ["orchestrator", "review", "rules", "documents", "report", "verifier"];
const statuses: Finding["status"][] = ["PASS", "FAIL", "REVIEW", "NOT_APPLICABLE"];
const routes: AgentEnvelope["route"][] = ["explain", "review", "evidence-proposal", "rule-proposal", "report-proposal", "general"];
const proposalKinds: AgentProposal["kind"][] = ["none", "evidence", "rule", "report"];
const modelIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/;
export const allowedOpenAIModels = ["gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna"] as const;

export const agentResponseSchema = {
  type: "object",
  properties: {
    answer: { type: "string", description: "Grounded user-facing answer. Do not invent identifiers, measurements, verdicts or authorities." },
    route: { type: "string", enum: routes },
    proposal: {
      type: "object",
      properties: {
        kind: { type: "string", enum: proposalKinds },
        summary: { type: "string" },
        payloadJson: { type: "string", description: "JSON-encoded proposal payload, or {} for no proposal." },
      },
      required: ["kind", "summary", "payloadJson"],
      additionalProperties: false,
    },
    citations: {
      type: "array", maxItems: 12,
      items: {
        type: "object",
        properties: {
          elementId: { type: "string" }, evidencePath: { type: "string" },
          status: { type: "string", enum: statuses },
        },
        required: ["elementId", "evidencePath", "status"],
        additionalProperties: false,
      },
    },
    limitations: { type: "array", maxItems: 8, items: { type: "string" } },
    requiresConfirmation: { type: "boolean" },
  },
  required: ["answer", "route", "proposal", "citations", "limitations", "requiresConfirmation"],
  additionalProperties: false,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const boundedString = (value: unknown, field: string, max: number, allowEmpty = false): string => {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > max) throw new Error(`Invalid ${field}.`);
  return value.trim();
};
const boundedCount = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 100_000) throw new Error(`Invalid ${field}.`);
  return Number(value);
};

export function validateAgentRequest(value: unknown): AgentRequest {
  if (!isRecord(value)) throw new Error("Invalid agent request.");
  const model = boundedString(value.model, "model", 80);
  if (!modelIdPattern.test(model) || !allowedOpenAIModels.includes(model as (typeof allowedOpenAIModels)[number])) throw new Error("Unsupported model identifier.");
  if (!roles.includes(value.role as AgentRole)) throw new Error("Invalid agent role.");
  const message = boundedString(value.message, "message", 4_000);
  if (!Array.isArray(value.history) || value.history.length > 20) throw new Error("Invalid history.");
  const history = value.history.map((item, index) => {
    if (!isRecord(item) || !["user", "assistant"].includes(String(item.role))) throw new Error(`Invalid history item ${index}.`);
    return { role: item.role as AgentHistoryMessage["role"], text: boundedString(item.text, `history item ${index}`, 4_000) };
  });
  if (!isRecord(value.context)) throw new Error("Invalid BIM context.");
  const rawContext = value.context;
  if (!Array.isArray(rawContext.findings) || rawContext.findings.length > 1_000) throw new Error("Invalid findings context.");
  if (!Array.isArray(rawContext.rules) || rawContext.rules.length > 100) throw new Error("Invalid rules context.");
  const context: AgentContext = {
    modelName: boundedString(rawContext.modelName, "model name", 240),
    locale: rawContext.locale === "zh" ? "zh" : "en",
    findings: rawContext.findings as Finding[], rules: rawContext.rules as RuleDefinition[],
    selectedFindingId: typeof rawContext.selectedFindingId === "string" ? rawContext.selectedFindingId.slice(0, 160) : undefined,
    reviewCount: boundedCount(rawContext.reviewCount, "review count"),
    overrideCount: boundedCount(rawContext.overrideCount, "override count"),
  };
  return { model, role: value.role as AgentRole, message, history, context };
}

export function parseAgentEnvelope(value: unknown): AgentEnvelope {
  if (!isRecord(value) || !isRecord(value.proposal) || !Array.isArray(value.citations) || !Array.isArray(value.limitations)) throw new Error("The model returned an invalid structured response.");
  const route = value.route as AgentEnvelope["route"];
  const kind = value.proposal.kind as AgentProposal["kind"];
  if (!routes.includes(route) || !proposalKinds.includes(kind) || typeof value.requiresConfirmation !== "boolean") throw new Error("The model returned an invalid response route.");
  const citations = value.citations.map((citation, index) => {
    if (!isRecord(citation) || !statuses.includes(citation.status as Finding["status"])) throw new Error(`Invalid citation ${index}.`);
    return { elementId: boundedString(citation.elementId, "citation element", 160), evidencePath: boundedString(citation.evidencePath, "citation evidence", 500), status: citation.status as Finding["status"] };
  });
  return {
    answer: boundedString(value.answer, "answer", 12_000), route,
    proposal: { kind, summary: boundedString(value.proposal.summary, "proposal summary", 2_000, true), payloadJson: boundedString(value.proposal.payloadJson, "proposal payload", 8_000) },
    citations, limitations: value.limitations.map((item, index) => boundedString(item, `limitation ${index}`, 1_000)),
    requiresConfirmation: value.requiresConfirmation,
  };
}

export function apiKeyLooksValid(value: string): boolean { return /^sk-[A-Za-z0-9_-]{20,}$/.test(value.trim()) && value.length <= 300; }
export function redactSecrets(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]").replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}
export function assertSameOrigin(requestUrl: string, origin: string | null): void {
  if (!origin) throw new Error("Missing request origin.");
  if (new URL(requestUrl).origin !== new URL(origin).origin) throw new Error("Cross-origin agent requests are not allowed.");
}

const numericClaims = (value: string): number[] => [...value.matchAll(/(?<![A-Za-z])\d[\d,]*(?:\.\d+)?/g)].map((match) => Number(match[0].replaceAll(",", ""))).filter(Number.isFinite);
const closeTo = (values: number[], candidate: number) => values.some((value) => Math.abs(value - candidate) < 0.0001);

export function verifyAgentEnvelope(envelope: AgentEnvelope, request: AgentRequest): string[] {
  const issues: string[] = [];
  const findings = request.context.findings;
  for (const citation of envelope.citations) {
    const finding = findings.find((item) => item.elementId === citation.elementId);
    if (!finding) { issues.push(`Invented GlobalId: ${citation.elementId}`); continue; }
    if (finding.status !== citation.status) issues.push(`Verdict mismatch for ${citation.elementId}.`);
    if (finding.evidencePath !== citation.evidencePath) issues.push(`Evidence-path mismatch for ${citation.elementId}.`);
  }
  const allowedNumbers = [request.context.reviewCount, request.context.overrideCount, findings.length,
    ...findings.flatMap((item) => [item.expressId, item.ruleVersion, item.observedValue, item.thresholdValue].filter((value): value is number => typeof value === "number")),
    ...request.context.rules.flatMap((item) => [item.version, item.threshold].filter((value): value is number => typeof value === "number")),
    ...numericClaims(request.message),
  ];
  const claims = numericClaims([envelope.answer, envelope.proposal.summary, envelope.proposal.payloadJson, ...envelope.limitations].join(" "));
  for (const claim of claims) if (!closeTo(allowedNumbers, claim)) issues.push(`Unsupported number: ${claim}.`);
  if (envelope.proposal.kind === "none" && envelope.requiresConfirmation) issues.push("A non-existent proposal cannot require confirmation.");
  if (envelope.proposal.kind !== "none" && !envelope.requiresConfirmation) issues.push("A model proposal requires human confirmation.");
  return [...new Set(issues)];
}
