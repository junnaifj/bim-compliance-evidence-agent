export type Door = {
  globalId: string;
  name?: string;
  widthMm?: number;
  widthSource: "clear_width" | "overall_width_proxy" | "missing";
  isExit?: boolean;
  fireRating?: string;
  storey?: string;
};

export type BuildingModel = {
  id: string;
  name: string;
  schema: string;
  storeys: number;
  source: "sample" | "uploaded";
  provenance?: string;
  doors: Door[];
};

export const candidateSamples = [
  { id: "greatandyc", label: "GreatAndyC", name: "Mixed review", path: "/samples/greatandyc-mixed-review.ifc", licence: "MIT", note: "Synthetic IFC4 · explicit FireExit and ClearWidth evidence" },
  { id: "waterywaterman", label: "WateryWaterman", name: "Duplex", path: "/samples/waterywaterman-duplex.ifc", licence: "Apache-2.0", note: "Realistic IFC2x3 · 14 doors · xeokit sample" },
  { id: "mickey12go", label: "Mickey12go", name: "Sample doors", path: "/samples/mickey12go-sample-doors.ifc", licence: "MIT", note: "Hand-authored IFC4 · three doors" },
] as const;

export type FindingStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";
export type Finding = {
  id: string;
  ruleId: string;
  ruleTitle: string;
  status: FindingStatus;
  elementId: string;
  elementName: string;
  message: string;
  observed: string;
  required: string;
  evidencePath: string;
  reliability: "EXPLICIT" | "PROXY" | "MISSING" | "DERIVED";
  nextStep: string;
};

export type ConfirmedRule = {
  id: string;
  title: string;
  target: string;
  field: "clearWidth";
  operator: ">=";
  threshold: number;
  unit: "mm";
};

const door = (globalId: string, name: string, widthMm: number | undefined, widthSource: Door["widthSource"], isExit: boolean | undefined, fireRating?: string, storey = "Level 01"): Door => ({ globalId, name, widthMm, widthSource, isExit, fireRating, storey });

export const demoModels: Record<"baseline" | "current" | "uncertain", BuildingModel> = {
  baseline: {
    id: "baseline", name: "Harbour Clinic · R01", schema: "IFC4", storeys: 2, source: "sample",
    doors: [door("2xQ7A1BASE000000000001", "Main exit D-01", 820, "clear_width", true, "FD60"), door("2xQ7A1BASE000000000002", "Consulting D-02", 900, "overall_width_proxy", false), door("2xQ7A1BASE000000000003", "Rear exit D-03", 880, "clear_width", true, "FD60"), door("2xQ7A1BASE000000000004", "Store D-04", 760, "overall_width_proxy", false), door("2xQ7A1BASE000000000005", "Stair door D-05", 910, "clear_width", true)],
  },
  current: {
    id: "current", name: "Harbour Clinic · R02", schema: "IFC4", storeys: 2, source: "sample",
    doors: [door("2xQ7A1BASE000000000001", "Main exit D-01", 950, "clear_width", true, "FD60"), door("2xQ7A1BASE000000000002", "Consulting D-02", 900, "overall_width_proxy", false), door("2xQ7A1BASE000000000003", "Rear exit D-03", 880, "clear_width", true, "FD60"), door("2xQ7A1BASE000000000004", "Store D-04", 760, "overall_width_proxy", false), door("2xQ7A1BASE000000000005", "Stair door D-05", 910, "clear_width", true), door("2xQ7A1BASE000000000006", "Treatment exit D-06", 900, "clear_width", true, "FD60", "Level 02")],
  },
  uncertain: {
    id: "uncertain", name: "Riverside Office · evidence gaps", schema: "IFC2X3", storeys: 1, source: "sample",
    doors: [door("3nR9EVIDENCE00000000001", "Door 01", 850, "overall_width_proxy", undefined), door("3nR9EVIDENCE00000000002", "", undefined, "missing", true), door("3nR9EVIDENCE00000000003", "Lobby door", 1000, "overall_width_proxy", true), door("3nR9EVIDENCE00000000004", "Meeting room door", 900, "clear_width", false)],
  },
};

function widthFinding(item: Door, threshold = 900, ruleId = "EGRESS-WIDTH-001", title = "Exit door clear-width evidence"): Finding {
  const base = { id: `${ruleId}-${item.globalId}`, ruleId, ruleTitle: title, elementId: item.globalId, elementName: item.name || "Unnamed door", required: `≥ ${threshold} mm`, evidencePath: item.widthSource === "clear_width" ? "Pset_DoorCommon.ClearWidth" : item.widthSource === "overall_width_proxy" ? "IfcDoor.OverallWidth" : "No usable width property", nextStep: "" };
  if (item.isExit === false) return { ...base, status: "NOT_APPLICABLE", message: "The element is explicitly not classified as an exit door.", observed: "Not an exit door", reliability: "EXPLICIT", nextStep: "No action is required under this rule." };
  if (item.isExit === undefined) return { ...base, status: "REVIEW", message: "Exit-door applicability is not evidenced, so a width verdict would be unsafe.", observed: "Exit status missing", reliability: "MISSING", nextStep: "Ask the design team to confirm whether this door serves an escape route." };
  if (item.widthMm === undefined) return { ...base, status: "REVIEW", message: "The door is an exit, but no usable width evidence was found.", observed: "Width missing", reliability: "MISSING", nextStep: "Provide a clear-opening measurement or an approved schedule value." };
  if (item.widthSource !== "clear_width") return { ...base, status: "REVIEW", message: `${item.widthMm} mm is a nominal OverallWidth proxy, not confirmed clear-opening evidence.`, observed: `${item.widthMm} mm proxy`, reliability: "PROXY", nextStep: "Confirm the clear opening before assigning a compliance verdict." };
  if (item.widthMm < threshold) return { ...base, status: "FAIL", message: `The evidenced clear width is ${item.widthMm} mm, ${threshold - item.widthMm} mm below the confirmed threshold.`, observed: `${item.widthMm} mm`, reliability: "EXPLICIT", nextStep: `Increase the clear opening by at least ${threshold - item.widthMm} mm, then re-check the revised IFC.` };
  return { ...base, status: "PASS", message: `The evidenced clear width is ${item.widthMm} mm and meets the confirmed threshold.`, observed: `${item.widthMm} mm`, reliability: "EXPLICIT", nextStep: "Retain the measurement evidence in the design record." };
}

function informationFinding(item: Door): Finding {
  const missing = [!item.name && "IfcDoor.Name", item.isExit === undefined && "exit classification", item.widthSource === "missing" && "width evidence", item.isExit === true && !item.fireRating && "fire-rating evidence"].filter(Boolean) as string[];
  const status: FindingStatus = missing.length ? "REVIEW" : "PASS";
  return { id: `INFO-001-${item.globalId}`, ruleId: "INFO-001", ruleTitle: "Door information completeness", status, elementId: item.globalId, elementName: item.name || "Unnamed door", message: missing.length ? `Evidence is incomplete: ${missing.join(", ")}.` : "The required pre-review evidence is present.", observed: missing.length ? `${missing.length} missing field${missing.length > 1 ? "s" : ""}` : "Complete", required: "Name, applicability, width provenance; fire rating for exits", evidencePath: `IfcDoor[${item.globalId}]`, reliability: missing.length ? "MISSING" : "EXPLICIT", nextStep: missing.length ? "Request the missing properties; do not infer them from the door name." : "No evidence-enrichment action is required." };
}

export function analyseModel(model: BuildingModel, projectRules: ConfirmedRule[] = []): Finding[] {
  const findings = model.doors.flatMap((item) => [widthFinding(item), informationFinding(item)]);
  projectRules.forEach((rule) => model.doors.forEach((item) => findings.push(widthFinding(item, rule.threshold, rule.id, rule.title))));
  return findings;
}

export function interpretRule(input: string): ConfirmedRule {
  const number = Number(input.match(/(\d+(?:\.\d+)?)\s*(mm|m)\b/i)?.[1] ?? 900);
  const unit = input.match(/\d+(?:\.\d+)?\s*(mm|m)\b/i)?.[1]?.toLowerCase();
  const threshold = unit === "m" ? Math.round(number * 1000) : Math.round(number);
  return { id: `PROJECT-WIDTH-${threshold}`, title: `Confirmed exit-door width · ${threshold} mm`, target: "IfcDoor where exit status is explicitly true", field: "clearWidth", operator: ">=", threshold, unit: "mm" };
}

export function compareModels(before: BuildingModel, after: BuildingModel) {
  const prior = new Map(before.doors.map((item) => [item.globalId, item]));
  const items = after.doors.map((item) => {
    const old = prior.get(item.globalId);
    if (!old) return { id: item.globalId, name: item.name || "Unnamed door", before: "—", after: item.widthMm ? `${item.widthMm} mm` : "Missing", kind: "new", label: "New element" };
    const changed = old.widthMm !== item.widthMm || old.fireRating !== item.fireRating || old.isExit !== item.isExit;
    const oldFail = old.isExit === true && old.widthSource === "clear_width" && (old.widthMm ?? Infinity) < 900;
    const newFail = item.isExit === true && item.widthSource === "clear_width" && (item.widthMm ?? Infinity) < 900;
    const kind = oldFail && !newFail ? "resolved" : !oldFail && newFail ? "regressed" : changed ? "changed" : "unchanged";
    return { id: item.globalId, name: item.name || "Unnamed door", before: old.widthMm ? `${old.widthMm} mm` : "Missing", after: item.widthMm ? `${item.widthMm} mm` : "Missing", kind, label: kind === "resolved" ? "Resolved" : kind === "regressed" ? "Regressed" : kind === "changed" ? "Evidence changed" : "No change" };
  });
  return { items, resolved: items.filter((item) => item.kind === "resolved").length, regressed: items.filter((item) => item.kind === "regressed").length, changed: items.filter((item) => item.kind !== "unchanged").length, unchanged: items.filter((item) => item.kind === "unchanged").length };
}

function splitStepArguments(line: string): string[] {
  const args: string[] = []; let token = ""; let quoted = false;
  for (const char of line) { if (char === "'") quoted = !quoted; if (char === "," && !quoted) { args.push(token.trim()); token = ""; } else token += char; }
  if (token) args.push(token.trim()); return args;
}

export function parseIfc(text: string, filename: string): BuildingModel {
  const schema = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1] ?? "IFC (unresolved)";
  const projectLine = text.match(/#\d+\s*=\s*IFCPROJECT\s*\([^;]+;/i)?.[0];
  const projectStrings = projectLine ? [...projectLine.matchAll(/'([^']*)'/g)].map((match) => match[1]) : [];
  const projectName = projectStrings[1];
  const entityLines = new Map<string, string>();
  for (const match of text.matchAll(/#(\d+)\s*=\s*([^;]+);/gi)) entityLines.set(match[1], match[2]);
  const propertyValues = new Map<string, { name: string; value?: string | number | boolean }>();
  const propertySets = new Map<string, { name: string; properties: string[] }>();
  const assignments = new Map<string, string[]>();
  for (const [id, line] of entityLines) {
    if (/^IFCPROPERTYSINGLEVALUE\s*\(/i.test(line)) {
      const name = line.match(/IFCPROPERTYSINGLEVALUE\s*\(\s*'([^']+)'/i)?.[1] ?? "";
      const boolean = line.match(/IFCBOOLEAN\s*\(\s*\.(T|F)\./i)?.[1];
      const number = line.match(/IFC(?:LENGTHMEASURE|REAL|INTEGER)\s*\(\s*(-?\d+(?:\.\d+)?)/i)?.[1];
      const label = line.match(/IFC(?:LABEL|TEXT|IDENTIFIER)\s*\(\s*'([^']*)'/i)?.[1];
      propertyValues.set(id, { name, value: boolean ? boolean.toUpperCase() === "T" : number !== undefined ? Number(number) : label });
    }
    if (/^IFCPROPERTYSET\s*\(/i.test(line)) {
      const name = [...line.matchAll(/'([^']*)'/g)].map((match) => match[1])[1] ?? "";
      const refsBlock = line.match(/\(\s*(#[\d\s,#]+)\s*\)\s*\)$/)?.[1] ?? "";
      propertySets.set(id, { name, properties: [...refsBlock.matchAll(/#(\d+)/g)].map((match) => match[1]) });
    }
    if (/^IFCRELDEFINESBYPROPERTIES\s*\(/i.test(line)) {
      const relation = line.match(/,\s*\((#[\d\s,#]+)\)\s*,\s*#(\d+)\s*\)$/i);
      if (relation) {
        const targets = [...relation[1].matchAll(/#(\d+)/g)].map((match) => match[1]);
        targets.forEach((target) => assignments.set(target, [...(assignments.get(target) ?? []), relation[2]]));
      }
    }
  }
  const lines = text.match(/#\d+\s*=\s*IFCDOOR\s*\([^;]+;/gi) ?? [];
  const doors = lines.map((line, index): Door => {
    const entityId = line.match(/^#(\d+)/)?.[1] ?? "";
    const body = line.slice(line.indexOf("(") + 1, line.lastIndexOf(")")); const args = splitStepArguments(body);
    const strings = [...line.matchAll(/'([^']*)'/g)].map((match) => match[1]);
    const numeric = args.map((arg) => Number(arg)).filter(Number.isFinite);
    const widthRaw = numeric.at(-1); const widthMm = widthRaw ? Math.round(widthRaw > 20 ? widthRaw : widthRaw * 1000) : undefined;
    const properties = (assignments.get(entityId) ?? []).flatMap((setId) => propertySets.get(setId)?.properties ?? []).map((propertyId) => propertyValues.get(propertyId)).filter(Boolean) as { name: string; value?: string | number | boolean }[];
    const findProperty = (name: string) => properties.find((property) => property.name.toLowerCase() === name.toLowerCase())?.value;
    const clearWidth = findProperty("ClearWidth");
    const fireExit = findProperty("FireExit");
    const fireRating = findProperty("FireRating");
    return {
      globalId: strings[0] || `UNRESOLVED-${index + 1}`,
      name: strings[1] || "",
      widthMm: typeof clearWidth === "number" ? Math.round(clearWidth > 20 ? clearWidth : clearWidth * 1000) : widthMm,
      widthSource: typeof clearWidth === "number" ? "clear_width" : widthMm ? "overall_width_proxy" : "missing",
      isExit: typeof fireExit === "boolean" ? fireExit : undefined,
      fireRating: typeof fireRating === "string" ? fireRating : undefined,
    };
  });
  return { id: `upload-${Date.now()}`, name: projectName || filename.replace(/\.ifc$/i, ""), schema, storeys: Math.max(1, (text.match(/IFCBUILDINGSTOREY\s*\(/gi) ?? []).length), source: "uploaded", doors };
}

export function buildReport(model: BuildingModel, findings: Finding[], language: "en" | "zh"): string {
  const fail = findings.filter((item) => item.status === "FAIL").length; const review = findings.filter((item) => item.status === "REVIEW").length;
  const heading = language === "en" ? "IFC Evidence Pre-review" : "IFC 证据预审报告";
  const summary = language === "en" ? `${findings.length} checks completed; ${fail} failed and ${review} require professional review.` : `已完成 ${findings.length} 项检查；${fail} 项不通过，${review} 项需要专业复核。`;
  return `# ${heading}\n\n**Model:** ${model.name}  \n**Schema:** ${model.schema}  \n**Generated:** ${new Date().toISOString()}\n\n## Summary\n\n${summary}\n\n## Traceable findings\n\n${findings.map((item) => `### [${item.status}] ${item.elementName} — ${item.ruleTitle}\n\n${item.message}\n\n- GlobalId: \`${item.elementId}\`\n- Observed: ${item.observed}\n- Required: ${item.required}\n- Evidence: \`${item.evidencePath}\`\n- Reliability: ${item.reliability}\n- Next step: ${item.nextStep}`).join("\n\n")}\n\n---\nThis prototype supports professional pre-review. It does not certify statutory compliance.\n`;
}
