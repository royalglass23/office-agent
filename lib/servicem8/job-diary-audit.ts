import { createHmac } from "node:crypto";
import { z } from "zod";
import { ServiceM8ApiError, type ServiceM8Client } from "./client";
import { uuidSchema } from "./event-schema";

export const auditJobNumbers = ["R260766", "R260609", "R260611"] as const;
export type AuditJobNumber = typeof auditJobNumbers[number];

type Source = "notes" | "email" | "activities" | "attachments" | "sms" | "payments";
type AuditPage = { records: unknown[]; nextCursor: string | null };
type AuditRecord = {
  key: string;
  at: string | null;
  direction?: "inbound" | "outbound" | "unknown";
  contentPresent?: boolean | null;
  fileType?: "pdf" | "image" | "other" | "unknown";
  attachmentRole?: "quote" | "other" | "unknown";
  endAt?: string | null;
  lastEditAt?: string | null;
  active: boolean | null;
};

const MAX_PAGES = 20;
const MAX_RECORDS = 2_000;
const requiredTimestamp = z.string().max(40)
  .regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?$/);
const timestamp = requiredTimestamp.nullable().optional();
const related = z.object({
  uuid: uuidSchema,
  related_object: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("job")),
  related_object_uuid: uuidSchema,
  active: z.union([z.literal(0), z.literal(1)]).optional().default(1),
}).passthrough();
const noteSchema = related.extend({ note: z.string(), create_date: timestamp });
const emailSchema = related.extend({
  timestamp,
  direction: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  message_text: z.string().optional(),
  message_html: z.string().optional(),
});
const activitySchema = z.object({
  uuid: uuidSchema,
  job_uuid: uuidSchema,
  start_date: timestamp,
  end_date: timestamp,
  edit_date: timestamp,
  active: z.union([z.literal(0), z.literal(1)]).optional().default(1),
}).passthrough();
const attachmentSchema = related.extend({ timestamp, file_type: z.string().optional(), attachment_source: z.string().optional() });
const smsSchema = z.object({
  uuid: uuidSchema,
  related_object: z.literal("job"),
  related_object_uuid: uuidSchema,
  timestamp: requiredTimestamp,
  direction: z.enum(["inbound", "outbound"]),
  message: z.string(),
}).passthrough();
const paymentSchema = z.object({
  uuid: uuidSchema,
  job_uuid: uuidSchema,
  timestamp: requiredTimestamp,
  active: z.union([z.literal(0), z.literal(1)]).optional().default(1),
}).passthrough();

function keyFor(secret: string, source: Source, uuid: string) {
  return createHmac("sha256", secret).update(`RG-380\0${source}\0${uuid}`).digest("hex").slice(0, 24);
}

function fileType(value: string | undefined): AuditRecord["fileType"] {
  if (!value) return "unknown";
  const extension = value.toLowerCase();
  if (extension === ".pdf") return "pdf";
  if ([".jpg", ".jpeg", ".png", ".heic", ".webp"].includes(extension)) return "image";
  return "other";
}

function attachmentRole(value: string | undefined): AuditRecord["attachmentRole"] {
  if (!value) return "unknown";
  return value.toUpperCase() === "QUOTE" ? "quote" : "other";
}

function projectRecord(source: Source, value: unknown, jobUUID: string, secret: string): AuditRecord | null {
  if (source === "activities") {
    const item = activitySchema.parse(value);
    if (item.job_uuid !== jobUUID) throw new Error("Audit child Job mismatch");
    return { key: keyFor(secret, source, item.uuid), at: item.start_date ?? null, endAt: item.end_date ?? null, lastEditAt: item.edit_date ?? null, active: item.active === 1 };
  }
  if (source === "payments") {
    const item = paymentSchema.parse(value);
    if (item.job_uuid !== jobUUID) throw new Error("Audit child Job mismatch");
    return { key: keyFor(secret, source, item.uuid), at: item.timestamp ?? null, active: item.active === 1 };
  }
  if (source === "notes") {
    const item = noteSchema.parse(value);
    if (item.related_object_uuid !== jobUUID) throw new Error("Audit child Job mismatch");
    return { key: keyFor(secret, source, item.uuid), at: item.create_date ?? null, contentPresent: item.note.length > 0, active: item.active === 1 };
  }
  if (source === "email") {
    const item = emailSchema.parse(value);
    if (item.related_object_uuid !== jobUUID) throw new Error("Audit child Job mismatch");
    const direction = item.direction === "inbound" || item.direction === "outbound" ? item.direction : "unknown";
    return {
      key: keyFor(secret, source, item.uuid), at: item.timestamp ?? null, direction, active: item.active === 1,
      contentPresent: [item.message, item.message_text, item.message_html].every((value) => value === undefined)
        ? null
        : Boolean(item.message?.length || item.message_text?.length || item.message_html?.length),
    };
  }
  if (source === "sms") {
    const item = smsSchema.parse(value);
    if (item.related_object_uuid !== jobUUID) throw new Error("Audit child Job mismatch");
    return {
      key: keyFor(secret, source, item.uuid), at: item.timestamp ?? null,
      direction: item.direction, contentPresent: item.message.length > 0, active: null,
    };
  }
  const item = attachmentSchema.parse(value);
  if (item.related_object_uuid !== jobUUID) throw new Error("Audit child Job mismatch");
  return { key: keyFor(secret, source, item.uuid), at: item.timestamp ?? null, fileType: fileType(item.file_type), attachmentRole: attachmentRole(item.attachment_source), active: item.active === 1 };
}

async function collectSource(
  source: Source,
  readPage: (cursor: string | null) => Promise<AuditPage>,
  jobUUID: string,
  secret: string,
) {
  const records: AuditRecord[] = [];
  const keys = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  let duplicates = 0;
  try {
    do {
      if (pages >= MAX_PAGES || records.length >= MAX_RECORDS) throw new Error("Audit page limit");
      const page = await readPage(cursor);
      pages += 1;
      for (const raw of page.records) {
        const item = projectRecord(source, raw, jobUUID, secret);
        if (!item) continue;
        if (keys.has(item.key)) { duplicates += 1; continue; }
        keys.add(item.key);
        records.push(item);
        if (records.length > MAX_RECORDS) throw new Error("Audit record limit");
      }
      cursor = page.nextCursor;
      if (cursor !== null) {
        if (cursors.has(cursor)) throw new Error("Audit cursor cycle");
        cursors.add(cursor);
      }
    } while (cursor !== null);
    return { source, status: duplicates === 0 ? "complete" : "duplicate", count: records.length, pages, duplicates, records };
  } catch (error) {
    const status = error instanceof ServiceM8ApiError
      ? error.status === 403 ? "scope_or_access_denied" : error.status === 401 ? "connection_unavailable" : "request_failed"
      : "invalid_or_incomplete_response";
    // Partial records could be mistaken for a complete count; omit them on failure.
    return { source, status, count: null, pages, duplicates: null, records: [] as AuditRecord[] };
  }
}

export async function auditJobDiary(client: ServiceM8Client, jobNumber: AuditJobNumber, secret: string) {
  const matches = await client.listJobsByNumber([jobNumber]);
  if (matches.length !== 1 || !matches[0] || typeof matches[0] !== "object") throw new Error("Audit parent Job is unavailable");
  const listed = z.object({ uuid: uuidSchema, generated_job_id: z.string() }).passthrough().parse(matches[0]);
  if (listed.generated_job_id !== jobNumber) throw new Error("Audit parent Job mismatch");
  const job = z.object({ uuid: uuidSchema, generated_job_id: z.string() }).passthrough().parse(await client.getJob(listed.uuid));
  if (job.uuid !== listed.uuid || job.generated_job_id !== jobNumber) throw new Error("Audit parent Job mismatch");

  const sources = [];
  for (const [source, reader] of [
    ["notes", (cursor: string | null) => client.listJobNotesPage(job.uuid, cursor)],
    ["email", (cursor: string | null) => client.listJobEmailsPage(job.uuid, cursor)],
    ["activities", (cursor: string | null) => client.listJobActivitiesPage(job.uuid, cursor)],
    ["attachments", (cursor: string | null) => client.listJobAttachmentsPage(job.uuid, cursor)],
    ["sms", (cursor: string | null) => client.listJobSmsPage(job.uuid, cursor)],
    ["payments", (cursor: string | null) => client.listJobPaymentsPage(job.uuid, cursor)],
  ] as const) {
    sources.push(await collectSource(source, reader, job.uuid, secret));
  }
  return {
    jobNumber,
    auditedAt: new Date().toISOString(),
    status: "incomplete" as const,
    // The source probe does not prove that every visible Diary event has an API match.
    sources,
  };
}
