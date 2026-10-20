import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { decryptToken, encryptToken } from "@/lib/security/encryption";
import { uuidSchema } from "./event-schema";

const MCP_URL = "https://api.servicem8.com/mcp";
const AUTHORIZE_URL = "https://go.servicem8.com/oauth/authorize";
const TOKEN_URL = "https://api.servicem8.com/oauth/access_token";
const STAGING_ORIGIN = "https://office-agent-staging.vercel.app";
const MAX_RESPONSE_BYTES = 1_000_000;

const stateSchema = z.object({
  accountUUID: uuidSchema,
  staffUUID: uuidSchema,
  jobUUID: uuidSchema,
  jobNumber: z.enum(["R260766", "R260609", "R260611", "R260445"]),
  verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
  expiresAt: z.number().int(),
}).strict();
export type McpProbeState = z.infer<typeof stateSchema>;

export function mcpProbeEnabled(appBaseUrl: URL) {
  return appBaseUrl.origin === STAGING_ORIGIN && Boolean(process.env.SERVICEM8_MCP_CLIENT_ID);
}

export function mcpProbeCallback(appBaseUrl: URL) {
  return new URL("/assistant/mcp/callback", appBaseUrl).toString();
}

export function prepareMcpProbe(
  identity: Pick<McpProbeState, "accountUUID" | "staffUUID" | "jobUUID" | "jobNumber">,
  appBaseUrl: URL,
  encryptionKey: string,
  now = Date.now(),
) {
  if (!mcpProbeEnabled(appBaseUrl)) throw new Error("MCP staging probe is disabled");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = encryptToken(JSON.stringify(stateSchema.parse({
    ...identity, verifier, nonce: randomBytes(24).toString("base64url"), expiresAt: now + 10 * 60_000,
  })), encryptionKey);
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.SERVICEM8_MCP_CLIENT_ID!);
  url.searchParams.set("redirect_uri", mcpProbeCallback(appBaseUrl));
  url.searchParams.set("scope", "mcp");
  url.searchParams.set("resource", MCP_URL);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export function readMcpProbeState(value: string, encryptionKey: string, now = Date.now()) {
  if (value.length < 50 || value.length > 2_048) throw new Error("Invalid MCP state");
  const state = stateSchema.parse(JSON.parse(decryptToken(value, encryptionKey)));
  if (state.expiresAt <= now || state.expiresAt > now + 10 * 60_000) throw new Error("Expired MCP state");
  return state;
}

export async function exchangeMcpProbeCode(
  code: string, state: McpProbeState, appBaseUrl: URL, fetcher: typeof fetch = fetch,
) {
  if (!mcpProbeEnabled(appBaseUrl) || code.length < 1 || code.length > 2_048) throw new Error("Invalid MCP exchange");
  const response = await fetcher(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code", client_id: process.env.SERVICEM8_MCP_CLIENT_ID!,
      redirect_uri: mcpProbeCallback(appBaseUrl), code, code_verifier: state.verifier, resource: MCP_URL,
    }),
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("MCP token exchange rejected");
  const data = z.object({
    access_token: z.string().min(1), token_type: z.string().transform((v) => v.toLowerCase()).pipe(z.literal("bearer")),
    scope: z.string().optional(),
  }).passthrough().parse(await response.json());
  if (data.scope && !data.scope.split(/\s+/).includes("mcp")) throw new Error("MCP scope absent");
  return data.access_token;
}

async function mcpRequest(
  token: string, message: Record<string, unknown>, fetcher: typeof fetch,
  sessionId?: string,
) {
  const response = await fetcher(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json",
      Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(message), cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`MCP request failed: ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_RESPONSE_BYTES) throw new Error("MCP response too large");
  const chunks: Uint8Array[] = [];
  const reader = response.body?.getReader();
  if (!reader) throw new Error("MCP response missing");
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error("MCP response too large"); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("text/event-stream")
    ? raw.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]").map((line) => JSON.parse(line)).find((value) => value.id === message.id)
    : JSON.parse(raw);
  if (!payload || payload.error) throw new Error("MCP returned an error");
  return { payload, sessionId: response.headers.get("mcp-session-id") ?? sessionId };
}

async function mcpInitialized(token: string, sessionId: string | undefined, fetcher: typeof fetch) {
  const response = await fetcher(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json",
      Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("MCP initialization rejected");
  await response.body?.cancel();
}

export async function probeMcpDiary(token: string, jobUUID: string, fetcher: typeof fetch = fetch) {
  uuidSchema.parse(jobUUID);
  const initialized = await mcpRequest(token, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "rg-office-agent-staging-audit", version: "0.1" } },
  }, fetcher);
  await mcpInitialized(token, initialized.sessionId ?? undefined, fetcher);
  const listed = await mcpRequest(token, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, fetcher, initialized.sessionId ?? undefined);
  const tools = z.object({ result: z.object({ tools: z.array(z.object({ name: z.string() }).passthrough()) }) })
    .passthrough().parse(listed.payload).result.tools;
  if (!tools.some((tool) => tool.name === "get_job_diary")) {
    return { status: "diary_tool_unavailable" as const, toolAvailable: false, staffBinding: "unverified" as const };
  }
  const called = await mcpRequest(token, {
    jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_job_diary", arguments: { job_uuid: jobUUID } },
  }, fetcher, listed.sessionId ?? undefined);
  const result = z.object({ result: z.object({
    content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).optional(),
    structuredContent: z.unknown().optional(), isError: z.boolean().optional(),
  }).passthrough() }).passthrough().parse(called.payload).result;
  if (result.isError) throw new Error("MCP Diary tool rejected the Job");
  const text = (result.content ?? []).filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
  if (text.length > MAX_RESPONSE_BYTES) throw new Error("MCP Diary result too large");
  const diary = z.object({ job_uuid: uuidSchema, entries: z.array(z.object({
    timestamp: z.string().nullable().optional(), object_type: z.string().nullable().optional(),
    object_uuid: z.string().nullable().optional(), content_preview: z.string().nullable().optional(),
  }).passthrough()).max(2_000) }).passthrough().parse(result.structuredContent ?? JSON.parse(text));
  if (diary.job_uuid !== jobUUID) throw new Error("MCP Diary Job mismatch");
  return {
    status: "inventory_only" as const, toolAvailable: true, staffBinding: "unverified" as const,
    fullContent: "unverified" as const, pagination: "unverified" as const,
    count: diary.entries.length,
    entries: diary.entries.map((entry) => ({
      at: entry.timestamp ?? null, objectType: entry.object_type ?? null,
      hasObjectUUID: Boolean(entry.object_uuid), previewLength: entry.content_preview?.length ?? 0,
    })),
  };
}
