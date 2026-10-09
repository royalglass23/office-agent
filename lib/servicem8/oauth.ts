import { z } from "zod";
import { getConfig } from "@/lib/config";
import type { OAuthTokenSet } from "@/lib/storage/oauth-connections";

const AUTHORIZE_URL = "https://go.servicem8.com/oauth/authorize";
const TOKEN_URL = "https://go.servicem8.com/oauth/access_token";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.coerce.number().int().positive().max(86_400),
  token_type: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("bearer")),
  scope: z.string().min(1),
});

export class OAuthExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthExchangeError";
  }
}

export function buildAuthorizeUrl(state: string) {
  const config = getConfig();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.serviceM8AppId);
  url.searchParams.set("scope", config.oauthScopes);
  url.searchParams.set("redirect_uri", config.oauthRedirectUri.toString());
  url.searchParams.set("state", state);
  return url;
}

async function requestTokens(
  body: URLSearchParams,
  fetcher: typeof fetch,
  now: Date,
): Promise<OAuthTokenSet> {
  const response = await fetcher(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new OAuthExchangeError("ServiceM8 rejected the OAuth token request");
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new OAuthExchangeError("ServiceM8 returned an invalid OAuth token response");

  const requiredScopes = new Set(getConfig().oauthScopes.split(" "));
  const grantedScopes = new Set(parsed.data.scope.split(/\s+/));
  if (
    grantedScopes.size !== requiredScopes.size ||
    [...requiredScopes].some((scope) => !grantedScopes.has(scope))
  ) {
    throw new OAuthExchangeError("ServiceM8 did not grant the exact Phase 0 scope set");
  }
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAt: new Date(now.getTime() + parsed.data.expires_in * 1000),
    scopes: parsed.data.scope,
  };
}

export async function exchangeAuthorizationCode(code: string, fetcher: typeof fetch = fetch, now = new Date()) {
  const config = getConfig();
  return requestTokens(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.serviceM8AppId,
      client_secret: config.serviceM8AppSecret,
      code,
      redirect_uri: config.oauthRedirectUri.toString(),
    }),
    fetcher,
    now,
  );
}

export async function exchangeRefreshToken(refreshToken: string, fetcher: typeof fetch = fetch, now = new Date()) {
  const config = getConfig();
  return requestTokens(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.serviceM8AppId,
      client_secret: config.serviceM8AppSecret,
      refresh_token: refreshToken,
    }),
    fetcher,
    now,
  );
}
