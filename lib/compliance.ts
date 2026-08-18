export type Locale = "en" | "zh";
export type FindingStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";
export type Reliability = "EXPLICIT" | "PROXY" | "MISSING" | "DERIVED";

export type Door = {
  expressId: number;
  globalId: string;
  name?: string;
  widthMm?: number;
  widthSource: "clear_width" | "overall_width_proxy" | "missing";
  isExit?: boolean;
  fireRating?: string;
  storey?: string;
  widthEvidencePath?: string;
  exitEvidencePath?: string;
};

export type Space = { expressId: number; globalId: string; name?: string };

export type BuildingModel = {
  id: string;
  name: string;
  filename: string;
  schema: string;
  units: "mm" | "m" | "unresolved";
  storeys: number;
  storeyNames?: string[];
  source: "sample" | "uploaded";
  provenance?: string;
  licence?: string;
  sourceUrl?: string;
  doors: Door[];
  spaces: Space[];
  byteLength?: number;
};

export type Finding = {
  id: string;
  ruleId: string;
  ruleVersion: number;
  ruleTitle: string;
  status: FindingStatus;
  elementId: string;
  expressId: number;
  elementName: string;
  message: string;
  observed: string;
  observedValue?: number;
  required: string;
  thresholdValue?: number;
  evidencePath: string;
  reliability: Reliability;
  nextStep: string;
};

export type RuleDefinition = {
  id: string;
  version: number;
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  authority: string;
  jurisdiction: string;
  sourceDocumentId: string;
  sourceAnchor: string;
  target: "IfcDoor" | "IfcSpace";
  field: "clearWidth" | "informationCompleteness";
  operator: ">=" | "required";
  threshold?: number;
  unit?: "mm";
  scope: string;
  exceptions: string[];
  missingEvidencePolicy: "REVIEW";
  severity: "HIGH" | "MEDIUM";
  status: "DRAFT" | "NEEDS_DECISION" | "VALIDATED" | "ACTIVE" | "SUPERSEDED";
  approvedAt?: string;
  extractionConfidence: number;
};

export type RuleConflict = {
  kind: "NONE" | "DUPLICATE" | "STRICTER" | "LOOSER" | "OVERLAPPING_SCOPE";
  existing?: RuleDefinition;
  summary: { en: string; zh: string };
  suggestions: { en: string[]; zh: string[] };
};

export const builtinRules: RuleDefinition[] = [
  {
    id: "EGRESS-WIDTH-001", version: 1,
    title: { en: "Exit door clear-width evidence", zh: "疏散门净宽度证据" },
    description: { en: "Checks explicitly confirmed exit doors against a 900 mm demonstration threshold.", zh: "按照 900 毫米演示阈值检查已明确标识的疏散门。" },
    authority: "Assessment demonstration parameter", jurisdiction: "Project", sourceDocumentId: "assessment-pack", sourceAnchor: "Rule 1",
    target: "IfcDoor", field: "clearWidth", operator: ">=", threshold: 900, unit: "mm", scope: "Doors explicitly classified as exits", exceptions: [], missingEvidencePolicy: "REVIEW", severity: "HIGH", status: "ACTIVE", approvedAt: "2026-08-15T00:00:00.000Z", extractionConfidence: 1,
  },
  {
    id: "INFO-001", version: 1,
    title: { en: "Door information completeness", zh: "门构件属性完整性" },
    description: { en: "Checks names, applicability, width provenance and fire-rating evidence for exit doors.", zh: "检查名称、适用性、宽度来源，以及疏散门的耐火等级证据。" },
    authority: "Assessment evidence policy", jurisdiction: "Project", sourceDocumentId: "assessment-pack", sourceAnchor: "Rule 2",
    target: "IfcDoor", field: "informationCompleteness", operator: "required", scope: "All IfcDoor elements", exceptions: [], missingEvidencePolicy: "REVIEW", severity: "MEDIUM", status: "ACTIVE", approvedAt: "2026-08-15T00:00:00.000Z", extractionConfidence: 1,
  },
];

export const assessmentSamples = [
  { id: "duplex", label: { en: "Duplex residence", zh: "双拼住宅" }, filename: "duplex-xeokit.ifc", path: "/samples/duplex-xeokit.ifc", schema: "IFC2X3", note: { en: "14 doors · 21 spaces · fast interactive sample", zh: "14 扇门 · 21 个空间 · 快速交互样本" }, licence: "Apache-2.0", sourceUrl: "https://github.com/xeokit/xeokit-sdk/blob/master/assets/models/ifc/Duplex.ifc" },
  { id: "clinic", label: { en: "Medical–dental clinic", zh: "医疗牙科诊所" }, filename: "medical-dental-clinic.ifc", path: "/samples/medical-dental-clinic.ifc", schema: "IFC2X3", note: { en: "254 doors · 269 spaces · performance sample", zh: "254 扇门 · 269 个空间 · 性能样本" }, licence: "CC-BY-4.0", sourceUrl: "https://github.com/buildingsmart-community/Community-Sample-Test-Files" },
  { id: "pcert", label: { en: "buildingSMART PCERT", zh: "buildingSMART PCERT" }, filename: "buildingsmart-pcert-architecture.ifc", path: "/samples/buildingsmart-pcert-architecture.ifc", schema: "IFC4", note: { en: "Official IFC4 negative-control model", zh: "官方 IFC4 阴性对照模型" }, licence: "CC-BY-4.0", sourceUrl: "https://github.com/buildingSMART/Sample-Test-Files" },
] as const;

const splitStepArguments = (line: string): string[] => {
  const args: string[] = []; let token = ""; let quoted = false; let depth = 0;
  for (const char of line) {
    if (char === "'") quoted = !quoted;
    if (!quoted && char === "(") depth += 1;
    if (!quoted && char === ")") depth -= 1;
    if (char === "," && !quoted && depth === 0) { args.push(token.trim()); token = ""; } else token += char;
  }
  if (token) args.push(token.trim());
  return args;
};

function normaliseLength(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value > 20 ? value : value * 1000);
}

export function parseIfc(text: string, filename: string, source: BuildingModel["source"] = "uploaded"): BuildingModel {
  if (!/ISO-10303-21/i.test(text) || !/IFCPROJECT\s*\(/i.test(text)) throw new Error("The file is not a readable IFC STEP model.");
  const schema = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1] ?? "IFC (unresolved)";
  const projectLine = text.match(/#\d+\s*=\s*IFCPROJECT\s*\([^;]+;/i)?.[0];
  const projectStrings = projectLine ? [...projectLine.matchAll(/'([^']*)'/g)].map((match) => match[1]) : [];
  const projectName = projectStrings[1];
  const entityLines = new Map<string, string>();
  for (const match of text.matchAll(/#(\d+)\s*=\s*([^;]+);/gi)) entityLines.set(match[1], match[2]);

  const propertyValues = new Map<string, { name: string; value?: string | number | boolean }>();
  const propertySets = new Map<string, string[]>();
  const assignments = new Map<string, string[]>();
  for (const [id, line] of entityLines) {
    if (/^IFCPROPERTYSINGLEVALUE\s*\(/i.test(line)) {
      const name = line.match(/IFCPROPERTYSINGLEVALUE\s*\(\s*'([^']+)'/i)?.[1] ?? "";
      const boolean = line.match(/IFCBOOLEAN\s*\(\s*\.(T|F)\./i)?.[1];
      const number = line.match(/IFC(?:LENGTHMEASURE|REAL|INTEGER|POSITIVE_LENGTH_MEASURE)\s*\(\s*(-?\d+(?:\.\d+)?)/i)?.[1];
      const label = line.match(/IFC(?:LABEL|TEXT|IDENTIFIER)\s*\(\s*'([^']*)'/i)?.[1];
      propertyValues.set(id, { name, value: boolean ? boolean.toUpperCase() === "T" : number !== undefined ? Number(number) : label });
    }
    if (/^IFCPROPERTYSET\s*\(/i.test(line)) {
      const refsBlock = line.match(/\(\s*(#[\d\s,#]+)\s*\)\s*\)$/)?.[1] ?? "";
      propertySets.set(id, [...refsBlock.matchAll(/#(\d+)/g)].map((match) => match[1]));
    }
    if (/^IFCRELDEFINESBYPROPERTIES\s*\(/i.test(line)) {
      const relation = line.match(/,\s*\((#[\d\s,#]+)\)\s*,\s*#(\d+)\s*\)$/i);
      if (relation) [...relation[1].matchAll(/#(\d+)/g)].map((m) => m[1]).forEach((target) => assignments.set(target, [...(assignments.get(target) ?? []), relation[2]]));
    }
  }

  const entityProperties = (entityId: string) => (assignments.get(entityId) ?? [])
    .flatMap((setId) => propertySets.get(setId) ?? [])
    .map((propertyId) => propertyValues.get(propertyId)).filter(Boolean) as { name: string; value?: string | number | boolean }[];

  const storeyById = new Map<string, string>();
  for (const [id, line] of entityLines) if (/^IFCBUILDINGSTOREY\s*\(/i.test(line)) {
    const strings = [...line.matchAll(/'([^']*)'/g)].map((item) => item[1]); storeyById.set(id, strings[1] || strings[0] || `Storey #${id}`);
  }
  const elementStorey = new Map<string, string>();
  for (const line of entityLines.values()) if (/^IFCRELCONTAINEDINSPATIALSTRUCTURE\s*\(/i.test(line)) {
    const relation = line.match(/,\s*\((#[\d\s,#]+)\)\s*,\s*#(\d+)\s*\)$/i); const storey = relation ? storeyById.get(relation[2]) : undefined;
    if (relation && storey) for (const match of relation[1].matchAll(/#(\d+)/g)) elementStorey.set(match[1], storey);
  }

  const doors = [...text.matchAll(/#(\d+)\s*=\s*IFCDOOR\s*\(([^;]+);/gi)].map((match, index): Door => {
    const entityId = match[1]; const line = match[0]; const body = match[2].replace(/\)$/, "");
    const args = splitStepArguments(body); const strings = [...line.matchAll(/'([^']*)'/g)].map((item) => item[1]);
    const numeric = args.map((arg) => /^-?\d+(?:\.\d+)?$/.test(arg) ? Number(arg) : NaN).filter(Number.isFinite);
    const nominalWidth = normaliseLength(numeric.at(-1));
    const properties = entityProperties(entityId);
    const property = (name: string) => properties.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value;
    const clearWidth = property("ClearWidth"); const fireExit = property("FireExit"); const fireRating = property("FireRating");
    return {
      expressId: Number(entityId), globalId: strings[0] || `UNRESOLVED-${index + 1}`, name: strings[1] || "",
      widthMm: typeof clearWidth === "number" ? normaliseLength(clearWidth) : nominalWidth,
      widthSource: typeof clearWidth === "number" ? "clear_width" : nominalWidth ? "overall_width_proxy" : "missing",
      isExit: typeof fireExit === "boolean" ? fireExit : undefined,
      fireRating: typeof fireRating === "string" && fireRating.trim() ? fireRating : undefined,
      storey: elementStorey.get(entityId),
    };
  });

  const spaces = [...text.matchAll(/#(\d+)\s*=\s*IFCSPACE\s*\(([^;]+);/gi)].map((match, index): Space => {
    const strings = [...match[0].matchAll(/'([^']*)'/g)].map((item) => item[1]);
    return { expressId: Number(match[1]), globalId: strings[0] || `SPACE-${index + 1}`, name: strings[1] || "" };
  });

  return {
    id: `${source}-${filename}-${text.length}`, name: projectName || filename.replace(/\.ifc$/i, ""), filename, schema,
    units: /IFCSIUNIT\s*\([^;]*\.MILLI\.[^;]*\.METRE\./i.test(text) ? "mm" : /IFCSIUNIT\s*\([^;]*\.METRE\./i.test(text) ? "m" : "unresolved",
    storeys: Math.max(1, storeyById.size), storeyNames: [...new Set(storeyById.values())], source, doors, spaces, byteLength: text.length,
  };
}

function widthFinding(item: Door, rule: RuleDefinition, locale: Locale): Finding {
  const threshold = rule.threshold ?? 900; const zh = locale === "zh";
  const measurement = (value: number) => zh ? `${value} 毫米` : `${value} mm`;
  const base = { id: `${rule.id}-v${rule.version}-${item.globalId}`, ruleId: rule.id, ruleVersion: rule.version, ruleTitle: rule.title[locale], elementId: item.globalId, expressId: item.expressId, elementName: item.name || (zh ? "未命名门" : "Unnamed door"), required: `≥ ${measurement(threshold)}`, thresholdValue: threshold, evidencePath: item.widthEvidencePath ?? (item.widthSource === "clear_width" ? "Pset_DoorCommon.ClearWidth" : item.widthSource === "overall_width_proxy" ? "IfcDoor.OverallWidth" : (zh ? "未找到可用的宽度属性" : "No usable width property")), nextStep: "" };
  if (item.isExit === false) return { ...base, status: "NOT_APPLICABLE", message: zh ? "该构件已明确标记为非疏散门。" : "The element is explicitly not classified as an exit door.", observed: zh ? "非疏散门" : "Not an exit door", reliability: "EXPLICIT", nextStep: zh ? "本规则无需处理。" : "No action is required under this rule." };
  if (item.isExit === undefined) return { ...base, status: "REVIEW", message: zh ? "模型未提供疏散门适用性证据，不能安全作出宽度判定。" : "Exit-door applicability is not evidenced, so a width verdict would be unsafe.", observed: zh ? "缺少疏散门状态" : "Exit status missing", reliability: "MISSING", nextStep: zh ? "请设计团队确认该门是否位于逃生路径。" : "Ask the design team to confirm whether this door serves an escape route." };
  if (item.widthMm === undefined) return { ...base, status: "REVIEW", message: zh ? "该门是疏散门，但没有可用宽度证据。" : "The door is an exit, but no usable width evidence was found.", observed: zh ? "缺少宽度" : "Width missing", reliability: "MISSING", nextStep: zh ? "请提供净开口测量值或已批准门表数据。" : "Provide a clear-opening measurement or an approved schedule value." };
  if (item.widthSource !== "clear_width") return { ...base, status: "REVIEW", message: zh ? `${measurement(item.widthMm)}为 IfcDoor.OverallWidth 的名义尺寸，尚不能作为净开口宽度的确证。` : `${measurement(item.widthMm)} is a nominal IfcDoor.OverallWidth value, not confirmed clear-opening evidence.`, observed: zh ? `${measurement(item.widthMm)}（名义尺寸）` : `${measurement(item.widthMm)} (nominal proxy)`, observedValue: item.widthMm, reliability: "PROXY", nextStep: zh ? "作出合规结论前，请以现场量测或经批准门表确认净开口尺寸。" : "Confirm the clear opening from a site measurement or approved door schedule before reaching a compliance conclusion." };
  if (item.widthMm < threshold) return { ...base, status: "FAIL", message: zh ? `已确认的净宽为${measurement(item.widthMm)}，比审查阈值少${measurement(threshold - item.widthMm)}。` : `The evidenced clear width is ${measurement(item.widthMm)}, which is ${measurement(threshold - item.widthMm)} below the review threshold.`, observed: measurement(item.widthMm), observedValue: item.widthMm, reliability: "EXPLICIT", nextStep: zh ? `净开口至少增加${measurement(threshold - item.widthMm)}，并在修订 IFC 模型后重新审查。` : `Increase the clear opening by at least ${measurement(threshold - item.widthMm)}, then re-check the revised IFC model.` };
  return { ...base, status: "PASS", message: zh ? `已确认的净宽为${measurement(item.widthMm)}，满足审查阈值。` : `The evidenced clear width is ${measurement(item.widthMm)} and meets the review threshold.`, observed: measurement(item.widthMm), observedValue: item.widthMm, reliability: "EXPLICIT", nextStep: zh ? "请在设计记录中保留净开口尺寸的证据。" : "Retain the clear-opening evidence in the design record." };
}

function informationFinding(item: Door, rule: RuleDefinition, locale: Locale): Finding {
  const zh = locale === "zh"; const missing = [!item.name && "IfcDoor.Name", item.isExit === undefined && (zh ? "疏散门分类" : "exit classification"), item.widthSource === "missing" && (zh ? "宽度证据" : "width evidence"), item.isExit === true && !item.fireRating && (zh ? "耐火等级证据" : "fire-rating evidence")].filter(Boolean) as string[];
  return { id: `${rule.id}-v${rule.version}-${item.globalId}`, ruleId: rule.id, ruleVersion: rule.version, ruleTitle: rule.title[locale], status: missing.length ? "REVIEW" : "PASS", elementId: item.globalId, expressId: item.expressId, elementName: item.name || (zh ? "未命名门" : "Unnamed door"), message: missing.length ? (zh ? `证据不完整：${missing.join("、")}。` : `Evidence is incomplete: ${missing.join(", ")}.`) : (zh ? "所需预审证据完整。" : "The required pre-review evidence is present."), observed: missing.length ? `${missing.length} ${zh ? "项缺失" : `missing field${missing.length > 1 ? "s" : ""}`}` : (zh ? "完整" : "Complete"), required: zh ? "名称、适用性、宽度来源；疏散门还需耐火等级" : "Name, applicability, width provenance; fire rating for exits", evidencePath: `IfcDoor[${item.globalId}]`, reliability: missing.length ? "MISSING" : "EXPLICIT", nextStep: missing.length ? (zh ? "补充缺失属性；不得根据门名称推断。" : "Request the missing properties; do not infer them from the door name.") : (zh ? "无需补充证据。" : "No evidence-enrichment action is required.") };
}

export function analyseModel(model: BuildingModel, rules: RuleDefinition[] = builtinRules, locale: Locale = "en"): Finding[] {
  const active = rules.filter((rule) => rule.status === "ACTIVE");
  return model.doors.flatMap((item) => active.map((rule) => rule.field === "clearWidth" ? widthFinding(item, rule, locale) : informationFinding(item, rule, locale)));
}

export function proposeRule(input: string, existing: RuleDefinition[] = builtinRules): { rule: RuleDefinition; conflict: RuleConflict; feasibility: { valid: boolean; score: number; issues: string[]; suggestions: string[] } } {
  const lower = input.toLowerCase(); const metre = lower.match(/(\d+(?:\.\d+)?)\s*(?:m|metre|meter|米)\b/); const millimetre = lower.match(/(\d+(?:\.\d+)?)\s*(?:mm|毫米)/);
  const threshold = millimetre ? Number(millimetre[1]) : metre ? Number(metre[1]) * 1000 : Number(lower.match(/\d+(?:\.\d+)?/)?.[0] ?? NaN);
  const issues: string[] = []; const suggestions: string[] = [];
  if (!Number.isFinite(threshold)) issues.push("No measurable numerical threshold was found.");
  if (Number.isFinite(threshold) && (threshold < 300 || threshold > 3000)) issues.push("The threshold is outside a plausible door-width range (300–3,000 mm); check the unit or decimal place.");
  if (!/(door|门)/i.test(input)) issues.push("The target element is unclear; specify doors or a more precise IFC entity.");
  if (!/(exit|egress|escape|疏散|出口)/i.test(input)) suggestions.push("Define whether the rule applies to exit doors, all doors, or a named classification.");
  suggestions.push("Add the jurisdiction, source clause, occupancy and any exceptions before approval.");
  const safeThreshold = Number.isFinite(threshold) ? Math.round(threshold) : 900;
  const rule: RuleDefinition = { id: `PROJECT-WIDTH-${String(existing.length + 1).padStart(3, "0")}`, version: 1, title: { en: `Project exit-door width · ${safeThreshold} mm`, zh: `项目疏散门宽度 · ${safeThreshold} 毫米` }, description: { en: input.trim(), zh: input.trim() }, authority: "User-proposed project rule", jurisdiction: "Project", sourceDocumentId: "chat-input", sourceAnchor: "User instruction", target: "IfcDoor", field: "clearWidth", operator: ">=", threshold: safeThreshold, unit: "mm", scope: /(exit|egress|escape|疏散|出口)/i.test(input) ? "Confirmed exit doors" : "Scope requires confirmation", exceptions: [], missingEvidencePolicy: "REVIEW", severity: "HIGH", status: "DRAFT", extractionConfidence: issues.length ? 0.55 : 0.9 };
  const comparable = existing.find((item) => item.field === rule.field && item.status === "ACTIVE");
  let kind: RuleConflict["kind"] = "NONE";
  if (comparable?.threshold === safeThreshold) kind = "DUPLICATE"; else if (comparable?.threshold && safeThreshold > comparable.threshold) kind = "STRICTER"; else if (comparable?.threshold && safeThreshold < comparable.threshold) kind = "LOOSER"; else if (comparable) kind = "OVERLAPPING_SCOPE";
  const delta = comparable?.threshold ? Math.abs(safeThreshold - comparable.threshold) : 0;
  const conflict: RuleConflict = { kind, existing: comparable, summary: { en: kind === "NONE" ? "No active rule conflict was found." : kind === "DUPLICATE" ? "The proposed threshold duplicates an active rule." : `The proposal is ${kind.toLowerCase()} than the active threshold by ${delta} mm.`, zh: kind === "NONE" ? "未发现与现有启用规则的冲突。" : kind === "DUPLICATE" ? "建议阈值与现有规则重复。" : `建议规则比现有阈值${kind === "STRICTER" ? "严格" : "宽松"} ${delta} 毫米。` }, suggestions: { en: ["Replace the active rule and preserve its history.", "Keep both rules with distinct scopes or jurisdictions.", "Cancel and refine the proposal."], zh: ["替换现有规则并保留历史版本。", "保留两条规则，但设置不同范围或法域。", "取消并继续完善建议。"] } };
  return { rule: { ...rule, status: issues.length ? "DRAFT" : conflict.kind === "NONE" ? "VALIDATED" : "NEEDS_DECISION" }, conflict, feasibility: { valid: issues.length === 0, score: Math.max(0, 100 - issues.length * 35 - suggestions.length * 5), issues, suggestions } };
}

export function resolveRuleProposal(rule: RuleDefinition, action: "replace" | "keep" | "cancel", existing: RuleDefinition[]): RuleDefinition[] {
  if (action === "cancel") return existing;
  const now = new Date().toISOString(); const approved = { ...rule, status: "ACTIVE" as const, approvedAt: now };
  if (action === "replace") return [...existing.map((item) => item.field === rule.field && item.status === "ACTIVE" ? { ...item, status: "SUPERSEDED" as const } : item), approved];
  return [...existing, { ...approved, scope: rule.scope === "Scope requires confirmation" ? "Project-specific exit doors; scope confirmed by the user" : rule.scope }];
}

export function compareModels(before: BuildingModel, after: BuildingModel, rules: RuleDefinition[] = builtinRules) {
  const beforeStatus = new Map(analyseModel(before, rules).filter((item) => item.ruleId === "EGRESS-WIDTH-001").map((item) => [item.elementId, item.status]));
  const prior = new Map(before.doors.map((item) => [item.globalId, item]));
  const afterStatus = new Map(analyseModel(after, rules).filter((item) => item.ruleId === "EGRESS-WIDTH-001").map((item) => [item.elementId, item.status]));
  const items = after.doors.map((item) => {
    const old = prior.get(item.globalId); if (!old) return { id: item.globalId, name: item.name || "Unnamed door", before: "—", after: item.widthMm ? `${item.widthMm} mm` : "Missing", kind: "new", label: "New element" };
    const changed = old.widthMm !== item.widthMm || old.fireRating !== item.fireRating || old.isExit !== item.isExit;
    const kind = beforeStatus.get(item.globalId) === "FAIL" && afterStatus.get(item.globalId) !== "FAIL" ? "resolved" : beforeStatus.get(item.globalId) !== "FAIL" && afterStatus.get(item.globalId) === "FAIL" ? "regressed" : changed ? "changed" : "unchanged";
    return { id: item.globalId, name: item.name || "Unnamed door", before: old.widthMm ? `${old.widthMm} mm` : "Missing", after: item.widthMm ? `${item.widthMm} mm` : "Missing", kind, label: kind === "resolved" ? "Resolved" : kind === "regressed" ? "Regressed" : kind === "changed" ? "Evidence changed" : "No change" };
  });
  return { items, resolved: items.filter((item) => item.kind === "resolved").length, regressed: items.filter((item) => item.kind === "regressed").length, changed: items.filter((item) => item.kind !== "unchanged").length, unchanged: items.filter((item) => item.kind === "unchanged").length };
}

function buildReportBase(model: BuildingModel, findings: Finding[], locale: Locale): string {
  const zh = locale === "zh"; const counts = Object.fromEntries(["FAIL", "REVIEW", "PASS", "NOT_APPLICABLE"].map((status) => [status, findings.filter((item) => item.status === status).length]));
  const status = (value: FindingStatus) => zh ? ({ PASS:"通过", FAIL:"不通过", REVIEW:"需专业复核", NOT_APPLICABLE:"不适用" } as const)[value] : ({ PASS:"Pass", FAIL:"Fail", REVIEW:"Professional review required", NOT_APPLICABLE:"Not applicable" } as const)[value];
  const reliability = (value: Reliability) => zh ? ({ EXPLICIT:"明确证据", PROXY:"替代证据", MISSING:"证据缺失", DERIVED:"推导证据" } as const)[value] : ({ EXPLICIT:"Explicit evidence", PROXY:"Proxy evidence", MISSING:"Missing evidence", DERIVED:"Derived evidence" } as const)[value];
  const conclusion = counts.FAIL ? (zh ? "所选范围存在不符合项，须完成整改并重新审查。" : "The selected scope contains non-compliant findings that require correction and re-review.") : counts.REVIEW ? (zh ? "未发现已确认的不符合项，但仍有证据需要专业复核。" : "No confirmed failures were found, but professional review of outstanding evidence is required.") : (zh ? "在所选规则和现有证据范围内，未发现不符合项。" : "No non-compliant findings were identified within the selected rules and available evidence.");
  return `# ${zh ? "BIM 合规证据预审报告" : "BIM Compliance Evidence Pre-review Report"}\n\n## ${zh ? "项目资料" : "Project particulars"}\n\n- **${zh ? "模型名称" : "Model"}:** ${model.name}\n- **${zh ? "IFC 架构" : "IFC schema"}:** ${model.schema}\n- **${zh ? "模型单位" : "Model units"}:** ${zh ? ({ mm:"毫米", m:"米", unresolved:"未确定" } as const)[model.units] : model.units}\n- **${zh ? "报告生成时间" : "Generated"}:** ${new Date().toISOString()}\n\n## ${zh ? "执行摘要" : "Executive summary"}\n\n${conclusion}\n\n${zh ? `共形成 ${findings.length} 项结果：${counts.FAIL} 项不通过，${counts.REVIEW} 项需专业复核，${counts.PASS} 项通过，${counts.NOT_APPLICABLE} 项不适用。` : `${findings.length} results were recorded: ${counts.FAIL} failed, ${counts.REVIEW} require professional review, ${counts.PASS} passed and ${counts.NOT_APPLICABLE} were not applicable.`}\n\n## ${zh ? "逐项审查结果" : "Detailed findings"}\n\n${findings.map((item, index) => `### ${index + 1}. ${status(item.status)} — ${item.elementName}\n\n**${zh ? "审查结论" : "Conclusion"}:** ${item.message}\n\n- **${zh ? "机器状态代码" : "Machine status"}:** \`${item.status}\`\n- **${zh ? "适用规则" : "Applied rule"}:** ${item.ruleTitle}（${item.ruleId} v${item.ruleVersion}）\n- **${zh ? "构件标识" : "Element GlobalId"}:** \`${item.elementId}\`\n- **${zh ? "观测证据" : "Observed evidence"}:** ${item.observed}\n- **${zh ? "验收准则" : "Acceptance criterion"}:** ${item.required}\n- **${zh ? "证据路径" : "Evidence path"}:** \`${item.evidencePath}\`\n- **${zh ? "证据质量" : "Evidence quality"}:** ${reliability(item.reliability)}\n- **${zh ? "建议措施" : "Recommended action"}:** ${item.nextStep}`).join("\n\n")}\n\n---\n${zh ? "限制声明：本报告仅用于专业预审，不构成法定认证，也不能替代合资格专业人士的判断。" : "Limitation: this report supports professional pre-review only. It does not certify statutory compliance or replace the judgement of a suitably qualified professional."}\n`;
}

function buildReportSummary(model: BuildingModel, findings: Finding[], locale: Locale): string {
  const zh = locale === "zh"; const counts = Object.fromEntries(["FAIL", "REVIEW", "PASS", "NOT_APPLICABLE"].map((status) => [status, findings.filter((item) => item.status === status).length]));
  const outcome = counts.FAIL ? (zh ? "所选范围存在不符合项，应在整改后重新审查。" : "The selected scope contains non-compliant findings and should be re-reviewed after correction.") : counts.REVIEW ? (zh ? "当前没有已确认的不符合项，但证据尚不足以完成全部判断。" : "There are no confirmed failures, but the available evidence is insufficient to conclude every check.") : (zh ? "在所选规则和现有证据范围内，未发现不符合项。" : "No non-compliant findings were identified within the selected rules and available evidence.");
  return `# ${zh ? "BIM 合规证据预审摘要" : "BIM Compliance Evidence Pre-review Summary"}\n\n- **${zh ? "模型名称" : "Model"}:** ${model.name}\n- **${zh ? "IFC 架构" : "IFC schema"}:** ${model.schema}\n- **${zh ? "模型单位" : "Model units"}:** ${zh ? ({ mm:"毫米", m:"米", unresolved:"未确定" } as const)[model.units] : model.units}\n\n## ${zh ? "总体结论" : "Overall conclusion"}\n\n${outcome}\n\n${zh ? `所选范围共形成 ${findings.length} 项结果：${counts.FAIL} 项不通过，${counts.REVIEW} 项需专业复核，${counts.PASS} 项通过，${counts.NOT_APPLICABLE} 项不适用。` : `The selected scope contains ${findings.length} results: ${counts.FAIL} failed, ${counts.REVIEW} require professional review, ${counts.PASS} passed and ${counts.NOT_APPLICABLE} were not applicable.`}\n\n---\n${zh ? "限制声明：本摘要不能替代逐项证据记录、法定认证或合资格专业人士的判断。" : "Limitation: this summary does not replace the finding-level evidence record, statutory certification or the judgement of a suitably qualified professional."}\n`;
}

export function buildReport(model: BuildingModel, findings: Finding[], locale: Locale, human?: { reviews: { elementId:string; disposition:string }[]; overrides: { elementId:string; field:string; provenance:string; status:string }[] }, detail: "summary" | "per-finding" = "per-finding"): string {
  const base = detail === "summary" ? buildReportSummary(model, findings, locale) : buildReportBase(model, findings, locale); if (!human || detail === "summary") return base;
  const lines = findings.flatMap((finding) => { const review = human.reviews.filter((record) => record.elementId === finding.elementId).at(-1); const corrections = human.overrides.filter((record) => record.elementId === finding.elementId && record.status === "APPLIED"); if (!review && !corrections.length) return []; return [`- ${finding.elementId}: ${review ? `${locale === "zh" ? "人工复核状态代码" : "Human disposition"} \`${review.disposition}\`` : ""}${review && corrections.length ? "; " : ""}${corrections.length ? `${locale === "zh" ? "已采用的证据修订" : "Applied evidence correction"} ${corrections.map((record) => `${record.field} · ${record.provenance}`).join("; ")}` : ""}`]; });
  if (!lines.length) return base; const heading = locale === "zh" ? "## 人工复核与证据修订（不覆盖机器结论）" : "## Human review and evidence corrections (machine verdicts remain separate)"; return base.replace("\n---\n", `\n${heading}\n\n${lines.join("\n")}\n\n---\n`);
}

export function verifyReport(report: string, findings: Finding[], options: { requireEveryFinding?: boolean } = {}): { valid: boolean; issues: string[] } {
  const issues: string[] = []; const requiredIds = findings.map((item) => item.elementId);
  if (options.requireEveryFinding !== false) for (const id of requiredIds) if (!report.includes(id)) issues.push(`Missing GlobalId: ${id}`);
  const findingSections = report.split(/(?=^### )/gm);
  if (options.requireEveryFinding !== false) for (const finding of findings) {
    const section = findingSections.find((candidate) => candidate.includes(finding.elementId) && candidate.includes(finding.ruleTitle));
    if (section && !section.includes(`\`${finding.status}\``)) issues.push(`Verdict mismatch for ${finding.elementId}: expected ${finding.status}`);
  }
  const allowedNumbers = new Set<number>([findings.length, ...findings.flatMap((item) => {
    const values = [item.observedValue, item.thresholdValue].filter((value): value is number => value !== undefined);
    if (item.observedValue !== undefined && item.thresholdValue !== undefined) values.push(Math.abs(item.thresholdValue - item.observedValue));
    const trustedText = [item.elementName, item.elementId, item.ruleTitle, item.message, item.observed, item.required, item.evidencePath, item.nextStep].join(" ");
    for (const match of trustedText.matchAll(/(\d+(?:\.\d+)?)\s*(mm|m)?\b/g)) values.push(Number(match[1]) * (match[2] === "m" ? 1000 : 1));
    return values;
  }), ...["FAIL", "REVIEW", "PASS", "NOT_APPLICABLE"].map((status) => findings.filter((item) => item.status === status).length)]);
  const claimText = report.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, "");
  const reportNumbers = [...claimText.matchAll(/(?<![A-Za-z0-9_#-])(\d+(?:\.\d+)?)\s*(mm|m)?\b/g)].map((match) => ({ value: Number(match[1]) * (match[2] === "m" ? 1000 : 1), raw: match[0] }));
  for (const item of reportNumbers) if (!allowedNumbers.has(item.value) && !/^20\d{2}/.test(item.raw)) issues.push(`Unverified numerical claim: ${item.raw}`);
  const mentionedIds = [...report.matchAll(/`([A-Za-z0-9_$-]{10,})`/g)].map((match) => match[1]);
  for (const id of mentionedIds) if (!requiredIds.includes(id) && !id.startsWith("IfcDoor")) issues.push(`Unknown identifier: ${id}`);
  return { valid: issues.length === 0, issues: [...new Set(issues)] };
}
