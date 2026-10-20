import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { uuidSchema } from "@/lib/servicem8/event-schema";

const ISSUER = "rg-office-agent";
const AUDIENCE = "rg-office-assistant-proof";
const GREETING_AUDIENCE = "rg-office-assistant-greeting";
const COMPANY_CHECK_AUDIENCE = "rg-company-check";
const COMPANY_CHECK_LAUNCH_AUDIENCE = "rg-company-check-launch";
const SESSION_SECONDS = 30 * 60;
const GREETING_SESSION_SECONDS = 2 * 60;
const CLOCK_TOLERANCE_SECONDS = 30;

const identitySchema = z.object({
  accountUUID: uuidSchema,
  staffUUID: uuidSchema,
}).strict();

export type AssistantIdentity = z.infer<typeof identitySchema>;
export type AssistantSession = AssistantIdentity & { launchExpiresAt: number };

const assistantRateLimits = {
  request: { maximum: 20, windowSeconds: 60 },
  search: { maximum: 10, windowSeconds: 60 },
  summary: { maximum: 5, windowSeconds: 60 },
  draft: { maximum: 5, windowSeconds: 60 },
  companySearch: { maximum: 10, windowSeconds: 60 },
  companyResearch: { maximum: 3, windowSeconds: 60 },
} as const;

export function assistantSessionHash(token: string) {
  return createHash("sha256").update(`assistant-session\0${token}`).digest("hex");
}

export function assistantGreetingSessionHash(token: string) {
  return createHash("sha256").update(`assistant-greeting-session\0${token}`).digest("hex");
}

export function assistantRateLimit(
  identity: AssistantIdentity,
  action: keyof typeof assistantRateLimits,
  now = new Date(),
) {
  const { maximum, windowSeconds } = assistantRateLimits[action];
  const currentSeconds = Math.floor(now.getTime() / 1000);
  const bucket = Math.floor(currentSeconds / windowSeconds);
  return {
    hashes: Array.from({ length: maximum }, (_, slot) => createHash("sha256")
      .update(`assistant-rate\0${action}\0${identity.accountUUID}\0${identity.staffUUID}\0${bucket}\0${slot}`)
      .digest("hex")),
    expiresAt: new Date((bucket + 2) * windowSeconds * 1000),
    retryAfterSeconds: Math.max(1, (bucket + 1) * windowSeconds - currentSeconds),
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

export async function issueAssistantGreetingSession(
  identity: AssistantIdentity,
  secret: string,
  now = new Date(),
) {
  const parsed = identitySchema.parse(identity);
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT(parsed)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(GREETING_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + GREETING_SESSION_SECONDS)
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

export async function verifyAssistantGreetingSession(
  token: string,
  secret: string,
  now = new Date(),
): Promise<AssistantIdentity> {
  try {
    if (token.length === 0 || token.length > 4_096 || token.split(".").length !== 3) throw new Error("invalid");
    const verified = await jwtVerify(token, signingKey(secret), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: GREETING_AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate: now,
    });
    return identitySchema.parse({
      accountUUID: verified.payload.accountUUID,
      staffUUID: verified.payload.staffUUID,
    });
  } catch {
    throw new Error("Assistant greeting session is invalid");
  }
}

export async function issueCompanyCheckSession(identity: AssistantIdentity, secret: string, now = new Date()) {
  const parsed = identitySchema.parse({ accountUUID: identity.accountUUID, staffUUID: identity.staffUUID });
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT(parsed)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(COMPANY_CHECK_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_SECONDS)
    .sign(signingKey(secret));
}

export async function issueCompanyCheckLaunchSession(identity: AssistantIdentity, secret: string, now = new Date()) {
  const parsed = identitySchema.parse({ accountUUID: identity.accountUUID, staffUUID: identity.staffUUID });
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT(parsed)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(COMPANY_CHECK_LAUNCH_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 5 * 60)
    .sign(signingKey(secret));
}

export async function verifyCompanyCheckLaunchSession(token: string, secret: string, now = new Date()): Promise<AssistantIdentity> {
  try {
    if (!token || token.length > 4_096 || token.split(".").length !== 3) throw new Error("invalid");
    const verified = await jwtVerify(token, signingKey(secret), {
      algorithms: ["HS256"], issuer: ISSUER, audience: COMPANY_CHECK_LAUNCH_AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SECONDS, currentDate: now,
    });
    return identitySchema.parse({ accountUUID: verified.payload.accountUUID, staffUUID: verified.payload.staffUUID });
  } catch {
    throw new Error("Company check launch session is invalid");
  }
}

export async function verifyCompanyCheckSession(token: string, secret: string, now = new Date()): Promise<AssistantIdentity> {
  try {
    if (!token || token.length > 4_096 || token.split(".").length !== 3) throw new Error("invalid");
    const verified = await jwtVerify(token, signingKey(secret), {
      algorithms: ["HS256"], issuer: ISSUER, audience: COMPANY_CHECK_AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SECONDS, currentDate: now,
    });
    return identitySchema.parse({ accountUUID: verified.payload.accountUUID, staffUUID: verified.payload.staffUUID });
  } catch {
    throw new Error("Company check session is invalid");
  }
}
