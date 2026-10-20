import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "@/lib/config";
import { issueAssistantSession, issueCompanyCheckLaunchSession, issueCompanyCheckSession } from "@/lib/security/assistant-session";
import { consumeEventHash } from "@/lib/storage/consumed-events";
import { POST } from "@/app/company-check/launch/route";

vi.mock("@/lib/config", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash: vi.fn() }));

const secret = "company-launch-secret-at-least-thirty-two-bytes";
const identity = {
  accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
  staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
};

function launchRequest(token: string) {
  return new Request("https://office.example.test/company-check/launch", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ session: token }),
  });
}

beforeEach(() => {
  vi.mocked(getConfig).mockReturnValue({
    appBaseUrl: new URL("https://office.example.test"),
    allowedAccountUUID: identity.accountUUID,
    sessionSigningSecret: secret,
    companyCheck: { enabled: true, apiKey: "test", model: "test" },
  } as ReturnType<typeof getConfig>);
  vi.mocked(consumeEventHash).mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("company-check ServiceM8 handoff", () => {
  it("exchanges a one-time signed assistant launch for an HTTP-only staff cookie", async () => {
    const token = await issueCompanyCheckLaunchSession(identity, secret);
    const result = await POST(launchRequest(token));
    expect(consumeEventHash).toHaveBeenCalled();
    expect(result.status).toBe(303);
    expect(result.headers.get("location")).toBe("https://office.example.test/company-check");
    const cookie = result.headers.get("set-cookie") || "";
    expect(cookie).toContain("rg_company_check_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
  });

  it("rejects replay and a token for another audience", async () => {
    const token = await issueCompanyCheckLaunchSession(identity, secret);
    vi.mocked(consumeEventHash).mockResolvedValue(false);
    expect((await POST(launchRequest(token))).status).toBe(409);
    const companyToken = await issueCompanyCheckSession(identity, secret);
    expect((await POST(launchRequest(companyToken))).status).toBe(401);
    const assistantToken = await issueAssistantSession(identity, secret);
    expect((await POST(launchRequest(assistantToken))).status).toBe(401);
  });
});
