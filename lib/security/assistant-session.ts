import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { uuidSchema } from "@/lib/servicem8/event-schema";

const ISSUER = "rg-office-agent";
const AUDIENCE = "rg-office-assistant-proof";
const SESSION_SECONDS = 30 * 60;
const CLOCK_TOLERANCE_SECONDS = 30;

const identitySchema = z.object({
  accountUUID: uuidSchema,
  staffUUID: uuidSchema,
}).strict();

export type AssistantIdentity = z.infer<typeof identitySchema>;
export type AssistantSession = AssistantIdentity & { launchExpiresAt: number };

export function assistantSessionHash(token: string) {
  return createHash("sha256").update(`assistant-session\0${token}`).digest("hex");
}

export function assistantRateLimit(
  identity: AssistantIdentity,
  action: "search" | "summary" | "draft",
  now = new Date(),
) {
  const windowSeconds = action === "search" ? 10 : 60;
  const currentSeconds = Math.floor(now.getTime() / 1000);
  const bucket = Math.floor(currentSeconds / windowSeconds);
  return {
    hash: createHash("sha256")
      .update(`assistant-rate\0${action}\0${identity.accountUUID}\0${identity.staffUUID}\0${bucket}`)
      .digest("hex"),
    expiresAt: new Date((bucket + 2) * windowSeconds * 1000),
  };
}

function signingKey(secret: string) {
  if (secret.length < 32) throw new Error("Assistant session secret is invalid");
  return new TextEncoder().encode(secret);
}

export async function issueAssistantSession(
  identity: AssistantIdentity,
  secret: string,
  now = new Date(),
  launchExpiresAt?: number,
) {
  const parsed = identitySchema.parse({
    accountUUID: identity.accountUUID,
    staffUUID: identity.staffUUID,
  });
  const issuedAt = Math.floor(now.getTime() / 1000);
  const absoluteExpiry = launchExpiresAt ?? issuedAt + SESSION_SECONDS;
  if (!Number.isSafeInteger(absoluteExpiry) || absoluteExpiry <= issuedAt) {
    throw new Error("Assistant session is expired");
  }
  return new SignJWT({ ...parsed, launchExpiresAt: absoluteExpiry })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(absoluteExpiry)
    .sign(signingKey(secret));
}

export async function verifyAssistantSession(
  token: string,
  secret: string,
  now = new Date(),
): Promise<AssistantSession> {
  try {
    if (token.length === 0 || token.length > 4_096 || token.split(".").length !== 3) throw new Error("invalid");
    const verified = await jwtVerify(token, signingKey(secret), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate: now,
    });
    const identity = identitySchema.parse({
      accountUUID: verified.payload.accountUUID,
      staffUUID: verified.payload.staffUUID,
    });
    const launchExpiresAt = verified.payload.launchExpiresAt;
    if (!Number.isSafeInteger(launchExpiresAt) || verified.payload.exp !== launchExpiresAt) throw new Error("invalid");
    return { ...identity, launchExpiresAt: launchExpiresAt as number };
  } catch {
    throw new Error("Assistant session is invalid");
  }
}
