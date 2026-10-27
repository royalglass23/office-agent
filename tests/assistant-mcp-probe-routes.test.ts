import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: vi.fn(), verify: vi.fn(), consume: vi.fn(), connection: vi.fn(), vendor: vi.fn(),
  client: vi.fn(), prepare: vi.fn(), enabled: vi.fn(), readState: vi.fn(), exchange: vi.fn(), probe: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ getConfig: mocks.config }));
vi.mock("@/lib/security/assistant-session", () => ({
  assistantRateLimit: () => ({ hashes: ["rate-slot"], expiresAt: new Date("2030-01-01") }),
  assistantSessionHash: () => "session-hash", verifyAssistantSession: mocks.verify,
}));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash: mocks.consume }));
vi.mock("@/lib/storage/oauth-connections", () => ({ getOAuthConnection: mocks.connection }));
vi.mock("@/lib/servicem8/client", () => ({ ServiceM8Client: mocks.client, requireVendorAccount: mocks.vendor }));
vi.mock("@/lib/servicem8/mcp-diary-probe", () => ({
  mcpProbeEnabled: mocks.enabled, prepareMcpProbe: mocks.prepare, readMcpProbeState: mocks.readState,
  exchangeMcpProbeCode: mocks.exchange, probeMcpDiary: mocks.probe,
}));

import { POST } from "@/app/assistant/mcp/start/route";
import { GET } from "@/app/assistant/mcp/callback/route";

const staging = "https://office-agent-staging.vercel.app";
const accountUUID = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";
const staffUUID = "9d914a06-221e-4013-8b4d-2735272710eb";
const jobUUID = "ae7e05bf-76f9-407e-bbb3-32e955c5d3d0";
const scopes = "vendor read_jobs read_customers read_job_notes read_staff read_email read_schedule read_attachments read_sms read_job_payments";

function start(jobNumber = "R260609", origin = staging) {
  return new Request(`${origin}/assistant/mcp/start`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ session: "signed-session", jobNumber }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockReturnValue({ appBaseUrl: new URL(staging), allowedAccountUUID: accountUUID,
    sessionSigningSecret: "secret", tokenEncryptionKey: "key", oauthScopes: scopes });
  mocks.enabled.mockReturnValue(true);
  mocks.verify.mockResolvedValue({ accountUUID, staffUUID, launchExpiresAt: 1_900_000_000 });
  mocks.consume.mockResolvedValue(true);
  mocks.connection.mockResolvedValue({ scopes });
  mocks.client.mockImplementation(function Client() {
    return {
      listJobsByNumber: vi.fn().mockResolvedValue([{ uuid: jobUUID, generated_job_id: "R260609" }]),
      getJob: vi.fn().mockResolvedValue({ uuid: jobUUID, generated_job_id: "R260609" }),
    };
  });
  mocks.prepare.mockReturnValue(new URL("https://go.servicem8.com/oauth/authorize?state=encrypted&client_id=staging-client"));
  mocks.readState.mockReturnValue({ accountUUID, staffUUID, jobUUID, jobNumber: "R260609", nonce: "nonce", expiresAt: Date.now() + 60_000 });
  mocks.exchange.mockResolvedValue("transient-token");
  mocks.probe.mockResolvedValue({ status: "inventory_only", staffBinding: "unverified", count: 18 });
});

describe("staging MCP Diary routes", () => {
  it("does not start on a different host or an unapproved Job", async () => {
    expect((await POST(start("R260609", "https://office-agent-ashy.vercel.app"))).status).toBe(404);
    expect((await POST(start("R260999"))).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("requires the original staff's REST access before opening MCP consent", async () => {
    mocks.connection.mockResolvedValueOnce({ scopes: "vendor read_jobs" });
    expect((await POST(start())).status).toBe(409);
    expect(mocks.prepare).not.toHaveBeenCalled();
    const response = await POST(start());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const html = await response.text();
    expect(html).toContain('href="https://go.servicem8.com/oauth/authorize?state=encrypted&amp;client_id=staging-client"');
    expect(html).toContain("Continue to ServiceM8");
    expect(html).not.toContain("signed-session");
    expect(mocks.client).toHaveBeenCalledWith(accountUUID, staffUUID);
    expect(mocks.prepare).toHaveBeenCalledWith(expect.objectContaining({ jobUUID, jobNumber: "R260609" }), expect.any(URL), "key");
  });

  it("rejects replayed launch sessions", async () => {
    mocks.consume.mockResolvedValueOnce(false);
    expect((await POST(start())).status).toBe(409);
    expect(mocks.connection).not.toHaveBeenCalled();
  });

  it("stops before MCP consent when the signed staff cannot read the requested Job", async () => {
    mocks.client.mockImplementationOnce(function Client() {
      return { listJobsByNumber: vi.fn().mockResolvedValue([]), getJob: vi.fn() };
    });
    expect((await POST(start())).status).toBe(403);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it("stops before MCP consent if the parent Job detail disagrees with the lookup", async () => {
    mocks.client.mockImplementationOnce(function Client() {
      return {
        listJobsByNumber: vi.fn().mockResolvedValue([{ uuid: jobUUID, generated_job_id: "R260609" }]),
        getJob: vi.fn().mockResolvedValue({ uuid: jobUUID, generated_job_id: "R260611" }),
      };
    });
    expect((await POST(start())).status).toBe(403);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it("consumes callback state once and returns only redacted metadata", async () => {
    const response = await GET(new Request(`${staging}/assistant/mcp/callback?code=code&state=encrypted`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ jobNumber: "R260609", status: "inventory_only", staffBinding: "unverified", count: 18 });
    expect(mocks.probe).toHaveBeenCalledWith("transient-token", jobUUID);
    mocks.consume.mockResolvedValueOnce(false);
    expect((await GET(new Request(`${staging}/assistant/mcp/callback?code=code&state=encrypted`))).status).toBe(409);
  });

  it("does not exchange a code after denied consent or a different account", async () => {
    expect((await GET(new Request(`${staging}/assistant/mcp/callback?error=access_denied`))).status).toBe(400);
    mocks.readState.mockReturnValueOnce({ accountUUID: "4e67f802-4107-49e1-ad62-a4fed36626a4" });
    expect((await GET(new Request(`${staging}/assistant/mcp/callback?code=code&state=encrypted`))).status).toBe(403);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});
