import { getConfig } from "@/lib/config";
import {
  assistantRateLimit,
  assistantSessionHash,
  verifyAssistantSession,
} from "@/lib/security/assistant-session";
import { ServiceM8ApiError, ServiceM8Client, requireVendorAccount } from "@/lib/servicem8/client";
import { auditJobDiary, auditJobNumbers, type AuditJobNumber } from "@/lib/servicem8/job-diary-audit";
import { getOAuthConnection } from "@/lib/storage/oauth-connections";
import { consumeEventHash } from "@/lib/storage/consumed-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGING_ORIGIN = "https://office-agent-staging.vercel.app";
const headers = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function result(status: number, code: string) {
  return Response.json({ status: code }, { status, headers });
}

async function readForm(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new Error("Invalid audit form");
  }
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 4_500) throw new Error("Invalid audit form");
  const form = new URLSearchParams(body);
  if (form.size !== 2 || form.getAll("session").length !== 1 || form.getAll("jobNumber").length !== 1) {
    throw new Error("Invalid audit form");
  }
  const session = form.get("session") ?? "";
  const jobNumber = form.get("jobNumber") ?? "";
  if (session.length === 0 || session.length > 4_096 || !auditJobNumbers.includes(jobNumber as AuditJobNumber)) {
    throw new Error("Invalid audit form");
  }
  return { session, jobNumber: jobNumber as AuditJobNumber };
}

export async function POST(request: Request) {
  try {
    const config = getConfig();
    if (config.appBaseUrl.origin !== STAGING_ORIGIN || new URL(request.url).origin !== STAGING_ORIGIN) {
      return result(404, "not_found");
    }
    const { session, jobNumber } = await readForm(request);
    const identity = await verifyAssistantSession(session, config.sessionSigningSecret);
    if (identity.accountUUID !== config.allowedAccountUUID) return result(403, "access_denied");
    const limit = assistantRateLimit(identity, "summary");
    // Session verification accepts 30 seconds of clock tolerance after expiry.
    if (!(await consumeEventHash(assistantSessionHash(session), new Date(identity.launchExpiresAt * 1000 + 60_000)))) {
      return result(409, "session_used");
    }
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
    const audit = await auditJobDiary(client, jobNumber, config.sessionSigningSecret);
    return Response.json(audit, { status: 200, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid audit form") return result(400, "invalid_request");
    if (error instanceof Error && error.message === "Assistant session is invalid") return result(401, "invalid_session");
    if (error instanceof ServiceM8ApiError) {
      return result(error.status === 401 ? 401 : 403, "service_m8_access_unavailable");
    }
    return result(502, "audit_unavailable");
  }
}
