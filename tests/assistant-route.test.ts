import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assistantRateLimit,
  assistantSessionHash,
  clientConstructor,
  consumeEventHash,
  createOfficeAssistantProof,
  getConfig,
  issueAssistantSession,
  proof,
  validateEmailGoal,
  requireVendorAccount,
  verifyAssistantSession,
  getStaff,
  isJobDiaryCoverageVerified,
} = vi.hoisted(() => {
  const proof = { searchJobs: vi.fn(), answerWhatHappened: vi.fn(), draftEmail: vi.fn(), adviseJob: vi.fn() };
  const validateEmailGoal = vi.fn((purpose: string) => purpose);
  return {
    assistantRateLimit: vi.fn((_: unknown, action: "request" | "search" | "summary" | "draft") => ({
      hashes: Array.from(
        { length: action === "request" ? 20 : action === "search" ? 10 : 5 },
        (_, index) => `${action}-slot-${index}`,
      ),
      expiresAt: new Date("2030-01-01T00:02:00Z"),
      retryAfterSeconds: 37,
    })),
    assistantSessionHash: vi.fn((token: string) => `session-${token}`),
    clientConstructor: vi.fn(),
    consumeEventHash: vi.fn(async (hash: string, expiresAt: Date) => hash.length > 0 && expiresAt.getTime() > 0),
    createOfficeAssistantProof: vi.fn(() => proof),
    getConfig: vi.fn(() => ({
      appBaseUrl: new URL("https://office.example.test"),
      sessionSigningSecret: "session-secret-with-at-least-thirty-two-bytes",
      assistantProof: { enabled: true, apiKey: "test-key", model: "gpt-test" },
    })),
    issueAssistantSession: vi.fn(async () => "next-session-token"),
    proof,
    validateEmailGoal,
    requireVendorAccount: vi.fn(async () => undefined),
    getStaff: vi.fn(async (staffUUID: string) => ({ first: staffUUID ? "May" : "" })),
    isJobDiaryCoverageVerified: vi.fn(() => true),
    verifyAssistantSession: vi.fn(async () => ({
      accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
      staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
    })),
  };
});

vi.mock("@/lib/config", () => ({ getConfig }));
vi.mock("@/lib/security/assistant-session", () => ({
  assistantRateLimit,
  assistantSessionHash,
  issueAssistantSession,
  verifyAssistantSession,
}));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash }));
vi.mock("@/lib/servicem8/job-diary-gate", () => ({
  isJobDiaryCoverageVerified,
  jobDiaryGateMessage: "No Job summary, email draft, or recommendation was generated",
}));
vi.mock("@/lib/security/safe-log", () => ({
  correlationId: () => "request-id",
  redactIdentifier: () => "redacted",
  safeLog: vi.fn(),
}));
vi.mock("@/lib/servicem8/client", () => ({
  ServiceM8ApiError: class ServiceM8ApiError extends Error {},
  ServiceM8Client: class ServiceM8Client {
    constructor(...args: unknown[]) { clientConstructor(...args); }
    getStaff(staffUUID: string) { return getStaff(staffUUID); }
  },
  requireVendorAccount,
}));
vi.mock("@/lib/servicem8/proof-reader", () => ({
  ServiceM8ProofReader: class ServiceM8ProofReader {},
}));
vi.mock("@/lib/servicem8/office-assistant-proof", () => ({
  emailRecipients: ["customer", "builder", "supplier", "internal"],
  emailRevisions: ["shorter", "warmer", "more-formal"],
  createOfficeAssistantProof,
  ProofGoalClarificationError: class ProofGoalClarificationError extends Error {},
  ProofEmailSuggestionError: class ProofEmailSuggestionError extends Error {},
  ProofJobAdviceError: class ProofJobAdviceError extends Error {},
  validateEmailGoal,
  ProofResolutionError: class ProofResolutionError extends Error {},
  ProofSearchTooBroadError: class ProofSearchTooBroadError extends Error {},
}));
vi.mock("@/lib/openai/proof-summarizer", () => ({
  OpenAIProofError: class OpenAIProofError extends Error {},
  createOpenAIProofSummarizer: () => ({ summarize: vi.fn() }),
}));
vi.mock("@/lib/openai/job-advisor", () => ({
  OpenAIJobAdviceError: class OpenAIJobAdviceError extends Error {},
  createOpenAIJobAdvisor: () => ({ advise: vi.fn() }),
}));

import { OPTIONS, POST } from "@/app/assistant/route";
import { ProofEmailSuggestionError, ProofGoalClarificationError, ProofResolutionError, ProofSearchTooBroadError } from "@/lib/servicem8/office-assistant-proof";

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
    isJobDiaryCoverageVerified.mockReturnValue(true);
  });

  it.each([
    { jobNumber: "R260766" },
    { jobNumber: "R260766", emailPurpose: "Ask for a site measure update", emailRecipient: "customer" },
    { jobNumber: "R260766", jobAdvice: "recommend" },
    { session: "valid-session", message: "What should we do next for R260766?" },
  ])("withholds Job output while Diary coverage is unverified: %j", async (fields) => {
    isJobDiaryCoverageVerified.mockReturnValue(false);
    const formFields: Record<string, string> = { session: "valid-session" };
    Object.assign(formFields, fields);
    const response = await POST(request(formFields));
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("Job Diary coverage incomplete");
    expect(body).toContain("No Job summary, email draft, or recommendation was generated");
    expect(createOfficeAssistantProof).not.toHaveBeenCalled();
  });

  it("withholds an auto-selected search result when Diary coverage is unverified", async () => {
    isJobDiaryCoverageVerified.mockReturnValue(false);
    proof.searchJobs.mockResolvedValueOnce([{ jobNumber: "R260766", address: "Test address", status: "Work Order" }]);
    const response = await POST(request({ session: "valid-session", query: "Test address" }));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Job Diary coverage incomplete");
    expect(proof.answerWhatHappened).not.toHaveBeenCalled();
  });

  it("rejects an invalid session before ServiceM8 access", async () => {
    verifyAssistantSession.mockRejectedValueOnce(new Error("Assistant session is invalid"));
    const response = await POST(request({ session: "invalid", query: "R260766" }));
    expect(response.status).toBe(401);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("rejects replay of an otherwise valid assistant form", async () => {
    consumeEventHash.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const response = await POST(request({ session: "used-session", query: "R260766" }));
    expect(response.status).toBe(409);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("rate limits guidance requests before rotating a session", async () => {
    consumeEventHash.mockImplementation(async (hash: string) => !hash.startsWith("request-slot-"));

    const response = await POST(request({
      session: "valid-session",
      message: "Help me with R260766",
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    expect(issueAssistantSession).not.toHaveBeenCalled();
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("limits concurrent guidance requests without ServiceM8 access", async () => {
    const consumed = new Set<string>();
    consumeEventHash.mockImplementation(async (hash: string) => {
      if (consumed.has(hash)) return false;
      consumed.add(hash);
      return true;
    });

    const responses = await Promise.all(Array.from({ length: 21 }, (_, index) => POST(request({
      session: `guidance-session-${index}`,
      message: "Help me with R260766",
    }))));

    expect(responses.map((response) => response.status).sort()).toEqual([
      ...Array.from({ length: 20 }, () => 200),
      429,
    ]);
    expect(issueAssistantSession).toHaveBeenCalledTimes(20);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("throttles replay flooding of one used session", async () => {
    const consumed = new Set<string>();
    consumeEventHash.mockImplementation(async (hash: string) => {
      if (consumed.has(hash)) return false;
      consumed.add(hash);
      return true;
    });

    const responses = await Promise.all(Array.from({ length: 21 }, () => POST(request({
      session: "replayed-guidance-session",
      message: "Help me with R260766",
    }))));

    expect(responses.map((response) => response.status).sort()).toEqual([
      200,
      ...Array.from({ length: 19 }, () => 409),
      429,
    ]);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("rate limits repeated expensive proof work before ServiceM8 access", async () => {
    consumeEventHash
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    const response = await POST(request({ session: "valid-session", jobNumber: "R260766" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(issueAssistantSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
        staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
      }),
      "session-secret-with-at-least-thirty-two-bytes",
      expect.any(Date),
      undefined,
    );
    const body = await response.text();
    expect(body).toContain("Wait 37 seconds and try again");
    expect(body).toContain('name="session" value="next-session-token"');
    expect(body).not.toContain("Reopen it from ServiceM8");
  });

  it("allows five concurrent summaries and rate limits the sixth", async () => {
    const consumed = new Set<string>();
    consumeEventHash.mockImplementation(async (hash: string) => {
      if (consumed.has(hash)) return false;
      consumed.add(hash);
      return true;
    });
    proof.answerWhatHappened.mockResolvedValue({
      job: { jobNumber: "R260766", address: "10 Queen Street", status: "Work Order", customerName: "Example" },
      summary: { text: "The site measure was completed.", citations: ["note:1"] },
      timeline: [],
      coverage: {
        included: ["core Job/customer fields", "Job diary notes"],
        excluded: ["email", "SMS", "forms", "attachments", "schedule activity"],
        noteCount: 1,
        truncated: false,
        snapshotAt: "2026-10-13T00:00:00.000Z",
      },
    });

    const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => POST(request({
      session: `valid-session-${index}`,
      jobNumber: "R260766",
    }))));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 200, 200, 429]);
    expect(proof.answerWhatHappened).toHaveBeenCalledTimes(5);
    expect(clientConstructor).toHaveBeenCalledTimes(5);
  });

  it("allows ten concurrent searches and rate limits the eleventh independently", async () => {
    const consumed = new Set<string>();
    consumeEventHash.mockImplementation(async (hash: string) => {
      if (consumed.has(hash)) return false;
      consumed.add(hash);
      return true;
    });
    proof.searchJobs.mockResolvedValue([
      { jobNumber: "R260766", address: "10 Queen Street", status: "Quote" },
      { jobNumber: "R260680", address: "10 Queen Road", status: "Work Order" },
    ]);

    const responses = await Promise.all(Array.from({ length: 11 }, (_, index) => POST(request({
      session: `search-session-${index}`,
      query: "10 Queen",
    }))));

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 429,
    ]);
    expect(proof.searchJobs).toHaveBeenCalledTimes(10);
    expect(proof.answerWhatHappened).not.toHaveBeenCalled();
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

  it("answers a natural-language What happened message for one exact Job number", async () => {
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

    const response = await POST(request({
      session: "valid-session",
      message: "What happened to R260766?",
    }));

    expect(response.status).toBe(200);
    expect(proof.answerWhatHappened).toHaveBeenCalledWith("R260766");
    const body = await response.text();
    expect(body).toContain("What happened to R260766?");
    expect(body).toContain("The site measure was completed.");
    expect(body).toContain('name="message"');
  });

  it("keeps an unknown Job inside the conversation without exposing Job evidence", async () => {
    proof.answerWhatHappened.mockRejectedValueOnce(new ProofResolutionError());
    const response = await POST(request({ session: "valid-session", message: "What happened to R000000?" }));
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("R000000");
    expect(body).toContain("couldn’t find");
    expect(body).toContain('name="message"');
    expect(body).toContain('name="session" value="next-session-token"');
    expect(body).not.toContain("selected Job could not be resolved uniquely");
    expect(proof.draftEmail).not.toHaveBeenCalled();
  });

  it("starts a fresh, staff-bound conversation without reading a Job", async () => {
    const response = await POST(request({ session: "valid-session", restart: "1" }));
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("what can I help with?");
    expect(body).toContain('name="session" value="next-session-token"');
    expect(clientConstructor).toHaveBeenCalledOnce();
    expect(requireVendorAccount).toHaveBeenCalledOnce();
    expect(getStaff).toHaveBeenCalledWith("9d914a06-221e-4013-8b4d-2735272710eb");
    expect(body).toContain("Hi, May—what can I help with?");
    expect(issueAssistantSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
        staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
      }),
      "session-secret-with-at-least-thirty-two-bytes",
      expect.any(Date),
      undefined,
    );
  });

  it("allows a credential-free ServiceM8 iframe to read its signed POST response", async () => {
    const response = await POST(new Request("https://office.example.test/assistant", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://app.servicem8.com" },
      body: new URLSearchParams({ session: "valid-session", message: "Help me with R260766" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toContain('name="message"');
  });

  it("permits only form POST preflight without allowing browser credentials", () => {
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("uses the selected Job notes for an explicit conversational email request", async () => {
    proof.adviseJob.mockResolvedValueOnce({
      job: { jobNumber: "R260766", address: "10 Queen Street", customerName: "Example" },
      recommendation: { nextAction: "Confirm the current measure position.", suggestedContact: "internal",
        source: { id: "note:1", at: "2026-10-13T00:00:00.000Z", text: "Site measure postponed." }, quote: "Site measure postponed." },
      draft: { subject: "10 Queen Street (R260766) – Job follow-up", body: "Could you please confirm the current measure position?", citations: ["job:record", "note:1"] },
      coverage: { included: ["core Job/customer fields", "Job diary notes"], excluded: ["email"], noteCount: 1, truncated: false, snapshotAt: "2026-10-13T00:00:00.000Z" },
    });
    const response = await POST(request({
      session: "valid-session",
      message: "Draft me an email for R260766",
    }));

    expect(response.status).toBe(200);
    expect(proof.adviseJob).toHaveBeenCalledWith("R260766", "Draft me an email for R260766", true);
    expect(proof.draftEmail).not.toHaveBeenCalled();
    const body = await response.text();
    expect(body).toContain("Review-only email draft");
    expect(body).toContain("Site measure postponed.");
    expect(body).not.toContain('name="emailRecipient"');
  });

  it("returns a next-step recommendation without an email when staff ask what next", async () => {
    proof.adviseJob.mockResolvedValueOnce({
      job: { jobNumber: "R260766", address: "10 Queen Street", customerName: "Example" },
      recommendation: { nextAction: "Confirm the current measure position.", suggestedContact: "internal",
        source: { id: "note:1", at: "2026-10-13T00:00:00.000Z", text: "Site measure postponed." }, quote: "Site measure postponed." },
      draft: null,
      coverage: { included: ["core Job/customer fields", "Job diary notes"], excluded: ["email", "SMS"], noteCount: 1, truncated: false, snapshotAt: "2026-10-13T00:00:00.000Z" },
    });
    const response = await POST(request({ session: "valid-session", message: "What should we do next for R260766?" }));
    expect(response.status).toBe(200);
    expect(proof.adviseJob).toHaveBeenCalledWith("R260766", "What should we do next for R260766?", false);
    const body = await response.text();
    expect(body).toContain("Confirm the current measure position.");
    expect(body).toContain("Not checked: email, SMS");
    expect(body).not.toContain("Review-only email draft");
  });

  it("keeps the selected Job for a conversational follow-up without guessing a new Job", async () => {
    proof.adviseJob.mockResolvedValueOnce({
      job: { jobNumber: "R260766", address: "10 Queen Street", customerName: "Example" },
      recommendation: { nextAction: "Review the site measure record.", suggestedContact: "internal",
        source: { id: "note:1", at: "2026-10-13T00:00:00.000Z", text: "Site measure postponed." }, quote: "Site measure postponed." },
      draft: null,
      coverage: { included: ["Job diary notes"], excluded: ["email"], noteCount: 1, truncated: false, snapshotAt: "2026-10-13T00:00:00.000Z" },
    });
    const response = await POST(request({ session: "valid-session", contextJobNumber: "R260766", message: "What next?" }));
    expect(response.status).toBe(200);
    expect(proof.adviseJob).toHaveBeenCalledWith("R260766", "What next?", false);
    expect(await response.text()).toContain('name="contextJobNumber" value="R260766"');
  });

  it("rejects malformed selected Job context before ServiceM8 access", async () => {
    const response = await POST(request({ session: "valid-session", contextJobNumber: "../../R260766", message: "What next?" }));
    expect(response.status).toBe(400);
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(proof.adviseJob).not.toHaveBeenCalled();
  });

  it("does not read ServiceM8 for unsupported or autonomous requests", async () => {
    const response = await POST(request({
      session: "valid-session",
      message: "Send an email for R260766 now",
    }));

    expect(response.status).toBe(200);
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(proof.answerWhatHappened).not.toHaveBeenCalled();
    expect(proof.draftEmail).not.toHaveBeenCalled();
    const body = await response.text();
    expect(body).toContain("Ask what happened, what to do next, or for an email draft for one Job.");
    expect(body).toContain('name="message"');
    expect(body).not.toContain('name="query"');
    expect(body).not.toContain("Send email");
  });

  it("does not turn an ambiguous message request into an email", async () => {
    const response = await POST(request({ session: "valid-session", message: "Write a message for R260766" }));
    expect(response.status).toBe(200);
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(proof.adviseJob).not.toHaveBeenCalled();
    expect(await response.text()).toContain("Ask what happened, what to do next, or for an email draft");
  });

  it("treats a request to summarize in an email as one email task", async () => {
    proof.adviseJob.mockResolvedValueOnce({
      job: { jobNumber: "R260766", address: "10 Queen Street", customerName: "Example" },
      recommendation: { nextAction: "Check whether the cited Job note still needs a follow-up with the customer.", suggestedContact: "customer",
        source: { id: "note:1", at: null, text: "Site measure postponed." }, quote: "Site measure postponed." },
      draft: { subject: "Job R260766", body: "Could you please confirm the current position for Job R260766?", citations: ["job:record", "note:1"] },
      coverage: { included: ["Job diary notes"], excluded: ["email"], noteCount: 1, truncated: false, snapshotAt: "2026-10-13T00:00:00.000Z" },
    });
    const message = "Draft an email summarizing what happened to R260766";
    const response = await POST(request({ session: "valid-session", message }));
    expect(response.status).toBe(200);
    expect(proof.adviseJob).toHaveBeenCalledWith("R260766", message, true);
  });

  it("does not read ServiceM8 when a conversation names more than one Job", async () => {
    const response = await POST(request({
      session: "valid-session",
      message: "What happened between R260766 and R260680?",
    }));

    expect(response.status).toBe(200);
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(proof.answerWhatHappened).not.toHaveBeenCalled();
    expect(proof.draftEmail).not.toHaveBeenCalled();
    expect(await response.text()).toContain("Include one exact Job number");
  });

  it("does not read ServiceM8 when a conversation requests both supported intents", async () => {
    const response = await POST(request({
      session: "valid-session",
      message: "What happened to R260766 and draft an email",
    }));

    expect(response.status).toBe(200);
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(proof.answerWhatHappened).not.toHaveBeenCalled();
    expect(proof.draftEmail).not.toHaveBeenCalled();
    expect(await response.text()).toContain("Ask for one task at a time");
  });

  it("returns a review-only email draft for one selected Job and purpose", async () => {
    proof.draftEmail.mockResolvedValueOnce({
      job: { jobNumber: "R260766", address: "10 Queen Street", customerName: "Example" },
      purpose: "Follow up on the site measure",
      draft: {
        subject: "Site measure follow-up",
        body: "Hi Example,\n\nThe site measure has been completed.",
        citations: ["company:record", "note:1"],
      },
      coverage: {
        included: ["core Job/customer fields", "Job diary notes"],
        excluded: ["email", "SMS", "forms", "attachments", "schedule activity"],
        noteCount: 1,
        truncated: false,
        snapshotAt: "2026-10-13T00:00:00.000Z",
      },
    });

    const response = await POST(request({
      session: "valid-session",
      jobNumber: "R260766",
      emailPurpose: "Follow up on the site measure",
      emailRecipient: "customer",
    }));

    expect(response.status).toBe(200);
    expect(proof.draftEmail).toHaveBeenCalledWith("R260766", "Follow up on the site measure", "customer", undefined);
    expect(proof.answerWhatHappened).not.toHaveBeenCalled();
    const body = await response.text();
    expect(body).toContain("Site measure follow-up");
    expect(body).toContain("nothing was sent");
    expect(body).not.toContain("Send email");
  });

  it("requires a supported recipient before reading a Job for a draft", async () => {
    for (const emailRecipient of [undefined, "unknown"]) {
      const response = await POST(request({
        session: "valid-session",
        jobNumber: "R260766",
        emailPurpose: "Give the customer a progress update",
        ...(emailRecipient ? { emailRecipient } : {}),
      }));
      expect(response.status).toBe(400);
    }
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(proof.draftEmail).not.toHaveBeenCalled();
  });

  it("routes a supported revision while rejecting unknown styles before a Job read", async () => {
    proof.draftEmail.mockResolvedValueOnce({
      job: { jobNumber: "R260766", address: "10 Queen Street", customerName: "Example" },
      purpose: "Give the customer a progress update",
      recipient: "customer",
      draft: { subject: "10 Queen Street (R260766) – Progress update", body: "Hello,", citations: ["job:record"] },
      coverage: { included: ["core Job/customer fields"], excluded: ["email"], noteCount: 0, truncated: false, snapshotAt: "2026-10-13T00:00:00.000Z" },
    });
    const fields = { session: "valid-session", jobNumber: "R260766", emailPurpose: "Give the customer a progress update", emailRecipient: "customer" };
    expect((await POST(request({ ...fields, emailRevision: "shorter" }))).status).toBe(200);
    expect(proof.draftEmail).toHaveBeenCalledWith("R260766", fields.emailPurpose, "customer", "shorter");
    vi.clearAllMocks();
    expect((await POST(request({ ...fields, emailRevision: "unbounded" }))).status).toBe(400);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("asks for the exact customer question when the goal is too vague", async () => {
    validateEmailGoal.mockImplementationOnce(() => { throw new ProofGoalClarificationError(); });
    const response = await POST(request({
      session: "valid-session",
      jobNumber: "R260766",
      emailRecipient: "customer",
      emailPurpose: "Update the customer and ask about timing",
    }));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("What exact question should this email ask?");
    expect(body).toContain('name="jobNumber" value="R260766"');
    expect(body).toContain('name="session" value="next-session-token"');
    expect(body).not.toContain("Email draft —");
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(requireVendorAccount).not.toHaveBeenCalled();
    expect(proof.draftEmail).not.toHaveBeenCalled();
  });

  it("asks for a supported goal when checked Job evidence cannot support an update", async () => {
    proof.draftEmail.mockRejectedValueOnce(new ProofGoalClarificationError(
      "The checked Job records do not support a progress update. Please choose a question-only goal or verify the update in ServiceM8.",
    ));
    const response = await POST(request({
      session: "valid-session",
      jobNumber: "R260766",
      emailRecipient: "customer",
      emailPurpose: "Give the customer a progress update",
    }));

    expect(response.status).toBe(200);
    expect(proof.draftEmail).toHaveBeenCalledOnce();
    const body = await response.text();
    expect(body).toContain("checked Job records do not support a progress update");
    expect(body).toContain('name="jobNumber" value="R260766"');
    expect(body).not.toContain("Email draft —");
  });

  it("withholds an AI suggestion that fails the Job evidence check", async () => {
    proof.draftEmail.mockRejectedValueOnce(new ProofEmailSuggestionError("Email suggestion contains an unsupported claim"));
    const response = await POST(request({
      session: "valid-session",
      jobNumber: "R260766",
      emailRecipient: "customer",
      emailPurpose: "Give the customer a progress update",
    }));

    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toContain("could not be supported by the checked Job records");
    expect(body).toContain("Nothing was sent");
    expect(body).not.toContain("Email suggestion contains an unsupported claim");
  });
});
