import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeEventHash, clientConstructor, requireVendorAccount, loadPhaseZeroJobContext } = vi.hoisted(() => ({
  consumeEventHash: vi.fn(async () => true),
  clientConstructor: vi.fn(),
  requireVendorAccount: vi.fn(async () => undefined),
  loadPhaseZeroJobContext: vi.fn(async () => ({
    jobUUID: "0686ce69-4a5d-4f73-ad56-827ffaaced2b",
    jobNumber: "Q123",
    jobStatus: "Quote",
    companyUUID: "123e4567-cb72-4d94-8a1e-d454131257eb",
    companyName: "Example Client",
  })),
}));

vi.mock("@/lib/config", () => ({
  getConfig: () => ({ serviceM8AppSecret: "phase-zero-test-secret-that-is-long-enough" }),
}));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash }));
vi.mock("@/lib/servicem8/client", () => ({
  ServiceM8ApiError: class ServiceM8ApiError extends Error {},
  ServiceM8Client: class ServiceM8Client { constructor(...args: unknown[]) { clientConstructor(...args); } },
  requireVendorAccount,
}));
vi.mock("@/lib/servicem8/job-context", () => ({ loadPhaseZeroJobContext }));

import { POST } from "@/app/api/servicem8/events/route";

const event = {
  eventVersion: "1.0",
  eventName: "rg_office_assistant",
  auth: {
    accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
    staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
  },
  eventArgs: { jobUUID: "0686ce69-4a5d-4f73-ad56-827ffaaced2b" },
};

async function sign(payload: Record<string, unknown> = event) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(new TextEncoder().encode("phase-zero-test-secret-that-is-long-enough"));
}

async function signFresh() {
  const now = Math.floor(Date.now() / 1000);
  return sign({ ...event, iat: now - 1, exp: now + 120 });
}

describe("ServiceM8 event route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid signature before storage or API access", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: `${await sign()}tampered`,
    }));
    expect(response.status).toBe(401);
    expect(consumeEventHash).not.toHaveBeenCalled();
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("stops before OAuth/API access when signed claims cannot prove freshness", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      headers: { "content-type": "application/jwt" },
      body: await sign(),
    }));
    expect(response.status).toBe(428);
    expect(consumeEventHash).toHaveBeenCalledOnce();
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(await response.text()).toContain("freshness could not be proven");
  });

  it("rejects an exact replay", async () => {
    consumeEventHash.mockResolvedValueOnce(false);
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await sign(),
    }));
    expect(response.status).toBe(409);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("binds the signed account before loading and rendering Job context", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      headers: { "content-type": "application/jwt" },
      body: await signFresh(),
    }));
    expect(response.status).toBe(200);
    expect(clientConstructor).toHaveBeenCalledWith(event.auth.accountUUID, event.auth.staffUUID);
    expect(requireVendorAccount).toHaveBeenCalledOnce();
    expect(loadPhaseZeroJobContext).toHaveBeenCalledWith(expect.anything(), event.eventArgs.jobUUID);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({
      eventResponse: expect.stringContaining("Q123"),
    });
  });

  it("rejects unexpected callback content types", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));
    expect(response.status).toBe(415);
  });
});
