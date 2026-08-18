import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url); workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html", "oai-authenticated-user-email": "reviewer@example.com", "oai-authenticated-user-full-name": "Assessment%20Reviewer", "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the complete assessment product", async () => {
  const response = await render(); assert.equal(response.status, 200); const html = await response.text();
  assert.match(html, /Evidence Agent/); assert.match(html, /IFC compliance workspace/i); assert.match(html, /Upload an IFC model/); assert.match(html, /Run evidence review/); assert.doesNotMatch(html, /Candidate benchmarks|codex-preview/);
});

test("publishes accessible product metadata", async () => {
  const html = await (await render()).text(); assert.match(html, /<html[^>]+lang="en-GB"/i); assert.match(html, /<title>Evidence Agent/); assert.match(html, /BIM compliance/i);
});

test("requires a platform-authenticated user before rendering project data", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url); workerUrl.searchParams.set("anonymous", `${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" }, redirect: "manual" }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.ok([302, 303, 307, 308].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /\/signin-with-chatgpt\?return_to=/);
});
