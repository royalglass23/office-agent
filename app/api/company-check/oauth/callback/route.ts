import { getConfig } from "@/lib/config";
import { redactIdentifier, safeLog } from "@/lib/security/safe-log";
import { fetchVendorAccountUUID } from "@/lib/servicem8/client";
import { exchangeCompanyCheckAuthorizationCode } from "@/lib/servicem8/oauth";
import { consumeCompanyCheckOAuthState } from "@/lib/storage/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const config = getConfig();
  if (!config.companyCheck.enabled) return new Response("Company Check is unavailable", { status: 503, headers });
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  if (state.length < 32 || state.length > 512 || code.length < 1 || code.length > 2048) {
    return new Response("The Company Check connection was incomplete.", { status: 400, headers });
  }
  if (!await consumeCompanyCheckOAuthState(state)) {
    return new Response("The Company Check connection has expired or was already used.", { status: 400, headers });
  }
  try {
    const tokens = await exchangeCompanyCheckAuthorizationCode(code);
    const accountUUID = await fetchVendorAccountUUID(tokens.accessToken);
    if (accountUUID !== config.allowedAccountUUID) {
      safeLog("warn", "Rejected unapproved Company Check OAuth account", { account: redactIdentifier(accountUUID) });
      return new Response("This ServiceM8 account is not authorised for Company Check.", { status: 403, headers });
    }
    // Company Check needs no ongoing ServiceM8 API access. Do not save these tokens in the Office Assistant connection table.
    safeLog("info", "Completed separate Company Check OAuth activation", { account: redactIdentifier(accountUUID) });
    return Response.redirect("https://go.servicem8.com/", 302);
  } catch {
    safeLog("error", "Company Check OAuth activation failed", {});
    return new Response("Company Check could not complete its ServiceM8 connection.", { status: 502, headers });
  }
}
