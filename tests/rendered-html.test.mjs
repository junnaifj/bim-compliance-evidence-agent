import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the assessment product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Evidence Agent/);
  assert.match(html, /IFC compliance pre-review/i);
  assert.match(html, /Upload an IFC model/);
  assert.match(html, /Run evidence review/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("publishes accessible product metadata", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /<html[^>]+lang="en-GB"/i);
  assert.match(html, /<title>Evidence Agent/);
  assert.match(html, /evidence-first BIM compliance agent/i);
});
