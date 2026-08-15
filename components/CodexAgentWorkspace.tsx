"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Finding, Locale } from "../lib/compliance";
import { agentModels, classifyAgentRequest, providers, selectableAgentModels, type AgentProvider, type AgentRole } from "../lib/agent";
import { interpretEvidenceChange, type OverrideDraft } from "../lib/human-review";

type Message = { role:"user" | "agent"; text:string; meta?:string };
type Props = {
  locale: Locale;
  providerId: AgentProvider["id"];
  selected?: Finding;
  modelName: string;
  findingCount: number;
  reviewCount: number;
  overrideCount: number;
  onProviderChange: (id: AgentProvider["id"]) => void;
  onEvidenceProposal: (proposal: Partial<OverrideDraft>) => void;
  onRuleProposal: (text: string) => void;
  onReportRequest: (text: string) => void;
  onAttachRuleSource: () => void;
  onAudit: (summary: string, evidence: string) => void;
};

const roles: AgentRole[] = ["orchestrator", "review", "rules", "documents", "report", "verifier"];
const roleName = (role: AgentRole, locale: Locale) => locale === "zh" ? ({ orchestrator:"自动协调", review:"审查 Agent", rules:"规则 Agent", documents:"文档 Agent", report:"报告 Agent", verifier:"验证 Agent" }[role]) : ({ orchestrator:"Auto", review:"Review agent", rules:"Rule agent", documents:"Document agent", report:"Report agent", verifier:"Verifier" }[role]);

export default function CodexAgentWorkspace({ locale, providerId, selected, modelName, findingCount, reviewCount, overrideCount, onProviderChange, onEvidenceProposal, onRuleProposal, onReportRequest, onAttachRuleSource, onAudit }: Props) {
  const [role, setRole] = useState<AgentRole>("orchestrator");
  const models = useMemo(() => selectableAgentModels(providerId), [providerId]);
  const [modelId, setModelId] = useState("evidence-local-v1");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role:"agent", text:"Ask about the selected BIM evidence, propose a correction, revise a rule or prepare a report. I will show the tool route and ask before any state-changing action.", meta:"Local deterministic · no API key" }]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeProvider = providers.find((item) => item.id === providerId) ?? providers[0];
  const activeModel = agentModels.find((item) => item.id === modelId) ?? models[0];

  const changeProvider = (next: AgentProvider["id"]) => { const available = selectableAgentModels(next); onProviderChange(next); setModelId(available[0]?.id ?? "evidence-local-v1"); };
  const send = () => {
    const text = input.trim(); if (!text) return; const intent = classifyAgentRequest(text); let response = ""; let meta = `Route: ${roleName(role, "en")} · ${activeModel?.name ?? "Unavailable"}`;
    if (activeProvider.mode !== "ready") response = locale === "zh" ? "该供应商尚未由运营者在服务端配置，因此不会发送文件或文字。请选择 Evidence Local v1。" : "This provider has not been configured server-side by the operator, so no file or text was sent. Select Evidence Local v1.";
    else if (intent === "unsafe-verdict-change") response = locale === "zh" ? "已阻止：Agent 不能直接把机器结论改为通过。您可以记录独立的人工状态，或提出有来源的证据修订并在影响预览后确认。" : "Blocked: the Agent cannot rewrite a machine verdict to PASS. Record a separate human disposition, or propose a sourced evidence correction and confirm it after impact preview.";
    else if (intent === "evidence-change") { const proposal = interpretEvidenceChange(text, selected?.elementId); if (!selected) response = locale === "zh" ? "请先在 Review 页面选择一个具体构件，再提出证据修订。" : "Select a specific element in Review before proposing an evidence correction."; else if (!proposal) response = locale === "zh" ? "我识别到证据修订意图，但还需要明确字段和值，例如“现场测得净宽 930 mm”。" : "I recognised an evidence-correction intent, but need a field and value, for example ‘field-measured clear width is 930 mm’."; else { onEvidenceProposal(proposal); response = locale === "zh" ? `已生成 ${selected.elementId} 的可编辑修订建议。请返回 Review 的人工复核面板补充复核人、证据来源和原因，然后预览影响；尚未应用。` : `I created an editable correction proposal for ${selected.elementId}. Complete reviewer, provenance and reason in the Human Review panel, then preview the impact. Nothing has been applied.`; meta += " · Proposal only · confirmation required"; } }
    else if (intent === "rule-change") { onRuleProposal(text); response = locale === "zh" ? "已把要求送入 Rule Studio。系统会检查现有规则、可行性与冲突，并要求您选择替换或分范围并存；尚未启用。" : "I sent the requirement to Rule Studio. It will check existing rules, feasibility and conflicts, then ask whether to replace or retain with separate scope. It is not active."; meta += " · Human approval required"; }
    else if (intent === "report") { onReportRequest(text); response = locale === "zh" ? "已把自然语言报告要求送到 Report 工作区，您可编辑简报后确认生成。" : "I sent the natural-language request to the Report workspace, where you can edit the brief before generation."; }
    else if (intent === "explain" && selected) response = `${selected.elementName} · ${selected.status}. ${selected.message} ${selected.nextStep} [${selected.evidencePath}]`;
    else response = locale === "zh" ? `当前模型为 ${modelName}，共有 ${findingCount} 项机器结果、${reviewCount} 条人工复核记录和 ${overrideCount} 条证据修订记录。请选择构件或说明想检查、修改或报告的内容。` : `The current model is ${modelName}, with ${findingCount} machine findings, ${reviewCount} human-review records and ${overrideCount} evidence corrections. Select an element or say what you want to inspect, correct or report.`;
    setMessages((current) => [...current, { role:"user", text } as Message, { role:"agent", text:response, meta } as Message].slice(-40)); setInput(""); onAudit(`Agent request: ${intent}`, meta);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } };

  return <div className="codex-agent-shell">
    <div className="agent-context-bar"><span>{modelName}</span><span>{findingCount} {locale === "zh" ? "项结果" : "findings"}</span>{selected && <span className="selected-context">{locale === "zh" ? "已选" : "Selected"}: {selected.elementName} · {selected.elementId}</span>}<span>{locale === "zh" ? "本地项目记忆" : "Local project memory"}</span></div>
    <div className="codex-thread">{messages.map((message, index) => <article className={`codex-message ${message.role}`} key={`${message.role}-${index}`}><span className="message-avatar">{message.role === "agent" ? "✦" : "YOU"}</span><div><p>{message.text}</p>{message.meta && <small>{message.meta}</small>}</div></article>)}</div>
    <div className="agent-starters"><button onClick={() => setInput(locale === "zh" ? "解释当前选中构件为什么得到这个结果" : "Explain why the selected element received this result")}>{locale === "zh" ? "解释选中结果" : "Explain selected result"}</button><button onClick={() => setInput(locale === "zh" ? "现场测得当前门净宽为 930 mm，请提出修订" : "The selected door has a field-measured clear width of 930 mm; propose a correction")}>{locale === "zh" ? "提出证据修订" : "Propose evidence correction"}</button><button onClick={() => setInput(locale === "zh" ? "生成一份给项目经理的精简中文报告" : "Prepare a concise report for the project manager")}>{locale === "zh" ? "准备报告" : "Prepare report"}</button></div>
    <div className="codex-composer"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} maxLength={4000} placeholder={locale === "zh" ? "向 Evidence Agent 提问；Enter 发送，Shift+Enter 换行" : "Ask Evidence Agent · Enter to send, Shift+Enter for a new line"} /><div className="composer-controls"><div><button className="attach-control" onClick={onAttachRuleSource} title={locale === "zh" ? "上传规则来源" : "Attach rule source"}>＋</button><select aria-label={locale === "zh" ? "选择 Agent" : "Select agent"} value={role} onChange={(event) => setRole(event.target.value as AgentRole)}>{roles.map((item) => <option value={item} key={item}>{roleName(item, locale)}</option>)}</select><select aria-label={locale === "zh" ? "选择供应商" : "Select provider"} value={providerId} onChange={(event) => changeProvider(event.target.value as AgentProvider["id"])}>{providers.map((item) => <option value={item.id} key={item.id}>{item.name}{item.mode !== "ready" ? ` · ${locale === "zh" ? "未配置" : "not configured"}` : ""}</option>)}</select><select aria-label={locale === "zh" ? "选择模型" : "Select model"} value={modelId} onChange={(event) => setModelId(event.target.value)}>{models.map((item) => <option value={item.id} key={item.id} disabled={item.mode !== "ready"}>{item.name}{item.mode !== "ready" ? ` · ${locale === "zh" ? "不可用" : "unavailable"}` : ""}</option>)}</select></div><button className="send-control" onClick={send} disabled={!input.trim()}>↑</button></div></div>
    <aside className="agent-transparency"><strong>{locale === "zh" ? "本次执行边界" : "Execution boundary"}</strong><span>{activeProvider.privacy[locale]} {locale === "zh" ? "Agent 只生成建议；规则、证据和人工状态的修改均需明确确认。" : "The Agent creates proposals only; rule, evidence and human-status changes require explicit confirmation."}</span></aside>
  </div>;
}
