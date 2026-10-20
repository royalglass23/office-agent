import { getConfig } from "@/lib/config";
import { issueCompanyCheckLaunchSession } from "@/lib/security/assistant-session";
import { correlationId, redactIdentifier, safeLog } from "@/lib/security/safe-log";
import { renderCompanyCheckMenu, renderError } from "@/lib/servicem8/render-context-html";
import { EventVerificationError, verifyServiceM8Event } from "@/lib/servicem8/verify-event";
import { consumeEventHash } from "@/lib/storage/consumed-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(html: string, status = 200) {
  return Response.json({ eventResponse: html }, { status, headers: {
    "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  } });
}

export async function POST(request: Request) {
  const requestId = correlationId();
  const config = getConfig();
  if (!config.companyCheck.enabled) return reply(renderError("Unavailable", "Company Check is not enabled."), 503);
  try {
    const verified = await verifyServiceM8Event(await request.text(), config.companyCheck.appSecret);
    if (verified.event.eventName !== "rg_company_check_menu") {
      return reply(renderError("Launch rejected", "This event belongs to another Add-on."), 400);
    }
    const identity = verified.event.auth;
    if (identity.accountUUID !== config.allowedAccountUUID) {
      safeLog("warn", "Rejected unapproved Company Check account", {
        requestId, account: redactIdentifier(identity.accountUUID),
      });
      return reply(renderError("Launch rejected", "This ServiceM8 account is not authorised."), 403);
    }
    if (verified.freshness !== "verified") {
      return reply(renderError("Launch rejected", "The ServiceM8 launch could not be verified as fresh."), 428);
    }
    const expiresAt = verified.event.exp
      ? new Date(verified.event.exp * 1000) : new Date(Date.now() + 5 * 60_000);
    if (!await consumeEventHash(verified.eventHash, expiresAt)) {
      return reply(renderError("Launch rejected", "This ServiceM8 launch has already been used."), 409);
    }
    const token = await issueCompanyCheckLaunchSession(identity, config.sessionSigningSecret);
    safeLog("info", "Opened separate Company Check Add-on", {
      requestId, account: redactIdentifier(identity.accountUUID), staff: redactIdentifier(identity.staffUUID),
    });
    return reply(renderCompanyCheckMenu(new URL("/company-check", config.appBaseUrl), token));
  } catch (error) {
    if (error instanceof EventVerificationError) {
      safeLog("warn", "Rejected Company Check event", { requestId, category: error.category });
      return reply(renderError("Launch rejected", "The ServiceM8 signature or event data was invalid."), 401);
    }
    safeLog("error", "Company Check launch failed", { requestId });
    return reply(renderError("Unable to open Company Check", "Please try again later."), 503);
  }
}
