import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "@/lib/config";
import { buildAuthorizeUrl, buildCompanyCheckAuthorizeUrl, exchangeAuthorizationCode,
  exchangeCompanyCheckAuthorizationCode, exchangeRefreshToken, OAuthExchangeError } from "@/lib/servicem8/oauth";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...originalEnv,
    APP_BASE_URL: "https://office.example.test",
    SERVICEM8_APP_ID: "app-id",
    SERVICEM8_APP_SECRET: "app-secret-with-enough-length",
    SERVICEM8_OAUTH_REDIRECT_URI: "https://office.example.test/api/servicem8/oauth/callback",
    SERVICEM8_OAUTH_SCOPES: "vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments read_sms read_job_payments",
    SERVICEM8_ALLOWED_ACCOUNT_UUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
    DATABASE_URL: "postgres://unused",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    SESSION_SIGNING_SECRET: "session-secret-with-at-least-thirty-two-bytes",
  };
  resetConfigForTests();
});

function tokenResponse(scope = "vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments read_sms read_job_payments") {
  return new Response(JSON.stringify({
    access_token: "access",
    refresh_token: "rotated-refresh",
    expires_in: 3600,
    token_type: "bearer",
    scope,
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function enableCompanyCheck() {
  process.env.COMPANY_CHECK_ENABLED = "true";
  process.env.CC_APP_ID = "separate-company-app-id";
  process.env.CC_APP_SECRET = "separate-company-secret-long-enough";
  process.env.NZBN_API_KEY = "nzbn-test-key";
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.OPENAI_RESEARCH_MODEL = "research-test";
  process.env.OPENAI_DATA_CONTROLS_VERIFIED = "true";
  resetConfigForTests();
}

describe("ServiceM8 OAuth", () => {
  it("builds the least-privilege authorize request with one-time state", () => {
    const url = buildAuthorizeUrl("state-value");
    expect(url.origin + url.pathname).toBe("https://go.servicem8.com/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments read_sms read_job_payments");
    expect(url.searchParams.get("state")).toBe("state-value");
  });

  it("exchanges a code without putting the secret in the URL", async () => {
    const fetcher = vi.fn(async () => tokenResponse()) as unknown as typeof fetch;
    const tokens = await exchangeAuthorizationCode("temporary-code", fetcher, new Date(0));
    const [url, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe("https://go.servicem8.com/oauth/access_token");
    expect(String((init as RequestInit).body)).toContain("client_secret=");
    expect(tokens.expiresAt.toISOString()).toBe("1970-01-01T01:00:00.000Z");
  });

  it("requires the read-only Staff scope for named greetings", async () => {
    const fetcher = vi.fn(async () => tokenResponse("vendor read_jobs read_customers read_job_notes")) as unknown as typeof fetch;
    await expect(exchangeAuthorizationCode("code", fetcher)).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  it("rejects a grant missing other required scopes", async () => {
    const fetcher = vi.fn(async () => tokenResponse("read_jobs")) as unknown as typeof fetch;
    await expect(exchangeAuthorizationCode("code", fetcher)).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  it("rejects the previous eight-scope grant until SMS and payment consent is complete", async () => {
    const fetcher = vi.fn(async () => tokenResponse("vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments")) as unknown as typeof fetch;
    await expect(exchangeAuthorizationCode("code", fetcher)).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  it("rejects any extra scope, including a write scope", async () => {
    const fetcher = vi.fn(async () => tokenResponse("vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments read_sms read_job_payments manage_jobs")) as unknown as typeof fetch;
    await expect(exchangeAuthorizationCode("code", fetcher)).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  it("persists the replacement refresh token returned during refresh", async () => {
    const fetcher = vi.fn(async () => tokenResponse()) as unknown as typeof fetch;
    const tokens = await exchangeRefreshToken("old-refresh", fetcher);
    expect(tokens.refreshToken).toBe("rotated-refresh");
    expect(String(((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body)).toContain("refresh_token=old-refresh");
  });

  it("uses separate Company Check credentials and only the vendor activation scope", async () => {
    enableCompanyCheck();
    const url = buildCompanyCheckAuthorizeUrl("company-state");
    expect(url.searchParams.get("client_id")).toBe("separate-company-app-id");
    expect(url.searchParams.get("scope")).toBe("vendor");
    expect(url.searchParams.get("redirect_uri")).toBe("https://office.example.test/api/company-check/oauth/callback");

    const fetcher = vi.fn(async () => tokenResponse("vendor")) as unknown as typeof fetch;
    await exchangeCompanyCheckAuthorizationCode("temporary-code", fetcher);
    const params = new URLSearchParams(String((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(params.get("client_id")).toBe("separate-company-app-id");
    expect(params.get("client_secret")).toBe("separate-company-secret-long-enough");
    expect(params.get("redirect_uri")).toBe("https://office.example.test/api/company-check/oauth/callback");
    const wrongScope = vi.fn(async () => tokenResponse("vendor read_jobs")) as unknown as typeof fetch;
    await expect(exchangeCompanyCheckAuthorizationCode("temporary-code", wrongScope)).rejects.toBeInstanceOf(OAuthExchangeError);
  });
});
