import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyseModel, compareModels, demoModels, interpretRule, parseIfc } from "../lib/compliance.ts";

test("explicit clear-width evidence can pass or fail", () => {
  const findings = analyseModel(demoModels.current);
  const width = findings.filter((item) => item.ruleId === "EGRESS-WIDTH-001");
  assert.equal(width.find((item) => item.elementName === "Rear exit D-03")?.status, "FAIL");
  assert.equal(width.find((item) => item.elementName === "Main exit D-01")?.status, "PASS");
});

test("proxy measurements and missing applicability remain REVIEW", () => {
  const findings = analyseModel(demoModels.uncertain);
  const width = findings.filter((item) => item.ruleId === "EGRESS-WIDTH-001");
  assert.equal(width.find((item) => item.elementName === "Lobby door")?.status, "REVIEW");
  assert.equal(width.find((item) => item.elementName === "Door 01")?.status, "REVIEW");
});

test("non-exit doors are explicitly outside the width rule", () => {
  const findings = analyseModel(demoModels.current);
  assert.equal(findings.find((item) => item.ruleId === "EGRESS-WIDTH-001" && item.elementName === "Store D-04")?.status, "NOT_APPLICABLE");
});

test("natural-language rules normalise metres and require a confirmed structure", () => {
  const rule = interpretRule("Confirmed exit doors must provide at least 0.95 m clear width");
  assert.equal(rule.threshold, 950);
  assert.equal(rule.operator, ">=");
  assert.equal(rule.field, "clearWidth");
});

test("revision comparison uses stable IFC GlobalIds", () => {
  const comparison = compareModels(demoModels.baseline, demoModels.current);
  assert.equal(comparison.resolved, 1);
  assert.equal(comparison.items.find((item) => item.name === "Main exit D-01")?.label, "Resolved");
});

test("the small IFC fixture exercises the upload parser", async () => {
  const text = await readFile(new URL("../examples/assessment-door-sample.ifc", import.meta.url), "utf8");
  const model = parseIfc(text, "assessment-door-sample.ifc");
  assert.equal(model.schema, "IFC4");
  assert.equal(model.storeys, 1);
  assert.equal(model.doors.length, 3);
  assert.equal(model.doors[0].widthMm, 820);
  assert.equal(model.doors[0].widthSource, "overall_width_proxy");
});

test("the official buildingSMART sample is a safe no-door negative control", async () => {
  const text = await readFile(new URL("../examples/buildingsmart-pcert-architecture.ifc", import.meta.url), "utf8");
  const model = parseIfc(text, "buildingsmart-pcert-architecture.ifc");
  assert.equal(model.schema, "IFC4");
  assert.equal(model.storeys, 1);
  assert.deepEqual(model.doors, []);
  assert.deepEqual(analyseModel(model), []);
});
