import { allowedOpenAIModels, apiKeyLooksValid, assertSameOrigin } from "../../../../lib/agent-contract.ts";
import { resolveAgentCredential } from "../../../../lib/agent-gateway.ts";
import { AgentGatewayError, probeOpenAIKey } from "../../../../lib/openai-agent.server.ts";

export const runtime = "edge";
const defaultModel = () => allowedOpenAIModels.includes(process.env.OPENAI_MODEL?.trim() as (typeof allowedOpenAIModels)[number]) ? process.env.OPENAI_MODEL!.trim() : "gpt-5.6";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export function GET(): Response {
  return json({ ok: true, provider: "openai", serverConfigured: apiKeyLooksValid(process.env.OPENAI_API_KEY ?? ""), defaultModel: defaultModel(), models: allowedOpenAIModels, byokSupported: true, keyStorage: "session-memory-only" });
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request.url, request.headers.get("origin"));
    const body = await request.json() as { model?: unknown };
    const model = typeof body.model === "string" ? body.model : defaultModel();
    const credential = resolveAgentCredential(request.headers.get("x-evidence-agent-auth"), request.headers.get("x-evidence-openai-key"), process.env.OPENAI_API_KEY);
    const result = await probeOpenAIKey(model, credential.apiKey);
    return json({ ...result, mode: credential.mode });
  } catch (error) {
    if (error instanceof AgentGatewayError) return json({ ok: false, error: { code: error.code, message: error.message } }, error.status);
    return json({ ok: false, error: { code: "INVALID_REQUEST", message: error instanceof Error ? error.message : "Connection test failed." } }, 400);
  }
}
