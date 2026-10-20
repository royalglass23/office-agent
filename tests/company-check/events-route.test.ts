import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "@/lib/config";
import { verifyCompanyCheckLaunchSession } from "@/lib/security/assistant-session";
import { consumeEventHash } from "@/lib/storage/consumed-events";
import { POST } from "@/app/api/company-check/events/route";

vi.mock("@/lib/config", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash: vi.fn() }));

const appSecret = "separate-company-addon-secret-long-enough";
const sessionSecret = "company-check-session-secret-long-enough";
const accountUUID = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";
const staffUUID = "9d914a06-221e-4013-8b4d-2735272710eb";

async function eventToken(overrides: Record<string, unknown> = {}, secret = appSecret) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ eventVersion: "1.0", eventName: "rg_company_check_menu",
    auth: { accountUUID, staffUUID }, eventArgs: [], iat: now - 1, exp: now + 120, jti: "company-launch-1", ...overrides })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(new TextEncoder().encode(secret));
}
function request(token: string) {
  return new Request("https://office.example.test/api/company-check/events", { method: "POST", body: token });
}

beforeEach(() => {
  vi.mocked(getConfig).mockReturnValue({ appBaseUrl: new URL("https://office.example.test"),
    allowedAccountUUID: accountUUID, sessionSigningSecret: sessionSecret,
    companyCheck: { enabled: true, appSecret, apiKey: "unused", model: "unused", nzbnApiKey: "unused" },
  } as ReturnType<typeof getConfig>);
  vi.mocked(consumeEventHash).mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("separate Company Check Add-on callback", () => {
  it("mints a one-time launch for the signed staff member", async () => {
    const response = await POST(request(await eventToken()));
    expect(response.status).toBe(200);
    expect(consumeEventHash).toHaveBeenCalledOnce();
    const { eventResponse } = await response.json();
    expect(eventResponse).toContain("RG Company Check");
    expect(eventResponse).toContain('action="https://office.example.test/company-check/launch"');
    const launchToken = eventResponse.match(/name="session" value="([^"]+)"/)?.[1];
    expect(launchToken).toBeTruthy();
    await expect(verifyCompanyCheckLaunchSession(launchToken!, sessionSecret)).resolves.toEqual({ accountUUID, staffUUID });
  });

  it("rejects Assistant events, the Assistant secret, foreign accounts and replays", async () => {
    expect((await POST(request(await eventToken({ eventName: "rg_office_assistant_menu" })))).status).toBe(400);
    expect((await POST(request(await eventToken({}, "office-assistant-secret-long-enough")))).status).toBe(401);
    expect((await POST(request(await eventToken({ auth: { accountUUID: "123e4567-cb72-4d94-8a1e-d454131257eb", staffUUID } })))).status).toBe(403);
    vi.mocked(consumeEventHash).mockResolvedValue(false);
    expect((await POST(request(await eventToken()))).status).toBe(409);
  });

  it("requires a fresh ServiceM8 menu event", async () => {
    expect((await POST(request(await eventToken({ iat: undefined, jti: undefined })))).status).toBe(428);
    expect(consumeEventHash).not.toHaveBeenCalled();
  });
});
