import { SignJWT, jwtVerify } from "jose";
import { getConfig } from "@/lib/config";
import { uuidSchema } from "@/lib/servicem8/event-schema";

const COOKIE_NAME = "rg_oauth_admin";

function secret() {
  return new TextEncoder().encode(getConfig().sessionSigningSecret);
}

export async function createAdminSession(accountUUID: string) {
  uuidSchema.parse(accountUUID);
  return new SignJWT({ accountUUID, purpose: "oauth-admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function verifyAdminSession(token: string) {
  const verified = await jwtVerify(token, secret(), { algorithms: ["HS256"], maxTokenAge: "15m" });
  if (verified.payload.purpose !== "oauth-admin") throw new Error("Invalid session purpose");
  return uuidSchema.parse(verified.payload.accountUUID);
}

export function adminSessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/api/servicem8/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=900`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; Path=/api/servicem8/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readAdminSessionCookie(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const cookie of cookies.split(";")) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}
