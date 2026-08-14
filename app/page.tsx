"use client";

import { useMemo, useRef, useState } from "react";
import {
  analyseModel,
  buildReport,
  compareModels,
  demoModels,
  interpretRule,
  parseIfc,
  type BuildingModel,
  type ConfirmedRule,
  type Finding,
} from "../lib/compliance";

type View = "review" | "compare" | "rules" | "report";
type Language = "en" | "zh";

const labels = {
  en: {
    review: "Review",
    compare: "Compare",
    rules: "Rule studio",
    report: "Report",
    run: "Run evidence review",
  },
  zh: {
    review: "审查",
    compare: "版本对比",
    rules: "规则工作室",
    report: "报告",
    run: "运行证据审查",
  },
};

function StatusPill({ status }: { status: Finding["status"] }) {
  return <span className={`status status-${status.toLowerCase()}`}>{status.replace("_", " ")}</span>;
}

export default function Home() {
  const [view, setView] = useState<View>("review");
  const [language, setLanguage] = useState<Language>("en");
  const [model, setModel] = useState<BuildingModel>(demoModels.current);
  const [baseline, setBaseline] = useState<BuildingModel>(demoModels.baseline);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [ruleText, setRuleText] = useState("Flag confirmed exit doors with a clear width below 950 mm");
  const [draftRule, setDraftRule] = useState<ConfirmedRule | null>(null);
  const [confirmedRules, setConfirmedRules] = useState<ConfirmedRule[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const copy = labels[language];
  const summary = useMemo(() => ({
    pass: findings.filter((f) => f.status === "PASS").length,
    fail: findings.filter((f) => f.status === "FAIL").length,
    review: findings.filter((f) => f.status === "REVIEW").length,
    na: findings.filter((f) => f.status === "NOT_APPLICABLE").length,
  }), [findings]);
  const selected = findings.find((finding) => finding.id === selectedId) ?? findings[0];
  const comparison = useMemo(() => compareModels(baseline, model), [baseline, model]);

  const runReview = () => {
    setBusy(true);
    window.setTimeout(() => {
      const next = analyseModel(model, confirmedRules);
      setFindings(next);
      setSelectedId(next.find((item) => item.status === "FAIL")?.id ?? next[0]?.id ?? null);
      setRan(true);
      setBusy(false);
      setToast(`Review complete · ${next.length} traceable findings`);
      window.setTimeout(() => setToast(""), 2600);
    }, 520);
  };

  const loadIfcFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseIfc(text, file.name);
    setModel(parsed);
    setFindings([]);
    setRan(false);
    setToast(`Loaded ${parsed.doors.length} doors from ${file.name}`);
    window.setTimeout(() => setToast(""), 2600);
  };

  const loadDemo = (key: keyof typeof demoModels) => {
    setModel(demoModels[key]);
    setFindings([]);
    setRan(false);
    setToast(`${demoModels[key].name} loaded`);
    window.setTimeout(() => setToast(""), 2200);
  };

  const downloadReport = () => {
    const report = buildReport(model, findings, language);
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${model.name.replace(/\W+/g, "-").toLowerCase()}-${language}-review.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("review")} aria-label="Go to review workspace">
          <span className="brand-mark">EA</span>
          <span><strong>Evidence Agent</strong><small>IFC compliance pre-review</small></span>
        </button>
        <nav aria-label="Workspace views">
          {(["review", "compare", "rules", "report"] as View[]).map((item) => (
            <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
              {copy[item]}
              {item === "compare" && comparison.changed > 0 && <em>{comparison.changed}</em>}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <div className="language-switch" aria-label="Report language">
            <button className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>EN</button>
            <button className={language === "zh" ? "selected" : ""} onClick={() => setLanguage("zh")}>中文</button>
          </div>
          <span className="local-badge"><i /> Evidence-bound</span>
        </div>
      </header>

      {view === "review" && (
        <section className="workspace">
          <aside className="rail">
            <div className="eyebrow">MODEL INTAKE</div>
            <button className="upload" onClick={() => fileRef.current?.click()}>
              <span>↑</span><strong>Upload an IFC model</strong><small>IFC2x3, IFC4 · local processing</small>
            </button>
            <input ref={fileRef} hidden type="file" accept=".ifc,text/plain" onChange={(event) => loadIfcFile(event.target.files?.[0])} />
            <div className="sample-title"><span>Assessment samples</span><span>3</span></div>
            {(Object.keys(demoModels) as (keyof typeof demoModels)[]).map((key) => (
              <button className={`sample ${model.id === demoModels[key].id ? "current" : ""}`} key={key} onClick={() => loadDemo(key)}>
                <span className="file-icon">IFC</span>
                <span><strong>{demoModels[key].name}</strong><small>{demoModels[key].doors.length} doors · {demoModels[key].schema}</small></span>
              </button>
            ))}
            <div className="scope-card">
              <div className="eyebrow">ACTIVE RULE PACK</div>
              <strong>Assessment evidence profile</strong>
              <p>Two deterministic checks. Thresholds are demonstration parameters, not statutory certification.</p>
              <button onClick={() => setView("rules")}>Inspect rules →</button>
            </div>
          </aside>

          <section className="review-main">
            <div className="model-heading">
              <div>
                <span className="breadcrumb">PROJECT / {model.schema} / PRE-REVIEW</span>
                <h1>{model.name}</h1>
                <p>{model.doors.length} doors · {model.storeys} storeys · Evidence extracted {model.source === "uploaded" ? "from uploaded IFC" : "from a controlled sample"}</p>
              </div>
              <button className="primary" onClick={runReview} disabled={busy}>{busy ? "Reviewing evidence…" : copy.run}</button>
            </div>

            <div className="canvas-card">
              <div className="canvas-toolbar">
                <span><b>Evidence map</b><small>Abstract spatial index · not reconstructed IFC geometry</small></span>
                <span className="legend"><i className="dot-fail" /> Fail <i className="dot-review" /> Review <i className="dot-pass" /> Pass</span>
              </div>
              <div className="model-stage">
                <div className="grid-plane" />
                <div className="building-model" aria-label="Abstract building evidence map">
                  <div className="slab slab-one" />
                  <div className="slab slab-two" />
                  <div className="wall wall-a" />
                  <div className="wall wall-b" />
                  <div className="wall wall-c" />
                  {model.doors.slice(0, 8).map((door, index) => {
                    const result = findings.find((finding) => finding.elementId === door.globalId && finding.ruleId === "EGRESS-WIDTH-001");
                    return <button key={door.globalId} title={`${door.name}: ${result?.status ?? "Not reviewed"}`} className={`door door-${index + 1} ${result ? `door-${result.status.toLowerCase()}` : ""}`} onClick={() => result && setSelectedId(result.id)}><span>{index + 1}</span></button>;
                  })}
                </div>
                <div className="view-label">EVIDENCE VIEW · L1</div>
              </div>
            </div>

            <div className="assurance-row">
              <div><span>01</span><strong>Deterministic verdicts</strong><small>The Agent cannot alter rule outcomes.</small></div>
              <div><span>02</span><strong>Explicit uncertainty</strong><small>Proxy or missing evidence becomes REVIEW.</small></div>
              <div><span>03</span><strong>Traceable evidence</strong><small>Every finding links to an IFC GlobalId.</small></div>
            </div>
          </section>

          <aside className="results-panel">
            <div className="results-head">
              <span><b>Review findings</b><small>{ran ? `${findings.length} checks completed` : "Ready to run"}</small></span>
              <button aria-label="More result options">•••</button>
            </div>
            <div className="metrics">
              <div><strong>{summary.fail}</strong><span>FAIL</span></div><div><strong>{summary.review}</strong><span>REVIEW</span></div><div><strong>{summary.pass}</strong><span>PASS</span></div><div><strong>{summary.na}</strong><span>N/A</span></div>
            </div>
            {!ran ? (
              <div className="empty-results"><span>◎</span><h2>Evidence is ready</h2><p>Run the review to evaluate two controlled rules without asking an AI to guess.</p></div>
            ) : (
              <>
                <div className="finding-list">
                  {findings.map((finding) => (
                    <button className={selected?.id === finding.id ? "selected-finding" : ""} key={finding.id} onClick={() => setSelectedId(finding.id)}>
                      <StatusPill status={finding.status} />
                      <span><strong>{finding.elementName}</strong><small>{finding.ruleTitle}</small></span><b>›</b>
                    </button>
                  ))}
                </div>
                {selected && <div className="evidence-drawer">
                  <div className="drawer-title"><StatusPill status={selected.status} /><span>{selected.elementName}<small>{selected.elementId}</small></span></div>
                  <p>{selected.message}</p>
                  <dl><div><dt>Observed</dt><dd>{selected.observed}</dd></div><div><dt>Required</dt><dd>{selected.required}</dd></div><div><dt>Evidence</dt><dd>{selected.evidencePath}</dd></div><div><dt>Reliability</dt><dd>{selected.reliability}</dd></div></dl>
                  <div className="agent-note"><span>✦</span><p><b>Agent next step</b>{selected.nextStep}</p></div>
                </div>}
              </>
            )}
          </aside>
        </section>
      )}

      {view === "compare" && (
        <section className="page-view">
          <div className="page-intro"><span className="eyebrow">MODEL VERSION CONTROL</span><h1>Show what changed, not merely what failed.</h1><p>Compare stable IFC GlobalIds across submissions and surface resolved, regressed and unchanged evidence.</p></div>
          <div className="compare-pickers">
            <label>BASELINE<select value={baseline.id} onChange={(event) => setBaseline(Object.values(demoModels).find((item) => item.id === event.target.value) ?? demoModels.baseline)}>{Object.values(demoModels).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <span>→</span>
            <label>CURRENT<select value={model.id} onChange={(event) => setModel(Object.values(demoModels).find((item) => item.id === event.target.value) ?? model)}>{Object.values(demoModels).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          </div>
          <div className="compare-summary"><div><strong>{comparison.resolved}</strong><span>Resolved</span></div><div><strong>{comparison.regressed}</strong><span>Regressed</span></div><div><strong>{comparison.changed}</strong><span>Changed</span></div><div><strong>{comparison.unchanged}</strong><span>Unchanged</span></div></div>
          <div className="diff-table"><div className="diff-row diff-header"><span>Element</span><span>Baseline</span><span>Current</span><span>Change</span></div>{comparison.items.map((item) => <div className="diff-row" key={item.id}><span><b>{item.name}</b><small>{item.id}</small></span><span>{item.before}</span><span>{item.after}</span><span className={`change-${item.kind}`}>{item.label}</span></div>)}</div>
        </section>
      )}

      {view === "rules" && (
        <section className="page-view rule-page">
          <div className="page-intro"><span className="eyebrow">CONTROLLED RULE AUTHORING</span><h1>Use natural language. Confirm the machine-readable rule.</h1><p>The Agent may interpret a request, but it cannot activate a rule until a reviewer confirms its target, evidence field, operator, threshold and unit.</p></div>
          <div className="rule-layout">
            <div className="rule-composer">
              <label>Describe a project rule</label>
              <textarea value={ruleText} onChange={(event) => setRuleText(event.target.value)} />
              <button className="primary" onClick={() => setDraftRule(interpretRule(ruleText))}>Interpret rule</button>
              <div className="supported"><b>Supported in this prototype</b><span>confirmed exit doors · clear width · below/at least · mm or m</span></div>
            </div>
            <div className="rule-preview">
              <div className="eyebrow">HUMAN CONFIRMATION GATE</div>
              {draftRule ? <><h2>{draftRule.title}</h2><dl><div><dt>Target</dt><dd>{draftRule.target}</dd></div><div><dt>Evidence field</dt><dd>{draftRule.field}</dd></div><div><dt>Condition</dt><dd>{draftRule.operator} {draftRule.threshold} {draftRule.unit}</dd></div><div><dt>Missing evidence</dt><dd>REVIEW — never inferred</dd></div><div><dt>Authority</dt><dd>Project rule · reviewer supplied</dd></div></dl><div className="confirm-warning">Activating this rule records your confirmation. It does not turn a project preference into legislation.</div><button className="confirm" onClick={() => { setConfirmedRules([...confirmedRules, draftRule]); setDraftRule(null); setToast("Project rule confirmed and activated"); window.setTimeout(() => setToast(""), 2500); }}>Confirm and activate</button></> : <div className="empty-preview"><span>⌁</span><p>Your structured rule will appear here for confirmation.</p></div>}
            </div>
          </div>
          <div className="rule-catalogue"><h2>Active rule catalogue</h2><div className="catalogue-grid"><article><span>BUILT-IN · v1.0</span><h3>Exit door clear-width evidence</h3><p>Confirmed exit doors are checked against an explicit 900 mm demonstration threshold.</p><b>Deterministic</b></article><article><span>BUILT-IN · v1.0</span><h3>Door information completeness</h3><p>Name, exit status, width provenance and fire-rating evidence are checked for review readiness.</p><b>Deterministic</b></article>{confirmedRules.map((rule, index) => <article key={`${rule.title}-${index}`}><span>PROJECT RULE · CONFIRMED</span><h3>{rule.title}</h3><p>{rule.target}; {rule.field} {rule.operator} {rule.threshold} {rule.unit}.</p><b>Reviewer approved</b></article>)}</div></div>
        </section>
      )}

      {view === "report" && (
        <section className="page-view report-page">
          <div className="page-intro report-intro"><div><span className="eyebrow">FAITHFUL REPORTING</span><h1>{language === "en" ? "A report that cannot rewrite the evidence." : "一份不能改写证据的报告。"}</h1><p>{language === "en" ? "Generated from structured findings only. Verdicts, measurements and rule references remain locked." : "仅从结构化检查结果生成；判定、测量值与规则引用均保持锁定。"}</p></div><button className="primary" onClick={downloadReport} disabled={!ran}>Download Markdown</button></div>
          {!ran ? <div className="report-empty"><span>≡</span><h2>Run a review first</h2><p>The report is built from completed, traceable findings rather than model-free prose.</p><button onClick={() => setView("review")}>Return to review</button></div> : <div className="report-sheet"><div className="report-meta"><span>PRE-REVIEW REPORT</span><span>{new Date().toISOString().slice(0, 10)}</span></div><h2>{model.name}</h2><p className="lead">{language === "en" ? `${findings.length} evidence checks were completed. ${summary.fail} failed and ${summary.review} require professional review.` : `已完成 ${findings.length} 项证据检查，其中 ${summary.fail} 项不通过，${summary.review} 项需要专业复核。`}</p><div className="report-kpis"><div><strong>{summary.fail}</strong><span>FAIL</span></div><div><strong>{summary.review}</strong><span>REVIEW</span></div><div><strong>{summary.pass}</strong><span>PASS</span></div></div><h3>{language === "en" ? "Priority findings" : "优先问题"}</h3>{findings.filter((finding) => finding.status !== "PASS" && finding.status !== "NOT_APPLICABLE").map((finding) => <article key={finding.id}><StatusPill status={finding.status} /><div><h4>{finding.elementName} · {finding.ruleTitle}</h4><p>{finding.message}</p><small>{finding.elementId} · {finding.evidencePath} · {finding.reliability}</small></div></article>)}<footer><span>✓ Numeric claims checked against structured findings</span><p>This prototype supports professional pre-review. It does not certify statutory compliance.</p></footer></div>}
        </section>
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
