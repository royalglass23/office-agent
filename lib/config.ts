import { z } from "zod";

const phaseZeroScopes = ["vendor", "read_jobs", "read_customers"] as const;

const envSchema = z.object({
  APP_BASE_URL: z.url().refine((url) => url.startsWith("https://"), "must use HTTPS"),
  SERVICEM8_APP_ID: z.string().min(1),
  SERVICEM8_APP_SECRET: z.string().min(16),
  SERVICEM8_OAUTH_REDIRECT_URI: z.url().refine((url) => url.startsWith("https://"), "must use HTTPS"),
  SERVICEM8_OAUTH_SCOPES: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  SESSION_SIGNING_SECRET: z.string().min(32),
});

export type PhaseZeroConfig = {
  appBaseUrl: URL;
  serviceM8AppId: string;
  serviceM8AppSecret: string;
  oauthRedirectUri: URL;
  oauthScopes: string;
  databaseUrl: string;
  tokenEncryptionKey: string;
  sessionSigningSecret: string;
};

let cached: PhaseZeroConfig | undefined;

export function getConfig(): PhaseZeroConfig {
  if (cached) return cached;

  const env = envSchema.parse(process.env);
  const configuredScopes = new Set(env.SERVICEM8_OAUTH_SCOPES.split(/\s+/).filter(Boolean));
  const exactScopes = new Set(phaseZeroScopes);
  if (
    configuredScopes.size !== exactScopes.size ||
    [...configuredScopes].some((scope) => !exactScopes.has(scope as (typeof phaseZeroScopes)[number]))
  ) {
    throw new Error(`SERVICEM8_OAUTH_SCOPES must be exactly: ${phaseZeroScopes.join(" ")}`);
  }

  const appBaseUrl = new URL(env.APP_BASE_URL);
  const oauthRedirectUri = new URL(env.SERVICEM8_OAUTH_REDIRECT_URI);
  const databaseUrl = new URL(env.DATABASE_URL);
  if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }
  if (process.env.NODE_ENV === "production" && !["require", "verify-full"].includes(databaseUrl.searchParams.get("sslmode") ?? "")) {
    throw new Error("Production DATABASE_URL must require TLS with sslmode=require or sslmode=verify-full");
  }
  if (appBaseUrl.host !== oauthRedirectUri.host) {
    throw new Error("OAuth redirect host must match APP_BASE_URL");
  }

  cached = {
    appBaseUrl,
    serviceM8AppId: env.SERVICEM8_APP_ID,
    serviceM8AppSecret: env.SERVICEM8_APP_SECRET,
    oauthRedirectUri,
    oauthScopes: [...phaseZeroScopes].join(" "),
    databaseUrl: databaseUrl.toString(),
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,
    sessionSigningSecret: env.SESSION_SIGNING_SECRET,
  };
  return cached;
}

export function resetConfigForTests() {
  cached = undefined;
}
