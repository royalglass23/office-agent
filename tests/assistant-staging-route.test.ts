import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const accountUUID = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";
  const staffUUID = "9d914a06-221e-4013-8b4d-2735272710eb";
  const jobUUID = "0686ce69-4a5d-4f73-ad56-827ffaaced2b";
  return {
    accountUUID, staffUUID, jobUUID,
    getConfig: vi.fn(() => ({ stagingJobSliceEnabled: true,
      assistantProof: { enabled: true, apiKey: "test-key", model: "test-model" },
      appBaseUrl: new URL("https://office-agent-staging.vercel.app"),
      sessionSigningSecret: "a-secret-with-at-least-thirty-two-bytes", allowedAccountUUID: accountUUID })),
    verifyAssistantSession: vi.fn(async () => ({ accountUUID, staffUUID, launchExpiresAt: Math.floor(Date.now() / 1000) + 300 })),
    consumeEventHash: vi.fn(async () => true),
    requireVendorAccount: vi.fn(async () => undefined),
    listJobsByNumber: vi.fn(async () => [{ uuid: jobUUID, jobNumber: "R260609" }]),
    getJob: vi.fn(async () => ({ uuid: jobUUID, jobNumber: "R260609", status: "Quote", address: "Example address" })),
    readRestJobContext: vi.fn(async () => ({ jobUUID, jobNumber: "R260609", sources: {
      email: { status: "complete", pages: 1, events: [{ source: "email", sourceId: "source", active: true, contentState: "full", timestamp: "2026-10-01 12:00:00", direction: "outbound" }] },
      sms: { status: "complete", pages: 1, events: [] }, notes: { status: "complete", pages: 1, events: [] },
      activities: { status: "complete", pages: 1, events: [] }, attachments: { status: "complete", pages: 1, events: [] },
      payments: { status: "complete", pages: 1, events: [] },
    }, diaryCoverage: "unverified" })),
    buildUnifiedJobContext: vi.fn(() => ({ jobUUID, jobNumber: "R260609" })),
    answerUnifiedJobQuestion: vi.fn(async () => ({ answer: "Latest verified email was recorded.", subject: "", body: "",
      citations: ["email:source"], anchors: [{ id: "email:source", quote: "Recorded email quote" }], gaps: [] })),
  };
});

vi.mock("@/lib/config", () => ({ getConfig: fixture.getConfig }));
vi.mock("@/lib/security/assistant-session", () => ({
  assistantRateLimit: () => ({ hashes: ["rate-slot"], expiresAt: new Date(Date.now() + 60_000) }),
  assistantSessionHash: () => "session-hash", issueAssistantSession: async () => "next-session",
  verifyAssistantSession: fixture.verifyAssistantSession,
}));
vi.mock("@/lib/security/safe-log", () => ({ correlationId: () => "request-id", safeLog: vi.fn() }));
vi.mock("@/lib/storage/consumed-events", () => ({ consumeEventHash: fixture.consumeEventHash }));
vi.mock("@/lib/servicem8/client", () => ({ ServiceM8Client: class ServiceM8Client {}, requireVendorAccount: fixture.requireVendorAccount }));
vi.mock("@/lib/servicem8/proof-reader", () => ({ ServiceM8ProofReader: class ServiceM8ProofReader {
  listJobsByNumber = fixture.listJobsByNumber;
  getJob = fixture.getJob;
} }));
vi.mock("@/lib/servicem8/rest-job-context", () => ({ readRestJobContext: fixture.readRestJobContext }));
vi.mock("@/lib/servicem8/unified-job-context", () => ({ buildUnifiedJobContext: fixture.buildUnifiedJobContext }));
vi.mock("@/lib/servicem8/unified-job-agent", () => ({ answerUnifiedJobQuestion: fixture.answerUnifiedJobQuestion }));

import { POST } from "@/app/assistant/staging/route";

function request(action: string, jobNumber = "R260609") {
  return new Request("https://office-agent-staging.vercel.app/assistant/staging", { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ session: "signed-session", jobNumber, action }),
  });
}

describe("staging Job slice", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("denies a foreign account before any Job read", async () => {
    fixture.verifyAssistantSession.mockResolvedValueOnce({ accountUUID: "123e4567-cb72-4d94-8a1e-d454131257eb",
      staffUUID: fixture.staffUUID, launchExpiresAt: Math.floor(Date.now() / 1000) + 300 });
    expect((await POST(request("view"))).status).toBe(401);
    expect(fixture.listJobsByNumber).not.toHaveBeenCalled();
  });

  it("rejects duplicate fields and replay before Job reads", async () => {
    const duplicate = request("view");
    const body = await duplicate.text();
    const invalid = new Request(duplicate.url, { method: "POST", headers: duplicate.headers,
      body: `${body}&jobNumber=R260611` });
    expect((await POST(invalid)).status).toBe(400);
    fixture.consumeEventHash.mockResolvedValueOnce(false);
    expect((await POST(request("view"))).status).toBe(409);
    expect(fixture.listJobsByNumber).not.toHaveBeenCalled();
  });

  it("checks exact parent before child reads and returns an escaped current Job", async () => {
    fixture.getJob.mockResolvedValueOnce({ uuid: fixture.jobUUID, jobNumber: "R260609", status: "<Open>", address: "Example" });
    const response = await POST(request("view"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("&lt;Open&gt;");
    expect(fixture.requireVendorAccount).toHaveBeenCalledWith(expect.anything(), fixture.accountUUID);
    expect(fixture.readRestJobContext).not.toHaveBeenCalled();
    const html = await POST(request("view")).then((result) => result.text());
    expect(html).toContain("Choose a bounded check");
    expect(html).toContain("Limited history");
    expect(html).toContain("Reading available messages and notes…");
    expect(html).toContain('role="status" aria-live="polite" hidden');
    expect(html).toContain("Finding the Job…");
  });

  it.each([
    ["latest", "What is the latest recorded customer-facing Email or SMS"],
    ["check", "what is one proposed next office check"],
    ["draft", "Prepare a concise follow-up email"],
  ])("runs the limited %s check with its own question", async (action, questionText) => {
    if (action === "draft") fixture.answerUnifiedJobQuestion.mockResolvedValueOnce({ answer: "", subject: "Checking in", body: "Can you confirm?",
      citations: ["email:source"], anchors: [{ id: "email:source", quote: "Recorded email quote" }], gaps: [] });
    const response = await POST(request(action));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Limited history");
    expect(fixture.answerUnifiedJobQuestion).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ text: expect.stringContaining(questionText) }), expect.anything(),
    );
  });

  it("withholds an answer if an active communication has no full body", async () => {
    const context = await fixture.readRestJobContext();
    context.diaryCoverage = "verified";
    context.sources.email.events[0].contentState = "unavailable";
    fixture.readRestJobContext.mockResolvedValueOnce(context);
    const response = await POST(request("latest"));
    expect(response.status).toBe(503);
    expect(fixture.answerUnifiedJobQuestion).not.toHaveBeenCalled();
  });

  it("returns a natural answer while keeping source validation behind the UI", async () => {
    const context = await fixture.readRestJobContext();
    context.diaryCoverage = "verified";
    fixture.readRestJobContext.mockResolvedValueOnce(context);
    const response = await POST(request("latest"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Latest verified email");
    expect(html).toContain("Check the full ServiceM8 Diary before acting");
    expect(html).not.toContain("Recorded email quote");
    expect(html).not.toContain("Evidence quotes");
    expect(html).not.toContain("Source coverage");
    expect(html).not.toContain("email:source");
    expect(fixture.buildUnifiedJobContext).toHaveBeenCalledWith(expect.anything(), []);
    expect(fixture.answerUnifiedJobQuestion).toHaveBeenCalledOnce();
  });

  it("requires the latest message and inbound reply citations", async () => {
    const context = await fixture.readRestJobContext();
    context.diaryCoverage = "verified";
    context.sources.email.events.push({ source: "email", sourceId: "reply", active: true,
      contentState: "full", timestamp: "2026-10-02 12:00:00", direction: "inbound" });
    fixture.readRestJobContext.mockResolvedValueOnce(context);
    expect((await POST(request("latest"))).status).toBe(503);
    fixture.readRestJobContext.mockResolvedValueOnce(context);
    fixture.answerUnifiedJobQuestion.mockResolvedValueOnce({ answer: "Reply", subject: "", body: "",
      citations: ["email:source", "email:reply"], anchors: [], gaps: [] });
    expect((await POST(request("latest"))).status).toBe(200);
  });

  it("shows an editable draft without technical source panels", async () => {
    const context = await fixture.readRestJobContext();
    context.diaryCoverage = "verified";
    fixture.readRestJobContext.mockResolvedValueOnce(context);
    fixture.answerUnifiedJobQuestion.mockResolvedValueOnce({ answer: "", subject: "Checking in", body: "Can you confirm?",
      citations: ["email:source"], anchors: [{ id: "email:source", quote: "Recorded email quote" }], gaps: [] });
    const response = await POST(request("draft"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('value="Checking in"');
    expect(html).toContain("<textarea id=\"body\" rows=\"10\">Can you confirm?</textarea>");
    expect(html).toContain("Nothing is sent or saved to ServiceM8");
    expect(html).not.toContain("Recorded email quote");
    expect(html).not.toContain("Source coverage");
  });
});
