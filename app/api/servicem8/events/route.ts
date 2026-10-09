import { getConfig } from "@/lib/config";
import { correlationId, redactIdentifier, safeLog } from "@/lib/security/safe-log";
import { ServiceM8ApiError, ServiceM8Client, requireVendorAccount } from "@/lib/servicem8/client";
import { loadPhaseZeroJobContext } from "@/lib/servicem8/job-context";
import { renderError, renderJobContext, renderLaunchProof } from "@/lib/servicem8/render-context-html";
import { EventVerificationError, verifyServiceM8Event } from "@/lib/servicem8/verify-event";
import { consumeEventHash } from "@/lib/storage/consumed-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addonResponseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function addonResponse(body: string, status = 200) {
  return Response.json({ eventResponse: body }, { status, headers: addonResponseHeaders });
}

export async function POST(request: Request) {
  const requestId = correlationId();
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType && contentType !== "text/plain" && contentType !== "application/jwt") {
    return addonResponse(renderError("Unsupported request", "The ServiceM8 callback content type was not accepted."), 415);
  }

  try {
    const verified = await verifyServiceM8Event(await request.text(), getConfig().serviceM8AppSecret);
    const replayExpiry = verified.event.exp
      ? new Date(verified.event.exp * 1000)
      : new Date(Date.now() + 10 * 60 * 1000);
    if (!(await consumeEventHash(verified.eventHash, replayExpiry))) {
      safeLog("warn", "Rejected replayed ServiceM8 event", { requestId });
      return addonResponse(renderError("Launch rejected", "This ServiceM8 launch has already been used."), 409);
    }

    const identifiers = {
      requestId,
      account: redactIdentifier(verified.event.auth.accountUUID),
      staff: redactIdentifier(verified.event.auth.staffUUID),
      job: redactIdentifier(verified.event.eventArgs.jobUUID),
    };

    if (verified.freshness === "unavailable") {
      safeLog("warn", "Signed event has no usable freshness claims; data access stopped", identifiers);
      return addonResponse(renderLaunchProof(verified.event), 428);
    }

    const client = new ServiceM8Client(verified.event.auth.accountUUID, verified.event.auth.staffUUID);
    await requireVendorAccount(client, verified.event.auth.accountUUID);
    const context = await loadPhaseZeroJobContext(client, verified.event.eventArgs.jobUUID);
    safeLog("info", "Completed read-only Phase 0 Job launch", identifiers);
    return addonResponse(renderJobContext(verified.event, context));
  } catch (error) {
    if (error instanceof EventVerificationError) {
      safeLog("warn", "Rejected invalid ServiceM8 event", { requestId });
      return addonResponse(renderError("Launch rejected", "The ServiceM8 signature or event data was invalid."), 401);
    }
    if (error instanceof ServiceM8ApiError) {
      safeLog("warn", "ServiceM8 data request failed closed", { requestId, status: error.status });
      const reconnect = error.status === 401
        ? "The ServiceM8 connection is unavailable. An account administrator must reconnect the add-on."
        : "ServiceM8 did not permit this read-only request.";
      return addonResponse(renderError("Unable to open this Job", reconnect), error.status === 401 ? 401 : 403);
    }
    safeLog("error", "Phase 0 event failed", { requestId });
    return addonResponse(renderError("Unable to open RG Office Assistant", "The request failed safely. No Job details are shown."), 500);
  }
}
