import { afterEach, describe, expect, it, vi } from "vitest";
import { renderConversationAssistant } from "@/lib/servicem8/render-context-html";

afterEach(() => vi.unstubAllEnvs());

describe("RG-380 MCP consent form", () => {
  it("shows the four approved Jobs only on configured staging", () => {
    vi.stubEnv("SERVICEM8_MCP_CLIENT_ID", "staging-client");
    const staging = renderConversationAssistant("May", new URL("https://office-agent-staging.vercel.app/assistant"), "signed-session-token");
    const production = renderConversationAssistant("May", new URL("https://office-agent-ashy.vercel.app/assistant"), "signed-session-token");
    expect(staging).toContain('action="https://office-agent-staging.vercel.app/assistant/mcp/start"');
    expect(staging).toContain('<option value="R260445">R260445</option>');
    expect(staging).toContain('data-audit="true" method="post" action="https://office-agent-staging.vercel.app/assistant/mcp/start"');
    expect(production).not.toContain("Check Diary read");
  });
});
