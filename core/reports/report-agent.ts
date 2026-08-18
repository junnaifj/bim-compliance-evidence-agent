import type { Finding, FindingStatus, Locale } from "../compliance/compliance";

export type ReportAudience = "project-team" | "client" | "fire-engineer" | "regulator";
export type ReportBrief = {
  audience: ReportAudience;
  language: "en" | "zh" | "bilingual";
  tone: "concise" | "technical" | "executive";
  focusStatuses: FindingStatus[];
  includeIdentifiers: boolean;
  includeEvidencePaths: boolean;
  includeActions: boolean;
  includeHumanReview: boolean;
  selectedElementOnly: boolean;
  ruleIds: string[];
  storeys: string[];
  detail: "summary" | "per-finding";
  maxFindings: number;
  extraInstruction: string;
};

export type ReportAgentResult = {
  intent: "configure-report" | "explain-finding" | "rule-change";
  brief: ReportBrief;
  reply: string;
  warnings: string[];
};

export function defaultReportBrief(locale: Locale): ReportBrief {
  return { audience: "project-team", language: locale, tone: "concise", focusStatuses: ["FAIL", "REVIEW"], includeIdentifiers: true, includeEvidencePaths: true, includeActions: true, includeHumanReview: true, selectedElementOnly: false, ruleIds: [], storeys: [], detail: "per-finding", maxFindings: 16, extraInstruction: "" };
}

const has = (input: string, pattern: RegExp) => pattern.test(input.toLowerCase());

export function interpretReportRequest(input: string, current: ReportBrief, locale: Locale): ReportAgentResult {
  const text = input.trim().slice(0, 4000); const zh = locale === "zh"; const warnings: string[] = [];
  if (has(text, /(change|replace|set|修改|更改|替换|设为).{0,18}(rule|threshold|width|规则|阈值|门宽)|\b\d+(?:\.\d+)?\s*(?:mm|m|毫米|米).{0,16}(rule|threshold|规则|阈值)/i)) {
    return { intent: "rule-change", brief: current, warnings, reply: zh ? "这项要求会改变审查规则，而不是报告写法。我没有修改任何判定；请送到“规则工作室”，由系统检查冲突、可行性并等待人工确认。" : "That request changes a review rule rather than the report. I have not altered any verdict; send it to Rule Studio for conflict, feasibility and human-approval checks." };
  }
  if (has(text, /(ignore (all|previous)|system prompt|developer message|api key|secret|忽略.*指令|系统提示|密钥|泄露)/i)) warnings.push(zh ? "已忽略试图改变系统边界或读取机密的内容。" : "An attempt to change system boundaries or retrieve secrets was ignored.");
  if (has(text, /(mark|make).{0,12}(all|everything).{0,12}(pass|compliant)|全部.{0,8}(通过|合规)/i)) warnings.push(zh ? "报告不能把现有判定改为通过。" : "The report cannot change existing findings to PASS.");
  if (has(text, /(explain|why|what does|解释|为什么|什么意思).{0,20}(selected|finding|result|选中|结果)/i)) return { intent: "explain-finding", brief: current, warnings, reply: zh ? "我会用已选结果的观测值、规则要求、证据路径和下一步解释，不增加模型中不存在的事实。" : "I will explain the selected result using its observation, requirement, evidence path and next step, without adding facts that are absent from the model." };

  const brief: ReportBrief = { ...current, focusStatuses: [...current.focusStatuses] };
  if (has(text, /(client|客户|业主)/i)) brief.audience = "client";
  if (has(text, /(fire engineer|消防工程师)/i)) brief.audience = "fire-engineer";
  if (has(text, /(regulator|authority|政府|监管|审批)/i)) brief.audience = "regulator";
  if (has(text, /(executive|board|管理层|高层)/i)) brief.tone = "executive";
  else if (has(text, /(technical|detailed|技术|详细)/i)) brief.tone = "technical";
  else if (has(text, /(concise|short|brief|简短|精简|摘要)/i)) brief.tone = "concise";
  if (has(text, /(bilingual|双语|中英)/i)) brief.language = "bilingual";
  else if (has(text, /(in chinese|中文|汉语)/i)) brief.language = "zh";
  else if (has(text, /(in english|英文|英语)/i)) brief.language = "en";
  if (has(text, /(failures? only|only failures?|只.{0,4}不通过|仅.{0,4}不通过)/i)) brief.focusStatuses = ["FAIL"];
  else if (has(text, /(issues? only|problems? only|只.{0,4}(问题|异常))/i)) brief.focusStatuses = ["FAIL", "REVIEW"];
  else if (has(text, /(include passes|all findings|全部结果|包括通过)/i)) brief.focusStatuses = ["FAIL", "REVIEW", "PASS", "NOT_APPLICABLE"];
  if (has(text, /(hide|exclude|omit).{0,12}(global.?id|identifier)|不.{0,8}(显示|包括).{0,8}(global.?id|标识)/i)) brief.includeIdentifiers = false;
  if (has(text, /(hide|exclude|omit).{0,12}evidence|不.{0,8}(显示|包括).{0,8}证据/i)) brief.includeEvidencePaths = false;
  if (has(text, /(no action|without action|不.{0,8}(行动|建议))/i)) brief.includeActions = false;
  if (has(text, /(without|exclude|omit).{0,16}human review|不.{0,8}(显示|包括).{0,8}人工复核/i)) brief.includeHumanReview = false;
  if (has(text, /(selected (element|finding) only|current element only|只.{0,6}(选中|当前).{0,6}(构件|结果))/i)) brief.selectedElementOnly = true;
  if (has(text, /(summary only|overview only|只.{0,6}(摘要|概览))/i)) brief.detail = "summary";
  if (has(text, /(each finding|every finding|per.finding|逐项|每一项|每个结果)/i)) brief.detail = "per-finding";
  const count = text.match(/(?:top|maximum|max|最多|前)\s*(\d{1,3})/i)?.[1]; if (count) brief.maxFindings = Math.min(100, Math.max(1, Number(count)));
  brief.extraInstruction = text.replace(/<[^>]*>/g, "").slice(0, 500);
  return { intent: "configure-report", brief, warnings, reply: zh ? "我已把您的自然语言整理成右侧可编辑的报告简报。请检查受众、语言、重点和证据范围；确认后直接生成，无需复制或粘贴提示词。" : "I have converted your request into the editable report brief on the right. Check its audience, language, focus and evidence scope, then generate directly—there is no prompt to copy or paste." };
}

export function findingsForBrief(findings: Finding[], brief: ReportBrief, context?: { selectedElementId?: string; storeyByElement?: Record<string, string | undefined> }): Finding[] {
  return findings.filter((finding) => {
    if (!brief.focusStatuses.includes(finding.status)) return false;
    if (brief.ruleIds.length && !brief.ruleIds.includes(finding.ruleId)) return false;
    if (brief.selectedElementOnly && context?.selectedElementId !== finding.elementId) return false;
    if (brief.storeys.length && !brief.storeys.includes(context?.storeyByElement?.[finding.elementId] ?? "")) return false;
    return true;
  }).slice(0, brief.maxFindings);
}

export function buildExternalInstruction(modelName: string, units: string, rules: string[], findings: Finding[], brief: ReportBrief): string {
  return `MODEL: ${modelName}\nUNITS: ${units}\nAUDIENCE: ${brief.audience}\nLANGUAGE: ${brief.language}\nTONE: ${brief.tone}\nDETAIL: ${brief.detail}\nACTIVE RULES: ${rules.join("; ")}\n\nVERIFIED FINDINGS JSON:\n${JSON.stringify(findings, null, 2)}\n\nWrite only from the supplied findings. Discuss every supplied finding when DETAIL is per-finding. Do not invent identifiers, dimensions, verdicts or legal authority. REVIEW is uncertainty, not PASS. This package is for an external LLM chat; the built-in Report Agent does not require copying it.`;
}
