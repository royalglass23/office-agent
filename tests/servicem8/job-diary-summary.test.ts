import { describe, expect, it, vi } from "vitest";
import {
  createJobDiarySummaryModule,
  type AuthorizedJobLaunch,
  type DiaryEntry,
  type DiaryPage,
  type DiaryReader,
  type DiarySourceName,
  type JobDiarySummary,
} from "@/lib/servicem8/job-diary-summary";

const syntheticLaunch = {} as AuthorizedJobLaunch;
const emptySummary: Omit<JobDiarySummary, "coverage"> = {
  headline: { text: "Synthetic job update", citations: ["notes:n1"] },
  overview: { text: "Quote approved; installation date is pending.", citations: ["notes:n1", "notes:n2"] },
  currentState: [],
  decisions: [],
  outstandingActions: [],
  risksAndQuestions: [],
  timeline: [],
};

describe("summarizeJobDiary", () => {
  it("stops before reading diary entries or summarizing when the parent Job is denied", async () => {
    const denial = new Error("Job access denied");
    const readPage = vi.fn();
    const summarize = vi.fn();
    const reader: DiaryReader = {
      requireJobAccess: async () => { throw denial; },
      readPage,
    };
    const diaryModule = createJobDiarySummaryModule({
      reader,
      summarizer: { summarize },
      enabledSources: ["notes"],
      now: () => new Date("2026-10-12T00:00:00Z"),
    });

    await expect(diaryModule.summarizeJobDiary(syntheticLaunch)).rejects.toBe(denial);
    expect(readPage).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it("summarizes all enabled pages once with deduplicated, bounded, redacted source citations", async () => {
    const readPage = vi.fn(async (_launch: AuthorizedJobLaunch, source: DiarySourceName, cursor: string | null): Promise<DiaryPage> => {
      if (source === "notes" && cursor === null) return {
        entries: [
          Object.assign(
            { source: "notes" as const, id: "n1", text: "<script>alert(1)</script> Quote approved. Contact alice@example.test or +64 21 123 4567.", createdAt: "2026-10-10T09:00:00Z" },
            { accessToken: "secret-token" },
          ),
        ],
        nextCursor: "page-2",
      };
      if (source === "notes") return {
        entries: [
          { source: "notes", id: "n1", text: "Duplicate note", createdAt: "2026-10-10T09:00:00Z" },
          { source: "notes", id: "n2", text: "Install date to confirm.", createdAt: "2026-10-11T09:00:00Z" },
        ],
        nextCursor: null,
      };
      return {
        entries: [{ source: "sms", id: "s1", text: "Client requested Monday.", createdAt: "2026-10-11T10:00:00Z" }],
        nextCursor: null,
      };
    });
    const summarize = vi.fn(async (entries: readonly DiaryEntry[]) => ({
      ...emptySummary,
      decisions: [{ text: `Quote approved: ${entries[0].id}.`, citations: ["notes:n1"] }],
      outstandingActions: [{ text: "Confirm installation date.", citations: ["notes:n2", "sms:s1"] }],
    }));
    const diaryModule = createJobDiarySummaryModule({
      reader: { requireJobAccess: async () => undefined, readPage },
      summarizer: { summarize },
      enabledSources: ["notes", "sms"],
      excludedSources: [{ source: "email", reason: "No supported complete read surface" }],
      now: () => new Date("2026-10-12T00:00:00Z"),
    });

    const result = await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(result.decisions).toEqual([{ text: "Quote approved: n1.", citations: ["notes:n1"] }]);
    expect(result.coverage).toEqual({
      includedSources: ["notes", "sms"],
      excludedSources: [
        { source: "attachments", reason: "Not enabled in this summary" },
        { source: "email", reason: "No supported complete read surface" },
        { source: "schedule", reason: "Not enabled in this summary" },
      ],
      itemCount: 3,
      truncated: false,
      snapshotAt: "2026-10-12T00:00:00.000Z",
    });
    expect(readPage.mock.calls.map(([, source, cursor]) => [source, cursor])).toEqual([
      ["notes", null], ["notes", "page-2"], ["sms", null],
    ]);
    expect(summarize).toHaveBeenCalledOnce();
    const summaryInput = summarize.mock.calls[0][0];
    expect(summaryInput.map((entry) => `${entry.source}:${entry.id}`)).toEqual(["notes:n1", "notes:n2", "sms:s1"]);
    expect(JSON.stringify(summaryInput)).not.toMatch(/<script>|alice@example\.test|\+64 21 123 4567|secret-token/);
    expect(summaryInput[0].text).toContain("Quote approved.");
  });

  it("removes UUID and JWT-shaped identifiers embedded in note text before summarization", async () => {
    const accountUUID = "550e8400-e29b-41d4-a716-446655440000";
    const callbackToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SIGNATURE_123";
    let receivedText = "";
    const diaryModule = createJobDiarySummaryModule({
      reader: {
        requireJobAccess: async () => undefined,
        readPage: async () => ({
          entries: [{
            source: "notes", id: "n1", createdAt: "2026-10-11T09:00:00Z",
            text: `Quote approved. Account ${accountUUID}; callback ${callbackToken}`,
          }],
          nextCursor: null,
        }),
      },
      summarizer: {
        summarize: async (entries) => {
          receivedText = entries[0].text;
          return { ...emptySummary, overview: { ...emptySummary.overview, citations: ["notes:n1"] } };
        },
      },
      enabledSources: ["notes"],
    });

    await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(receivedText).toContain("Quote approved.");
    expect(receivedText).toContain("[uuid redacted]");
    expect(receivedText).toContain("[token redacted]");
    expect(receivedText).not.toContain(accountUUID);
    expect(receivedText).not.toContain(callbackToken);
  });

  it("marks a large source as truncated and does not read later sources", async () => {
    const entries = Array.from({ length: 201 }, (_, index) => ({
      source: "notes" as const,
      id: `n${index}`,
      text: `Synthetic note ${index}`,
      createdAt: "2026-10-11T09:00:00Z",
    }));
    const readPage = vi.fn(async () => ({ entries, nextCursor: null }));
    const diaryModule = createJobDiarySummaryModule({
      reader: { requireJobAccess: async () => undefined, readPage },
      summarizer: { summarize: async () => emptySummary },
      enabledSources: ["notes", "sms"],
    });

    const result = await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(result.coverage.itemCount).toBe(200);
    expect(result.coverage.truncated).toBe(true);
    expect(result.coverage.includedSources).toEqual(["notes"]);
    expect(result.coverage.excludedSources).toContainEqual({
      source: "sms", reason: "Not read because the summary limit was reached",
    });
    expect(readPage).toHaveBeenCalledOnce();
  });

  it("reports all unselected diary sources as excluded", async () => {
    const diaryModule = createJobDiarySummaryModule({
      reader: {
        requireJobAccess: async () => undefined,
        readPage: async () => ({ entries: [], nextCursor: null }),
      },
      summarizer: { summarize: vi.fn() },
      enabledSources: ["notes"],
    });

    const result = await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(result.coverage.excludedSources).toEqual([
      { source: "sms", reason: "Not enabled in this summary" },
      { source: "attachments", reason: "Not enabled in this summary" },
      { source: "email", reason: "Not enabled in this summary" },
      { source: "schedule", reason: "Not enabled in this summary" },
    ]);
  });

  it("rejects a claimed fact that cites a source item absent from the authorized snapshot", async () => {
    const diaryModule = createJobDiarySummaryModule({
      reader: {
        requireJobAccess: async () => undefined,
        readPage: async () => ({
          entries: [{ source: "notes", id: "n1", text: "Synthetic note", createdAt: "2026-10-11T09:00:00Z" }],
          nextCursor: null,
        }),
      },
      summarizer: {
        summarize: async () => ({
          ...emptySummary,
          decisions: [{ text: "Deposit received.", citations: ["notes:missing"] }],
        }),
      },
      enabledSources: ["notes"],
    });

    await expect(diaryModule.summarizeJobDiary(syntheticLaunch)).rejects.toThrow("unsupported citation");
  });

  it("fails safely on a repeating page cursor", async () => {
    const summarize = vi.fn();
    const diaryModule = createJobDiarySummaryModule({
      reader: {
        requireJobAccess: async () => undefined,
        readPage: async () => ({ entries: [], nextCursor: "same-page" }),
      },
      summarizer: { summarize },
      enabledSources: ["notes"],
    });

    await expect(diaryModule.summarizeJobDiary(syntheticLaunch)).rejects.toThrow("Repeated diary page cursor");
    expect(summarize).not.toHaveBeenCalled();
  });

  it("discloses when an individual entry had to be shortened before summarization", async () => {
    let receivedText = "";
    const diaryModule = createJobDiarySummaryModule({
      reader: {
        requireJobAccess: async () => undefined,
        readPage: async () => ({
          entries: [{ source: "notes", id: "n1", text: "A".repeat(2_500), createdAt: "2026-10-11T09:00:00Z" }],
          nextCursor: null,
        }),
      },
      summarizer: {
        summarize: async (entries) => {
          receivedText = entries[0].text;
          return { ...emptySummary, overview: { ...emptySummary.overview, citations: ["notes:n1"] } };
        },
      },
      enabledSources: ["notes"],
    });

    const result = await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(receivedText).toHaveLength(2_000);
    expect(result.coverage.truncated).toBe(true);
  });

  it("caps total text sent to the summarizer and discloses the partial snapshot", async () => {
    const entries = Array.from({ length: 15 }, (_, index) => ({
      source: "notes" as const,
      id: `n${index}`,
      text: "A".repeat(1_500),
      createdAt: "2026-10-11T09:00:00Z",
    }));
    const summarize = vi.fn(async (entries: readonly DiaryEntry[]) => {
      expect(entries.reduce((total, entry) => total + entry.text.length, 0)).toBeLessThanOrEqual(20_000);
      return emptySummary;
    });
    const diaryModule = createJobDiarySummaryModule({
      reader: {
        requireJobAccess: async () => undefined,
        readPage: async (_launch, source) => ({ entries: source === "notes" ? entries : [], nextCursor: null }),
      },
      summarizer: { summarize },
      enabledSources: ["notes", "sms"],
    });

    const result = await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(summarize).toHaveBeenCalledOnce();
    expect(result.coverage.truncated).toBe(true);
    expect(result.coverage.includedSources).toEqual(["notes"]);
  });

  it("returns an empty evidence result without inventing a summary", async () => {
    const summarize = vi.fn();
    const diaryModule = createJobDiarySummaryModule({
      reader: {
        requireJobAccess: async () => undefined,
        readPage: async () => ({ entries: [], nextCursor: null }),
      },
      summarizer: { summarize },
      enabledSources: ["notes"],
      now: () => new Date("2026-10-12T00:00:00Z"),
    });

    const result = await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(result.headline).toEqual({ text: "No diary content available", citations: [] });
    expect(result.coverage.itemCount).toBe(0);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("does not claim the diary is empty when pagination stops before completion", async () => {
    const summarize = vi.fn();
    const diaryModule = createJobDiarySummaryModule({
      reader: {
        requireJobAccess: async () => undefined,
        readPage: async (_launch, _source, cursor) => ({
          entries: [],
          nextCursor: String(Number(cursor ?? "0") + 1),
        }),
      },
      summarizer: { summarize },
      enabledSources: ["notes"],
    });

    const result = await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(result.coverage.truncated).toBe(true);
    expect(result.headline.text).toBe("No content in the partial diary snapshot");
    expect(summarize).not.toHaveBeenCalled();
  });

  it("does not claim the diary is empty when no source was selected", async () => {
    const readPage = vi.fn();
    const diaryModule = createJobDiarySummaryModule({
      reader: { requireJobAccess: async () => undefined, readPage },
      summarizer: { summarize: vi.fn() },
      enabledSources: [],
    });

    const result = await diaryModule.summarizeJobDiary(syntheticLaunch);
    expect(result.headline.text).toBe("No diary sources selected");
    expect(readPage).not.toHaveBeenCalled();
  });
});
