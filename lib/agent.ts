import { audit, type AuditEvent } from "./memory";

export type AgentProvider = { id: "local" | "openai" | "anthropic" | "google" | "openrouter"; name: string; mode: "ready" | "operator-configuration-required"; privacy: { en: string; zh: string }; suitableFor: { en: string; zh: string } };
export const providers: AgentProvider[] = [
  { id: "local", name: "Local deterministic", mode: "ready", privacy: { en: "Files remain in this browser session.", zh: "文件保留在当前浏览器会话中。" }, suitableFor: { en: "IFC parsing, rule execution, conflict checks and verified reports", zh: "IFC 解析、规则执行、冲突检查和已验证报告" } },
  { id: "openai", name: "OpenAI", mode: "operator-configuration-required", privacy: { en: "Server-side credential required; never entered in the browser.", zh: "需要服务端凭据；绝不在浏览器中输入。" }, suitableFor: { en: "Document interpretation and report drafting; recommended model: gpt-5.6-sol", zh: "文档理解与报告草拟；建议模型：gpt-5.6-sol" } },
  { id: "anthropic", name: "Anthropic", mode: "operator-configuration-required", privacy: { en: "Install an authorised server-side connector.", zh: "需要安装已授权的服务端连接器。" }, suitableFor: { en: "Optional document interpretation", zh: "可选文档理解" } },
  { id: "google", name: "Google", mode: "operator-configuration-required", privacy: { en: "Install an authorised server-side connector.", zh: "需要安装已授权的服务端连接器。" }, suitableFor: { en: "Optional document interpretation", zh: "可选文档理解" } },
  { id: "openrouter", name: "OpenRouter", mode: "operator-configuration-required", privacy: { en: "Install an authorised server-side connector.", zh: "需要安装已授权的服务端连接器。" }, suitableFor: { en: "Optional multi-provider routing", zh: "可选多供应商路由" } },
];

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
