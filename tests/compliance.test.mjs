import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyseModel, buildReport, builtinRules, compareModels, parseIfc, proposeRule, resolveRuleProposal, verifyReport } from "../core/compliance/compliance.ts";

const explicitDoorModel = (widthMm) => ({ id: "test", name: "Boundary fixture", filename: "boundary.ifc", schema: "IFC4", units: "mm", storeys: 1, source: "uploaded", spaces: [], doors: [{ expressId: 12, globalId: "2xQ7A1BOUNDARY000000001", name: "Exit D-01", widthMm, widthSource: "clear_width", isExit: true, fireRating: "FD60" }] });

for (const [width, expected] of [[899, "FAIL"], [900, "PASS"], [901, "PASS"]]) test(`door-width boundary ${width} mm is ${expected}`, () => {
  const result = analyseModel(explicitDoorModel(width)).find((item) => item.ruleId === "EGRESS-WIDTH-001");
  assert.equal(result?.status, expected);
});

test("nominal OverallWidth remains REVIEW instead of becoming clear-width evidence", () => {
  const model = explicitDoorModel(1200); model.doors[0].widthSource = "overall_width_proxy";
  assert.equal(analyseModel(model)[0].status, "REVIEW");
});

test("missing exit applicability remains REVIEW", () => {
  const model = explicitDoorModel(900); model.doors[0].isExit = undefined;
  assert.equal(analyseModel(model)[0].status, "REVIEW");
});

test("metres are normalised and an active conflict is surfaced", () => {
  const result = proposeRule("Confirmed exit doors must provide at least 0.95 m clear width", builtinRules);
  assert.equal(result.rule.threshold, 950); assert.equal(result.conflict.kind, "STRICTER"); assert.equal(result.feasibility.valid, true);
});

test("implausible numerical rules fail feasibility and cannot be silently accepted", () => {
  const result = proposeRule("All exit doors must be at least 20 m wide", builtinRules);
  assert.equal(result.feasibility.valid, false); assert.match(result.feasibility.issues.join(" "), /plausible/i);
});

test("replace supersedes the prior active rule and activates an immutable new record", () => {
  const result = proposeRule("Confirmed exit doors must provide at least 950 mm clear width", builtinRules);
  const rules = resolveRuleProposal(result.rule, "replace", builtinRules);
  assert.equal(rules.find((item) => item.id === "EGRESS-WIDTH-001")?.status, "SUPERSEDED");
  assert.equal(rules.find((item) => item.id === result.rule.id)?.status, "ACTIVE");
});

test("version comparison uses stable GlobalIds", () => {
  const before = explicitDoorModel(850); const after = explicitDoorModel(950);
  const comparison = compareModels(before, after);
  assert.equal(comparison.resolved, 1); assert.equal(comparison.items[0].id, before.doors[0].globalId);
});

test("the verified report contains every finding and only grounded numerical claims", () => {
  const model = explicitDoorModel(850); const findings = analyseModel(model); const report = buildReport(model, findings, "en");
  assert.deepEqual(verifyReport(report, findings), { valid: true, issues: [] });
});

test("English and Chinese reports use natural professional language without leaking UI-locale prose", () => {
  const model = explicitDoorModel(850);
  const englishFindings = analyseModel(model, builtinRules, "en");
  const chineseFindings = analyseModel(model, builtinRules, "zh");
  const english = buildReport(model, englishFindings, "en");
  const chinese = buildReport(model, chineseFindings, "zh");
  assert.match(english, /Review conclusion/); assert.match(english, /Confirmed non-compliance details/); assert.match(english, /Remediation priority recommendations/); assert.match(english, /Professional review required|Fail|Pass/);
  assert.doesNotMatch(english, /需专业复核|毫米|证据质量/);
  assert.match(chinese, /审查结论/); assert.match(chinese, /违规明细/); assert.match(chinese, /整改优先级建议/); assert.match(chinese, /需专业复核|不通过|通过/);
  assert.doesNotMatch(chinese, /Reliability:|Schema:|No usable width property|nominal proxy/);
  assert.deepEqual(verifyReport(english, englishFindings), { valid: true, issues: [] });
  assert.deepEqual(verifyReport(chinese, chineseFindings), { valid: true, issues: [] });
});

test("confirmed failures and review matters receive deterministic priorities without changing verdicts", () => {
  const failed = analyseModel(explicitDoorModel(850));
  assert.equal(failed.find((item) => item.ruleId === "EGRESS-WIDTH-001")?.priority, "P1");
  const proxy = explicitDoorModel(850); proxy.doors[0].widthSource = "overall_width_proxy";
  const reviewed = analyseModel(proxy);
  assert.equal(reviewed.find((item) => item.ruleId === "EGRESS-WIDTH-001")?.status, "REVIEW");
  assert.equal(reviewed.find((item) => item.ruleId === "EGRESS-WIDTH-001")?.priority, "P2");
});

test("summary reports may omit finding identifiers while retaining grounded totals", () => {
  const model = explicitDoorModel(850); const findings = analyseModel(model); const report = buildReport(model, findings, "en", undefined, "summary");
  assert.doesNotMatch(report, new RegExp(model.doors[0].globalId)); assert.deepEqual(verifyReport(report, findings, { requireEveryFinding: false }), { valid: true, issues: [] });
});

test("the numerical guard catches a hallucinated threshold", () => {
  const model = explicitDoorModel(850); const findings = analyseModel(model); const report = buildReport(model, findings, "en").replaceAll("900 mm", "990 mm");
  const result = verifyReport(report, findings); assert.equal(result.valid, false); assert.match(result.issues.join(" "), /990/);
});

test("the identifier guard catches an invented GlobalId", () => {
  const model = explicitDoorModel(850); const findings = analyseModel(model); const report = buildReport(model, findings, "en").replace(model.doors[0].globalId, "3INVENTEDGLOBALID0000001");
  const result = verifyReport(report, findings); assert.equal(result.valid, false); assert.match(result.issues.join(" "), /Missing GlobalId|Unknown identifier/);
});

test("the verdict guard catches a REVIEW-to-PASS hallucination", () => {
  const model = explicitDoorModel(850); model.doors[0].widthSource = "overall_width_proxy"; const findings = analyseModel(model); const report = buildReport(model, findings, "en").replace("`REVIEW`", "`PASS`");
  const result = verifyReport(report, findings); assert.equal(result.valid, false); assert.match(result.issues.join(" "), /Verdict mismatch/);
});

test("real Duplex and Clinic samples preserve expected entity counts", async () => {
  const duplex = parseIfc(await readFile(new URL("../public/samples/duplex-xeokit.ifc", import.meta.url), "utf8"), "duplex-xeokit.ifc", "sample");
  const clinic = parseIfc(await readFile(new URL("../public/samples/medical-dental-clinic.ifc", import.meta.url), "utf8"), "medical-dental-clinic.ifc", "sample");
  assert.deepEqual([duplex.doors.length, duplex.spaces.length], [14, 21]); assert.deepEqual([clinic.doors.length, clinic.spaces.length], [254, 269]);
  assert.ok(duplex.storeyNames.includes("Level 1")); assert.equal(duplex.doors.filter((door) => door.storey).length, duplex.doors.length);
});

test("official IFC4 negative control does not invent targets or findings", async () => {
  const model = parseIfc(await readFile(new URL("../public/samples/buildingsmart-pcert-architecture.ifc", import.meta.url), "utf8"), "pcert.ifc", "sample");
  assert.match(model.schema, /^IFC4/); assert.equal(model.doors.length, 0); assert.deepEqual(analyseModel(model), []);
});

test("malformed and disguised input is rejected", () => assert.throws(() => parseIfc("<script>alert(1)</script>", "model.ifc"), /not a readable IFC/i));
