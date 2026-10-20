import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(), saveState: vi.fn(async (_state: string, _expiresAt: Date) => undefined),
  consumeState: vi.fn(async (_state: string) => true),
  buildUrl: vi.fn((state: string) => new URL(`https://go.servicem8.com/oauth/authorize?state=${state}`)),
  exchange: vi.fn(async (_code: string) => ({ accessToken: "company-access-token", refreshToken: "company-refresh-token" })),
  vendor: vi.fn(async (_accessToken: string) => "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b"),
}));

vi.mock("@/lib/config", () => ({ getConfig: mocks.getConfig }));
vi.mock("@/lib/storage/oauth-state", () => ({
  saveCompanyCheckOAuthState: mocks.saveState, consumeCompanyCheckOAuthState: mocks.consumeState,
}));
vi.mock("@/lib/servicem8/oauth", () => ({
  buildCompanyCheckAuthorizeUrl: mocks.buildUrl, exchangeCompanyCheckAuthorizationCode: mocks.exchange,
}));
vi.mock("@/lib/servicem8/client", () => ({ fetchVendorAccountUUID: mocks.vendor }));

import { GET as start } from "@/app/api/company-check/oauth/start/route";
import { GET as callback } from "@/app/api/company-check/oauth/callback/route";

const accountUUID = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";
const state = "company-check-oauth-state-123456789012345";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfig.mockReturnValue({ companyCheck: { enabled: true }, allowedAccountUUID: accountUUID });
  mocks.consumeState.mockResolvedValue(true);
  mocks.vendor.mockResolvedValue(accountUUID);
});

describe("separate Company Check OAuth activation", () => {
  it("starts its own one-time authorisation and confirms the vendor account", async () => {
    const initial = await start();
    expect(initial.status).toBe(302);
    expect(mocks.saveState).toHaveBeenCalledOnce();
    const minted = mocks.saveState.mock.calls[0][0] as string;
    expect(new URL(initial.headers.get("location")!).searchParams.get("state")).toBe(minted);

    const completed = await callback(new Request(`https://office.example.test/api/company-check/oauth/callback?state=${state}&code=code`));
    expect(completed.status).toBe(302);
    expect(completed.headers.get("location")).toBe("https://go.servicem8.com/");
    expect(mocks.consumeState).toHaveBeenCalledWith(state);
    expect(mocks.exchange).toHaveBeenCalledWith("code");
    expect(mocks.vendor).toHaveBeenCalledWith("company-access-token");
  });

  it("rejects replayed state and a different ServiceM8 account", async () => {
    mocks.consumeState.mockResolvedValueOnce(false);
    expect((await callback(new Request(`https://office.example.test/api/company-check/oauth/callback?state=${state}&code=code`))).status).toBe(400);
    expect(mocks.exchange).not.toHaveBeenCalled();
    mocks.vendor.mockResolvedValue("123e4567-cb72-4d94-8a1e-d454131257eb");
    expect((await callback(new Request(`https://office.example.test/api/company-check/oauth/callback?state=${state}&code=code`))).status).toBe(403);
  });
});
