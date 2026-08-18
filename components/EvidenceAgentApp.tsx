"use client";

import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import {
  analyseModel,
  assessmentSamples,
  buildReport,
  builtinRules,
  compareModels,
  parseIfc,
  proposeRule,
  resolveRuleProposal,
  verifyReport,
  type BuildingModel,
  type Finding,
  type Locale,
  type RuleDefinition,
} from "../lib/compliance";
import {
  officialRuleSources,
  readRuleDocument,
  type RuleDocument,
} from "../lib/document-intelligence";
import {
  audit,
  clearMemory,
  emptyMemory,
  loadMemory,
  saveMemory,
  type AuditEvent,
  type ProjectMemory,
} from "../lib/memory";
import { reviewTrace, type AgentProvider } from "../lib/agent";
import {
  buildExternalInstruction,
  defaultReportBrief,
  findingsForBrief,
  interpretReportRequest,
  type ReportBrief,
} from "../lib/report-agent";
import {
  builtinRulePackage,
  createRulePackageDraft,
  executionRecords,
  finaliseRulePackage,
  rulePackageReadiness,
  rulesForPackage,
  updateRulePackageEntry,
  type RulePackage,
  type RulePackageDecision,
} from "../lib/rule-packages";
import {
  filterFindingsForSelection,
  nextFindingByStatus,
  shouldHandleReviewShortcut,
  type ViewerElement,
} from "../lib/viewer-interaction";
import {
  effectiveModel,
  type ElementEvidenceOverride,
  type HumanReviewRecord,
  type OverrideDraft,
} from "../lib/human-review";
import HumanReviewPanel from "./HumanReviewPanel";
import CodexAgentWorkspace from "./CodexAgentWorkspace";

const IfcViewer = dynamic(() => import("./IfcViewer"), {
  ssr: false,
  loading: () => (
    <div className="viewer-loading">Loading the IFC evidence viewer…</div>
  ),
});
type View = "review" | "compare" | "rules" | "sources" | "agents" | "report";

const copy = {
  en: {
    nav: {
      review: "Review",
      compare: "Compare",
      rules: "Rule studio",
      sources: "Sources",
      agents: "Agent",
      report: "Report",
    },
    strap: "IFC compliance workspace",
    upload: "Upload an IFC model",
    uploadHint: "IFC2x3 or IFC4 · processed in this browser",
    samples: "Assessment samples",
    activePack: "Active rule pack",
    activeText:
      "Human-approved deterministic checks. Demonstration thresholds are not statutory certification.",
    inspect: "Inspect rules",
    run: "Run evidence review",
    running: "Reviewing evidence…",
    evidenceMap: "Evidence map",
    viewerHint:
      "Interactive IFC geometry · orbit, pan, zoom, section and inspect",
    findings: "Review findings",
    ready: "Ready to run",
    checks: "checks completed",
    evidenceReady: "Evidence is ready",
    evidenceReadyText:
      "Run the review to evaluate the approved rules without asking an AI to guess.",
    observed: "Observed",
    required: "Required",
    evidence: "Evidence",
    reliability: "Reliability",
    next: "Agent next step",
    project: "PROJECT",
    preReview: "PRE-REVIEW",
    modelEvidence: "Evidence extracted from the IFC model",
    fail: "Fail",
    review: "Review",
    pass: "Pass",
    na: "N/A",
    disclaimer:
      "Professional pre-review only · plans and qualified professional judgement prevail",
    compareTitle: "Compare model revisions",
    compareLead:
      "Upload or select two IFC revisions. GlobalIds anchor the evidence diff; unmatched identifiers are reported as new elements.",
    baseline: "Baseline IFC",
    current: "Current IFC",
    changed: "Changed",
    resolved: "Resolved",
    regressed: "Regressed",
    unchanged: "Unchanged",
    element: "Element",
    before: "Before",
    after: "After",
    outcome: "Outcome",
    ruleTitle: "Rule studio",
    ruleLead:
      "Describe a requirement. The Agent checks feasibility and existing rules before asking you to replace, retain with a distinct scope, or cancel.",
    proposed: "Proposed requirement",
    analyse: "Analyse proposal",
    feasibility: "Feasibility",
    conflict: "Existing-rule check",
    advice: "Customisation prompts",
    replace: "Replace existing rule",
    keep: "Keep both with a distinct scope",
    cancel: "Cancel",
    catalogue: "Rule catalogue",
    active: "Active",
    draft: "Draft",
    sourceTitle: "Rule-source library",
    sourceLead:
      "Upload a regulation or project requirement, preview the original and turn traceable passages into draft rules.",
    uploadRule: "Upload a rule-source file",
    formats: "PDF, DOCX, XLSX, CSV, IDS, IFC, DXF and text",
    original: "Original preview",
    extractedRules: "Extracted rule catalogue",
    noDoc: "Upload a file to open its private preview and extracted catalogue.",
    official: "Official Hong Kong source registry",
    officialNote:
      "Official documents are linked, not redistributed. Confirm the current edition and copyright terms at source.",
    openSource: "Open official source",
    importRule: "Send to conflict review",
    agentTitle: "Transparent Agent workspace",
    agentLead:
      "A bounded plan–act–verify architecture. The trace shows evidence, tools and decisions—not hidden chain-of-thought.",
    memory: "Project memory",
    memoryText:
      "Stores approved rules, decisions and preferences on this device. It cannot silently approve a rule.",
    clear: "Clear project memory",
    providers: "Provider registry",
    trace: "Execution trace",
    noTrace: "Run a review or analyse a rule to create a trace.",
    reportTitle: "Verified review report",
    reportLead:
      "The narrative is generated only from deterministic findings, then checked for unknown numbers and identifiers.",
    download: "Download Markdown",
    verification: "Report verification",
    valid: "Verified",
    blocked: "Blocked",
    prompt: "Suggested review prompt",
    copyPrompt: "Copy prompt",
    noReport: "Run a review to generate a bilingual evidence report.",
    loaded: "loaded",
    doors: "doors",
    spaces: "spaces",
    licence: "Licence",
    source: "Source",
    decisionNeeded: "Human decision required",
    noApplicable:
      "This valid IFC contains no reviewable doors for the active pack.",
    local: "Evidence-bound",
    lang: "Language",
  },
  zh: {
    nav: {
      review: "审查",
      compare: "版本对比",
      rules: "规则工作室",
      sources: "规则来源",
      agents: "Agent 对话",
      report: "报告",
    },
    strap: "IFC 合规工作空间",
    upload: "上传 IFC 模型",
    uploadHint: "IFC2x3 或 IFC4 · 在本浏览器处理",
    samples: "评估样本",
    activePack: "启用的规则包",
    activeText: "经人工确认的确定性检查。演示阈值不构成法定认证。",
    inspect: "查看规则",
    run: "运行证据审查",
    running: "正在审查证据…",
    evidenceMap: "证据地图",
    viewerHint: "交互式 IFC 几何 · 旋转、平移、缩放、剖切与查看",
    findings: "审查结果",
    ready: "可以开始",
    checks: "项检查已完成",
    evidenceReady: "证据已就绪",
    evidenceReadyText: "运行审查，以已批准规则进行判断，不让 AI 猜测。",
    observed: "观测值",
    required: "要求",
    evidence: "证据",
    reliability: "可靠性",
    next: "Agent 下一步",
    project: "项目",
    preReview: "预审",
    modelEvidence: "证据已从 IFC 模型提取",
    fail: "不通过",
    review: "需复核",
    pass: "通过",
    na: "不适用",
    disclaimer: "仅供专业预审 · 正式图则与合资格专业判断优先",
    compareTitle: "比较模型版本",
    compareLead:
      "上传或选择两个 IFC 版本。系统使用 GlobalId 关联证据差异，无法匹配的标识将列为新构件。",
    baseline: "基线 IFC",
    current: "当前 IFC",
    changed: "已变化",
    resolved: "已解决",
    regressed: "新增问题",
    unchanged: "未变化",
    element: "构件",
    before: "修改前",
    after: "修改后",
    outcome: "结果",
    ruleTitle: "规则工作室",
    ruleLead:
      "描述检查要求。Agent 会先检查可行性和现有规则，再请您选择替换、分范围并存或取消。",
    proposed: "建议规则",
    analyse: "分析建议",
    feasibility: "可行性",
    conflict: "现有规则检查",
    advice: "定制建议",
    replace: "替换现有规则",
    keep: "保留两者并设置不同范围",
    cancel: "取消",
    catalogue: "规则目录",
    active: "已启用",
    draft: "草稿",
    sourceTitle: "规则来源库",
    sourceLead: "上传规范或项目要求，预览原文件，并把可追溯条文转为规则草稿。",
    uploadRule: "上传规则来源文件",
    formats: "PDF、DOCX、XLSX、CSV、IDS、IFC、DXF 及文本",
    original: "原文件预览",
    extractedRules: "提取的规则目录",
    noDoc: "请上传文件，以打开私有预览和提取的规则目录。",
    official: "香港官方来源注册表",
    officialNote:
      "平台只提供官方链接，不重新分发完整文件。请在来源处确认现行版本与版权条款。",
    openSource: "打开官方来源",
    importRule: "送至冲突审查",
    agentTitle: "透明 Agent 工作空间",
    agentLead:
      "采用有边界的计划—执行—验证架构。轨迹展示证据、工具和决策，不展示隐藏思维链。",
    memory: "项目记忆",
    memoryText: "在本设备保存已批准规则、决策和偏好，不能静默批准规则。",
    clear: "清除项目记忆",
    providers: "供应商注册表",
    trace: "执行轨迹",
    noTrace: "运行审查或分析规则后将生成轨迹。",
    reportTitle: "已验证审查报告",
    reportLead: "报告只能依据确定性检查结果生成，并检查未知数值和构件标识。",
    download: "下载 Markdown",
    verification: "报告验证",
    valid: "已验证",
    blocked: "已阻止",
    prompt: "检查报告提示词",
    copyPrompt: "复制提示词",
    noReport: "请先运行审查，以生成双语证据报告。",
    loaded: "已载入",
    doors: "扇门",
    spaces: "个空间",
    licence: "许可证",
    source: "来源",
    decisionNeeded: "需要人工决策",
    noApplicable: "该 IFC 文件有效，但启用规则包中没有可审查的门。",
    local: "证据约束",
    lang: "语言",
  },
} as const;

const blankModel: BuildingModel = {
  id: "empty",
  name: "No model",
  filename: "",
  schema: "—",
  units: "unresolved",
  storeys: 0,
  source: "sample",
  doors: [],
  spaces: [],
};
const BUILD_ID = "EA-0.4.0 · SSD-1.8";
const zhRuleText = "已确认的疏散门净宽不得小于 0.95 米";
const localiseRuleText = (value: string) =>
  ({
    "Add the jurisdiction, source clause, occupancy and any exceptions before approval.":
      "批准前请补充法域、来源条文、建筑用途及例外。",
    "No measurable numerical threshold was found.": "未找到可测量的数值阈值。",
    "The threshold is outside a plausible door-width range (300–3,000 mm); check the unit or decimal place.":
      "阈值超出合理门宽范围（300–3,000 毫米）；请检查单位或小数位。",
    "The target element is unclear; specify doors or a more precise IFC entity.":
      "目标构件不明确；请指定门或更精确的 IFC 实体。",
    "Define whether the rule applies to exit doors, all doors, or a named classification.":
      "请说明规则适用于疏散门、所有门或指定分类。",
  })[value] ?? value;
const localiseScope = (value: string) =>
  ({
    "Doors explicitly classified as exits": "明确分类为疏散门的构件",
    "All IfcDoor elements": "所有 IfcDoor 构件",
    "Confirmed exit doors": "已确认的疏散门",
    "Scope requires confirmation": "适用范围需要确认",
    "Project-specific exit doors; scope confirmed by the user":
      "用户已确认范围的项目疏散门",
  })[value] ?? value;

function Status({
  value,
  locale,
}: {
  value: Finding["status"];
  locale: Locale;
}) {
  const text =
    locale === "zh"
      ? {
          PASS: "通过",
          FAIL: "不通过",
          REVIEW: "需复核",
          NOT_APPLICABLE: "不适用",
        }[value]
      : value.replace("_", " ");
  return <span className={`status status-${value.toLowerCase()}`}>{text}</span>;
}

function ReliabilityLabel({ value, locale }: { value: Finding["reliability"]; locale: Locale }) {
  const labels = locale === "zh"
    ? { EXPLICIT: "明确证据", PROXY: "替代证据", MISSING: "证据缺失", DERIVED: "推导证据" }
    : { EXPLICIT: "Explicit evidence", PROXY: "Proxy evidence", MISSING: "Missing evidence", DERIVED: "Derived evidence" };
  return <>{labels[value]}</>;
}

export default function EvidenceAgentApp({ viewer }: { viewer: { displayName: string; email: string } }) {
  const [view, setView] = useState<View>("review");
  const [locale, setLocale] = useState<Locale>("en");
  const t = copy[locale];
  const [model, setModel] = useState<BuildingModel>(blankModel);
  const [baseline, setBaseline] = useState<BuildingModel>(blankModel);
  const [modelSource, setModelSource] = useState<string | ArrayBuffer | null>(
    null,
  );
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedElement, setSelectedElement] = useState<ViewerElement | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [loadingSampleId, setLoadingSampleId] = useState<string>();
  const [toast, setToast] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"ALL" | Finding["status"]>(
    "ALL",
  );
  const [reviewStorey, setReviewStorey] = useState("ALL");
  const [rules, setRules] = useState<RuleDefinition[]>(builtinRules);
  const [ruleText, setRuleText] = useState(
    "Confirmed exit doors must provide at least 0.95 m clear width",
  );
  const [proposal, setProposal] = useState<ReturnType<typeof proposeRule>>();
  const [document, setDocument] = useState<RuleDocument>();
  const [docBusy, setDocBusy] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [memory, setMemory] = useState<ProjectMemory>(() => emptyMemory());
  const [provider, setProvider] = useState<AgentProvider["id"]>("local");
  const [rulePackages, setRulePackages] = useState<RulePackage[]>([
    builtinRulePackage,
  ]);
  const [draftPackage, setDraftPackage] = useState<RulePackage>();
  const [selectedPackageId, setSelectedPackageId] = useState(
    builtinRulePackage.id,
  );
  const [reportBrief, setReportBriefState] = useState<ReportBrief>(() =>
    defaultReportBrief("en"),
  );
  const [reportInput, setReportInput] = useState("");
  const [reportMessages, setReportMessages] = useState<
    { role: "agent" | "user"; text: string }[]
  >([
    {
      role: "agent",
      text: "Tell me who will read the report and what they need. I will turn that into an editable brief—no prompt copying required.",
    },
  ]);
  const [reportReady, setReportReady] = useState(false);
  const [reportContext, setReportContext] = useState("");
  const [reportNarrative, setReportNarrative] = useState("");
  const [reportMode, setReportMode] = useState<"local" | "openai" | "fallback">(
    "local",
  );
  const [reportAiBusy, setReportAiBusy] = useState(false);
  const [reportAuthMode, setReportAuthMode] = useState<"operator" | "byok">(
    "operator",
  );
  const [reportApiKey, setReportApiKey] = useState("");
  const [reportModel, setReportModel] = useState("gpt-5.6");
  const [humanReviews, setHumanReviews] = useState<HumanReviewRecord[]>([]);
  const [evidenceOverrides, setEvidenceOverrides] = useState<
    ElementEvidenceOverride[]
  >([]);
  const [agentEvidenceProposal, setAgentEvidenceProposal] =
    useState<Partial<OverrideDraft> | null>(null);
  const modelFile = useRef<HTMLInputElement>(null);
  const baselineFile = useRef<HTMLInputElement>(null);
  const ruleFile = useRef<HTMLInputElement>(null);
  const reportInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const remembered = loadMemory();
      setMemory(remembered);
      if (remembered.rules.length)
        setRules([...builtinRules, ...remembered.rules]);
      if (remembered.reportBrief)
        setReportBriefState({
          ...defaultReportBrief("en"),
          ...remembered.reportBrief,
        } as ReportBrief);
      if (remembered.reportMessages?.length)
        setReportMessages(remembered.reportMessages);
      setHumanReviews(remembered.humanReviews ?? []);
      setEvidenceOverrides(remembered.evidenceOverrides ?? []);
      if (remembered.rulePackages?.length)
        setRulePackages([
          builtinRulePackage,
          ...remembered.rulePackages.filter(
            (item) => item.id !== builtinRulePackage.id,
          ),
        ]);
      if (remembered.selectedRulePackageId)
        setSelectedPackageId(remembered.selectedRulePackageId);
    });
    void loadSample(assessmentSamples[0], true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reviewedModel = useMemo(
    () => effectiveModel(model, evidenceOverrides),
    [model, evidenceOverrides],
  );
  const visibleFindings = useMemo(
    () =>
      selectedElement
        ? filterFindingsForSelection(findings, selectedElement.globalId)
        : findings.filter((finding) => {
            if (reviewStatus !== "ALL" && finding.status !== reviewStatus)
              return false;
            if (
              reviewStorey !== "ALL" &&
              reviewedModel.doors.find(
                (door) => door.globalId === finding.elementId,
              )?.storey !== reviewStorey
            )
              return false;
            return true;
          }),
    [
      findings,
      reviewedModel.doors,
      reviewStatus,
      reviewStorey,
      selectedElement,
    ],
  );
  const selected = findings.find((item) => item.id === selectedId);
  const selectedPackage =
    rulePackages.find((item) => item.id === selectedPackageId) ??
    builtinRulePackage;
  const activeRules = rulesForPackage(selectedPackage, rules);
  const summary = useMemo(
    () =>
      Object.fromEntries(
        ["FAIL", "REVIEW", "PASS", "NOT_APPLICABLE"].map((status) => [
          status,
          visibleFindings.filter((item) => item.status === status).length,
        ]),
      ) as Record<Finding["status"], number>,
    [visibleFindings],
  );
  const storeyByElement = useMemo(
    () =>
      Object.fromEntries(
        reviewedModel.doors.map((door) => [door.globalId, door.storey]),
      ),
    [reviewedModel.doors],
  );
  const reportFindings = useMemo(
    () =>
      findingsForBrief(findings, reportBrief, {
        selectedElementId: selectedElement?.globalId,
        storeyByElement,
      }),
    [findings, reportBrief, selectedElement?.globalId, storeyByElement],
  );
  const comparison = useMemo(
    () => compareModels(baseline, reviewedModel, activeRules),
    [baseline, reviewedModel, activeRules],
  );
  const baseReport = useMemo(() => {
    const human = reportBrief.includeHumanReview
      ? { reviews: humanReviews, overrides: evidenceOverrides }
      : undefined;
    const includedIds = new Set(reportFindings.map((finding) => finding.id));
    const englishFindings = analyseModel(reviewedModel, activeRules, "en").filter((finding) => includedIds.has(finding.id));
    const chineseFindings = analyseModel(reviewedModel, activeRules, "zh").filter((finding) => includedIds.has(finding.id));
    const english = buildReport(reviewedModel, englishFindings, "en", human, reportBrief.detail);
    const chinese = buildReport(reviewedModel, chineseFindings, "zh", human, reportBrief.detail);
    const base =
      reportBrief.language === "bilingual"
        ? `${english}\n\n---\n\n${chinese}`
        : reportBrief.language === "zh"
          ? chinese
          : english;
    const packHeader =
      reportBrief.language === "zh"
        ? `> 规则包：${selectedPackage.name} · v${selectedPackage.version}`
        : `> Rule package: ${selectedPackage.name} · v${selectedPackage.version}`;
    return base.replace(/\n\n/, `\n\n${packHeader}\n\n`);
  }, [
    reviewedModel,
    reportFindings,
    reportBrief.language,
    reportBrief.includeHumanReview,
    reportBrief.detail,
    humanReviews,
    evidenceOverrides,
    activeRules,
    selectedPackage.name,
    selectedPackage.version,
  ]);
  const report = useMemo(
    () =>
      `${baseReport}${reportNarrative ? `\n\n## ${reportBrief.language === "zh" ? "AI 专业叙述（已验证）" : "Verified AI professional narrative"}\n\n${reportNarrative}\n` : ""}`,
    [baseReport, reportNarrative, reportBrief.language],
  );
  const verification = useMemo(
    () =>
      reportFindings.length
        ? verifyReport(report, reportFindings, { requireEveryFinding: reportBrief.detail === "per-finding" })
        : { valid: false, issues: [] },
    [report, reportFindings, reportBrief.detail],
  );
  const packageExecution = useMemo(
    () => executionRecords(selectedPackage, findings, locale),
    [selectedPackage, findings, locale],
  );
  const currentReportContext = `${model.id}:${selectedPackage.id}-v${selectedPackage.version}:${activeRules.map((rule) => `${rule.id}-v${rule.version}`).join(",")}:${findings.map((finding) => `${finding.id}:${finding.status}`).join(",")}`;
  const reportStale = reportReady && reportContext !== currentReportContext;
  const prompt = buildExternalInstruction(
    model.name,
    model.units,
    activeRules.map(
      (rule) =>
        `${rule.title.en}${rule.threshold ? ` (≥ ${rule.threshold} mm)` : ""}`,
    ),
    reportFindings,
    reportBrief,
  );
  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const persistHumanReviews = (next: HumanReviewRecord[]) => {
    setHumanReviews(next);
    setMemory((current) => {
      const updated = { ...current, humanReviews: next };
      saveMemory(updated);
      return updated;
    });
  };
  const persistEvidenceOverrides = (next: ElementEvidenceOverride[]) => {
    setEvidenceOverrides(next);
    setMemory((current) => {
      const updated = { ...current, evidenceOverrides: next };
      saveMemory(updated);
      return updated;
    });
  };
  const persistRulePackages = (
    next: RulePackage[],
    activeId = selectedPackageId,
  ) => {
    setRulePackages(next);
    setSelectedPackageId(activeId);
    setMemory((current) => {
      const updated = {
        ...current,
        rulePackages: next.filter((item) => item.id !== builtinRulePackage.id),
        selectedRulePackageId: activeId,
      };
      saveMemory(updated);
      return updated;
    });
  };
  const invalidateReport = () => {
    setReportReady(false);
    setReportNarrative("");
    setReportMode("local");
  };
  const setReportBrief = (next: SetStateAction<ReportBrief>) => {
    setReportBriefState(next);
    invalidateReport();
  };
  const recalculateWithOverrides = (next: ElementEvidenceOverride[]) => {
    const results = analyseModel(
      effectiveModel(model, next),
      activeRules,
      locale,
    );
    setFindings(results);
    setSelectedId((current) => results.find((item) => item.id === current)?.id);
    invalidateReport();
  };
  const recordHumanAudit = (summaryText: string, evidence: string) => {
    const event = audit("user", "human-review", summaryText, evidence);
    setEvents((current) => [event, ...current].slice(0, 80));
    setMemory((current) => {
      const updated = {
        ...current,
        events: [event, ...current.events].slice(0, 80),
      };
      saveMemory(updated);
      return updated;
    });
  };
  const jumpToStatus = (status: Finding["status"]) => {
    const id = nextFindingByStatus(findings, status, selectedId);
    const finding = findings.find((item) => item.id === id);
    if (finding) selectFinding(finding);
    else
      flash(
        locale === "zh"
          ? `没有${status === "FAIL" ? "不通过" : "需复核"}结果`
          : `No ${status.toLowerCase()} findings`,
      );
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!shouldHandleReviewShortcut(event.target)) return;
      if (event.key.toLowerCase() === "f") jumpToStatus("FAIL");
      if (event.key.toLowerCase() === "r") jumpToStatus("REVIEW");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const changeLocale = (next: Locale) => {
    setLocale(next);
    setReportBrief((current) => ({ ...current, language: next }));
    setReportMessages((current) =>
      current.length === 1
        ? [
            {
              role: "agent",
              text:
                next === "zh"
                  ? "请直接告诉我报告给谁看、重点是什么。我会整理成可编辑简报，无需复制提示词。"
                  : "Tell me who will read the report and what they need. I will turn that into an editable brief—no prompt copying required.",
            },
          ]
        : current,
    );
    setRuleText((current) =>
      current ===
        "Confirmed exit doors must provide at least 0.95 m clear width" &&
      next === "zh"
        ? zhRuleText
        : current === zhRuleText && next === "en"
          ? "Confirmed exit doors must provide at least 0.95 m clear width"
          : current,
    );
    if (findings.length) {
      const translated = analyseModel(reviewedModel, activeRules, next);
      setFindings(translated);
      setSelectedId(
        (current) => translated.find((item) => item.id === current)?.id,
      );
    }
  };

  async function loadSample(
    sample: (typeof assessmentSamples)[number],
    initial = false,
  ) {
    if (loadingSampleId && !initial) return;
    try {
      if (!initial) {
        setLoadingSampleId(sample.id);
      }
      const response = await fetch(sample.path);
      if (!response.ok) {
        throw new Error(`Sample download failed (HTTP ${response.status}).`);
      }
      const buffer = await response.arrayBuffer();
      const parsed = parseIfc(
        new TextDecoder().decode(buffer),
        sample.filename,
        "sample",
      );
      const enriched = {
        ...parsed,
        id: sample.id,
        name: sample.label[locale],
        provenance: sample.note[locale],
        licence: sample.licence,
        sourceUrl: sample.sourceUrl,
      };
      setModel(enriched);
      setModelSource(buffer);
      if (initial || baseline.id === "empty") setBaseline(enriched);
      setFindings([]);
      setSelectedId(undefined);
      setSelectedElement(null);
      invalidateReport();
      if (!initial) {
        persistHumanReviews([]);
        persistEvidenceOverrides([]);
        flash(`${sample.label[locale]} ${t.loaded}`);
      }
    } catch (error) {
      flash(
        error instanceof Error ? error.message : "Sample could not be loaded.",
      );
    } finally {
      if (!initial) setLoadingSampleId(undefined);
    }
  }

  async function loadIfc(
    file: File | undefined,
    target: "current" | "baseline",
  ) {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseIfc(new TextDecoder().decode(buffer), file.name);
      if (target === "baseline") setBaseline(parsed);
      else {
        setModel(parsed);
        setModelSource(buffer);
        setFindings([]);
        setSelectedId(undefined);
        setSelectedElement(null);
        invalidateReport();
        persistHumanReviews([]);
        persistEvidenceOverrides([]);
      }
      flash(`${file.name} ${t.loaded}`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "IFC could not be read.");
    }
  }

  function runReview() {
    setBusy(true);
    setSelectedId(undefined);
    setSelectedElement(null);
    invalidateReport();
    window.setTimeout(() => {
      const results = analyseModel(reviewedModel, activeRules, locale);
      setFindings(results);
      const trace = reviewTrace(
        reviewedModel.name,
        activeRules.length,
        results.length,
        locale,
      );
      setEvents((current) =>
        [
          audit(
            "rule-engine",
            "package-execution",
            `${selectedPackage.name} · ${activeRules.length} executable rules`,
            `${results.length} findings · zero-applicability rules retained in execution summary`,
          ),
          ...trace,
          ...current,
        ].slice(0, 80),
      );
      setBusy(false);
      flash(
        locale === "zh"
          ? `审查完成 · ${results.length} 项可追溯结果`
          : `Review complete · ${results.length} traceable findings`,
      );
    }, 180);
  }

  function inspectProposal(text = ruleText) {
    const knownRules = [...rules, ...activeRules].filter(
      (rule, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.id === rule.id && candidate.version === rule.version,
        ) === index,
    );
    const result = proposeRule(text, knownRules);
    setProposal(result);
    setEvents((current) => [
      audit(
        "rule-agent",
        "conflict-check",
        `${result.conflict.kind}: ${result.conflict.summary[locale]}`,
        `${locale === "zh" ? "可行性" : "Feasibility"} ${result.feasibility.score}/100`,
      ),
      ...current,
    ]);
  }

  function decide(action: "replace" | "keep" | "cancel") {
    if (!proposal) return;
    if (action !== "cancel" && !proposal.feasibility.valid) {
      flash(
        locale === "zh"
          ? "规则尚不可执行，请先修正可行性问题。"
          : "The rule is not executable yet; resolve the feasibility issues first.",
      );
      return;
    }
    const next = resolveRuleProposal(proposal.rule, action, rules);
    setRules(next);
    setProposal(undefined);
    if (action !== "cancel") {
      const approved = next.filter(
        (item) => item.id === proposal.rule.id && item.status === "ACTIVE",
      );
      const nextMemory = {
        ...memory,
        rules: [
          ...memory.rules.filter((item) => item.id !== proposal.rule.id),
          ...approved,
        ],
        decisions: [
          ...memory.decisions,
          {
            at: new Date().toISOString(),
            decision: action,
            ruleId: proposal.rule.id,
          },
        ],
        events: [
          audit("user", "rule-approval", `${action}: ${proposal.rule.id}`),
          ...memory.events,
        ],
      };
      setMemory(nextMemory);
      saveMemory(nextMemory);
    }
    flash(
      action === "cancel"
        ? locale === "zh"
          ? "已取消规则建议"
          : "Proposal cancelled"
        : locale === "zh"
          ? "规则已由人工确认并启用"
          : "Rule approved and activated by the user",
    );
  }

  async function loadRuleFile(file?: File) {
    if (!file) return;
    setDocBusy(true);
    try {
      const next = await readRuleDocument(file);
      if (document?.previewUrl) URL.revokeObjectURL(document.previewUrl);
      setDocument(next);
      setDraftPackage(createRulePackageDraft(next));
      setEvents((current) => [
        audit(
          "document-agent",
          "document-extraction",
          locale === "zh"
            ? `已读取 ${file.name}；${next.characterCount} 个字符；${next.rules.length} 条候选规则。`
            : `Read ${file.name}; ${next.characterCount} characters; ${next.rules.length} candidate rules.`,
          `SHA-256 ${next.hash} · ${next.extractionStatus}`,
        ),
        ...current,
      ]);
      flash(
        next.extractionStatus === "EXTRACTION_ERROR"
          ? locale === "zh"
            ? "PDF 可预览，但文字提取失败"
            : "PDF previewed, but text extraction failed"
          : locale === "zh"
            ? `已读取 ${next.characterCount} 个字符；请逐条确认后打包`
            : `Read ${next.characterCount} characters; review every entry before packaging`,
      );
    } catch (error) {
      flash(
        error instanceof Error ? error.message : "Document could not be read.",
      );
    } finally {
      setDocBusy(false);
    }
  }

  function editPackageEntry(
    entryId: string,
    patch: {
      sourceText?: string;
      decision?: RulePackageDecision;
      confirmed?: boolean;
      reviewerNote?: string;
      threshold?: number;
    },
  ) {
    setDraftPackage((current) =>
      current ? updateRulePackageEntry(current, entryId, patch) : current,
    );
  }

  function confirmRulePackage() {
    if (!draftPackage) return;
    const readiness = rulePackageReadiness(draftPackage);
    if (!readiness.ready) {
      flash(
        locale === "zh"
          ? readiness.issues
              .map((item) =>
                item ===
                "Every extracted entry requires an explicit human decision."
                  ? "每条提取内容都需要人工确认。"
                  : item,
              )
              .join(" ")
          : readiness.issues.join(" "),
      );
      return;
    }
    try {
      const ready = finaliseRulePackage(draftPackage);
      const next = [
        ...rulePackages.filter((item) => item.id !== ready.id),
        ready,
      ];
      persistRulePackages(next, ready.id);
      setDraftPackage(undefined);
      setFindings([]);
      invalidateReport();
      setEvents((current) => [
        audit(
          "user",
          "rule-package-confirmed",
          `${ready.name} · v${ready.version}`,
          `${ready.entries.length} reviewed entries · ${rulesForPackage(ready).length} executable`,
        ),
        ...current,
      ]);
      flash(
        locale === "zh"
          ? "规则包已确认并送至模型审查"
          : "Rule package confirmed and made available for model review",
      );
    } catch (error) {
      flash(
        error instanceof Error
          ? error.message
          : "The rule package could not be confirmed.",
      );
    }
  }

  function downloadReport() {
    if (!verification.valid) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement("a");
    anchor.href = url;
    anchor.download = `${model.name.replace(/\W+/g, "-").toLowerCase()}-${locale}-report.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const selectViewerElement = (element: ViewerElement | null) => {
    setSelectedElement(element);
    setSelectedId(
      element
        ? findings.find((item) => item.elementId === element.globalId)?.id
        : undefined,
    );
  };
  const selectFinding = (finding: Finding) => {
    setSelectedId(finding.id);
    const door = reviewedModel.doors.find(
      (item) => item.globalId === finding.elementId,
    );
    setSelectedElement({
      globalId: finding.elementId,
      expressId: finding.expressId,
      entityType: "IfcDoor",
      name: door?.name || finding.elementName,
    });
  };
  function sendReportMessage() {
    const input = reportInput.trim();
    if (!input) return;
    const result = interpretReportRequest(input, reportBrief, locale);
    const explanation =
      result.intent === "explain-finding" && selected
        ? `${selected.elementName}: ${selected.message} ${selected.nextStep} [${selected.evidencePath}]`
        : undefined;
    const nextMessages = [
      ...reportMessages,
      { role: "user" as const, text: input },
      {
        role: "agent" as const,
        text: [result.reply, ...result.warnings].join(" "),
      },
      ...(explanation ? [{ role: "agent" as const, text: explanation }] : []),
    ];
    setReportMessages(nextMessages);
    setReportInput("");
    if (result.intent === "configure-report") setReportBrief(result.brief);
    if (result.intent === "rule-change") setRuleText(input);
    const nextMemory = {
      ...memory,
      reportBrief: result.brief as unknown as Record<string, unknown>,
      reportMessages: nextMessages.slice(-30),
    };
    setMemory(nextMemory);
    saveMemory(nextMemory);
    setEvents((current) => [
      audit(
        "report-agent",
        result.intent,
        result.reply,
        result.warnings.join(" ") || "Deterministic local interpreter",
      ),
      ...current,
    ]);
  }
  function generateConfiguredReport() {
    if (!reportFindings.length) {
      flash(
        locale === "zh"
          ? "当前简报没有选择任何可报告结果。"
          : "The current brief selects no reportable findings.",
      );
      return;
    }
    setReportReady(true);
    setReportContext(currentReportContext);
    setEvents((current) => [
      audit(
        "report-agent",
        "report-generate",
        `${reportFindings.length} grounded findings`,
        `Verifier: ${verification.valid ? "passed" : "blocked"}`,
      ),
      ...current,
    ]);
    flash(
      locale === "zh"
        ? "已按确认简报生成并验证报告"
        : "Report generated and verified from the confirmed brief",
    );
  }

  async function generateAiReport() {
    if (!reportFindings.length || reportAiBusy) return;
    setReportAiBusy(true);
    setReportNarrative("");
    const languageInstruction =
      reportBrief.language === "zh"
        ? "Use professional Simplified Chinese."
        : reportBrief.language === "bilingual"
          ? "Write each section first in native British English and then in professional Simplified Chinese. Keep the two versions semantically equivalent."
          : "Use native British English.";
    const message = `Write a professional ${reportBrief.detail === "per-finding" ? "finding-by-finding" : "summary"} narrative for the ${reportBrief.audience} using every supplied deterministic result. ${languageInstruction} Do not change any status, number, GlobalId, rule or evidence path.`;
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-evidence-agent-auth": reportAuthMode,
          ...(reportAuthMode === "byok"
            ? { "x-evidence-openai-key": reportApiKey.trim() }
            : {}),
        },
        body: JSON.stringify({
          model: reportModel,
          role: "report",
          message,
          history: [],
          context: {
            modelName: model.name,
            locale: reportBrief.language === "zh" ? "zh" : "en",
            findings: reportFindings,
            rules: activeRules,
            selectedFindingId: selected?.id,
            reviewCount: humanReviews.length,
            overrideCount: evidenceOverrides.length,
          },
        }),
      });
      const value = (await response.json()) as {
        ok?: boolean;
        envelope?: { answer?: string };
        error?: { message?: string };
      };
      if (!response.ok || !value.ok || !value.envelope?.answer)
        throw new Error(
          value.error?.message ??
            "OpenAI did not return a verified report narrative.",
        );
      const candidate = `${baseReport}\n\n${value.envelope.answer}`;
      const checked = verifyReport(candidate, reportFindings, { requireEveryFinding: reportBrief.detail === "per-finding" });
      if (!checked.valid)
        throw new Error(
          `AI narrative verification failed: ${checked.issues.join(" ")}`,
        );
      setReportNarrative(value.envelope.answer);
      setReportMode("openai");
      setReportReady(true);
      setReportContext(currentReportContext);
      setEvents((current) => [
        audit(
          "report-agent",
          "openai-report",
          `${reportFindings.length} grounded findings`,
          "Structured response and final report verifier passed",
        ),
        ...current,
      ]);
      flash(
        locale === "zh"
          ? "AI 报告叙述已生成并通过事实校验"
          : "AI report narrative generated and passed factual verification",
      );
    } catch (error) {
      setReportMode("fallback");
      setReportReady(true);
      setReportContext(currentReportContext);
      const reason =
        error instanceof Error ? error.message : "AI report generation failed.";
      setEvents((current) => [
        audit(
          "report-agent",
          "safe-fallback",
          "Local deterministic report retained",
          reason,
        ),
        ...current,
      ]);
      flash(
        locale === "zh"
          ? "AI 未完成；已保留完整的本地确定性报告"
          : "AI did not complete; the complete deterministic report was retained",
      );
    } finally {
      setReportAiBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setView("review")}
          aria-label="Review workspace"
        >
          <span className="brand-mark">EA</span>
          <span>
            <strong>Evidence Agent</strong>
            <small>{t.strap}</small>
          </span>
        </button>
        <nav aria-label="Workspace views">
          {(
            [
              "review",
              "compare",
              "rules",
              "sources",
              "agents",
              "report",
            ] as View[]
          ).map((item) => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              onClick={() => setView(item)}
            >
              {t.nav[item]}
              {item === "compare" && comparison.changed > 0 ? (
                <em>{comparison.changed}</em>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <div className="language-switch" aria-label={t.lang}>
            <button
              className={locale === "en" ? "selected" : ""}
              onClick={() => changeLocale("en")}
            >
              EN
            </button>
            <button
              className={locale === "zh" ? "selected" : ""}
              onClick={() => changeLocale("zh")}
            >
              中文
            </button>
          </div>
          <span className="local-badge">
            <i /> {t.local}
          </span>
          <span className="identity-chip" title={viewer.email}>
            <b>{viewer.displayName.slice(0, 1).toUpperCase()}</b>
            <span>{viewer.displayName}</span>
          </span>
          <a className="sign-out" href="/signout-with-chatgpt?return_to=%2F">
            {locale === "zh" ? "退出" : "Sign out"}
          </a>
        </div>
      </header>

      {view === "review" && (
        <section className="workspace">
          <aside className="rail">
            <div className="eyebrow">
              {locale === "zh" ? "模型导入" : "MODEL INTAKE"}
            </div>
            <button
              className="upload"
              onClick={() => modelFile.current?.click()}
            >
              <span>↑</span>
              <strong>{t.upload}</strong>
              <small>{t.uploadHint}</small>
            </button>
            <input
              ref={modelFile}
              hidden
              type="file"
              accept=".ifc"
              onChange={(event) =>
                void loadIfc(event.target.files?.[0], "current")
              }
            />
            <div className="sample-title">
              <span>{t.samples}</span>
              <span>{assessmentSamples.length}</span>
            </div>
            {assessmentSamples.map((sample) => (
              <button
                className={`sample ${model.id === sample.id ? "current" : ""} ${loadingSampleId === sample.id ? "sample-loading" : ""}`}
                key={sample.id}
                onClick={() => void loadSample(sample)}
                disabled={Boolean(loadingSampleId)}
                aria-pressed={model.id === sample.id}
                aria-busy={loadingSampleId === sample.id}
              >
                <span className="file-icon">IFC</span>
                <span>
                  <strong>{sample.label[locale]}</strong>
                  <small>
                    {loadingSampleId === sample.id
                      ? locale === "zh"
                        ? "正在载入并解析模型…"
                        : "Loading and parsing model…"
                      : sample.note[locale]}
                  </small>
                  <small>
                    {sample.schema} · {sample.licence}
                  </small>
                </span>
              </button>
            ))}
            <div className="scope-card">
              <div className="eyebrow">{t.activePack}</div>
              <label className="pack-selector">
                <span>
                  {locale === "zh" ? "审查规则包" : "Review rule package"}
                </span>
                <select
                  value={selectedPackage.id}
                  onChange={(event) => {
                    const id = event.target.value;
                    persistRulePackages(rulePackages, id);
                    setFindings([]);
                    setSelectedId(undefined);
                    setSelectedElement(null);
                    invalidateReport();
                  }}
                >
                  <option value={builtinRulePackage.id}>
                    {builtinRulePackage.name}
                  </option>
                  {rulePackages
                    .filter(
                      (item) =>
                        item.id !== builtinRulePackage.id &&
                        item.status === "READY",
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · v{item.version}
                      </option>
                    ))}
                </select>
              </label>
              <strong>
                {activeRules.length}{" "}
                {locale === "zh" ? "条可执行规则" : "executable rules"}
              </strong>
              <p>{t.activeText}</p>
              <button onClick={() => setView("sources")}>
                {locale === "zh" ? "管理规则包" : "Manage packages"} →
              </button>
            </div>
          </aside>
          <section className="review-main">
            <div className="model-heading">
              <div>
                <span className="breadcrumb">
                  {t.project} / {model.schema} / {t.preReview}
                </span>
                <h1>{model.name}</h1>
                <p>
                  {model.doors.length} {t.doors} · {model.spaces.length}{" "}
                  {t.spaces} · {t.modelEvidence}
                </p>
                {model.provenance && (
                  <p className="provenance">
                    {model.provenance} · {t.licence}: {model.licence}
                  </p>
                )}
              </div>
              <button
                className="primary"
                onClick={runReview}
                disabled={busy || model.id === "empty"}
              >
                {busy ? t.running : t.run}
              </button>
            </div>
            <div className="canvas-card">
              <div className="canvas-toolbar">
                <span>
                  <b>{t.evidenceMap}</b>
                  <small>
                    {t.viewerHint} ·{" "}
                    {locale === "zh"
                      ? "悬停高亮；重复单击选择内部构件；Esc 清除"
                      : "hover highlights; click repeatedly for internal elements; Esc clears"}
                  </small>
                </span>
                <span className="review-tools">
                  <button onClick={() => jumpToStatus("FAIL")}>
                    F · {t.fail}
                  </button>
                  <button onClick={() => jumpToStatus("REVIEW")}>
                    R · {t.review}
                  </button>
                  <span className="legend">
                    <i className="dot-fail" /> {t.fail}{" "}
                    <i className="dot-review" /> {t.review}{" "}
                    <i className="dot-pass" /> {t.pass}
                  </span>
                </span>
              </div>
              <IfcViewer
                source={modelSource}
                sourceKey={model.id}
                findings={findings}
                selectedGlobalId={selectedElement?.globalId}
                onSelect={selectViewerElement}
                locale={locale}
              />
            </div>
            <div className="package-run-summary">
              <header>
                <span>
                  <b>
                    {locale === "zh"
                      ? "规则包执行记录"
                      : "Rule-package execution record"}
                  </b>
                  <small>
                    {selectedPackage.name} · v{selectedPackage.version}
                  </small>
                </span>
                <small>
                  {locale === "zh"
                    ? "没有适用构件的规则仍会保留"
                    : "Rules with no applicable elements remain visible"}
                </small>
              </header>
              <div>
                {packageExecution.map((record) => (
                  <article
                    key={record.entryId}
                    className={`execution-${record.outcome.toLowerCase()}`}
                  >
                    <span>{record.outcome.replaceAll("_", " ")}</span>
                    <strong>{record.title}</strong>
                    <small>
                      {record.ruleId ??
                        (locale === "zh"
                          ? "参考条文"
                          : "Reference passage")}{" "}
                      · {record.findingCount}{" "}
                      {locale === "zh" ? "项结果" : "findings"}
                    </small>
                  </article>
                ))}
              </div>
            </div>
            <div className="assurance-row">
              <div>
                <span>01</span>
                <strong>
                  {locale === "zh" ? "确定性判定" : "Deterministic verdicts"}
                </strong>
                <small>
                  {locale === "zh"
                    ? "Agent 不能改变规则引擎结果。"
                    : "The Agent cannot alter rule-engine outcomes."}
                </small>
              </div>
              <div>
                <span>02</span>
                <strong>
                  {locale === "zh" ? "明确不确定性" : "Explicit uncertainty"}
                </strong>
                <small>
                  {locale === "zh"
                    ? "代理值或缺失证据将标为需复核。"
                    : "Proxy or missing evidence becomes REVIEW."}
                </small>
              </div>
              <div>
                <span>03</span>
                <strong>
                  {locale === "zh" ? "可追溯证据" : "Traceable evidence"}
                </strong>
                <small>
                  {locale === "zh"
                    ? "每项结果关联 IFC GlobalId。"
                    : "Every finding links to an IFC GlobalId."}
                </small>
              </div>
            </div>
          </section>
          <aside className="results-panel">
            <div className="results-head">
              <span>
                <b>{t.findings}</b>
                <small>
                  {findings.length
                    ? `${visibleFindings.length} ${selectedElement ? (locale === "zh" ? "项选中构件结果" : "findings for selected element") : t.checks}`
                    : t.ready}
                </small>
              </span>
              {selectedElement && (
                <button
                  className="clear-selection"
                  onClick={() => selectViewerElement(null)}
                >
                  {locale === "zh" ? "返回全部结果" : "Back to all findings"}
                </button>
              )}
            </div>
            {!selectedElement && findings.length > 0 && (
              <div className="finding-filters">
                <select
                  aria-label={
                    locale === "zh" ? "按状态筛选" : "Filter by status"
                  }
                  value={reviewStatus}
                  onChange={(event) =>
                    setReviewStatus(event.target.value as typeof reviewStatus)
                  }
                >
                  <option value="ALL">
                    {locale === "zh" ? "所有状态" : "All statuses"}
                  </option>
                  <option value="FAIL">{t.fail}</option>
                  <option value="REVIEW">{t.review}</option>
                  <option value="PASS">{t.pass}</option>
                  <option value="NOT_APPLICABLE">{t.na}</option>
                </select>
                <select
                  aria-label={
                    locale === "zh" ? "按楼层筛选" : "Filter by storey"
                  }
                  value={reviewStorey}
                  onChange={(event) => setReviewStorey(event.target.value)}
                >
                  <option value="ALL">
                    {locale === "zh" ? "整个模型" : "Whole model"}
                  </option>
                  {(model.storeyNames ?? []).map((storey) => (
                    <option key={storey} value={storey}>
                      {storey}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="metrics">
              <div>
                <strong>{summary.FAIL}</strong>
                <span>{t.fail}</span>
              </div>
              <div>
                <strong>{summary.REVIEW}</strong>
                <span>{t.review}</span>
              </div>
              <div>
                <strong>{summary.PASS}</strong>
                <span>{t.pass}</span>
              </div>
              <div>
                <strong>{summary.NOT_APPLICABLE}</strong>
                <span>{t.na}</span>
              </div>
            </div>
            {!findings.length ? (
              <div className="empty-results">
                <span>◎</span>
                <h2>
                  {model.id !== "empty" && model.doors.length === 0
                    ? t.noApplicable
                    : t.evidenceReady}
                </h2>
                <p>{t.evidenceReadyText}</p>
              </div>
            ) : selectedElement && !visibleFindings.length ? (
              <div className="element-evidence-empty">
                <span>ELEMENT EVIDENCE</span>
                <h2>{selectedElement.name}</h2>
                <code>
                  {selectedElement.entityType} · {selectedElement.globalId}
                </code>
                <p>
                  {locale === "zh"
                    ? "该构件已从 IFC 几何中识别，但目前没有启用规则适用于它。这不是“通过”结论。"
                    : "This element is identified in the IFC geometry, but no active rule currently applies to it. This is not a PASS verdict."}
                </p>
                <button onClick={() => selectViewerElement(null)}>
                  {locale === "zh" ? "返回全部结果" : "Back to all findings"}
                </button>
              </div>
            ) : (
              <>
                <div className="finding-list">
                  {visibleFindings.map((finding) => {
                    const human = humanReviews
                      .filter((item) => item.elementId === finding.elementId)
                      .at(-1);
                    return (
                      <button
                        className={
                          selected?.id === finding.id ? "selected-finding" : ""
                        }
                        key={finding.id}
                        onClick={() => selectFinding(finding)}
                      >
                        <Status value={finding.status} locale={locale} />
                        <span>
                          <strong>{finding.elementName}</strong>
                          <small>{finding.ruleTitle}</small>
                          {human && (
                            <small className="human-mini">
                              {locale === "zh" ? "人工" : "Human"}:{" "}
                              {human.disposition.replaceAll("_", " ")}
                            </small>
                          )}
                        </span>
                        <b>›</b>
                      </button>
                    );
                  })}
                </div>
                {selected &&
                  visibleFindings.some((item) => item.id === selected.id) && (
                    <div className="evidence-drawer">
                      <div className="drawer-title">
                        <Status value={selected.status} locale={locale} />
                        <span>
                          {selected.elementName}
                          <small>{selected.elementId}</small>
                        </span>
                      </div>
                      <div className="machine-verdict-lock">
                        {locale === "zh"
                          ? "机器结论只读；人工状态单独记录"
                          : "Machine verdict is read-only; human judgement is recorded separately"}
                      </div>
                      <h3>
                        {locale === "zh"
                          ? "为什么得到这个结果？"
                          : "Why this result?"}
                      </h3>
                      <p>{selected.message}</p>
                      <dl>
                        <div>
                          <dt>{t.observed}</dt>
                          <dd>{selected.observed}</dd>
                        </div>
                        <div>
                          <dt>{t.required}</dt>
                          <dd>{selected.required}</dd>
                        </div>
                        {selected.observedValue !== undefined &&
                          selected.thresholdValue !== undefined && (
                            <div>
                              <dt>{locale === "zh" ? "差额" : "Difference"}</dt>
                              <dd>
                                {selected.observedValue -
                                  selected.thresholdValue}{" "}
                                mm
                              </dd>
                            </div>
                          )}
                        <div>
                          <dt>{t.evidence}</dt>
                          <dd>{selected.evidencePath}</dd>
                        </div>
                        <div>
                          <dt>
                            {locale === "zh" ? "规则来源" : "Rule source"}
                          </dt>
                          <dd>
                            {activeRules.find((rule) => rule.id === selected.ruleId)
                              ?.sourceAnchor ?? selected.ruleId}
                          </dd>
                        </div>
                        <div>
                          <dt>{t.reliability}</dt>
                          <dd><ReliabilityLabel value={selected.reliability} locale={locale} /></dd>
                        </div>
                      </dl>
                      <div className="agent-note">
                        <span>✦</span>
                        <p>
                          <b>{t.next}</b>
                          {selected.nextStep}
                        </p>
                      </div>
                      <HumanReviewPanel
                        model={model}
                        finding={selected}
                        rules={activeRules}
                        locale={locale}
                        reviews={humanReviews}
                        overrides={evidenceOverrides}
                        onReviewsChange={persistHumanReviews}
                        onOverridesChange={persistEvidenceOverrides}
                        onRecalculate={recalculateWithOverrides}
                        onAudit={recordHumanAudit}
                        proposedChange={agentEvidenceProposal}
                      />
                    </div>
                  )}
              </>
            )}
          </aside>
        </section>
      )}

      {view === "compare" && (
        <section className="page-view">
          <div className="page-intro">
            <span className="eyebrow">MODEL A / MODEL B</span>
            <h1>{t.compareTitle}</h1>
            <p>{t.compareLead}</p>
          </div>
          <div className="compare-pickers">
            <label>
              {t.baseline}
              <button
                className="file-choice"
                onClick={() => baselineFile.current?.click()}
              >
                {baseline.name}
              </button>
              <input
                hidden
                ref={baselineFile}
                type="file"
                accept=".ifc"
                onChange={(event) =>
                  void loadIfc(event.target.files?.[0], "baseline")
                }
              />
            </label>
            <span>→</span>
            <label>
              {t.current}
              <button
                className="file-choice"
                onClick={() => modelFile.current?.click()}
              >
                {model.name}
              </button>
            </label>
          </div>
          <div className="compare-summary">
            <div>
              <strong>{comparison.changed}</strong>
              <span>{t.changed}</span>
            </div>
            <div>
              <strong>{comparison.resolved}</strong>
              <span>{t.resolved}</span>
            </div>
            <div>
              <strong>{comparison.regressed}</strong>
              <span>{t.regressed}</span>
            </div>
            <div>
              <strong>{comparison.unchanged}</strong>
              <span>{t.unchanged}</span>
            </div>
          </div>
          <div className="diff-table">
            <div className="diff-row diff-header">
              <span>{t.element}</span>
              <span>{t.before}</span>
              <span>{t.after}</span>
              <span>{t.outcome}</span>
            </div>
            {comparison.items.slice(0, 250).map((item) => (
              <div className="diff-row" key={item.id}>
                <span>
                  {item.name}
                  <small>{item.id}</small>
                </span>
                <span>{item.before}</span>
                <span>{item.after}</span>
                <span className={`change-${item.kind}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "rules" && (
        <section className="page-view">
          <div className="page-intro">
            <span className="eyebrow">
              {locale === "zh" ? "人工确认闭环" : "HUMAN-IN-THE-LOOP"}
            </span>
            <h1>{t.ruleTitle}</h1>
            <p>{t.ruleLead}</p>
          </div>
          <div className="rule-layout">
            <div className="rule-composer">
              <label>{t.proposed}</label>
              <textarea
                value={ruleText}
                onChange={(event) => setRuleText(event.target.value)}
              />
              <button className="primary" onClick={() => inspectProposal()}>
                {t.analyse}
              </button>
              <div className="prompt-chips">
                <button
                  onClick={() =>
                    setRuleText(
                      locale === "zh"
                        ? "已确认的疏散门净宽不得小于 1000 毫米，仅适用于医疗空间"
                        : "Confirmed exit doors serving clinical spaces must have at least 1,000 mm clear width",
                    )
                  }
                >
                  {locale === "zh" ? "增加适用范围" : "Add scope"}
                </button>
                <button
                  onClick={() =>
                    setRuleText(
                      `${ruleText} · ${locale === "zh" ? "来源条文与例外尚待填写" : "source clause and exceptions to be confirmed"}`,
                    )
                  }
                >
                  {locale === "zh" ? "增加来源提示" : "Add source prompt"}
                </button>
              </div>
            </div>
            <div className="rule-preview">
              {proposal ? (
                <>
                  <h2>{proposal.rule.title[locale]}</h2>
                  <div
                    className={`score ${proposal.feasibility.valid ? "score-good" : "score-bad"}`}
                  >
                    {t.feasibility}: {proposal.feasibility.score}/100
                  </div>
                  {proposal.feasibility.issues.map((issue) => (
                    <p className="issue" key={issue}>
                      {locale === "zh" ? localiseRuleText(issue) : issue}
                    </p>
                  ))}
                  <h3>{t.conflict}</h3>
                  <p>{proposal.conflict.summary[locale]}</p>
                  <h3>{t.advice}</h3>
                  <ul>
                    {[
                      ...proposal.feasibility.suggestions,
                      ...proposal.conflict.suggestions[locale],
                    ].map((suggestion) => (
                      <li key={suggestion}>
                        {locale === "zh"
                          ? localiseRuleText(suggestion)
                          : suggestion}
                      </li>
                    ))}
                  </ul>
                  <div className="decision-grid">
                    <button onClick={() => decide("replace")}>
                      {t.replace}
                    </button>
                    <button onClick={() => decide("keep")}>{t.keep}</button>
                    <button onClick={() => decide("cancel")}>{t.cancel}</button>
                  </div>
                </>
              ) : (
                <div className="empty-preview">
                  <span>✦</span>
                  <p>
                    {locale === "zh"
                      ? "Agent 将在这里显示规则结构、冲突、可行性与修改建议。"
                      : "The Agent will show rule structure, conflicts, feasibility and customisation advice here."}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="rule-catalogue">
            <h2>{t.catalogue}</h2>
            <div className="catalogue-grid">
              {rules.map((rule) => (
                <article key={`${rule.id}-${rule.version}`}>
                  <span>
                    {rule.status === "ACTIVE" ? t.active : t.draft} · v
                    {rule.version}
                  </span>
                  <h3>{rule.title[locale]}</h3>
                  <p>{rule.description[locale]}</p>
                  <b>
                    {rule.id} ·{" "}
                    {locale === "zh" ? localiseScope(rule.scope) : rule.scope}
                  </b>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {view === "sources" && (
        <section className="page-view wide-page">
          <div className="page-intro">
            <span className="eyebrow">
              {locale === "zh" ? "文档智能" : "DOCUMENT INTELLIGENCE"}
            </span>
            <h1>{t.sourceTitle}</h1>
            <p>{t.sourceLead}</p>
            <small className="build-id">
              {BUILD_ID} · PDF worker {document?.workerStatus ?? "not tested"}
            </small>
          </div>
          <button
            className="source-upload"
            onClick={() => ruleFile.current?.click()}
          >
            <span>＋</span>
            <strong>
              {docBusy
                ? locale === "zh"
                  ? "正在读取…"
                  : "Reading…"
                : t.uploadRule}
            </strong>
            <small>{t.formats}</small>
          </button>
          <input
            ref={ruleFile}
            hidden
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.yaml,.yml,.ids,.ifc,.dxf,.dwg"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void loadRuleFile(file);
            }}
          />
          <div className="document-workspace">
            <section>
              <h2>{t.original}</h2>
              {!document ? (
                <div className="doc-empty">{t.noDoc}</div>
              ) : (
                <>
                  <div className="doc-meta">
                    <strong>{document.name}</strong>
                    <small>
                      SHA-256 {document.hash.slice(0, 16)}… ·{" "}
                      {(document.size / 1024).toFixed(1)} KB
                    </small>
                    <small>
                      {document.pageCount
                        ? `${document.pageCount} ${locale === "zh" ? "页" : "pages"} · `
                        : ""}
                      {document.characterCount.toLocaleString()}{" "}
                      {locale === "zh"
                        ? "个已提取字符"
                        : "extracted characters"}{" "}
                      · {document.extractionStatus}
                    </small>
                  </div>
                  {document.previewUrl ? (
                    <iframe
                      className="document-preview"
                      src={document.previewUrl}
                      title={document.name}
                    />
                  ) : (
                    <div
                      className="document-preview html-preview"
                      dangerouslySetInnerHTML={{
                        __html: document.previewHtml ?? "",
                      }}
                    />
                  )}
                  {document.warnings.map((warning) => (
                    <p className="doc-warning" key={warning}>
                      {locale === "zh" ? `文档提示：${warning}` : warning}
                    </p>
                  ))}
                </>
              )}
            </section>
            <section>
              <h2>{t.extractedRules}</h2>
              {!document ? (
                <div className="doc-empty">{t.noDoc}</div>
              ) : document.rules.length ? (
                document.rules.map((rule) => (
                  <article className="extracted-rule" key={rule.id}>
                    <span>
                      {Math.round(rule.extractionConfidence * 100)}% ·{" "}
                      {rule.sourceAnchor}
                    </span>
                    <h3>{rule.title[locale]}</h3>
                    <p>{rule.description[locale]}</p>
                    <button
                      onClick={() => {
                        setRuleText(rule.description.en);
                        setView("rules");
                        window.setTimeout(
                          () => inspectProposal(rule.description.en),
                          0,
                        );
                      }}
                    >
                      {t.importRule}
                    </button>
                  </article>
                ))
              ) : document.extractionStatus === "EXTRACTION_ERROR" ? (
                <div className="doc-empty">
                  {locale === "zh"
                    ? "PDF 可以预览，但文字提取发生技术错误。请查看左侧错误代码；扫描件可改用授权 OCR。"
                    : "The PDF can be previewed, but text extraction encountered a technical error. Review the error code on the left; use authorised OCR for a scanned copy."}
                </div>
              ) : document.extractionStatus === "NO_MACHINE_TEXT" ? (
                <div className="doc-empty">
                  {locale === "zh"
                    ? "文件已打开，但未检测到机器可读文字层。它可能是扫描件、加密文件或限制复制的 PDF；请使用获授权的 OCR 或人工转录。"
                    : "The file opened, but no machine-readable text layer was detected. It may be scanned, encrypted or copy-restricted; use authorised OCR or manual transcription."}
                </div>
              ) : (
                <>
                  <div className="doc-empty">
                    {locale === "zh"
                      ? `已成功读取 ${document.characterCount} 个字符，但没有找到可直接执行的数值规则。以下条文可送至规则工作室进一步结构化。`
                      : `Successfully read ${document.characterCount} characters, but found no directly executable numerical rule. The passages below can be structured further in Rule Studio.`}
                  </div>
                  {document.passages.map((passage, index) => (
                    <article
                      className="extracted-rule"
                      key={`${document.id}-passage-${index}`}
                    >
                      <span>
                        {passage.classification.replace("_", " ")} ·{" "}
                        {passage.sourceAnchor} ·{" "}
                        {locale === "zh"
                          ? "需要人工确认"
                          : "human confirmation required"}
                      </span>
                      <p>{passage.text}</p>
                      {passage.missing.length > 0 && (
                        <small>
                          {locale === "zh" ? "待补充：" : "Missing: "}
                          {passage.missing.join(", ")}
                        </small>
                      )}
                      <button
                        onClick={() => {
                          setRuleText(passage.text);
                          setView("rules");
                          window.setTimeout(
                            () => inspectProposal(passage.text),
                            0,
                          );
                        }}
                      >
                        {t.importRule}
                      </button>
                    </article>
                  ))}
                </>
              )}
            </section>
          </div>
          <section className="rule-package-builder">
            <header>
              <div>
                <span className="eyebrow">
                  {locale === "zh"
                    ? "文档级人工确认"
                    : "DOCUMENT-LEVEL HUMAN CONFIRMATION"}
                </span>
                <h2>
                  {locale === "zh" ? "规则包工作台" : "Rule-package workbench"}
                </h2>
                <p>
                  {locale === "zh"
                    ? "先逐条检查、修改并确认，不需要选择模型。全部确认后，整份来源会成为模型审查时可选的规则包。"
                    : "Review, amend and confirm each entry before selecting any model. Once every decision is confirmed, the complete source becomes a selectable model-review package."}
                </p>
              </div>
              {draftPackage && (
                <span
                  className={`package-state state-${draftPackage.status.toLowerCase()}`}
                >
                  {draftPackage.status}
                </span>
              )}
            </header>
            {!draftPackage ? (
              <div className="doc-empty">
                {locale === "zh"
                  ? "上传规则来源后，完整的规则包草稿会显示在这里。"
                  : "Upload a rule source to create its complete package draft here."}
              </div>
            ) : (
              <>
                <div className="package-meta">
                  <label>
                    {locale === "zh" ? "规则包名称" : "Package name"}
                    <input
                      value={draftPackage.name}
                      onChange={(event) =>
                        setDraftPackage({
                          ...draftPackage,
                          name: event.target.value.slice(0, 160),
                        })
                      }
                    />
                  </label>
                  <span>
                    {draftPackage.entries.length}{" "}
                    {locale === "zh" ? "条提取内容" : "extracted entries"} ·
                    SHA-256 {draftPackage.sourceHash.slice(0, 12)}…
                  </span>
                </div>
                <div className="package-entry-list">
                  {draftPackage.entries.map((entry, index) => (
                    <article
                      key={entry.id}
                      className={entry.confirmed ? "entry-confirmed" : ""}
                    >
                      <header>
                        <span>
                          {String(index + 1).padStart(2, "0")} ·{" "}
                          {entry.classification.replaceAll("_", " ")} ·{" "}
                          {entry.sourceAnchor}
                        </span>
                        <label>
                          <input
                            type="checkbox"
                            checked={entry.confirmed}
                            onChange={(event) =>
                              editPackageEntry(entry.id, {
                                confirmed: event.target.checked,
                              })
                            }
                          />
                          {locale === "zh" ? "人工已确认" : "Human-confirmed"}
                        </label>
                      </header>
                      <label>
                        {locale === "zh" ? "条文内容" : "Requirement text"}
                        <textarea
                          value={entry.sourceText}
                          onChange={(event) =>
                            editPackageEntry(entry.id, {
                              sourceText: event.target.value,
                            })
                          }
                        />
                      </label>
                      <div className="package-entry-controls">
                        <label>
                          {locale === "zh" ? "处理方式" : "Decision"}
                          <select
                            value={entry.decision}
                            onChange={(event) =>
                              editPackageEntry(entry.id, {
                                decision: event.target
                                  .value as RulePackageDecision,
                              })
                            }
                          >
                            <option value="INCLUDE">
                              {locale === "zh"
                                ? "纳入确定性审查"
                                : "Include in deterministic review"}
                            </option>
                            <option value="REFERENCE_ONLY">
                              {locale === "zh" ? "仅作参考" : "Reference only"}
                            </option>
                            <option value="EXCLUDE">
                              {locale === "zh"
                                ? "明确排除"
                                : "Explicitly exclude"}
                            </option>
                          </select>
                        </label>
                        {entry.rule && (
                          <label>
                            {locale === "zh"
                              ? "阈值（毫米）"
                              : "Threshold (mm)"}
                            <input
                              type="number"
                              min="300"
                              max="3000"
                              value={entry.rule.threshold ?? ""}
                              onChange={(event) =>
                                editPackageEntry(entry.id, {
                                  threshold: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                        )}
                        <label>
                          {locale === "zh" ? "复核备注" : "Review note"}
                          <input
                            value={entry.reviewerNote}
                            onChange={(event) =>
                              editPackageEntry(entry.id, {
                                reviewerNote: event.target.value.slice(0, 500),
                              })
                            }
                            placeholder={
                              locale === "zh"
                                ? "范围、例外或确认依据"
                                : "Scope, exception or confirmation basis"
                            }
                          />
                        </label>
                      </div>
                      {entry.decision === "INCLUDE" && !entry.rule && (
                        <p className="issue">
                          {locale === "zh"
                            ? "该条文尚未形成可执行结构；请改为仅供参考，或送至规则工作室结构化。"
                            : "This passage has no executable structure yet. Mark it as reference-only or send it to Rule Studio for structuring."}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                <div className="package-finalise">
                  <span>
                    {
                      draftPackage.entries.filter((entry) => entry.confirmed)
                        .length
                    }
                    /{draftPackage.entries.length}{" "}
                    {locale === "zh" ? "项已确认" : "entries confirmed"}
                  </span>
                  <button
                    className="primary"
                    disabled={!rulePackageReadiness(draftPackage).ready}
                    onClick={confirmRulePackage}
                  >
                    {locale === "zh"
                      ? "确认并打包整份规则来源"
                      : "Confirm and package the complete source"}
                  </button>
                  {rulePackageReadiness(draftPackage).issues.map((issue) => (
                    <small key={issue}>{issue}</small>
                  ))}
                </div>
              </>
            )}
            <div className="saved-packages">
              <h3>
                {locale === "zh"
                  ? "模型审查可选规则包"
                  : "Packages available for model review"}
              </h3>
              {rulePackages.map((item) => (
                <article key={item.id}>
                  <span>
                    {item.status} · v{item.version}
                  </span>
                  <strong>{item.name}</strong>
                  <small>
                    {rulesForPackage(item, rules).length}{" "}
                    {locale === "zh" ? "条可执行规则" : "executable rules"} ·{" "}
                    {item.entries.length}{" "}
                    {locale === "zh" ? "项包内容" : "package entries"}
                  </small>
                  <button
                    onClick={() => {
                      persistRulePackages(rulePackages, item.id);
                      setFindings([]);
                      invalidateReport();
                      setView("review");
                    }}
                  >
                    {locale === "zh" ? "用于模型审查" : "Use for model review"}
                  </button>
                </article>
              ))}
            </div>
          </section>
          <div className="official-sources">
            <h2>{t.official}</h2>
            <p>{t.officialNote}</p>
            <div>
              {officialRuleSources.map((source) => (
                <article key={source.id}>
                  <span>
                    {locale === "zh"
                      ? "香港特别行政区 · 官方链接"
                      : "HKSAR · OFFICIAL LINK"}
                  </span>
                  <h3>{source.title[locale]}</h3>
                  <p>{source.note[locale]}</p>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {t.openSource} ↗
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {view === "agents" && (
        <section className="page-view agent-page">
          <div className="page-intro">
            <span className="eyebrow">
              {locale === "zh"
                ? "对话 / 工具 / 确认"
                : "CONVERSE / TOOL / CONFIRM"}
            </span>
            <h1>{locale === "zh" ? "Evidence Agent" : "Evidence Agent"}</h1>
            <p>
              {locale === "zh"
                ? "像 Codex 一样在一个连续对话中选择 Agent、供应商和模型。所有改变状态的操作都会先形成可编辑建议，并由您确认。"
                : "A Codex-style continuous conversation with agent, provider and model controls in the composer. Every state-changing action becomes an editable proposal for your confirmation."}
            </p>
          </div>
          <CodexAgentWorkspace
            locale={locale}
            providerId={provider}
            selected={selected}
            modelName={model.name}
            findings={findings}
            rules={activeRules}
            reviewCount={humanReviews.length}
            overrideCount={evidenceOverrides.length}
            onProviderChange={setProvider}
            onEvidenceProposal={(next) => {
              setAgentEvidenceProposal(next);
              setView("review");
              flash(
                locale === "zh"
                  ? "修订建议已送至所选构件的人工复核面板"
                  : "Correction proposal sent to the selected element's Human Review panel",
              );
            }}
            onRuleProposal={(text) => {
              setRuleText(text);
              setView("rules");
              window.setTimeout(() => inspectProposal(text), 0);
            }}
            onReportRequest={(text) => {
              setReportInput(text);
              setView("report");
              window.setTimeout(() => reportInputRef.current?.focus(), 0);
            }}
            onAttachRuleSource={() => {
              setView("sources");
              window.setTimeout(() => ruleFile.current?.click(), 0);
            }}
            onAudit={recordHumanAudit}
          />
          <div className="agent-support-grid">
            <section className="memory-card">
              <h2>{t.memory}</h2>
              <p>{t.memoryText}</p>
              <dl>
                <div>
                  <dt>{locale === "zh" ? "项目" : "Project"}</dt>
                  <dd>{memory.projectId}</dd>
                </div>
                <div>
                  <dt>{locale === "zh" ? "规则决策" : "Rule decisions"}</dt>
                  <dd>{memory.decisions.length}</dd>
                </div>
                <div>
                  <dt>
                    {locale === "zh"
                      ? "人工记录 / 证据修订"
                      : "Human records / evidence corrections"}
                  </dt>
                  <dd>
                    {humanReviews.length} / {evidenceOverrides.length}
                  </dd>
                </div>
              </dl>
              <button
                onClick={() => {
                  clearMemory();
                  setMemory(emptyMemory());
                  setRules(builtinRules);
                  setRulePackages([builtinRulePackage]);
                  setSelectedPackageId(builtinRulePackage.id);
                  setDraftPackage(undefined);
                  setHumanReviews([]);
                  setEvidenceOverrides([]);
                  invalidateReport();
                  flash(
                    locale === "zh"
                      ? "项目记忆已清除"
                      : "Project memory cleared",
                  );
                }}
              >
                {t.clear}
              </button>
            </section>
            <div className="trace-panel">
              <h2>{t.trace}</h2>
              {events.length ? (
                events.slice(0, 12).map((event) => (
                  <article key={event.id}>
                    <time>
                      {new Date(event.at).toLocaleTimeString(
                        locale === "zh" ? "zh-HK" : "en-GB",
                      )}
                    </time>
                    <span>
                      <b>{event.actor}</b>
                      <strong>{event.kind}</strong>
                      <p>{event.summary}</p>
                      {event.evidence && <small>{event.evidence}</small>}
                    </span>
                  </article>
                ))
              ) : (
                <div className="doc-empty">{t.noTrace}</div>
              )}
            </div>
          </div>
        </section>
      )}

      {view === "report" && (
        <section className="page-view wide-page">
          <div className="page-intro report-intro">
            <div>
              <span className="eyebrow">EVIDENCE-BOUND REPORT AGENT</span>
              <h1>
                {locale === "zh"
                  ? "与 Report Agent 对话"
                  : "Talk to the Report Agent"}
              </h1>
              <p>
                {locale === "zh"
                  ? "直接用自然语言说明报告给谁看、重点与篇幅。Agent 会生成可编辑简报；确认后在平台内生成报告，无需复制或粘贴提示词。"
                  : "Describe the audience, focus and length in ordinary language. The Agent creates an editable brief, then generates inside this platform—there is no prompt to copy or paste."}
              </p>
            </div>
            {reportReady && (
              <button
                className="primary"
                disabled={!verification.valid || reportStale}
                onClick={downloadReport}
              >
                {t.download}
              </button>
            )}
          </div>
          {!findings.length ? (
            <div className="report-empty">
              <span>□</span>
              <h2>{t.noReport}</h2>
              <button onClick={() => setView("review")}>
                {t.nav.review} →
              </button>
            </div>
          ) : (
            <>
              <div className="report-agent-layout">
                <section className="report-chat">
                  <header>
                    <span>✦</span>
                    <div>
                      <strong>Report Agent</strong>
                      <small>
                        {locale === "zh"
                          ? "本地确定性解释器 · 不需要 API 密钥"
                          : "Local deterministic interpreter · no API key required"}
                      </small>
                    </div>
                  </header>
                  <div className="chat-messages">
                    {reportMessages.map((message, index) => (
                      <p
                        className={message.role}
                        key={`${message.role}-${index}`}
                      >
                        {message.text}
                      </p>
                    ))}
                  </div>
                  <div className="chat-suggestions">
                    <button
                      onClick={() =>
                        setReportInput(
                          locale === "zh"
                            ? "给项目经理写一份精简中文报告，只列出不通过和需复核问题，最多 10 项。"
                            : "Write a concise report for the project manager, covering failures and review items only, maximum 10 findings.",
                        )
                      }
                    >
                      {locale === "zh"
                        ? "精简项目报告"
                        : "Concise project report"}
                    </button>
                    <button
                      onClick={() =>
                        setReportInput(
                          locale === "zh"
                            ? "为消防工程师生成详细的中英双语报告，包括 GlobalId、证据路径和行动建议。"
                            : "Prepare a detailed bilingual report for the fire engineer, including GlobalIds, evidence paths and actions.",
                        )
                      }
                    >
                      {locale === "zh"
                        ? "消防工程师双语报告"
                        : "Bilingual fire-engineer report"}
                    </button>
                    <button
                      disabled={!selected}
                      onClick={() =>
                        setReportInput(
                          locale === "zh"
                            ? "解释当前选中的审查结果。"
                            : "Explain the selected finding.",
                        )
                      }
                    >
                      {locale === "zh"
                        ? "解释选中结果"
                        : "Explain selected finding"}
                    </button>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendReportMessage();
                    }}
                  >
                    <input
                      ref={reportInputRef}
                      value={reportInput}
                      onChange={(event) => setReportInput(event.target.value)}
                      maxLength={4000}
                      placeholder={
                        locale === "zh"
                          ? "例如：给客户写一页中文摘要，只列出需处理的问题…"
                          : "For example: write a one-page client summary covering issues that need action…"
                      }
                    />
                    <button type="submit">
                      {locale === "zh" ? "发送" : "Send"}
                    </button>
                  </form>
                  <aside>
                    <strong>
                      {locale === "zh"
                        ? "固定安全边界"
                        : "Locked safety boundaries"}
                    </strong>
                    <span>
                      {locale === "zh"
                        ? "不能更改规则、判定或数值；不能把 REVIEW 写成 PASS；不能虚构法规依据。"
                        : "Cannot change rules, verdicts or measurements; cannot turn REVIEW into PASS; cannot invent regulatory authority."}
                    </span>
                  </aside>
                </section>
                <section className="report-brief">
                  <header>
                    <span className="eyebrow">
                      {locale === "zh"
                        ? "可编辑报告简报"
                        : "EDITABLE REPORT BRIEF"}
                    </span>
                    <h2>
                      {locale === "zh"
                        ? "生成前由您确认"
                        : "Confirm before generation"}
                    </h2>
                  </header>
                  <label>
                    {locale === "zh" ? "受众" : "Audience"}
                    <select
                      value={reportBrief.audience}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          audience: event.target
                            .value as ReportBrief["audience"],
                        })
                      }
                    >
                      <option value="project-team">Project team</option>
                      <option value="client">Client</option>
                      <option value="fire-engineer">Fire engineer</option>
                      <option value="regulator">Regulator / authority</option>
                    </select>
                  </label>
                  <label>
                    {locale === "zh" ? "语言" : "Language"}
                    <select
                      value={reportBrief.language}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          language: event.target
                            .value as ReportBrief["language"],
                        })
                      }
                    >
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                      <option value="bilingual">English + 中文</option>
                    </select>
                  </label>
                  <label>
                    {locale === "zh" ? "语气" : "Tone"}
                    <select
                      value={reportBrief.tone}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          tone: event.target.value as ReportBrief["tone"],
                        })
                      }
                    >
                      <option value="concise">Concise</option>
                      <option value="technical">Technical</option>
                      <option value="executive">Executive</option>
                    </select>
                  </label>
                  <fieldset>
                    <legend>
                      {locale === "zh" ? "包含状态" : "Include statuses"}
                    </legend>
                    {(
                      [
                        "FAIL",
                        "REVIEW",
                        "PASS",
                        "NOT_APPLICABLE",
                      ] as Finding["status"][]
                    ).map((status) => (
                      <label key={status}>
                        <input
                          type="checkbox"
                          checked={reportBrief.focusStatuses.includes(status)}
                          onChange={(event) =>
                            setReportBrief({
                              ...reportBrief,
                              focusStatuses: event.target.checked
                                ? [...reportBrief.focusStatuses, status]
                                : reportBrief.focusStatuses.filter(
                                    (item) => item !== status,
                                  ),
                            })
                          }
                        />
                        {status.replace("_", " ")}
                      </label>
                    ))}
                  </fieldset>
                  <label>
                    {locale === "zh" ? "最多列出结果" : "Maximum findings"}
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={reportBrief.maxFindings}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          maxFindings: Math.min(
                            100,
                            Math.max(1, Number(event.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                  <div className="brief-toggles">
                    <label>
                      <input
                        type="checkbox"
                        checked={reportBrief.includeIdentifiers}
                        onChange={(event) =>
                          setReportBrief({
                            ...reportBrief,
                            includeIdentifiers: event.target.checked,
                          })
                        }
                      />{" "}
                      GlobalIds
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={reportBrief.includeEvidencePaths}
                        onChange={(event) =>
                          setReportBrief({
                            ...reportBrief,
                            includeEvidencePaths: event.target.checked,
                          })
                        }
                      />{" "}
                      {locale === "zh" ? "证据路径" : "Evidence paths"}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={reportBrief.includeActions}
                        onChange={(event) =>
                          setReportBrief({
                            ...reportBrief,
                            includeActions: event.target.checked,
                          })
                        }
                      />{" "}
                      {locale === "zh" ? "行动建议" : "Actions"}
                    </label>
                  </div>
                  <div className="brief-count">
                    {reportFindings.length}{" "}
                    {locale === "zh"
                      ? "项已验证结果将写入报告"
                      : "verified findings will be reported"}
                  </div>
                  <button
                    className="primary"
                    onClick={generateConfiguredReport}
                  >
                    {locale === "zh"
                      ? "确认简报并生成报告"
                      : "Confirm brief and generate report"}
                  </button>
                </section>
              </div>
              <section className="report-scope-panel">
                <div>
                  <h3>{locale === "zh" ? "结果范围" : "Result scope"}</h3>
                  <label>
                    {locale === "zh" ? "详细程度" : "Detail"}
                    <select
                      value={reportBrief.detail}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          detail: event.target.value as ReportBrief["detail"],
                        })
                      }
                    >
                      <option value="per-finding">
                        {locale === "zh" ? "逐项检测结果" : "Every finding"}
                      </option>
                      <option value="summary">
                        {locale === "zh" ? "仅摘要" : "Summary only"}
                      </option>
                    </select>
                  </label>
                  <label>
                    {locale === "zh" ? "楼层范围" : "Storey scope"}
                    <select
                      value={reportBrief.storeys[0] ?? "ALL"}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          storeys:
                            event.target.value === "ALL"
                              ? []
                              : [event.target.value],
                        })
                      }
                    >
                      <option value="ALL">
                        {locale === "zh" ? "全部楼层" : "All storeys"}
                      </option>
                      {(model.storeyNames ?? []).map((storey) => (
                        <option value={storey} key={storey}>
                          {storey}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {locale === "zh" ? "规则范围" : "Rule scope"}
                    <select
                      value={reportBrief.ruleIds[0] ?? "ALL"}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          ruleIds:
                            event.target.value === "ALL"
                              ? []
                              : [event.target.value],
                        })
                      }
                    >
                      <option value="ALL">
                        {locale === "zh"
                          ? "规则包全部规则"
                          : "All package rules"}
                      </option>
                      {activeRules.map((rule) => (
                        <option value={rule.id} key={rule.id}>
                          {rule.title[locale]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={reportBrief.selectedElementOnly}
                      disabled={!selectedElement}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          selectedElementOnly: event.target.checked,
                        })
                      }
                    />
                    {locale === "zh"
                      ? "仅当前选中构件"
                      : "Selected element only"}
                  </label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={reportBrief.includeHumanReview}
                      onChange={(event) =>
                        setReportBrief({
                          ...reportBrief,
                          includeHumanReview: event.target.checked,
                        })
                      }
                    />
                    {locale === "zh"
                      ? "包括人工复核与证据修订"
                      : "Include human review and evidence corrections"}
                  </label>
                </div>
                <div className="ai-report-control">
                  <h3>
                    {locale === "zh"
                      ? "AI 专业叙述"
                      : "AI professional narrative"}
                  </h3>
                  <p>
                    {locale === "zh"
                      ? "确定性报告始终完整生成；OpenAI 只对已选范围进行叙述，并通过数值、GlobalId 与状态校验。"
                      : "The deterministic report is always complete. OpenAI only narrates the selected scope, then every number, GlobalId and status is verified."}
                  </p>
                  <label>
                    {locale === "zh" ? "认证方式" : "Authentication"}
                    <select
                      value={reportAuthMode}
                      onChange={(event) =>
                        setReportAuthMode(
                          event.target.value as "operator" | "byok",
                        )
                      }
                    >
                      <option value="operator">
                        {locale === "zh" ? "平台密钥" : "Platform key"}
                      </option>
                      <option value="byok">
                        {locale === "zh"
                          ? "我的会话 API 密钥"
                          : "My session API key"}
                      </option>
                    </select>
                  </label>
                  {reportAuthMode === "byok" && (
                    <label>
                      OpenAI API key
                      <input
                        type="password"
                        autoComplete="off"
                        value={reportApiKey}
                        onChange={(event) =>
                          setReportApiKey(event.target.value)
                        }
                        placeholder="sk-…"
                      />
                      <small>
                        {locale === "zh"
                          ? "仅保存在页面内存；刷新即清除。"
                          : "Held in page memory only and cleared on refresh."}
                      </small>
                    </label>
                  )}
                  <label>
                    {locale === "zh" ? "模型" : "Model"}
                    <select
                      value={reportModel}
                      onChange={(event) => setReportModel(event.target.value)}
                    >
                      <option value="gpt-5.6">GPT-5.6</option>
                      <option value="gpt-5.6-terra">GPT-5.6 Terra</option>
                      <option value="gpt-5.6-luna">GPT-5.6 Luna</option>
                    </select>
                  </label>
                  <div className="report-generation-actions">
                    <button
                      className="primary"
                      onClick={() => void generateAiReport()}
                      disabled={
                        reportAiBusy ||
                        !reportFindings.length ||
                        (reportAuthMode === "byok" && !reportApiKey.trim())
                      }
                    >
                      {reportAiBusy
                        ? locale === "zh"
                          ? "AI 正在生成并验证…"
                          : "Generating and verifying…"
                        : locale === "zh"
                          ? "生成并验证 AI 报告"
                          : "Generate and verify AI report"}
                    </button>
                    <button
                      onClick={() => {
                        setReportNarrative("");
                        setReportMode("local");
                        generateConfiguredReport();
                      }}
                    >
                      {locale === "zh"
                        ? "使用本地确定性报告"
                        : "Use deterministic local report"}
                    </button>
                  </div>
                </div>
              </section>
              {reportReady && (
                <>
                  <div
                    className={`verification-banner ${verification.valid && !reportStale ? "verified" : "verification-failed"}`}
                  >
                    <strong>
                      {reportStale
                        ? locale === "zh"
                          ? "报告已过期：模型或规则已改变，请重新生成。"
                          : "Report is stale: the model or rule state has changed. Generate again."
                        : `${t.verification}: ${verification.valid ? t.valid : t.blocked}`}
                    </strong>
                    <span>
                      {locale === "zh" ? "生成方式" : "Generation path"}:{" "}
                      {reportMode === "openai"
                        ? "OpenAI + deterministic verification"
                        : reportMode === "fallback"
                          ? "Safe deterministic fallback"
                          : "Deterministic local"}
                    </span>
                    {verification.issues.map((issue) => (
                      <span key={issue}>{issue}</span>
                    ))}
                  </div>
                  <div className="report-sheet">
                    <div className="report-meta">
                      <span>EVIDENCE AGENT</span>
                      <span>
                        {model.schema} · {model.units}
                      </span>
                    </div>
                    <h2>
                      {locale === "zh"
                        ? "BIM 合规证据预审"
                        : "BIM Compliance Evidence Pre-review"}
                    </h2>
                    <p className="lead">
                      {locale === "zh"
                        ? `报告包含 ${reportFindings.length} 项经验证结果。`
                        : `This report contains ${reportFindings.length} verified findings.`}
                    </p>
                    <div className="report-kpis">
                      <div>
                        <strong>
                          {
                            reportFindings.filter(
                              (item) => item.status === "FAIL",
                            ).length
                          }
                        </strong>
                        <span>{t.fail}</span>
                      </div>
                      <div>
                        <strong>
                          {
                            reportFindings.filter(
                              (item) => item.status === "REVIEW",
                            ).length
                          }
                        </strong>
                        <span>{t.review}</span>
                      </div>
                      <div>
                        <strong>
                          {
                            reportFindings.filter(
                              (item) => item.status === "PASS",
                            ).length
                          }
                        </strong>
                        <span>{t.pass}</span>
                      </div>
                    </div>
                    {reportNarrative && (
                      <section className="ai-narrative">
                        <h3>
                          {locale === "zh"
                            ? "已验证 AI 专业叙述"
                            : "Verified AI professional narrative"}
                        </h3>
                        <p>{reportNarrative}</p>
                      </section>
                    )}
                    {reportBrief.detail === "per-finding" &&
                      reportFindings.map((finding) => (
                        <article key={finding.id}>
                          <Status value={finding.status} locale={locale} />
                          <div>
                            <h4>
                              {finding.elementName} — {finding.ruleTitle}
                            </h4>
                            <p>{finding.message}</p>
                            {reportBrief.includeIdentifiers && (
                              <small>{finding.elementId}</small>
                            )}
                            {reportBrief.includeEvidencePaths && (
                              <small> · {finding.evidencePath}</small>
                            )}
                            {reportBrief.includeActions && (
                              <p>
                                <b>{locale === "zh" ? "行动：" : "Action: "}</b>
                                {finding.nextStep}
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                    <footer>
                      <span>{t.disclaimer}</span>
                    </footer>
                  </div>
                </>
              )}
              <details className="prompt-card">
                <summary>
                  {locale === "zh"
                    ? "高级：复制外部 LLM 指令包"
                    : "Advanced: copy an external LLM instruction package"}
                </summary>
                <p>
                  {locale === "zh"
                    ? "普通流程不需要此功能。仅当您刻意使用其他 LLM 聊天工具时，复制后粘贴到该工具的新对话输入框；外部服务的隐私政策由其运营者负责。"
                    : "The normal workflow does not need this. Use it only when you deliberately choose another LLM chat: copy the package and paste it into that service's new-chat input. That service's privacy terms then apply."}
                </p>
                <textarea readOnly value={prompt} />
                <button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(prompt)
                      .then(() =>
                        flash(
                          locale === "zh"
                            ? "外部指令包已复制"
                            : "External instruction package copied",
                        ),
                      )
                  }
                >
                  {locale === "zh"
                    ? "复制外部指令包"
                    : "Copy external instruction package"}
                </button>
              </details>
            </>
          )}
        </section>
      )}
      <button className="ask-agent" onClick={() => setView("agents")}>
        <span>✦</span>
        {locale === "zh" ? "询问 Evidence Agent" : "Ask Evidence Agent"}
      </button>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
