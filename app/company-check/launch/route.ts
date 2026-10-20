import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { companyCheckCookie } from "@/lib/company-check/auth";
import { assistantSessionHash, issueCompanyCheckSession, verifyCompanyCheckLaunchSession } from "@/lib/security/assistant-session";
import { consumeEventHash } from "@/lib/storage/consumed-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getConfig();
  if (!config.companyCheck.enabled || request.headers.get("content-type")?.split(";", 1)[0] !== "application/x-www-form-urlencoded") {
    return new Response("Company check unavailable", { status: 503 });
  }
  const body = await request.text();
  if (body.length > 4_200) return new Response("Invalid launch", { status: 400 });
  const form = new URLSearchParams(body);
  const token = form.get("session");
  if (form.size !== 1 || !token) return new Response("Invalid launch", { status: 400 });
  try {
    const identity = await verifyCompanyCheckLaunchSession(token, config.sessionSigningSecret);
    if (identity.accountUUID !== config.allowedAccountUUID) return new Response("Unauthorised account", { status: 403 });
    if (!await consumeEventHash(assistantSessionHash(token), new Date(Date.now() + 31 * 60_000))) {
      return new Response("Launch already used. Reopen Office Agent from ServiceM8.", { status: 409 });
    }
    const companyToken = await issueCompanyCheckSession(identity, config.sessionSigningSecret);
    const reply = NextResponse.redirect(new URL("/company-check", config.appBaseUrl), 303);
    reply.cookies.set(companyCheckCookie, companyToken, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 60,
    });
    return reply;
  } catch {
    return new Response("Launch expired. Reopen Office Agent from ServiceM8.", { status: 401 });
  }
}
