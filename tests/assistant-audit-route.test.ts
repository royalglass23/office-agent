import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  verifySession: vi.fn(),
  consume: vi.fn(),
  getConnection: vi.fn(),
  requireVendor: vi.fn(),
  audit: vi.fn(),
  client: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ getConfig: mocks.getConfig }));
vi.mock("@/lib/security/assistant-session", () => ({
  assistantRateLimit: () => ({ hashes: ["slot"], expiresAt: new Date("2030-01-01") }),
  assistantSessionHash: () => "session-hash",
  verifyAssistantSession: mocks.verifySession,
}));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash: mocks.consume }));
vi.mock("@/lib/storage/oauth-connections", () => ({ getOAuthConnection: mocks.getConnection }));
vi.mock("@/lib/servicem8/client", () => ({
  ServiceM8Client: mocks.client,
  ServiceM8ApiError: class ServiceM8ApiError extends Error {},
  requireVendorAccount: mocks.requireVendor,
}));
vi.mock("@/lib/servicem8/job-diary-audit", () => ({
  auditJobNumbers: ["R260766", "R260609"],
  auditJobDiary: mocks.audit,
}));

import { POST } from "@/app/assistant/audit/route";

const accountUUID = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";
const staffUUID = "9d914a06-221e-4013-8b4d-2735272710eb";
const scopes = "vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments";
const staging = "https://office-agent-staging.vercel.app";

function request(origin = staging, jobNumber = "R260609", session = "signed-session") {
  return new Request(`${origin}/assistant/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ session, jobNumber }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfig.mockReturnValue({
    appBaseUrl: new URL(staging), allowedAccountUUID: accountUUID,
    sessionSigningSecret: "test-signing-secret", oauthScopes: scopes,
  });
  mocks.verifySession.mockResolvedValue({ accountUUID, staffUUID, launchExpiresAt: 1_900_000_000 });
  mocks.consume.mockResolvedValue(true);
  mocks.getConnection.mockResolvedValue({ scopes });
  mocks.client.mockImplementation(function MockServiceM8Client() { return {}; });
  mocks.audit.mockResolvedValue({ jobNumber: "R260609", status: "incomplete", sources: [] });
});

describe("staging RG-380 audit route", () => {
  it("is unavailable on production even with a signed session", async () => {
    const response = await POST(request("https://office-agent-ashy.vercel.app"));
    expect(response.status).toBe(404);
    expect(mocks.verifySession).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("rejects Jobs outside the owner's two authorised fixtures", async () => {
    const response = await POST(request(staging, "R260680"));
    expect(response.status).toBe(400);
    expect(mocks.verifySession).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("requires an exact eight-scope stored grant before any ServiceM8 read", async () => {
    mocks.getConnection.mockResolvedValue({ scopes: "vendor read_jobs read_customers read_job_notes read_staff" });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ status: "grant_incomplete" });
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("uses the signed staff identity and returns redacted audit output", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.client).toHaveBeenCalledWith(accountUUID, staffUUID);
    expect(mocks.requireVendor).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), "R260609", "test-signing-secret");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ status: "incomplete", jobNumber: "R260609" });
  });

  it("stops replayed sessions before reading connection metadata", async () => {
    mocks.consume.mockResolvedValueOnce(false);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("retains the replay marker beyond the verifier's expiry tolerance", async () => {
    await POST(request());
    expect(mocks.consume).toHaveBeenCalledWith("session-hash", new Date(1_900_000_060_000));
  });
});
