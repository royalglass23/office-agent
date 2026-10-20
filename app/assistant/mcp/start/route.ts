import { z } from "zod";
import { getConfig } from "@/lib/config";
import { assistantRateLimit, assistantSessionHash, verifyAssistantSession } from "@/lib/security/assistant-session";
import { ServiceM8Client, requireVendorAccount } from "@/lib/servicem8/client";
import { mcpProbeEnabled, prepareMcpProbe } from "@/lib/servicem8/mcp-diary-probe";
import { getOAuthConnection } from "@/lib/storage/oauth-connections";
import { consumeEventHash } from "@/lib/storage/consumed-events";
import { uuidSchema } from "@/lib/servicem8/event-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedJobs = new Set(["R260766", "R260609", "R260611", "R260445"]);
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'" };
function result(status: number, code: string) { return Response.json({ status: code }, { status, headers }); }

export async function POST(request: Request) {
  try {
    const config = getConfig();
    if (!mcpProbeEnabled(config.appBaseUrl) || new URL(request.url).origin !== config.appBaseUrl.origin) {
      return result(404, "not_found");
    }
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") {
      return result(400, "invalid_request");
    }
    const body = await request.text();
    if (Buffer.byteLength(body) > 4_500) return result(400, "invalid_request");
    const form = new URLSearchParams(body);
    const session = form.get("session") ?? "";
    const jobNumber = form.get("jobNumber") ?? "";
    if (form.size !== 2 || form.getAll("session").length !== 1 || form.getAll("jobNumber").length !== 1 ||
        session.length < 1 || session.length > 4_096 || !allowedJobs.has(jobNumber)) return result(400, "invalid_request");
    const identity = await verifyAssistantSession(session, config.sessionSigningSecret);
    if (identity.accountUUID !== config.allowedAccountUUID) return result(403, "access_denied");
    if (!(await consumeEventHash(assistantSessionHash(session), new Date(identity.launchExpiresAt * 1000 + 60_000)))) {
      return result(409, "session_used");
    }
    const limit = assistantRateLimit(identity, "summary");
    let rateSlot = false;
    for (const hash of limit.hashes) {
      if (await consumeEventHash(hash, limit.expiresAt)) { rateSlot = true; break; }
    }
    if (!rateSlot) return result(429, "rate_limited");
    const connection = await getOAuthConnection(identity.accountUUID);
    const expected = new Set(config.oauthScopes.split(" "));
    const granted = new Set(connection?.scopes.split(/\s+/).filter(Boolean) ?? []);
    if (!connection || expected.size !== granted.size || [...expected].some((scope) => !granted.has(scope))) {
      return result(409, "grant_incomplete");
    }
    const client = new ServiceM8Client(identity.accountUUID, identity.staffUUID);
    await requireVendorAccount(client, identity.accountUUID);
    const matches = await client.listJobsByNumber([jobNumber]);
    if (matches.length !== 1) {
      return result(403, "job_unavailable");
    }
    const listed = z.object({ uuid: uuidSchema, generated_job_id: z.string() }).passthrough().parse(matches[0]);
    if (listed.generated_job_id !== jobNumber) return result(403, "job_unavailable");
    const job = z.object({ uuid: uuidSchema, generated_job_id: z.string() }).passthrough().parse(await client.getJob(listed.uuid));
    if (job.uuid !== listed.uuid || job.generated_job_id !== jobNumber) {
      return result(403, "job_unavailable");
    }
    const authorization = prepareMcpProbe({
      ...identity, jobUUID: listed.uuid, jobNumber: jobNumber as "R260766" | "R260609" | "R260611" | "R260445",
    }, config.appBaseUrl, config.tokenEncryptionKey);
    return new Response(null, { status: 302, headers: { ...headers, Location: authorization.toString() } });
  } catch {
    return result(502, "probe_unavailable");
  }
}
