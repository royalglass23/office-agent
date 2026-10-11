import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeEventHash, clientConstructor, getStaff, requireVendorAccount, loadPhaseZeroJobContext, safeLog } = vi.hoisted(() => ({
  consumeEventHash: vi.fn(async () => true),
  clientConstructor: vi.fn(),
  getStaff: vi.fn(async (staffUUID: string) => ({ uuid: staffUUID, first: "May", last: "Yang" })),
  requireVendorAccount: vi.fn(async () => undefined),
  loadPhaseZeroJobContext: vi.fn(async () => ({
    jobUUID: "0686ce69-4a5d-4f73-ad56-827ffaaced2b",
    jobNumber: "Q123",
    jobStatus: "Quote",
    companyUUID: "123e4567-cb72-4d94-8a1e-d454131257eb",
    companyName: "Example Client",
  })),
  safeLog: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getConfig: () => ({ serviceM8AppSecret: "phase-zero-test-secret-that-is-long-enough" }),
}));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash }));
vi.mock("@/lib/security/safe-log", () => ({
  correlationId: () => "test-request-id",
  redactIdentifier: () => "redacted",
  safeLog,
}));
vi.mock("@/lib/servicem8/client", () => ({
  ServiceM8ApiError: class ServiceM8ApiError extends Error {},
  ServiceM8Client: class ServiceM8Client {
    constructor(...args: unknown[]) { clientConstructor(...args); }
    getStaff(staffUUID: string) { return getStaff(staffUUID); }
  },
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

const menuEvent = {
  ...event,
  eventName: "rg_office_assistant_menu",
  eventArgs: {},
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

  it("renders the signed staff member's name for a fresh global menu launch", async () => {
    const now = Math.floor(Date.now() / 1000);
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      headers: { "content-type": "application/jwt" },
      body: await sign({ ...menuEvent, iat: now - 1, exp: now + 120 }),
    }));
    expect(response.status).toBe(200);
    expect(clientConstructor).toHaveBeenCalledWith(event.auth.accountUUID, event.auth.staffUUID);
    expect(requireVendorAccount).toHaveBeenCalledOnce();
    expect(getStaff).toHaveBeenCalledWith(event.auth.staffUUID);
    expect(loadPhaseZeroJobContext).not.toHaveBeenCalled();
    const { eventResponse } = await response.json();
    expect(eventResponse).toContain("Hi, May—anything I can help with?");
    expect(eventResponse).toContain("Leave: use ServiceM8 navigation");
    expect(eventResponse).toContain("No message leaves this page");
    expect(eventResponse).not.toContain("closeWindow");
  });

  it("keeps a menu launch fail-closed when freshness cannot be proven", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await sign(menuEvent),
    }));
    expect(response.status).toBe(428);
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(event.auth.staffUUID);
  });

  it("logs field names but no field values when a menu schema is rejected", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await sign({ ...menuEvent, eventArgs: { menuItemUUID: "private-value" } }),
    }));
    expect(response.status).toBe(401);
    expect(safeLog).toHaveBeenCalledWith("warn", "Rejected invalid ServiceM8 event", expect.objectContaining({
      requestId: "test-request-id",
      validationCategory: "schema",
      validationEventArgsKeys: "menuItemUUID",
      validationIssueCodes: "unrecognized_keys",
    }));
    expect(JSON.stringify(safeLog.mock.calls)).not.toContain("private-value");
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("accepts a valid signed callback regardless of its declared media type", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: await signFresh(),
    }));
    expect(response.status).toBe(200);
    expect(clientConstructor).toHaveBeenCalledWith(event.auth.accountUUID, event.auth.staffUUID);
  });

  it("rejects a malformed callback body before storage or API access", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));
    expect(response.status).toBe(401);
    expect(consumeEventHash).not.toHaveBeenCalled();
    expect(clientConstructor).not.toHaveBeenCalled();
  });
});
