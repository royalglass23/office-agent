import { adminSessionCookie, createAdminSession } from "@/lib/security/admin-session";
import { redactIdentifier, safeLog } from "@/lib/security/safe-log";
import { fetchVendorAccountUUID } from "@/lib/servicem8/client";
import { exchangeAuthorizationCode } from "@/lib/servicem8/oauth";
import { renderError } from "@/lib/servicem8/render-context-html";
import { saveOAuthConnection } from "@/lib/storage/oauth-connections";
import { consumeOAuthState } from "@/lib/storage/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Content-Type": "text/html; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (state.length < 32 || state.length > 512 || code.length < 1 || code.length > 2048) {
    return new Response(renderError("Connection rejected", "The OAuth callback was incomplete."), { status: 400, headers });
  }
  if (!(await consumeOAuthState(state))) {
    return new Response(renderError("Connection rejected", "The OAuth state was invalid, expired, or already used."), { status: 400, headers });
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const accountUUID = await fetchVendorAccountUUID(tokens.accessToken);
    await saveOAuthConnection(accountUUID, tokens);
    const session = await createAdminSession(accountUUID);
    safeLog("info", "Bound ServiceM8 OAuth connection", { account: redactIdentifier(accountUUID) });
    const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Connected</title></head><body><main><h1>RG Office Assistant connected</h1><p>The read-only Phase 0 scopes are active for this ServiceM8 account.</p><form action="/api/servicem8/oauth/disconnect" method="post"><button type="submit">Disconnect</button></form></main></body></html>`;
    return new Response(body, { headers: { ...headers, "Set-Cookie": adminSessionCookie(session) } });
  } catch {
    safeLog("error", "ServiceM8 OAuth account binding failed");
    return new Response(renderError("Connection failed", "The ServiceM8 account could not be safely connected."), { status: 502, headers });
  }
}
