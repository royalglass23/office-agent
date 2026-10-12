import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  consumeOAuthState,
  exchangeAuthorizationCode,
  fetchVendorAccountUUID,
  saveOAuthConnection,
  createAdminSession,
  safeLog,
} = vi.hoisted(() => ({
  consumeOAuthState: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  fetchVendorAccountUUID: vi.fn(),
  saveOAuthConnection: vi.fn(),
  createAdminSession: vi.fn(),
  safeLog: vi.fn(),
}));

vi.mock("@/lib/storage/oauth-state", () => ({ consumeOAuthState }));
vi.mock("@/lib/servicem8/oauth", () => ({ exchangeAuthorizationCode }));
vi.mock("@/lib/servicem8/client", () => ({ fetchVendorAccountUUID }));
vi.mock("@/lib/storage/oauth-connections", () => ({ saveOAuthConnection }));
vi.mock("@/lib/security/admin-session", () => ({
  createAdminSession,
  adminSessionCookie: (session: string) => `rg_oauth_admin=${session}`,
}));
vi.mock("@/lib/security/safe-log", () => ({
  redactIdentifier: () => "redacted",
  safeLog,
}));

import { GET } from "@/app/api/servicem8/oauth/callback/route";

const accountUUID = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";
const tokens = {
  accessToken: "private-access-token",
  refreshToken: "private-refresh-token",
  expiresAt: new Date("2026-10-13T00:00:00.000Z"),
  scopes: "vendor read_jobs read_customers read_job_notes read_staff",
};

function callbackRequest() {
  return new Request(
    "https://office.example.test/api/servicem8/oauth/callback?code=private-code&state=abcdefghijklmnopqrstuvwxyz123456",
  );
}

describe("ServiceM8 OAuth callback diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeOAuthState.mockResolvedValue(true);
    exchangeAuthorizationCode.mockResolvedValue(tokens);
    fetchVendorAccountUUID.mockResolvedValue(accountUUID);
    saveOAuthConnection.mockResolvedValue(undefined);
    createAdminSession.mockResolvedValue("private-session-token");
  });

  it.each([
    {
      stage: "token_exchange",
      fail: () => exchangeAuthorizationCode.mockRejectedValueOnce(new Error("private token response")),
    },
    {
      stage: "vendor_identity",
      fail: () => fetchVendorAccountUUID.mockRejectedValueOnce(new Error("private vendor response")),
    },
    {
      stage: "connection_save",
      fail: () => saveOAuthConnection.mockRejectedValueOnce(new Error("private database error")),
    },
    {
      stage: "admin_session",
      fail: () => createAdminSession.mockRejectedValueOnce(new Error("private session error")),
    },
  ])("logs only the safe $stage stage when binding fails", async ({ stage, fail }) => {
    fail();

    const response = await GET(callbackRequest());

    expect(response.status).toBe(502);
    expect(safeLog).toHaveBeenCalledWith("error", "ServiceM8 OAuth account binding failed", { stage });
    const logged = JSON.stringify(safeLog.mock.calls);
    expect(logged).not.toContain("private-code");
    expect(logged).not.toContain("private-access-token");
    expect(logged).not.toContain("private-refresh-token");
    expect(logged).not.toContain(accountUUID);
    expect(logged).not.toContain("private token response");
    expect(logged).not.toContain("private vendor response");
    expect(logged).not.toContain("private database error");
    expect(logged).not.toContain("private session error");
  });

  it("keeps the successful response and cookie unchanged", async () => {
    const response = await GET(callbackRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBe("rg_oauth_admin=private-session-token");
    expect(await response.text()).toContain("RG Office Assistant connected");
    expect(safeLog).toHaveBeenCalledWith("info", "Bound ServiceM8 OAuth connection", { account: "redacted" });
  });
});
