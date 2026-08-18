import { audit, type AuditEvent } from "../review/memory.ts";

export type AgentAvailability = "ready" | "credential-required" | "planned";
export type AgentProvider = { id: "local" | "openai" | "anthropic" | "google" | "openrouter"; name: string; mode: AgentAvailability; privacy: { en: string; zh: string }; suitableFor: { en: string; zh: string } };
export const providers: AgentProvider[] = [
  { id: "local", name: "Local deterministic", mode: "ready", privacy: { en: "Files remain in this browser session.", zh: "文件保留在当前浏览器会话中。" }, suitableFor: { en: "IFC parsing, rule execution, conflict checks and verified reports", zh: "IFC 解析、规则执行、冲突检查和已验证报告" } },
  { id: "openai", name: "OpenAI", mode: "credential-required", privacy: { en: "Uses either the operator's server secret or your session-only API key. Only the question and bounded structured evidence are sent; raw IFC and source documents are excluded.", zh: "使用运营者的服务端密钥，或您仅在本次页面会话中提供的 API 密钥。只发送问题和受限结构化证据，不发送原始 IFC 或法规文件。" }, suitableFor: { en: "Evidence-grounded explanation and proposal drafting with server-side verification", zh: "基于证据的解释和建议草拟，并由服务端验证" } },
  { id: "anthropic", name: "Anthropic", mode: "planned", privacy: { en: "Connector not implemented in this release.", zh: "本版本尚未实现该连接器。" }, suitableFor: { en: "Planned document interpretation", zh: "规划中的文档理解" } },
  { id: "google", name: "Google", mode: "planned", privacy: { en: "Connector not implemented in this release.", zh: "本版本尚未实现该连接器。" }, suitableFor: { en: "Planned document interpretation", zh: "规划中的文档理解" } },
  { id: "openrouter", name: "OpenRouter", mode: "planned", privacy: { en: "Connector not implemented in this release.", zh: "本版本尚未实现该连接器。" }, suitableFor: { en: "Planned multi-provider routing", zh: "规划中的多供应商路由" } },
];

export type AgentRole = "orchestrator" | "review" | "rules" | "documents" | "report" | "verifier";
export type AgentModel = { id: string; providerId: AgentProvider["id"]; name: string; mode: AgentAvailability; execution: "deterministic" | "generative" };
export const agentModels: AgentModel[] = [
  { id:"evidence-local-v1", providerId:"local", name:"Evidence Local v1", mode:"ready", execution:"deterministic" },
  { id:"gpt-5.6", providerId:"openai", name:"GPT-5.6", mode:"credential-required", execution:"generative" },
  { id:"gpt-5.6-terra", providerId:"openai", name:"GPT-5.6 Terra", mode:"credential-required", execution:"generative" },
  { id:"gpt-5.6-luna", providerId:"openai", name:"GPT-5.6 Luna", mode:"credential-required", execution:"generative" },
  { id:"planned-anthropic", providerId:"anthropic", name:"Anthropic · planned", mode:"planned", execution:"generative" },
  { id:"planned-google", providerId:"google", name:"Google · planned", mode:"planned", execution:"generative" },
  { id:"planned-openrouter", providerId:"openrouter", name:"OpenRouter · planned", mode:"planned", execution:"generative" },
];

export function selectableAgentModels(providerId: AgentProvider["id"]): AgentModel[] { return agentModels.filter((item) => item.providerId === providerId); }
export function classifyAgentRequest(input: string): "unsafe-verdict-change" | "evidence-change" | "rule-change" | "report" | "explain" | "general" {
  const text = input.trim();
  if (/(set|mark|change|改成|设为).{0,12}(all|every|全部|所有).{0,20}(pass|通过)/i.test(text)) return "unsafe-verdict-change";
  if (/(rule|threshold|requirement|规则|阈值|要求)/i.test(text) && /(change|add|replace|改|新增|替换)/i.test(text)) return "rule-change";
  if (/(width|clear|净宽|宽度|exit|疏散门|现场测量)/i.test(text) && /(change|correct|measured|set|改|修正|测量|确认)/i.test(text)) return "evidence-change";
  if (/(report|summary|报告|摘要)/i.test(text)) return "report";
  if (/(explain|why|what|解释|为什么|是什么)/i.test(text)) return "explain";
  return "general";
}

export function reviewTrace(modelName: string, ruleCount: number, findingCount: number, locale: "en" | "zh" = "en"): AuditEvent[] {
  const zh = locale === "zh";
  return [
    audit("orchestrator", "plan", zh ? `已为 ${modelName} 制定有边界的证据审查计划。` : `Planned a bounded evidence review for ${modelName}.`),
    audit("model-intake", "tool", zh ? "已解析 IFC schema、单位、GlobalId 和可审查门证据。" : "Parsed IFC schema, units, GlobalIds and reviewable door evidence.", zh ? "本地解析；未传输文件" : "Local parser; no file transmission"),
    audit("rule-agent", "decision", zh ? `已选择 ${ruleCount} 条经人工批准的启用规则。` : `Selected ${ruleCount} human-approved active rules.`),
    audit("rule-engine", "tool", zh ? `已生成 ${findingCount} 项确定性结果。` : `Produced ${findingCount} deterministic findings.`, zh ? "报告 Agent 无权修改规则输出" : "Rule output is immutable to the report agent"),
    audit("verifier", "guardrail", zh ? "已准备构件标识与数值声明，以执行报告验证。" : "Prepared identifiers and numerical claims for report verification."),
  ];
}
