import { describe, expect, it, vi } from "vitest";
import { ServiceM8ApiError, type ServiceM8Client } from "@/lib/servicem8/client";
import { auditJobDiary, auditJobNumbers } from "@/lib/servicem8/job-diary-audit";

const jobUUID = "0686ce69-4a5d-4f73-ad56-827ffaaced2b";
const noteUUID = "123e4567-cb72-4d94-8a1e-d454131257eb";
const emailUUID = "223e4567-cb72-4d94-8a1e-d454131257eb";

function reader(overrides: Record<string, unknown> = {}) {
  return {
    listJobsByNumber: vi.fn(async () => [{ uuid: jobUUID, generated_job_id: "R260609" }]),
    getJob: vi.fn(async () => ({ uuid: jobUUID, generated_job_id: "R260609", job_address: "Private address" })),
    listJobNotesPage: vi.fn(async () => ({ records: [{ uuid: noteUUID, related_object: "job", related_object_uuid: jobUUID, note: "Private note", create_date: "2026-10-01 10:00:00" }], nextCursor: null })),
    listJobEmailsPage: vi.fn(async () => ({ records: [{ uuid: emailUUID, related_object: "job", related_object_uuid: jobUUID, direction: "inbound", message_text: "Private email", timestamp: "2026-10-02 10:00:00" }], nextCursor: null })),
    listJobActivitiesPage: vi.fn(async () => ({ records: [], nextCursor: null })),
    listJobAttachmentsPage: vi.fn(async () => ({ records: [], nextCursor: null })),
    listJobSmsPage: vi.fn(async () => ({ records: [], nextCursor: null })),
    listJobPaymentsPage: vi.fn(async () => ({ records: [], nextCursor: null })),
    ...overrides,
  };
}

describe("RG-380 redacted Job Diary audit", () => {
  it("allows only the three owner-authorised Job numbers", () => {
    expect(auditJobNumbers).toEqual(["R260766", "R260609", "R260611"]);
  });

  it("checks the exact parent Job before reading any children", async () => {
    const client = reader({ getJob: vi.fn(async () => ({ uuid: jobUUID, generated_job_id: "R260766" })) });
    await expect(auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret"))
      .rejects.toThrow("Audit parent Job mismatch");
    expect(client.listJobNotesPage).not.toHaveBeenCalled();
    expect(client.listJobEmailsPage).not.toHaveBeenCalled();
  });

  it("returns only pseudonymous keys, timestamps, and presence flags", async () => {
    const result = await auditJobDiary(reader() as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.status).toBe("incomplete");
    expect(result.sources.map((source) => [source.source, source.count, source.status])).toEqual([
      ["notes", 1, "complete"], ["email", 1, "complete"], ["activities", 0, "complete"], ["attachments", 0, "complete"],
      ["sms", 0, "complete"], ["payments", 0, "complete"],
    ]);
    expect(result.sources[1].records[0]).toMatchObject({ direction: "inbound", contentPresent: true });
    expect(JSON.stringify(result)).not.toMatch(/Private|0686ce69|123e4567|223e4567/);
  });

  it("marks a denied child source incomplete rather than reporting zero", async () => {
    const client = reader({ listJobEmailsPage: vi.fn(async () => { throw new ServiceM8ApiError("denied", 403); }) });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources[1]).toMatchObject({ source: "email", status: "scope_or_access_denied", count: null, records: [] });
  });

  it("follows cursors and marks duplicate source IDs", async () => {
    const cursor = "323e4567-cb72-4d94-8a1e-d454131257eb";
    const item = { uuid: noteUUID, related_object: "job", related_object_uuid: jobUUID, note: "Private note", create_date: "2026-10-01 10:00:00" };
    const notes = vi.fn(async (_jobUUID: string, value: string | null) => value === null
      ? { records: [item], nextCursor: cursor }
      : { records: [item], nextCursor: null });
    const result = await auditJobDiary(reader({ listJobNotesPage: notes }) as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(notes.mock.calls).toEqual([[jobUUID, null], [jobUUID, cursor]]);
    expect(result.sources[0]).toMatchObject({ status: "duplicate", count: 1, pages: 2, duplicates: 1 });
  });

  it("rejects a child record linked to another Job", async () => {
    const client = reader({ listJobAttachmentsPage: vi.fn(async () => ({ records: [{
      uuid: noteUUID, related_object: "job", related_object_uuid: "423e4567-cb72-4d94-8a1e-d454131257eb",
    }], nextCursor: null })) });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources[3]).toMatchObject({ status: "invalid_or_incomplete_response", count: null, records: [] });
  });

  it("fails the source closed when a timestamp contains private text", async () => {
    const client = reader({ listJobEmailsPage: vi.fn(async () => ({ records: [{
      uuid: emailUUID, related_object: "job", related_object_uuid: jobUUID,
      timestamp: "Call private customer at 09:00", message_text: "Private email",
    }], nextCursor: null })) });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources[1]).toMatchObject({ status: "invalid_or_incomplete_response", count: null, records: [] });
    expect(JSON.stringify(result)).not.toContain("private customer");
  });

  it("includes returned inactive history with a redacted active flag", async () => {
    const client = reader({ listJobNotesPage: vi.fn(async () => ({ records: [{
      uuid: noteUUID, related_object: "job", related_object_uuid: jobUUID,
      note: "Private deleted note", create_date: "2026-10-01 10:00:00", active: 0,
    }], nextCursor: null })) });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources[0]).toMatchObject({ count: 1, records: [expect.objectContaining({ active: false })] });
    expect(JSON.stringify(result)).not.toContain("Private deleted note");
  });

  it("exposes activity edit time separately from scheduled time and classifies attachment source", async () => {
    const client = reader({
      listJobActivitiesPage: vi.fn(async () => ({ records: [{
        uuid: noteUUID, job_uuid: jobUUID, start_date: "2026-10-25 09:00:00",
        end_date: "2026-10-25 10:00:00", edit_date: "2026-09-27 22:52:12",
        private_detail: "Private booking detail",
      }], nextCursor: null })),
      listJobAttachmentsPage: vi.fn(async () => ({ records: [{
        uuid: emailUUID, related_object: "job", related_object_uuid: jobUUID,
        timestamp: "2026-09-09 12:38:37", file_type: ".pdf",
        attachment_source: "QUOTE", filename: "Private quote.pdf",
      }], nextCursor: null })),
    });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources[2].records[0]).toMatchObject({ at: "2026-10-25 09:00:00", lastEditAt: "2026-09-27 22:52:12" });
    expect(result.sources[3].records[0]).toMatchObject({ fileType: "pdf", attachmentRole: "quote" });
    expect(JSON.stringify(result)).not.toMatch(/Private|QUOTE/);
  });

  it("fails a source closed when edit metadata contains private text", async () => {
    const client = reader({ listJobActivitiesPage: vi.fn(async () => ({ records: [{
      uuid: noteUUID, job_uuid: jobUUID, start_date: "2026-10-25 09:00:00",
      edit_date: "Private booking detail",
    }], nextCursor: null })) });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources[2]).toMatchObject({ status: "invalid_or_incomplete_response", count: null, records: [] });
    expect(JSON.stringify(result)).not.toContain("Private booking detail");
  });

  it("redacts SMS content and payment amount while preserving their Job links and timestamps", async () => {
    const client = reader({
      listJobSmsPage: vi.fn(async () => ({ records: [{
        uuid: noteUUID, related_object: "job", related_object_uuid: jobUUID,
        timestamp: "2026-09-09 14:16:00", direction: "outbound", message: "Private SMS", to_phone: "Private phone",
      }], nextCursor: null })),
      listJobPaymentsPage: vi.fn(async () => ({ records: [{
        uuid: emailUUID, job_uuid: jobUUID, timestamp: "2026-10-20 06:55:45", amount: "Private amount",
        method: "Private method", note: "Private payment note", active: 1,
      }], nextCursor: null })),
    });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources[4]).toMatchObject({ source: "sms", count: 1, records: [expect.objectContaining({
      at: "2026-09-09 14:16:00", direction: "outbound", contentPresent: true, active: null,
    })] });
    expect(result.sources[5]).toMatchObject({ source: "payments", count: 1, records: [expect.objectContaining({
      at: "2026-10-20 06:55:45", active: true,
    })] });
    expect(JSON.stringify(result)).not.toMatch(/Private|0686ce69|123e4567|223e4567/);
  });

  it("does not turn denied SMS or payments into a zero count", async () => {
    const denied = vi.fn(async () => { throw new ServiceM8ApiError("denied", 403); });
    const client = reader({ listJobSmsPage: denied, listJobPaymentsPage: denied });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources.slice(4)).toEqual([
      expect.objectContaining({ source: "sms", status: "scope_or_access_denied", count: null, records: [] }),
      expect.objectContaining({ source: "payments", status: "scope_or_access_denied", count: null, records: [] }),
    ]);
  });

  it("fails closed for a payment without a usable event timestamp", async () => {
    const client = reader({ listJobPaymentsPage: vi.fn(async () => ({ records: [{
      uuid: emailUUID, job_uuid: jobUUID, amount: "Private amount", active: 1,
    }], nextCursor: null })) });
    const result = await auditJobDiary(client as unknown as ServiceM8Client, "R260609", "test-secret");
    expect(result.sources[5]).toMatchObject({ source: "payments", status: "invalid_or_incomplete_response", count: null, records: [] });
    expect(JSON.stringify(result)).not.toContain("Private amount");
  });
});
