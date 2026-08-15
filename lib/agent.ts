import { audit, type AuditEvent } from "./memory.ts";

export type AgentProvider = { id: "local" | "openai" | "anthropic" | "google" | "openrouter"; name: string; mode: "ready" | "operator-configuration-required"; privacy: { en: string; zh: string }; suitableFor: { en: string; zh: string } };
export const providers: AgentProvider[] = [
  { id: "local", name: "Local deterministic", mode: "ready", privacy: { en: "Files remain in this browser session.", zh: "文件保留在当前浏览器会话中。" }, suitableFor: { en: "IFC parsing, rule execution, conflict checks and verified reports", zh: "IFC 解析、规则执行、冲突检查和已验证报告" } },
  { id: "openai", name: "OpenAI", mode: "operator-configuration-required", privacy: { en: "A separately billed server-side API credential is required; a ChatGPT or Codex login is not reused and credentials are never entered in the browser.", zh: "需要单独计费的服务端 API 凭据；不会复用 ChatGPT 或 Codex 登录，且绝不在浏览器中输入凭据。" }, suitableFor: { en: "Optional document interpretation and report drafting; extracted content remains subject to human approval", zh: "可选文档理解与报告草拟；提取内容仍须人工确认" } },
  { id: "anthropic", name: "Anthropic", mode: "operator-configuration-required", privacy: { en: "Install an authorised server-side connector.", zh: "需要安装已授权的服务端连接器。" }, suitableFor: { en: "Optional document interpretation", zh: "可选文档理解" } },
  { id: "google", name: "Google", mode: "operator-configuration-required", privacy: { en: "Install an authorised server-side connector.", zh: "需要安装已授权的服务端连接器。" }, suitableFor: { en: "Optional document interpretation", zh: "可选文档理解" } },
  { id: "openrouter", name: "OpenRouter", mode: "operator-configuration-required", privacy: { en: "Install an authorised server-side connector.", zh: "需要安装已授权的服务端连接器。" }, suitableFor: { en: "Optional multi-provider routing", zh: "可选多供应商路由" } },
];

export type AgentRole = "orchestrator" | "review" | "rules" | "documents" | "report" | "verifier";
export type AgentModel = { id: string; providerId: AgentProvider["id"]; name: string; mode: "ready" | "operator-configuration-required"; execution: "deterministic" | "generative" };
export const agentModels: AgentModel[] = [
  { id:"evidence-local-v1", providerId:"local", name:"Evidence Local v1", mode:"ready", execution:"deterministic" },
  { id:"operator-openai", providerId:"openai", name:"OpenAI · operator configured", mode:"operator-configuration-required", execution:"generative" },
  { id:"operator-anthropic", providerId:"anthropic", name:"Anthropic · operator configured", mode:"operator-configuration-required", execution:"generative" },
  { id:"operator-google", providerId:"google", name:"Google · operator configured", mode:"operator-configuration-required", execution:"generative" },
  { id:"operator-openrouter", providerId:"openrouter", name:"OpenRouter · operator configured", mode:"operator-configuration-required", execution:"generative" },
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
