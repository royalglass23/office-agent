import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { EventVerificationError, verifyServiceM8Event } from "@/lib/servicem8/verify-event";

const secret = "phase-zero-test-secret-that-is-long-enough";
const now = 1_800_000_000;
const baseEvent = {
  eventVersion: "1.0",
  eventName: "RG_OFFICE_ASSISTANT",
  auth: {
    accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
    staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
  },
  eventArgs: { jobUUID: "0686ce69-4a5d-4f73-ad56-827ffaaced2b" },
};

async function sign(payload: Record<string, unknown>, algorithm = "HS256") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm, typ: "JWT" })
    .sign(new TextEncoder().encode(secret));
}

describe("verifyServiceM8Event", () => {
  it("accepts an HS256 Job action with a bounded freshness window", async () => {
    const token = await sign({ ...baseEvent, iat: now - 5, exp: now + 120 });
    const result = await verifyServiceM8Event(token, secret, now);
    expect(result.event.eventName).toBe("rg_office_assistant");
    expect(result.freshness).toBe("verified");
    expect(result.eventHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("authenticates but marks a documented event without temporal claims as freshness unavailable", async () => {
    const result = await verifyServiceM8Event(await sign(baseEvent), secret, now);
    expect(result.freshness).toBe("unavailable");
  });

  it.each([
    ["wrong algorithm", () => sign({ ...baseEvent, iat: now, exp: now + 60 }, "HS512")],
    ["wrong event", () => sign({ ...baseEvent, eventName: "another_event", iat: now, exp: now + 60 })],
    ["invalid UUID", () => sign({ ...baseEvent, auth: { ...baseEvent.auth, staffUUID: "not-a-uuid" }, iat: now, exp: now + 60 })],
    ["unsafe lifetime", () => sign({ ...baseEvent, iat: now, exp: now + 600 })],
  ])("rejects %s", async (_name, tokenFactory) => {
    await expect(verifyServiceM8Event(await tokenFactory(), secret, now)).rejects.toBeInstanceOf(EventVerificationError);
  });
});
