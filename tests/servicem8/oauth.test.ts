import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "@/lib/config";
import { buildAuthorizeUrl, exchangeAuthorizationCode, exchangeRefreshToken, OAuthExchangeError } from "@/lib/servicem8/oauth";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...originalEnv,
    APP_BASE_URL: "https://office.example.test",
    SERVICEM8_APP_ID: "app-id",
    SERVICEM8_APP_SECRET: "app-secret-with-enough-length",
    SERVICEM8_OAUTH_REDIRECT_URI: "https://office.example.test/api/servicem8/oauth/callback",
    SERVICEM8_OAUTH_SCOPES: "vendor read_jobs read_customers",
    DATABASE_URL: "postgres://unused",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    SESSION_SIGNING_SECRET: "session-secret-with-at-least-thirty-two-bytes",
  };
  resetConfigForTests();
});

function tokenResponse(scope = "vendor read_jobs read_customers") {
  return new Response(JSON.stringify({
    access_token: "access",
    refresh_token: "rotated-refresh",
    expires_in: 3600,
    token_type: "bearer",
    scope,
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("ServiceM8 OAuth", () => {
  it("builds the least-privilege authorize request with one-time state", () => {
    const url = buildAuthorizeUrl("state-value");
    expect(url.origin + url.pathname).toBe("https://go.servicem8.com/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("vendor read_jobs read_customers");
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

  it("requires all three Phase 0 scopes", async () => {
    const fetcher = vi.fn(async () => tokenResponse("read_jobs")) as unknown as typeof fetch;
    await expect(exchangeAuthorizationCode("code", fetcher)).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  it("rejects any extra scope, including a write scope", async () => {
    const fetcher = vi.fn(async () => tokenResponse("vendor read_jobs read_customers manage_jobs")) as unknown as typeof fetch;
    await expect(exchangeAuthorizationCode("code", fetcher)).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  it("persists the replacement refresh token returned during refresh", async () => {
    const fetcher = vi.fn(async () => tokenResponse()) as unknown as typeof fetch;
    const tokens = await exchangeRefreshToken("old-refresh", fetcher);
    expect(tokens.refreshToken).toBe("rotated-refresh");
    expect(String(((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body)).toContain("refresh_token=old-refresh");
  });
});
