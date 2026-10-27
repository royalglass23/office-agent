import { describe, expect, it } from "vitest";
import { buildJobContext, type JobDiaryEntry, type JobSourceRecord } from "@/lib/servicem8/job-context-builder";

const diary: JobDiaryEntry[] = [
  { diaryKey: "d1", source: "notes", sourceId: "n1", eventType: "note", timestamp: "2026-10-01 09:00:00", contentPreview: "Site access..." },
  { diaryKey: "d2", eventType: "email", timestamp: "2026-10-02 10:00:00", contentPreview: "Customer replied..." },
  { diaryKey: "d3", eventType: "call", timestamp: "2026-10-03 11:00:00", contentPreview: "" },
];
const sources: JobSourceRecord[] = [
  { source: "notes", sourceId: "n1", eventType: "note", timestamp: "2026-10-01 09:00:00", contentState: "full", content: "Site access confirmed" },
  { source: "email", sourceId: "e1", eventType: "email", timestamp: "2026-10-02 10:00:00", contentState: "full", content: "Customer replied with requested date" },
  { source: "email", sourceId: "e2", eventType: "email", timestamp: "2026-10-02 10:00:00", contentState: "full", content: "Another message at the same time" },
];

describe("Job Context Builder", () => {
  it("joins only stable IDs or an externally verified match, preserving source provenance", () => {
    const result = buildJobContext(diary, sources, [{ diaryKey: "d2", source: "email", sourceId: "e1" }]);
    expect(result.events).toHaveLength(3);
    expect(result.events[0]).toMatchObject({ source: { system: "notes", id: "n1" }, contentState: "full", timestampMatch: true });
    expect(result.events[1]).toMatchObject({ source: { system: "email", id: "e1" }, contentState: "full", previewTruncated: true });
    expect(result.events[2]).toMatchObject({ source: null, contentState: "unavailable" });
    expect(result.unresolvedSources).toEqual([{ source: "email", sourceId: "e2", eventType: "email", timestamp: "2026-10-02 10:00:00" }]);
  });

  it("does not equate same-time records or treat an empty preview as empty source content", () => {
    const result = buildJobContext(diary, sources);
    expect(result.events[1]).toMatchObject({ source: null, contentState: "preview_only" });
    expect(result.events[2].contentState).toBe("unavailable");
    expect(result.unresolvedSources).toHaveLength(2);
  });

  it("preserves genuine empty content and exposes timestamp disagreement", () => {
    const result = buildJobContext(
      [{ diaryKey: "d", source: "sms", sourceId: "s", eventType: "sms", timestamp: "2026-10-01 10:00:00", contentPreview: "" }],
      [{ source: "sms", sourceId: "s", eventType: "sms", timestamp: "2026-10-01 10:00:01", contentState: "empty" }],
    );
    expect(result.events[0]).toMatchObject({ contentState: "empty", content: "", timestampMatch: false });
  });

  it("rejects duplicate identities and unverifiable joins", () => {
    expect(() => buildJobContext(diary, [sources[0], sources[0]])).toThrow("Duplicate source ID");
    expect(() => buildJobContext(diary, sources, [{ diaryKey: "d2", source: "email", sourceId: "missing" }])).toThrow("Verified source missing");
    expect(() => buildJobContext(diary, sources, [{ diaryKey: "d2", source: "notes", sourceId: "n1" }])).toThrow("Invalid source match");
    expect(() => buildJobContext(diary, sources, [{ diaryKey: "d1", source: "email", sourceId: "e1" }])).toThrow("Verified source conflicts with Diary ID");
  });
});
