import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfig, resetConfigForTests } from "@/lib/config";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: "test",
    APP_BASE_URL: "https://office.example.test",
    SERVICEM8_APP_ID: "app-id",
    SERVICEM8_APP_SECRET: "app-secret-with-enough-length",
    SERVICEM8_OAUTH_REDIRECT_URI: "https://office.example.test/api/servicem8/oauth/callback",
    SERVICEM8_OAUTH_SCOPES: "vendor read_jobs read_customers read_job_notes read_staff",
    SERVICEM8_ALLOWED_ACCOUNT_UUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
    DATABASE_URL: "postgres://unused",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    SESSION_SIGNING_SECRET: "session-secret-with-at-least-thirty-two-bytes",
  };
  delete process.env.ASSISTANT_PROOF_ENABLED;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_DATA_CONTROLS_VERIFIED;
  resetConfigForTests();
});

afterEach(() => {
  process.env = originalEnv;
  resetConfigForTests();
});

describe("bounded assistant proof configuration", () => {
  it("requires one explicit allowed ServiceM8 account", () => {
    expect(getConfig().allowedAccountUUID).toBe("5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b");
    resetConfigForTests();
    delete process.env.SERVICEM8_ALLOWED_ACCOUNT_UUID;
    expect(() => getConfig()).toThrow("SERVICEM8_ALLOWED_ACCOUNT_UUID");
  });

  it("stays disabled without OpenAI credentials", () => {
    expect(getConfig().assistantProof).toEqual({ enabled: false });
  });

  it("fails closed when proof enablement lacks the provider data-control acknowledgement", () => {
    process.env.ASSISTANT_PROOF_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-test";
    expect(() => getConfig()).toThrow("OPENAI_DATA_CONTROLS_VERIFIED");
  });

  it("enables only with an explicit model, key, and data-control acknowledgement", () => {
    process.env.ASSISTANT_PROOF_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-test";
    process.env.OPENAI_DATA_CONTROLS_VERIFIED = "true";
    expect(getConfig().assistantProof).toEqual({
      enabled: true,
      apiKey: "test-key",
      model: "gpt-test",
    });
  });
});
