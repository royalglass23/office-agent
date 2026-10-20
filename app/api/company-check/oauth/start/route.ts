import { randomBytes } from "node:crypto";
import { getConfig } from "@/lib/config";
import { buildCompanyCheckAuthorizeUrl } from "@/lib/servicem8/oauth";
import { saveCompanyCheckOAuthState } from "@/lib/storage/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!getConfig().companyCheck.enabled) return new Response("Company Check is unavailable", { status: 503 });
  const state = randomBytes(32).toString("base64url");
  await saveCompanyCheckOAuthState(state, new Date(Date.now() + 10 * 60_000));
  return Response.redirect(buildCompanyCheckAuthorizeUrl(state), 302);
}
