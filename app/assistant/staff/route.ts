import { getConfig } from "@/lib/config";
import { verifyAssistantSession } from "@/lib/security/assistant-session";
import { correlationId, safeLog } from "@/lib/security/safe-log";
import { ServiceM8Client, requireVendorAccount } from "@/lib/servicem8/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...responseHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const config = getConfig();
    if (!config.assistantProof.enabled) return Response.json({ error: "Unavailable" }, { status: 503, headers: responseHeaders });
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") {
      return Response.json({ error: "Invalid request" }, { status: 400, headers: responseHeaders });
    }
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 4_192) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers: responseHeaders });
    }
    const form = new URLSearchParams(body);
    const sessions = form.getAll("session");
    if (form.size !== 1 || sessions.length !== 1 || sessions[0].length === 0 || sessions[0].length > 4_096) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers: responseHeaders });
    }
    let identity;
    try {
      identity = await verifyAssistantSession(sessions[0], config.sessionSigningSecret);
    } catch {
      return Response.json({ error: "Session expired" }, { status: 401, headers: responseHeaders });
    }
    const client = new ServiceM8Client(identity.accountUUID, identity.staffUUID);
    await requireVendorAccount(client, identity.accountUUID);
    const staff = await client.getStaff(identity.staffUUID);
    return Response.json({ first: staff.first }, { headers: responseHeaders });
  } catch {
    safeLog("warn", "Unable to load assistant greeting", { requestId });
    return Response.json({ error: "Unable to load greeting" }, { status: 503, headers: responseHeaders });
  }
}
