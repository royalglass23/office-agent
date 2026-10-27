import { describe, expect, it, vi } from "vitest";
import { ServiceM8ApiError, type ServiceM8Client } from "@/lib/servicem8/client";
import { checkContextForTask, readRestJobContext, reconcileRestJobContext } from "@/lib/servicem8/rest-job-context";

const jobUUID = "0686ce69-4a5d-4f73-ad56-827ffaaced2b";
const noteUUID = "123e4567-cb72-4d94-8a1e-d454131257eb";
const emailUUID = "223e4567-cb72-4d94-8a1e-d454131257eb";
const smsUUID = "323e4567-cb72-4d94-8a1e-d454131257eb";
const nextCursor = "423e4567-cb72-4d94-8a1e-d454131257eb";
const date = "2026-10-01 10:00:00";
const page = (records: unknown[], cursor: string | null = null) => ({ records, nextCursor: cursor });
const note = { uuid: noteUUID, related_object: "job", related_object_uuid: jobUUID, create_date: date, note: "Site access confirmed" };
const email = { uuid: emailUUID, related_object: "job", related_object_uuid: jobUUID, timestamp: date, direction: "inbound", message_text: "Reply text" };
const sms = { uuid: smsUUID, related_object: "job", related_object_uuid: jobUUID, timestamp: date, direction: "outbound", message: "" };

function reader(overrides: Record<string, unknown> = {}) {
  return {
    getJob: vi.fn(async () => ({ uuid: jobUUID, generated_job_id: "R260609" })),
    listJobNotesPage: vi.fn(async () => page([note])), getJobNote: vi.fn(async () => note),
    listJobEmailsPage: vi.fn(async () => page([email])), getJobEmail: vi.fn(async () => email),
    listJobSmsPage: vi.fn(async () => page([sms])),
    listJobActivitiesPage: vi.fn(async () => page([])),
    listJobAttachmentsPage: vi.fn(async () => page([])),
    listJobPaymentsPage: vi.fn(async () => page([])),
    ...overrides,
  } as unknown as ServiceM8Client;
}

describe("REST Job context", () => {
  it("reads parent first, all source pages and full Note/Email detail; preserves empty SMS", async () => {
    const notes = vi.fn(async (_job: string, cursor: string | null) => cursor === null ? page([note], nextCursor) : page([]));
    const client = reader({ listJobNotesPage: notes });
    const context = await readRestJobContext(client, jobUUID);
    expect(notes.mock.calls.map(([, cursor]) => cursor)).toEqual([null, nextCursor]);
    expect(context.sources.notes).toMatchObject({ status: "complete", pages: 2, events: [{ sourceId: noteUUID, contentState: "full", content: "Site access confirmed" }] });
    expect(context.sources.email.events[0]).toMatchObject({ sourceId: emailUUID, direction: "inbound", contentState: "full" });
    expect(context.sources.sms.events[0]).toMatchObject({ sourceId: smsUUID, contentState: "empty", content: "" });
    expect(context.diaryCoverage).toBe("unverified");
    expect(checkContextForTask(context, "latest_communication")).toMatchObject({ ready: false, scope: ["email", "sms"], gaps: ["diary:unverified"] });
    expect(checkContextForTask(context, "customer_response").gaps).toEqual(["diary:unverified"]);
    expect(checkContextForTask(context, "next_action")).toMatchObject({ ready: false, gaps: ["diary:unverified"] });
    const reconciled = reconcileRestJobContext(context, [
      { diaryKey: "d1", source: "notes", sourceId: noteUUID, eventType: "note", timestamp: date },
      { diaryKey: "d2", eventType: "email", timestamp: date, contentPreview: "Reply..." },
    ]);
    expect(reconciled.events).toHaveLength(2);
    expect(reconciled.events[0]).toMatchObject({ source: { system: "notes", id: noteUUID }, contentState: "full" });
    expect(reconciled.events[1]).toMatchObject({ source: null, contentState: "preview_only" });
    expect(reconciled.unresolvedSources).toHaveLength(2);
  });

  it("stops before child reads when the parent Job is denied", async () => {
    const client = reader({ getJob: vi.fn(async () => { throw new ServiceM8ApiError("denied", 403); }) });
    await expect(readRestJobContext(client, jobUUID)).rejects.toMatchObject({ status: 403 });
    expect(client.listJobEmailsPage).not.toHaveBeenCalled();
  });

  it("never treats denied detail, a duplicate row or a cursor cycle as an empty source", async () => {
    const denied = await readRestJobContext(reader({ getJobEmail: vi.fn(async () => { throw new ServiceM8ApiError("denied", 403); }) }), jobUUID);
    expect(denied.sources.email).toMatchObject({ status: "access_denied", events: [] });
    expect(checkContextForTask(denied, "latest_communication").ready).toBe(false);
    const duplicate = await readRestJobContext(reader({ listJobSmsPage: vi.fn(async () => page([sms, sms])) }), jobUUID);
    expect(duplicate.sources.sms).toMatchObject({ status: "invalid", events: [] });
    const cycle = await readRestJobContext(reader({ listJobEmailsPage: vi.fn(async () => page([email], nextCursor)) }), jobUUID);
    expect(cycle.sources.email).toMatchObject({ status: "invalid", events: [] });
  });

  it("rejects a mismatched child and distinguishes unavailable body from genuine empty content", async () => {
    const mismatch = await readRestJobContext(reader({ getJobNote: vi.fn(async () => ({ ...note, related_object_uuid: "523e4567-cb72-4d94-8a1e-d454131257eb" })) }), jobUUID);
    expect(mismatch.sources.notes.status).toBe("invalid");
    const unavailable = await readRestJobContext(reader({ getJobEmail: vi.fn(async () => ({ ...email, message_text: undefined })) }), jobUUID);
    expect(unavailable.sources.email.events[0].contentState).toBe("unavailable");
    expect(checkContextForTask(unavailable, "customer_response").gaps).toContain("email:content_unavailable");
  });

  it("accepts ServiceM8's capitalized Job relation without weakening owner validation", async () => {
    const capitalized = { ...note, related_object: "Job" };
    const context = await readRestJobContext(reader({
      listJobNotesPage: vi.fn(async () => page([capitalized])),
      getJobNote: vi.fn(async () => capitalized),
    }), jobUUID);
    expect(context.sources.notes).toMatchObject({ status: "complete", events: [{ sourceId: noteUUID }] });
  });
});
