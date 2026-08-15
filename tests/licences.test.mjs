import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

