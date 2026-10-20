import { afterEach, describe, expect, it, vi } from "vitest";
import {
  exchangeMcpProbeCode, prepareMcpProbe, probeMcpDiary, readMcpProbeState,
} from "@/lib/servicem8/mcp-diary-probe";

const origin = new URL("https://office-agent-staging.vercel.app");
const key = Buffer.alloc(32, 7).toString("base64");
const identity = {
  accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
  staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
  jobUUID: "ae7e05bf-76f9-407e-bbb3-32e955c5d3d0",
  jobNumber: "R260609" as const,
};

afterEach(() => vi.unstubAllEnvs());

describe("one-time staging MCP Diary probe", () => {
  it("binds the PKCE challenge and encrypted state to one authorised Job", () => {
    vi.stubEnv("SERVICEM8_MCP_CLIENT_ID", "staging-client");
    const url = prepareMcpProbe(identity, origin, key, 1_800_000_000_000);
    expect(url.searchParams.get("scope")).toBe("mcp");
    expect(url.searchParams.get("resource")).toBe("https://api.servicem8.com/mcp");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = readMcpProbeState(url.searchParams.get("state")!, key, 1_800_000_001_000);
    expect(state).toMatchObject(identity);
    expect(state.verifier).toHaveLength(43);
    expect(() => readMcpProbeState(url.searchParams.get("state")!, key, 1_800_000_601_000)).toThrow();
    expect(url.toString()).not.toContain(identity.staffUUID);
    expect(url.toString()).not.toContain(state.verifier);
  });

  it("accepts the signed launch identity without carrying unrelated session fields into OAuth state", () => {
    vi.stubEnv("SERVICEM8_MCP_CLIENT_ID", "staging-client");
    const launchIdentity = { ...identity, launchExpiresAt: 1_900_000_000, launch: "global-menu" };
    const url = prepareMcpProbe(launchIdentity, origin, key, 1_800_000_000_000);
    const state = readMcpProbeState(url.searchParams.get("state")!, key, 1_800_000_001_000);
    expect(state).toMatchObject(identity);
    expect(state).not.toHaveProperty("launchExpiresAt");
    expect(state).not.toHaveProperty("launch");
  });

  it("is disabled outside the exact staging host", () => {
    vi.stubEnv("SERVICEM8_MCP_CLIENT_ID", "staging-client");
    expect(() => prepareMcpProbe(identity, new URL("https://office-agent-ashy.vercel.app"), key)).toThrow();
  });

  it("exchanges only the intended MCP grant with its PKCE verifier", async () => {
    vi.stubEnv("SERVICEM8_MCP_CLIENT_ID", "staging-client");
    const state = readMcpProbeState(prepareMcpProbe(identity, origin, key).searchParams.get("state")!, key);
    const fetcher = vi.fn(async (_url, init) => {
      const body = init.body as URLSearchParams;
      expect(body.get("code_verifier")).toBe(state.verifier);
      expect(body.get("resource")).toBe("https://api.servicem8.com/mcp");
      expect(body.has("client_secret")).toBe(false);
      return Response.json({ access_token: "one-time-token", token_type: "Bearer", scope: "mcp" });
    }) as unknown as typeof fetch;
    expect(await exchangeMcpProbeCode("code", state, origin, fetcher)).toBe("one-time-token");
  });

  it("calls only the Diary read tool and returns redacted inventory", async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const message = JSON.parse(init.body as string);
      if (message.method === "initialize") return Response.json({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } });
      if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
      if (message.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "get_job_diary" }, { name: "update_job" }] } });
      expect(message).toMatchObject({ method: "tools/call", params: { name: "get_job_diary", arguments: { job_uuid: identity.jobUUID } } });
      return Response.json({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: JSON.stringify({
        job_uuid: identity.jobUUID,
        entries: [{ timestamp: "2026-09-08 13:28:33", object_type: "Service", content_preview: "Private customer message" }],
      }) }] } });
    }) as unknown as typeof fetch;
    const result = await probeMcpDiary("one-time-token", identity.jobUUID, fetcher);
    expect(result).toMatchObject({ status: "inventory_only", count: 1, staffBinding: "unverified", fullContent: "unverified" });
    expect(JSON.stringify(result)).not.toContain("Private customer message");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("fails closed if the Diary tool is missing", async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const message = JSON.parse(init.body as string);
      if (message.method === "initialize") return Response.json({ jsonrpc: "2.0", id: 1, result: {} });
      if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
      return Response.json({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "update_job" }] } });
    }) as unknown as typeof fetch;
    expect(await probeMcpDiary("one-time-token", identity.jobUUID, fetcher)).toMatchObject({ status: "diary_tool_unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
