import { AgentGatewayError } from "./openai-agent.server.ts";
import { apiKeyLooksValid } from "./agent-contract.ts";

export type AgentCredentialMode = "operator" | "byok";
type RateBucket = { windowStart: number; count: number };
const buckets = new Map<string, RateBucket>();
const WINDOW_MS = 60_000;
const LIMIT = 20;

export function resolveAgentCredential(mode: string | null, byokKey: string | null, operatorKey?: string): { apiKey: string; mode: AgentCredentialMode } {
  if (mode === "byok") {
    if (!byokKey || !apiKeyLooksValid(byokKey)) throw new AgentGatewayError("BYOK_REQUIRED", "A valid session API key is required.", 401);
    return { apiKey: byokKey.trim(), mode: "byok" };
  }
  if (mode !== "operator") throw new AgentGatewayError("AUTH_MODE_REQUIRED", "Choose operator or session-key authentication.", 400);
  if (!operatorKey || !apiKeyLooksValid(operatorKey)) throw new AgentGatewayError("OPERATOR_KEY_UNAVAILABLE", "The operator has not configured an OpenAI API key.", 503);
  return { apiKey: operatorKey.trim(), mode: "operator" };
}

export function consumeAgentRateLimit(identifier: string, now = Date.now()): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const safeId = identifier.slice(0, 160) || "anonymous"; const current = buckets.get(safeId);
  if (!current || now - current.windowStart >= WINDOW_MS) { buckets.set(safeId, { windowStart: now, count: 1 }); return { allowed: true, remaining: LIMIT - 1, retryAfterSeconds: 0 }; }
  if (current.count >= LIMIT) return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - current.windowStart)) / 1_000)) };
  current.count += 1; return { allowed: true, remaining: LIMIT - current.count, retryAfterSeconds: 0 };
}

export function clientIdentifier(headers: Headers): string {
  return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local-preview";
}
