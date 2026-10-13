import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientConstructor,
  consumeEventHash,
  createOfficeAssistantProof,
  getConfig,
  issueAssistantSession,
  proof,
  requireVendorAccount,
  verifyAssistantSession,
} = vi.hoisted(() => {
  const proof = { searchJobs: vi.fn(), answerWhatHappened: vi.fn() };
  return {
    clientConstructor: vi.fn(),
    consumeEventHash: vi.fn(async () => true),
    createOfficeAssistantProof: vi.fn(() => proof),
    getConfig: vi.fn(() => ({
      appBaseUrl: new URL("https://office.example.test"),
      sessionSigningSecret: "session-secret-with-at-least-thirty-two-bytes",
      assistantProof: { enabled: true, apiKey: "test-key", model: "gpt-test" },
    })),
    issueAssistantSession: vi.fn(async () => "next-session-token"),
    proof,
    requireVendorAccount: vi.fn(async () => undefined),
    verifyAssistantSession: vi.fn(async () => ({
      accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
      staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
    })),
  };
});

vi.mock("@/lib/config", () => ({ getConfig }));
vi.mock("@/lib/security/assistant-session", () => ({
  assistantRateLimit: () => ({ hash: "b".repeat(64), expiresAt: new Date("2030-01-01T00:02:00Z") }),
  assistantSessionHash: () => "a".repeat(64),
  issueAssistantSession,
  verifyAssistantSession,
}));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash }));
vi.mock("@/lib/security/safe-log", () => ({
  correlationId: () => "request-id",
  redactIdentifier: () => "redacted",
  safeLog: vi.fn(),
}));
vi.mock("@/lib/servicem8/client", () => ({
  ServiceM8ApiError: class ServiceM8ApiError extends Error {},
  ServiceM8Client: class ServiceM8Client {
    constructor(...args: unknown[]) { clientConstructor(...args); }
  },
  requireVendorAccount,
}));
vi.mock("@/lib/servicem8/proof-reader", () => ({
  ServiceM8ProofReader: class ServiceM8ProofReader {},
}));
vi.mock("@/lib/servicem8/office-assistant-proof", () => ({
  createOfficeAssistantProof,
  ProofResolutionError: class ProofResolutionError extends Error {},
  ProofSearchTooBroadError: class ProofSearchTooBroadError extends Error {},
}));
vi.mock("@/lib/openai/proof-summarizer", () => ({
  OpenAIProofError: class OpenAIProofError extends Error {},
  createOpenAIProofSummarizer: () => ({ summarize: vi.fn() }),
}));

import { POST } from "@/app/assistant/route";
import { ProofSearchTooBroadError } from "@/lib/servicem8/office-assistant-proof";

function request(fields: Record<string, string>) {
  return new Request("https://office.example.test/assistant", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

describe("assistant proof route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeEventHash.mockResolvedValue(true);
  });

  it("rejects an invalid session before ServiceM8 access", async () => {
    verifyAssistantSession.mockRejectedValueOnce(new Error("Assistant session is invalid"));
    const response = await POST(request({ session: "invalid", query: "R260766" }));
    expect(response.status).toBe(401);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("rejects replay of an otherwise valid assistant form", async () => {
    consumeEventHash.mockResolvedValueOnce(false);
    const response = await POST(request({ session: "used-session", query: "R260766" }));
    expect(response.status).toBe(409);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("rate limits repeated expensive proof work before ServiceM8 access", async () => {
    consumeEventHash.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const response = await POST(request({ session: "valid-session", jobNumber: "R260766" }));
    expect(response.status).toBe(429);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("shows an explicit choice when more than one Job matches", async () => {
    proof.searchJobs.mockResolvedValueOnce([
      { jobNumber: "R260766", address: "10 Queen Street", status: "Quote" },
      { jobNumber: "R260680", address: "10 Queen Road", status: "Work Order" },
    ]);
    const response = await POST(request({ session: "valid-session", query: "10 Queen" }));
    expect(response.status).toBe(200);
    expect(clientConstructor).toHaveBeenCalledWith(
      "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
      "9d914a06-221e-4013-8b4d-2735272710eb",
    );
    expect(requireVendorAccount).toHaveBeenCalledOnce();
    expect(await response.text()).toContain("Choose the Job");
    expect(proof.answerWhatHappened).not.toHaveBeenCalled();
  });

  it("asks for a more specific reference when a search has too many matches", async () => {
    proof.searchJobs.mockRejectedValueOnce(new ProofSearchTooBroadError());
    const response = await POST(request({ session: "valid-session", query: "Auckland" }));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("More detail needed");
    expect(proof.answerWhatHappened).not.toHaveBeenCalled();
  });

  it("returns the bounded proof answer for one selected Job", async () => {
    proof.answerWhatHappened.mockResolvedValueOnce({
      job: { jobNumber: "R260766", address: "10 Queen Street", status: "Work Order", customerName: "Example" },
      summary: { text: "The site measure was completed.", citations: ["note:1"] },
      timeline: [{ at: "2026-09-02T10:30:00.000Z", text: "Site measure completed.", citations: ["note:1"] }],
      coverage: {
        included: ["core Job/customer fields", "Job diary notes"],
        excluded: ["email", "SMS", "forms", "attachments", "schedule activity"],
        noteCount: 1,
        truncated: false,
        snapshotAt: "2026-10-13T00:00:00.000Z",
      },
    });
    const response = await POST(request({ session: "valid-session", jobNumber: "R260766" }));
    expect(response.status).toBe(200);
    expect(proof.answerWhatHappened).toHaveBeenCalledWith("R260766");
    expect(await response.text()).toContain("The site measure was completed.");
    expect(issueAssistantSession).toHaveBeenCalled();
  });
});
