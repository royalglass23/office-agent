import { beforeEach, describe, expect, it, vi } from "vitest";

const { getConfig, verifyAssistantSession, clientConstructor, requireVendorAccount, getStaff, safeLog } = vi.hoisted(() => ({
  getConfig: vi.fn(() => ({ assistantProof: { enabled: true }, sessionSigningSecret: "test-session-secret" })),
  verifyAssistantSession: vi.fn(async () => ({
    accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
    staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
  })),
  clientConstructor: vi.fn(),
  requireVendorAccount: vi.fn(async () => undefined),
  getStaff: vi.fn(async (staffUUID: string) => ({ first: staffUUID ? "May" : "" })),
  safeLog: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ getConfig }));
vi.mock("@/lib/security/assistant-session", () => ({ verifyAssistantSession }));
vi.mock("@/lib/security/safe-log", () => ({ correlationId: () => "test-request-id", safeLog }));
vi.mock("@/lib/servicem8/client", () => ({
  ServiceM8Client: class ServiceM8Client {
    constructor(...args: unknown[]) { clientConstructor(...args); }
    getStaff(staffUUID: string) { return getStaff(staffUUID); }
  },
  requireVendorAccount,
}));

import { OPTIONS, POST } from "@/app/assistant/staff/route";

function request(body: string) {
  return new Request("https://office.example.test/assistant/staff", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("assistant greeting lookup", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns the signed staff member's first name after account verification", async () => {
    const response = await POST(request("session=signed-session"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ first: "May" });
    expect(verifyAssistantSession).toHaveBeenCalledWith("signed-session", "test-session-secret");
    expect(clientConstructor).toHaveBeenCalledWith(
      "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
      "9d914a06-221e-4013-8b4d-2735272710eb",
    );
    expect(requireVendorAccount).toHaveBeenCalledOnce();
    expect(getStaff).toHaveBeenCalledWith("9d914a06-221e-4013-8b4d-2735272710eb");
  });

  it("rejects invalid sessions before ServiceM8 access", async () => {
    verifyAssistantSession.mockRejectedValueOnce(new Error("Assistant session is invalid"));
    const response = await POST(request("session=invalid"));
    expect(response.status).toBe(401);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("does not read Staff when account verification fails", async () => {
    requireVendorAccount.mockRejectedValueOnce(new Error("Account mismatch"));
    const response = await POST(request("session=signed-session"));
    expect(response.status).toBe(503);
    expect(getStaff).not.toHaveBeenCalled();
  });

  it("rejects extra form fields before ServiceM8 access", async () => {
    const response = await POST(request("session=signed-session&staffUUID=other"));
    expect(response.status).toBe(400);
    expect(verifyAssistantSession).not.toHaveBeenCalled();
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("allows the iframe's cross-origin form request", () => {
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
