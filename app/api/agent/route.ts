import { assertSameOrigin, validateAgentRequest } from "../../../core/agent/agent-contract.ts";
import { clientIdentifier, consumeAgentRateLimit, resolveAgentCredential } from "../../../core/agent/agent-gateway.ts";
import { AgentGatewayError, runOpenAIResponsesAgent } from "../../../core/agent/openai-agent.server.ts";
import { authenticatedUserFromHeaders } from "../../../core/review/authenticated-user.ts";

export const runtime = "edge";
const json = (body: unknown, status = 200, extraHeaders?: HeadersInit) => Response.json(body, { status, headers: { "cache-control": "no-store", ...extraHeaders } });
const errorResponse = (error: unknown) => {
  if (error instanceof AgentGatewayError) return json({ ok: false, error: { code: error.code, message: error.message } }, error.status);
  const message = error instanceof Error ? error.message : "The agent request failed.";
  return json({ ok: false, error: { code: "INVALID_REQUEST", message } }, 400);
};

export async function POST(request: Request): Promise<Response> {
  try {
    if (!authenticatedUserFromHeaders(request.headers)) return json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before using the Agent." } }, 401);
    assertSameOrigin(request.url, request.headers.get("origin"));
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > 1_000_000) throw new AgentGatewayError("REQUEST_TOO_LARGE", "The agent request is too large.", 413);
    const rate = consumeAgentRateLimit(clientIdentifier(request.headers));
    if (!rate.allowed) return json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many agent requests. Try again shortly." } }, 429, { "retry-after": String(rate.retryAfterSeconds) });
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1_000_000) throw new AgentGatewayError("REQUEST_TOO_LARGE", "The agent request is too large.", 413);
    let body: unknown; try { body = JSON.parse(rawBody); } catch { throw new AgentGatewayError("INVALID_JSON", "The agent request is not valid JSON.", 400); }
    const agentRequest = validateAgentRequest(body);
    const credential = resolveAgentCredential(request.headers.get("x-evidence-agent-auth"), request.headers.get("x-evidence-openai-key"), process.env.OPENAI_API_KEY);
    const result = await runOpenAIResponsesAgent(agentRequest, { apiKey: credential.apiKey });
    return json({ ok: true, mode: credential.mode, ...result });
  } catch (error) { return errorResponse(error); }
}
