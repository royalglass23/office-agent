import { createHash } from "node:crypto";
import { getConfig } from "@/lib/config";
import { exchangeMcpProbeCode, mcpProbeEnabled, probeMcpDiary, readMcpProbeState } from "@/lib/servicem8/mcp-diary-probe";
import { consumeEventHash } from "@/lib/storage/consumed-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'", "X-Content-Type-Options": "nosniff" };
function result(status: number, code: string) { return Response.json({ status: code }, { status, headers }); }

export async function GET(request: Request) {
  try {
    const config = getConfig();
    if (!mcpProbeEnabled(config.appBaseUrl) || new URL(request.url).origin !== config.appBaseUrl.origin) {
      return result(404, "not_found");
    }
    const url = new URL(request.url);
    const code = url.searchParams.get("code") ?? "";
    const stateValue = url.searchParams.get("state") ?? "";
    if (url.searchParams.has("error") || code.length < 1 || code.length > 2_048) return result(400, "consent_rejected");
    const state = readMcpProbeState(stateValue, config.tokenEncryptionKey);
    if (state.accountUUID !== config.allowedAccountUUID) return result(403, "access_denied");
    const replayHash = createHash("sha256").update(`mcp-probe\0${state.nonce}`).digest("hex");
    if (!(await consumeEventHash(replayHash, new Date(state.expiresAt + 60_000)))) return result(409, "state_used");
    const token = await exchangeMcpProbeCode(code, state, config.appBaseUrl);
    const probe = await probeMcpDiary(token, state.jobUUID);
    return Response.json({ jobNumber: state.jobNumber, ...probe }, { status: 200, headers });
  } catch {
    return result(502, "probe_unavailable");
  }
}
