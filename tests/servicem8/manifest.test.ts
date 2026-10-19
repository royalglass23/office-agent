import { beforeEach, describe, expect, it } from "vitest";
import manifest from "@/manifest.json";
import stagingManifest from "@/manifest-staging.json";
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
    SERVICEM8_OAUTH_SCOPES: "vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments",
    SERVICEM8_ALLOWED_ACCOUNT_UUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
    DATABASE_URL: "postgres://unused",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    SESSION_SIGNING_SECRET: "session-secret-with-at-least-thirty-two-bytes",
  };
  resetConfigForTests();
});

describe("ServiceM8 add-on manifest", () => {
  it("keeps the uploaded and served manifests aligned with a global web menu entry", async () => {
    const served = await GET().json();
    expect(manifest.oauth.scope).toBe("vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments");
    expect(served.oauth.scope).toBe(manifest.oauth.scope);
    expect(served.version).toBe(manifest.version);
    expect(manifest.actions).toEqual([]);
    expect(served.actions).toEqual([]);
    expect(manifest.menuItems).toEqual([
      {
        name: "RG Office Assistant",
        type: "addon",
        iconURL: "https://office-agent-ashy.vercel.app/icon.png",
        event: "rg_office_assistant_menu",
      },
    ]);
    expect(served.menuItems).toEqual(manifest.menuItems);
  });

  it("labels the staging deployment distinctly while keeping the same bounded capabilities", async () => {
    process.env.APP_BASE_URL = "https://office-agent-staging.vercel.app";
    process.env.SERVICEM8_OAUTH_REDIRECT_URI = "https://office-agent-staging.vercel.app/api/servicem8/oauth/callback";
    resetConfigForTests();

    const served = await GET().json();
    expect(stagingManifest.oauth.scope).toBe(manifest.oauth.scope);
    expect(stagingManifest.version).toBe(manifest.version);
    expect(served).toMatchObject({
      name: "RG Office Assistant Staging",
      version: "0.2.1",
      oauth: { scope: "vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments" },
      actions: [],
      menuItems: [{ name: "RG Office Assistant Staging", event: "rg_office_assistant_menu" }],
    });
  });
});
