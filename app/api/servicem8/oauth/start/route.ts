import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl } from "@/lib/servicem8/oauth";
import { saveOAuthState } from "@/lib/storage/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = randomBytes(32).toString("base64url");
  await saveOAuthState(state, new Date(Date.now() + 10 * 60 * 1000));
  return Response.redirect(buildAuthorizeUrl(state), 302);
}
