import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeEventHash, clientConstructor, getConfig, getStaff, issueAssistantGreetingSession, issueAssistantSession, requireVendorAccount, loadPhaseZeroJobContext, safeLog, isJobDiaryCoverageVerified } = vi.hoisted(() => ({
  consumeEventHash: vi.fn(async () => true),
  clientConstructor: vi.fn(),
  getConfig: vi.fn(() => ({
    appBaseUrl: new URL("https://office.example.test"),
    serviceM8AppSecret: "phase-zero-test-secret-that-is-long-enough",
    sessionSigningSecret: "session-secret-with-at-least-thirty-two-bytes",
    allowedAccountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
    assistantProof: { enabled: false } as { enabled: boolean; apiKey?: string; model?: string },
  })),
  getStaff: vi.fn(async (staffUUID: string) => ({ uuid: staffUUID, first: "May", last: "Yang" })),
  issueAssistantGreetingSession: vi.fn(async () => "signed-greeting-session"),
  issueAssistantSession: vi.fn(async () => "signed-assistant-session"),
  requireVendorAccount: vi.fn(async () => undefined),
  loadPhaseZeroJobContext: vi.fn(async () => ({
    jobUUID: "0686ce69-4a5d-4f73-ad56-827ffaaced2b",
    jobNumber: "Q123",
    jobStatus: "Quote",
    companyUUID: "123e4567-cb72-4d94-8a1e-d454131257eb",
    companyName: "Example Client",
  })),
  safeLog: vi.fn(),
  isJobDiaryCoverageVerified: vi.fn(() => true),
}));

vi.mock("@/lib/config", () => ({ getConfig }));
vi.mock("@/lib/security/assistant-session", () => ({ issueAssistantGreetingSession, issueAssistantSession }));
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
vi.mock("@/lib/servicem8/job-diary-gate", () => ({ isJobDiaryCoverageVerified }));

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
  eventArgs: [],
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
  beforeEach(() => {
    vi.clearAllMocks();
    isJobDiaryCoverageVerified.mockReturnValue(true);
    getConfig.mockReturnValue({
      appBaseUrl: new URL("https://office.example.test"),
      serviceM8AppSecret: "phase-zero-test-secret-that-is-long-enough",
      sessionSigningSecret: "session-secret-with-at-least-thirty-two-bytes",
      allowedAccountUUID: event.auth.accountUUID,
      assistantProof: { enabled: false } as { enabled: boolean; apiKey?: string; model?: string },
    });
  });

  it("withholds the Phase 0 Job context while Diary coverage is unverified", async () => {
    isJobDiaryCoverageVerified.mockReturnValue(false);
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await signFresh(),
    }));
    expect(response.status).toBe(503);
    const result = await response.json();
    expect(result.eventResponse).toContain("Job Diary coverage incomplete");
    expect(loadPhaseZeroJobContext).not.toHaveBeenCalled();
    expect(clientConstructor).not.toHaveBeenCalled();
  });

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

  it("rejects a signed foreign account before replay storage, API access, or session issuance", async () => {
    getConfig.mockReturnValueOnce({
      appBaseUrl: new URL("https://office.example.test"),
      serviceM8AppSecret: "phase-zero-test-secret-that-is-long-enough",
      sessionSigningSecret: "session-secret-with-at-least-thirty-two-bytes",
      allowedAccountUUID: "123e4567-cb72-4d94-8a1e-d454131257eb",
      assistantProof: { enabled: true, apiKey: "test-key", model: "gpt-test" },
    });
    const now = Math.floor(Date.now() / 1000);

    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await sign({ ...menuEvent, iat: now - 1, jti: "foreign-menu-launch" }),
    }));

    expect(response.status).toBe(403);
    expect(consumeEventHash).not.toHaveBeenCalled();
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(issueAssistantSession).not.toHaveBeenCalled();
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
      body: await sign({ ...menuEvent, iat: now - 1, jti: "fresh-menu-launch" }),
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

  it("mints a staff-bound server session when the bounded proof is enabled", async () => {
    getConfig.mockReturnValueOnce({
      appBaseUrl: new URL("https://office.example.test"),
      serviceM8AppSecret: "phase-zero-test-secret-that-is-long-enough",
      sessionSigningSecret: "session-secret-with-at-least-thirty-two-bytes",
      allowedAccountUUID: event.auth.accountUUID,
      assistantProof: { enabled: true, apiKey: "test-key", model: "gpt-test" },
    });
    const now = Math.floor(Date.now() / 1000);
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await sign({ ...menuEvent, iat: now - 1, jti: "proof-menu-launch" }),
    }));
    expect(response.status).toBe(200);
    expect(issueAssistantSession).toHaveBeenCalledWith({
      accountUUID: event.auth.accountUUID,
      staffUUID: event.auth.staffUUID,
    }, "session-secret-with-at-least-thirty-two-bytes");
    expect(issueAssistantGreetingSession).toHaveBeenCalledWith({
      accountUUID: event.auth.accountUUID,
      staffUUID: event.auth.staffUUID,
    }, "session-secret-with-at-least-thirty-two-bytes");
    expect(requireVendorAccount).not.toHaveBeenCalled();
    expect(getStaff).not.toHaveBeenCalled();
    const { eventResponse } = await response.json();
    expect(eventResponse).toContain('action="https://office.example.test/assistant"');
    expect(eventResponse).toContain('name="session" value="signed-assistant-session"');
    expect(eventResponse).toContain("signed-greeting-session");
    expect(eventResponse).toContain("Opening RG Office Assistant…");
    expect(eventResponse).toContain('name="message"');
    expect(eventResponse).toContain("What happened to R260766?");
    expect(eventResponse).not.toContain(event.auth.accountUUID);
    expect(eventResponse).not.toContain(event.auth.staffUUID);
  });

  it("rejects a replayed fresh global menu launch before API access", async () => {
    consumeEventHash.mockResolvedValueOnce(false);
    const now = Math.floor(Date.now() / 1000);
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await sign({ ...menuEvent, iat: now - 1, jti: "replayed-menu-launch" }),
    }));
    expect(response.status).toBe(409);
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(getStaff).not.toHaveBeenCalled();
  });

  it("keeps a menu launch fail-closed when jti is missing even with exp", async () => {
    const now = Math.floor(Date.now() / 1000);
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await sign({ ...menuEvent, iat: now - 1, exp: now + 120 }),
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

  it("logs only the argument count when a menu array is rejected", async () => {
    const response = await POST(new Request("https://office.example.test/api/servicem8/events", {
      method: "POST",
      body: await sign({ ...menuEvent, eventArgs: ["private-value"] }),
    }));
    expect(response.status).toBe(401);
    expect(safeLog).toHaveBeenCalledWith("warn", "Rejected invalid ServiceM8 event", expect.objectContaining({
      requestId: "test-request-id",
      validationCategory: "schema",
      validationEventArgsType: "array",
      validationEventArgsArrayLength: 1,
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
