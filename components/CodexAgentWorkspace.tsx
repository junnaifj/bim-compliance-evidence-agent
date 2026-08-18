"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Finding, Locale, RuleDefinition } from "../core/compliance/compliance";
import { classifyAgentRequest, providers, selectableAgentModels, type AgentProvider, type AgentRole } from "../core/agent/agent";
import type { AgentEnvelope, AgentTraceEntry } from "../core/agent/agent-contract";
import { interpretEvidenceChange, type OverrideDraft } from "../core/review/human-review";

type Message = { role: "user" | "agent"; text: string; meta?: string };
let transientSessionKey = "";
let transientAuthMode: "operator" | "byok" = "operator";
let transientMessages: Message[] = [{ role: "agent", text: "Ask about selected BIM evidence, propose a correction, revise a rule or prepare a report. State-changing work remains a proposal until you confirm it.", meta: "Local deterministic · no API key" }];
type ApiConfig = { serverConfigured: boolean; defaultModel: string; models: string[]; byokSupported: boolean };
type ApiResult = { ok: boolean; mode?: "operator" | "byok"; envelope?: AgentEnvelope; trace?: AgentTraceEntry[]; responseId?: string; usage?: { totalTokens?: number }; error?: { code: string; message: string } };
type Props = {
  locale: Locale; providerId: AgentProvider["id"]; selected?: Finding; modelName: string;
  findings: Finding[]; rules: RuleDefinition[]; reviewCount: number; overrideCount: number;
  onProviderChange: (id: AgentProvider["id"]) => void;
  onEvidenceProposal: (proposal: Partial<OverrideDraft>) => void;
  onRuleProposal: (text: string) => void; onReportRequest: (text: string) => void;
  onAttachRuleSource: () => void; onAudit: (summary: string, evidence: string) => void;
};

const roles: AgentRole[] = ["orchestrator", "review", "rules", "documents", "report", "verifier"];
const roleName = (role: AgentRole, locale: Locale) => locale === "zh"
  ? ({ orchestrator: "自动协调", review: "审查 Agent", rules: "规则 Agent", documents: "文档 Agent", report: "报告 Agent", verifier: "验证 Agent" }[role])
  : ({ orchestrator: "Auto", review: "Review agent", rules: "Rule agent", documents: "Document agent", report: "Report agent", verifier: "Verifier" }[role]);

export default function CodexAgentWorkspace({ locale, providerId, selected, modelName, findings, rules, reviewCount, overrideCount, onProviderChange, onEvidenceProposal, onRuleProposal, onReportRequest, onAttachRuleSource, onAudit }: Props) {
  const [role, setRole] = useState<AgentRole>("orchestrator");
  const models = useMemo(() => selectableAgentModels(providerId), [providerId]);
  const [modelId, setModelId] = useState(() => selectableAgentModels(providerId)[0]?.id ?? "evidence-local-v1");
  const [input, setInput] = useState("");
  const [messages, setMessagesState] = useState<Message[]>(transientMessages);
  const [config, setConfig] = useState<ApiConfig>();
  const [authMode, setAuthModeState] = useState<"operator" | "byok">(transientAuthMode);
  const [apiKey, setApiKeyState] = useState(transientSessionKey);
  const [connection, setConnection] = useState<"idle" | "testing" | "ready" | "error">("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiTrace, setApiTrace] = useState<AgentTraceEntry[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeProvider = providers.find((item) => item.id === providerId) ?? providers[0];
  const findingCount = findings.length;
  const setMessages = (update: (current: Message[]) => Message[]) => setMessagesState((current) => { const next = update(current); transientMessages = next; return next; });
  const setAuthMode = (value: "operator" | "byok") => { transientAuthMode = value; setAuthModeState(value); };

  useEffect(() => { void fetch("/api/agent/config", { cache: "no-store" }).then((response) => response.json()).then((value: ApiConfig & { ok?: boolean }) => {
    setConfig(value); if (value.defaultModel && selectableAgentModels("openai").some((item) => item.id === value.defaultModel)) setModelId((current) => current === "evidence-local-v1" ? current : value.defaultModel);
  }).catch(() => setConfig({ serverConfigured: false, defaultModel: "gpt-5.6", models: ["gpt-5.6"], byokSupported: true })); }, []);

  const authHeaders = () => ({ "content-type": "application/json", "x-evidence-agent-auth": authMode, ...(authMode === "byok" ? { "x-evidence-openai-key": apiKey.trim() } : {}) });
  const changeProvider = (next: AgentProvider["id"]) => {
    const available = selectableAgentModels(next); onProviderChange(next); setModelId(available[0]?.id ?? "evidence-local-v1"); setConnection("idle"); setConnectionMessage("");
  };
  const setApiKey = (value: string) => { transientSessionKey = value; setApiKeyState(value); };
  const clearKey = () => { setApiKey(""); setConnection("idle"); setConnectionMessage(locale === "zh" ? "会话密钥已从页面内存清除。" : "The session key has been cleared from page memory."); };
  const testConnection = async () => {
    setConnection("testing"); setConnectionMessage(locale === "zh" ? "正在验证连接…" : "Testing the connection…");
    try {
      const response = await fetch("/api/agent/config", { method: "POST", headers: authHeaders(), body: JSON.stringify({ model: modelId }) });
      const value = await response.json() as ApiResult;
      if (!response.ok || !value.ok) throw new Error(value.error?.message ?? "Connection test failed.");
      setConnection("ready"); setConnectionMessage(locale === "zh" ? `连接成功 · ${modelId} · 密钥不会被保存` : `Connected · ${modelId} · key not stored`);
    } catch (error) { setConnection("error"); setConnectionMessage(error instanceof Error ? error.message : "Connection test failed."); }
  };

  const applyProposal = (envelope: AgentEnvelope, originalText: string) => {
    if (!envelope.requiresConfirmation || envelope.proposal.kind === "none") return;
    if (envelope.proposal.kind === "rule") onRuleProposal(envelope.proposal.summary || originalText);
    if (envelope.proposal.kind === "report") onReportRequest(envelope.proposal.summary || originalText);
    if (envelope.proposal.kind === "evidence") {
      const proposal = interpretEvidenceChange(originalText, selected?.elementId) ?? interpretEvidenceChange(envelope.proposal.summary, selected?.elementId);
      if (proposal && selected) onEvidenceProposal(proposal);
    }
  };
  const localResponse = (text: string): { text: string; meta: string } => {
    const intent = classifyAgentRequest(text); let response = ""; let meta = `Route: ${roleName(role, "en")} · Evidence Local v1`;
    if (intent === "unsafe-verdict-change") response = locale === "zh" ? "已阻止：Agent 不能直接把机器结论改为通过。您可以记录独立的人工状态，或提出有来源的证据修订并确认。" : "Blocked: the Agent cannot rewrite a machine verdict to PASS. Record a separate human disposition, or propose and confirm a sourced evidence correction.";
    else if (intent === "evidence-change") { const proposal = interpretEvidenceChange(text, selected?.elementId); if (!selected) response = locale === "zh" ? "请先在 Review 页面选择具体构件。" : "Select a specific element in Review first."; else if (!proposal) response = locale === "zh" ? "请说明字段和值，例如“现场测得净宽 930 mm”。" : "Give a field and value, for example ‘field-measured clear width is 930 mm’."; else { onEvidenceProposal(proposal); response = locale === "zh" ? `已为 ${selected.elementId} 生成可编辑修订建议；尚未应用。` : `An editable correction proposal was created for ${selected.elementId}; nothing has been applied.`; meta += " · Proposal only"; } }
    else if (intent === "rule-change") { onRuleProposal(text); response = locale === "zh" ? "要求已送至 Rule Studio 进行冲突、可行性和人工确认。" : "The requirement was sent to Rule Studio for conflict, feasibility and human-confirmation checks."; meta += " · Confirmation required"; }
    else if (intent === "report") { onReportRequest(text); response = locale === "zh" ? "要求已送至 Report 工作区，请确认可编辑简报。" : "The request was sent to Report; confirm the editable brief there."; }
    else if (intent === "explain" && selected) response = `${selected.elementName} · ${selected.status}. ${selected.message} ${selected.nextStep} [${selected.evidencePath}]`;
    else response = locale === "zh" ? `当前模型 ${modelName} 有 ${findingCount} 项机器结果、${reviewCount} 条人工复核和 ${overrideCount} 条证据修订。` : `The current model ${modelName} has ${findingCount} machine findings, ${reviewCount} human-review records and ${overrideCount} evidence corrections.`;
    return { text: response, meta };
  };
  const send = async () => {
    const text = input.trim(); if (!text || busy) return;
    const userMessage: Message = { role: "user", text }; setMessages((current) => [...current, userMessage].slice(-40)); setInput("");
    if (providerId !== "openai") { const result = localResponse(text); setMessages((current) => [...current, { role: "agent", text: result.text, meta: result.meta } as Message].slice(-40)); onAudit(`Agent request: ${classifyAgentRequest(text)}`, result.meta); return; }
    setBusy(true);
    try {
      const history = messages.slice(-12).map((message) => ({ role: message.role === "agent" ? "assistant" as const : "user" as const, text: message.text }));
      const response = await fetch("/api/agent", { method: "POST", headers: authHeaders(), body: JSON.stringify({ model: modelId, role, message: text, history, context: { modelName, locale, findings, rules, selectedFindingId: selected?.id, reviewCount, overrideCount } }) });
      const value = await response.json() as ApiResult;
      if (!response.ok || !value.ok || !value.envelope) throw new Error(value.error?.message ?? "The Agent did not return a verified answer.");
      const meta = `OpenAI · ${modelId} · verified${value.usage?.totalTokens ? ` · ${value.usage.totalTokens} tokens` : ""}`;
      setApiTrace(value.trace ?? []); applyProposal(value.envelope, text);
      const limitations = value.envelope.limitations.length ? `\n\n${locale === "zh" ? "限制：" : "Limitations: "}${value.envelope.limitations.join(" · ")}` : "";
      setMessages((current) => [...current, { role: "agent", text: `${value.envelope?.answer}${limitations}`, meta } as Message].slice(-40)); onAudit(`Verified OpenAI response: ${value.envelope.route}`, `${meta} · response ${value.responseId ?? "unavailable"}`);
    } catch (error) {
      const fallback = localResponse(text); const reason = error instanceof Error ? error.message : "OpenAI request failed.";
      setMessages((current) => [...current, { role: "agent", text: `${fallback.text}\n\n${locale === "zh" ? "OpenAI 未使用或未能完成；已安全回退至本地。" : "OpenAI was unavailable or did not complete; the safe local fallback was used."}`, meta: `Fallback: Local deterministic · ${reason}` } as Message].slice(-40));
      onAudit("Agent fallback", reason);
    } finally { setBusy(false); }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } };

  return <div className="codex-agent-shell">
    <div className="agent-context-bar"><span>{modelName}</span><span>{findingCount} {locale === "zh" ? "项结果" : "findings"}</span>{selected && <span className="selected-context">{locale === "zh" ? "已选" : "Selected"}: {selected.elementName} · {selected.elementId}</span>}<span>{locale === "zh" ? "本地项目记忆" : "Local project memory"}</span></div>
    {providerId === "openai" && <a className="agent-key-help" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">{locale === "zh" ? "在 OpenAI Platform 创建或管理 API Key ↗" : "Create or manage an API key on OpenAI Platform ↗"}</a>}
    {providerId === "openai" && <section className="agent-connection-panel"><div><strong>{locale === "zh" ? "OpenAI API 连接" : "OpenAI API connection"}</strong><p>{locale === "zh" ? "选择平台密钥，或使用您自己的 API 密钥。ChatGPT/Codex 订阅不等同于 API 额度。" : "Use the platform key or your own API key. A ChatGPT/Codex subscription is separate from API billing."}</p></div><label><span>{locale === "zh" ? "认证方式" : "Authentication"}</span><select value={authMode} onChange={(event) => { setAuthMode(event.target.value as "operator" | "byok"); setConnection("idle"); }}><option value="operator">{locale === "zh" ? `平台密钥${config?.serverConfigured ? "（已配置）" : "（未配置）"}` : `Platform key${config?.serverConfigured ? " (configured)" : " (not configured)"}`}</option><option value="byok">{locale === "zh" ? "我的会话 API 密钥" : "My session API key"}</option></select></label>{authMode === "byok" && <label className="agent-key-field"><span>OpenAI API key</span><input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setConnection("idle"); }} placeholder="sk-…" /><small>{locale === "zh" ? "只保存在此页面的内存中；不会写入浏览器存储、日志或项目文件。刷新或关闭页面即清除。" : "Held only in this page's memory; never written to browser storage, logs or project files. Refreshing or closing clears it."}</small></label>}<div className="agent-connection-actions"><button onClick={() => void testConnection()} disabled={connection === "testing" || (authMode === "byok" && !apiKey.trim())}>{connection === "testing" ? (locale === "zh" ? "验证中…" : "Testing…") : (locale === "zh" ? "测试连接" : "Test connection")}</button>{authMode === "byok" && <button onClick={clearKey} disabled={!apiKey}>{locale === "zh" ? "清除密钥" : "Clear key"}</button>}<span className={`connection-state ${connection}`}>{connectionMessage}</span></div></section>}
    <div className="codex-thread">{messages.map((message, index) => <article className={`codex-message ${message.role}`} key={`${message.role}-${index}`}><span className="message-avatar">{message.role === "agent" ? "✦" : "YOU"}</span><div><p>{message.text}</p>{message.meta && <small>{message.meta}</small>}</div></article>)}</div>
    <div className="agent-starters"><button onClick={() => setInput(locale === "zh" ? "解释当前选中构件为什么得到这个结果" : "Explain why the selected element received this result")}>{locale === "zh" ? "解释选中结果" : "Explain selected result"}</button><button onClick={() => setInput(locale === "zh" ? "现场测得当前门净宽为 930 mm，请提出修订" : "The selected door has a field-measured clear width of 930 mm; propose a correction")}>{locale === "zh" ? "提出证据修订" : "Propose evidence correction"}</button><button onClick={() => setInput(locale === "zh" ? "生成一份给项目经理的精简中文报告" : "Prepare a concise report for the project manager")}>{locale === "zh" ? "准备报告" : "Prepare report"}</button></div>
    <div className="codex-composer"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} maxLength={4000} placeholder={locale === "zh" ? "向 Evidence Agent 提问；Enter 发送，Shift+Enter 换行" : "Ask Evidence Agent · Enter to send, Shift+Enter for a new line"} /><div className="composer-controls"><div><button className="attach-control" onClick={onAttachRuleSource} title={locale === "zh" ? "上传规则来源" : "Attach rule source"}>＋</button><select aria-label={locale === "zh" ? "选择 Agent" : "Select agent"} value={role} onChange={(event) => setRole(event.target.value as AgentRole)}>{roles.map((item) => <option value={item} key={item}>{roleName(item, locale)}</option>)}</select><select aria-label={locale === "zh" ? "选择供应商" : "Select provider"} value={providerId} onChange={(event) => changeProvider(event.target.value as AgentProvider["id"])}>{providers.map((item) => <option value={item.id} key={item.id} disabled={item.mode === "planned"}>{item.name}{item.mode === "planned" ? ` · ${locale === "zh" ? "规划中" : "planned"}` : ""}</option>)}</select><select aria-label={locale === "zh" ? "选择模型" : "Select model"} value={modelId} onChange={(event) => { setModelId(event.target.value); setConnection("idle"); }}>{models.map((item) => <option value={item.id} key={item.id} disabled={item.mode === "planned"}>{item.name}</option>)}</select></div><button className="send-control" onClick={() => void send()} disabled={!input.trim() || busy}>{busy ? "…" : "↑"}</button></div></div>
    <aside className="agent-transparency"><strong>{locale === "zh" ? "本次执行边界" : "Execution boundary"}</strong><span>{activeProvider.privacy[locale]} {locale === "zh" ? "发送内容包括问题、最近对话、规则和审查结果；不包括原始 IFC/PDF。Agent 只生成建议，修改均需明确确认。" : "Sent data comprises the question, recent messages, rules and review findings; raw IFC/PDF files are excluded. The Agent creates proposals only and changes require explicit confirmation."}</span>{apiTrace.length > 0 && <ol>{apiTrace.map((entry, index) => <li key={`${entry.stage}-${index}`}><b>{entry.stage}</b> · {entry.summary}{entry.detail ? ` — ${entry.detail}` : ""}</li>)}</ol>}</aside>
  </div>;
}
