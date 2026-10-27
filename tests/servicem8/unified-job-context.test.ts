import { describe, expect, it } from "vitest";
import { buildUnifiedJobContext } from "@/lib/servicem8/unified-job-context";
import type { RestJobContext, RestContextEvent, RestSource } from "@/lib/servicem8/rest-job-context";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const note: RestContextEvent = { source: "notes", sourceId: "n1", eventType: "note",
  timestamp: "2026-10-27 10:00:00", timestampField: "create_date", active: true,
  contentState: "full", content: "A verified note" };
const email: RestContextEvent = { source: "email", sourceId: "e1", eventType: "email",
  timestamp: "2026-10-27 11:00:00", timestampField: "timestamp", active: null,
  direction: "outbound", contentState: "full", content: "A verified email" };
function context(): RestJobContext {
  const empty = { status: "complete" as const, pages: 1, events: [] as RestContextEvent[] };
  return { jobUUID: uuid, jobNumber: "R260609", diaryCoverage: "unverified",
    sources: Object.fromEntries((["notes", "email", "sms", "activities", "attachments", "payments"] as RestSource[])
      .map((source) => [source, { ...empty, events: source === "notes" ? [note] : source === "email" ? [email] : [] }])) as RestJobContext["sources"] };
}

describe("unified Job context", () => {
  it("joins an explicit ID and a unique communication time without doubling the timeline", () => {
    const result = buildUnifiedJobContext(context(), [
      { diaryKey: "n", timestamp: note.timestamp, eventType: "note", objectId: "n1" },
      { diaryKey: "e", timestamp: email.timestamp, eventType: "email" },
      { diaryKey: "call", timestamp: "2026-10-27 12:00:00", eventType: "call" },
    ]);
    expect(result.events).toHaveLength(3);
    expect(result.unlinkedSources).toHaveLength(0);
    expect(result.matchedById).toBe(1);
    expect(result.matchedByUniqueTime).toBe(1);
    expect(result.diaryOnly).toBe(1);
    expect(result.events.find((event) => event.diaryKey === "call")?.contentState).toBe("unavailable");
  });

  it("does not override a missing explicit ID or infer grouped attachment identity", () => {
    const rest = context();
    rest.sources.attachments.events = [{ ...email, source: "attachments", sourceId: "a1", eventType: "attachment" }];
    const result = buildUnifiedJobContext(rest, [
      { diaryKey: "e", timestamp: email.timestamp, eventType: "email", objectId: "wrong" },
      { diaryKey: "file", timestamp: email.timestamp, eventType: "file" },
    ]);
    expect(result.diaryOnly).toBe(2);
    expect(result.unlinkedSources.map((event) => event.sourceId)).toEqual(["n1", "e1", "a1"]);
    expect(result.events).toHaveLength(2);
  });
});
