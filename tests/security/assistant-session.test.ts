import { describe, expect, it } from "vitest";
import {
  assistantRateLimit,
  issueAssistantSession,
  verifyAssistantSession,
} from "@/lib/security/assistant-session";

const secret = "assistant-session-test-secret-at-least-thirty-two-bytes";
const identity = {
  accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
  staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
};

describe("staff-bound assistant session", () => {
  it("preserves only the verified account and staff identity for thirty minutes", async () => {
    const token = await issueAssistantSession(identity, secret, new Date("2030-01-01T00:00:00Z"));

    await expect(verifyAssistantSession(token, secret, new Date("2030-01-01T00:29:59Z"))).resolves.toEqual({
      ...identity,
      launchExpiresAt: 1_893_457_800,
    });
    await expect(verifyAssistantSession(token, secret, new Date("2030-01-01T00:30:31Z"))).rejects.toThrow(
      "Assistant session is invalid",
    );
  });

  it("keeps the original absolute expiry across repeated rotations", async () => {
    const launched = await issueAssistantSession(identity, secret, new Date("2030-01-01T00:00:00Z"));
    const first = await verifyAssistantSession(launched, secret, new Date("2030-01-01T00:10:00Z"));
    const rotatedOnce = await issueAssistantSession(first, secret, new Date("2030-01-01T00:10:00Z"), first.launchExpiresAt);
    const second = await verifyAssistantSession(rotatedOnce, secret, new Date("2030-01-01T00:20:00Z"));
    const rotatedTwice = await issueAssistantSession(second, secret, new Date("2030-01-01T00:20:00Z"), second.launchExpiresAt);

    await expect(verifyAssistantSession(rotatedTwice, secret, new Date("2030-01-01T00:30:31Z"))).rejects.toThrow(
      "Assistant session is invalid",
    );
  });

  it("rejects tampering instead of accepting browser-supplied identity", async () => {
    const token = await issueAssistantSession(identity, secret, new Date("2030-01-01T00:00:00Z"));
    const [header, payload, signature] = token.split(".");
    const changedPayload = Buffer.from(JSON.stringify({
      ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      staffUUID: "123e4567-cb72-4d94-8a1e-d454131257eb",
    })).toString("base64url");

    await expect(verifyAssistantSession(
      `${header}.${changedPayload}.${signature}`,
      secret,
      new Date("2030-01-01T00:01:00Z"),
    )).rejects.toThrow("Assistant session is invalid");
  });

  it("creates account-and-staff-bound rate-limit buckets", () => {
    const first = assistantRateLimit(identity, "summary", new Date("2030-01-01T00:00:01Z"));
    const sameBucket = assistantRateLimit(identity, "summary", new Date("2030-01-01T00:00:59Z"));
    const nextBucket = assistantRateLimit(identity, "summary", new Date("2030-01-01T00:01:00Z"));
    expect(first.hash).toBe(sameBucket.hash);
    expect(first.hash).not.toBe(nextBucket.hash);
    expect(first.expiresAt.toISOString()).toBe("2030-01-01T00:02:00.000Z");
  });
});
