import { afterEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { issueAssistantSession, issueCompanyCheckSession } from "@/lib/security/assistant-session";
import { companyCheckIdentity, requireCompanyCheck } from "@/lib/company-check/auth";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/config", () => ({ getConfig: vi.fn() }));

const secret = "company-check-test-secret-at-least-thirty-two-bytes";
const identity = {
  accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
  staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
};

function setup(token?: string) {
  vi.mocked(getConfig).mockReturnValue({
    sessionSigningSecret: secret,
    allowedAccountUUID: identity.accountUUID,
    appBaseUrl: new URL("https://office.example.test"),
  } as ReturnType<typeof getConfig>);
  vi.mocked(cookies).mockResolvedValue({ get: () => token ? { value: token } : undefined } as never);
}

afterEach(() => vi.clearAllMocks());

describe("company-check staff boundary", () => {
  it("rejects a missing cookie and an assistant token", async () => {
    setup();
    await expect(companyCheckIdentity()).resolves.toBeNull();
    setup(await issueAssistantSession(identity, secret));
    await expect(companyCheckIdentity()).resolves.toBeNull();
  });

  it("accepts only the configured account and a same-origin mutation", async () => {
    setup(await issueCompanyCheckSession(identity, secret));
    const sameOrigin = new Request("https://office.example.test/api/company-check/reports", {
      method: "POST", headers: { origin: "https://office.example.test" },
    });
    const otherOrigin = new Request("https://office.example.test/api/company-check/reports", {
      method: "POST", headers: { origin: "https://attacker.example" },
    });
    await expect(requireCompanyCheck(sameOrigin)).resolves.toEqual(identity);
    await expect(requireCompanyCheck(otherOrigin)).resolves.toBeNull();
    vi.mocked(getConfig).mockReturnValue({ ...getConfig(), allowedAccountUUID: "f8fdf080-55c6-40b1-ac27-ade987822448" });
    await expect(companyCheckIdentity()).resolves.toBeNull();
  });
});
