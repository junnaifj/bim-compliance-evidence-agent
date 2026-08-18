import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseIfc } from "../core/compliance/compliance.ts";

test("every redistributed IFC has a licence, source and exact hash", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/samples/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.samples.length, 3);
  for (const sample of manifest.samples) {
    assert.equal(sample.redistribution_permitted, true); assert.match(sample.source_url, /^https:\/\//); assert.ok(sample.licence);
    const bytes = await readFile(new URL(`../public/samples/${sample.file}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sample.sha256);
  }
});

test("no candidate-labelled IFC remains in the published sample directory", async () => {
  const manifest = await readFile(new URL("../public/samples/manifest.json", import.meta.url), "utf8");
  assert.doesNotMatch(manifest, /candidate|greatandyc|waterywaterman|mickey12go/i);
});

test("the concise manual IFC fixture is licensed, exact and structurally readable", async () => {
  const manifest = JSON.parse(await readFile(new URL("../fixtures/manifest.json", import.meta.url), "utf8"));
  const bytes = await readFile(new URL(`../fixtures/${manifest.ifc.filename}`, import.meta.url)); const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash, manifest.ifc.sha256); assert.equal(manifest.ifc.licence, "Apache-2.0");
  const model = parseIfc(bytes.toString("utf8"), "IfcOpenHouse.ifc", "sample"); assert.equal(model.schema, manifest.ifc.schema); assert.equal(model.storeys, manifest.ifc.storeys); assert.equal(model.doors.length, manifest.ifc.doors);
});

test("the official HKSAR manual fixture is explicitly local-only and Git-ignored", async () => {
  const manifest = JSON.parse(await readFile(new URL("../fixtures/manifest.json", import.meta.url), "utf8")); const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  assert.equal(manifest.official_local_reference.redistribution, false); assert.match(manifest.official_local_reference.source, /^https:\/\/www\.bd\.gov\.hk\//); assert.match(ignore, /fixtures\/hk-official\/\*\.pdf/);
  try { const bytes = await readFile(new URL(`../fixtures/${manifest.official_local_reference.filename}`, import.meta.url)); assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.official_local_reference.sha256); assert.match(bytes.subarray(0, 8).toString(), /^%PDF-/); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  try { const bytes = await readFile(new URL(`../fixtures/${manifest.official_local_quick_fixture.filename}`, import.meta.url)); assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.official_local_quick_fixture.sha256); assert.match(bytes.subarray(0, 8).toString(), /^%PDF-/); } catch (error) { if (error?.code !== "ENOENT") throw error; }
});
