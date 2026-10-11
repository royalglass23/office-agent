import { beforeEach, describe, expect, it } from "vitest";
import manifest from "@/manifest.json";
import { GET } from "@/app/api/servicem8/manifest/route";
import { resetConfigForTests } from "@/lib/config";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...originalEnv,
    APP_BASE_URL: "https://office-agent-ashy.vercel.app",
    SERVICEM8_APP_ID: "app-id",
    SERVICEM8_APP_SECRET: "app-secret-with-enough-length",
    SERVICEM8_OAUTH_REDIRECT_URI: "https://office-agent-ashy.vercel.app/api/servicem8/oauth/callback",
    SERVICEM8_OAUTH_SCOPES: "vendor read_jobs read_customers read_job_notes",
    DATABASE_URL: "postgres://unused",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    SESSION_SIGNING_SECRET: "session-secret-with-at-least-thirty-two-bytes",
  };
  resetConfigForTests();
});

describe("ServiceM8 add-on manifest", () => {
  it("keeps the uploaded and served manifests on the same read-only Notes scope and version", async () => {
    const served = await GET().json();
    expect(manifest.oauth.scope).toBe("vendor read_jobs read_customers read_job_notes");
    expect(served.oauth.scope).toBe(manifest.oauth.scope);
    expect(served.version).toBe(manifest.version);
    expect(served.actions).toEqual(manifest.actions);
  });
});
