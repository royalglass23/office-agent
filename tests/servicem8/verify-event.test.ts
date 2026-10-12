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

  it("accepts a menu launch without inventing Job context", async () => {
    const token = await sign({
      ...baseEvent,
      eventName: "RG_OFFICE_ASSISTANT_MENU",
      eventArgs: [],
      iat: now - 5,
      jti: "live-menu-event-id",
    });
    const result = await verifyServiceM8Event(token, secret, now);
    expect(result.event.eventName).toBe("rg_office_assistant_menu");
    expect(result.event.eventArgs).toEqual({});
    expect("jobUUID" in result.event.eventArgs).toBe(false);
    expect(result.freshness).toBe("verified");
  });

  it("uses the account-scoped menu jti as the replay identity", async () => {
    const payload = {
      ...baseEvent,
      eventName: "rg_office_assistant_menu",
      eventArgs: [],
      iat: now - 5,
      jti: "one-menu-launch",
    };
    const first = await verifyServiceM8Event(await sign({ ...payload, iss: "first" }), secret, now);
    const second = await verifyServiceM8Event(await sign({ ...payload, iss: "second" }), secret, now);
    expect(first.eventHash).toBe(second.eventHash);
  });

  it("keeps a menu launch without jti freshness-unavailable", async () => {
    const result = await verifyServiceM8Event(await sign({
      ...baseEvent,
      eventName: "rg_office_assistant_menu",
      eventArgs: [],
      iat: now - 5,
    }), secret, now);
    expect(result.freshness).toBe("unavailable");
  });

  it("does not apply the approved menu policy to a Job event", async () => {
    const result = await verifyServiceM8Event(await sign({
      ...baseEvent,
      iat: now - 5,
      jti: "job-event-without-exp",
    }), secret, now);
    expect(result.event.eventName).toBe("rg_office_assistant");
    expect(result.freshness).toBe("unavailable");
  });

  it.each([
    ["older than five minutes", now - 301],
    ["more than thirty seconds in the future", now + 31],
  ])("rejects a menu launch issued %s", async (_description, iat) => {
    await expect(verifyServiceM8Event(await sign({
      ...baseEvent,
      eventName: "rg_office_assistant_menu",
      eventArgs: [],
      iat,
      jti: "invalid-time-menu-launch",
    }), secret, now)).rejects.toBeInstanceOf(EventVerificationError);
  });

  it("rejects a menu launch that claims Job context", async () => {
    const token = await sign({
      ...baseEvent,
      eventName: "rg_office_assistant_menu",
      iat: now - 5,
      exp: now + 120,
    });
    await expect(verifyServiceM8Event(token, secret, now)).rejects.toBeInstanceOf(EventVerificationError);
  });

  it("rejects a menu launch with non-empty array arguments", async () => {
    const token = await sign({
      ...baseEvent,
      eventName: "rg_office_assistant_menu",
      eventArgs: ["unexpected"],
      iat: now - 5,
      exp: now + 120,
    });
    await expect(verifyServiceM8Event(token, secret, now)).rejects.toBeInstanceOf(EventVerificationError);
  });

  it("reports only structural diagnostics for a schema mismatch", async () => {
    const token = await sign({
      ...baseEvent,
      eventName: "rg_office_assistant_menu",
      eventArgs: { menuItemUUID: "do-not-log-this-value" },
      iat: now - 5,
      exp: now + 120,
    });
    const error = await verifyServiceM8Event(token, secret, now).catch((caught) => caught);
    expect(error).toBeInstanceOf(EventVerificationError);
    expect(error).toMatchObject({
      category: "schema",
      diagnostics: {
        payloadKeys: ["auth", "eventArgs", "eventName", "eventVersion", "exp", "iat"],
        authKeys: ["accountUUID", "staffUUID"],
        eventArgsType: "object",
        eventArgsKeys: ["menuItemUUID"],
        issueCodes: ["unrecognized_keys"],
      },
    });
    expect(JSON.stringify(error.diagnostics)).not.toContain("do-not-log-this-value");
  });

  it("does not attach payload diagnostics to a signature failure", async () => {
    const token = `${await sign({ ...baseEvent, iat: now, exp: now + 60 })}tampered`;
    const error = await verifyServiceM8Event(token, secret, now).catch((caught) => caught);
    expect(error).toMatchObject({ category: "signature", diagnostics: undefined });
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
