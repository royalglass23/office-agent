import { getConfig } from "@/lib/config";
import { clearAdminSessionCookie, readAdminSessionCookie, verifyAdminSession } from "@/lib/security/admin-session";
import { deleteOAuthConnection } from "@/lib/storage/oauth-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== getConfig().appBaseUrl.origin) {
    return new Response("Invalid origin", { status: 403 });
  }
  const token = readAdminSessionCookie(request);
  if (!token) return new Response("Authentication required", { status: 401 });

  try {
    const accountUUID = await verifyAdminSession(token);
    await deleteOAuthConnection(accountUUID);
    return new Response("ServiceM8 connection removed.", {
      headers: { "Cache-Control": "no-store", "Set-Cookie": clearAdminSessionCookie() },
    });
  } catch {
    return new Response("Authentication required", { status: 401 });
  }
}
