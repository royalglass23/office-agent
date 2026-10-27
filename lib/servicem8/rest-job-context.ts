import { z } from "zod";
import { ServiceM8ApiError, type ServiceM8Client } from "./client";
import { uuidSchema } from "./event-schema";
import { buildJobContext, type JobDiaryEntry, type JobSourceRecord, type VerifiedMatch } from "./job-context-builder";

export const restSources = ["notes", "email", "sms", "activities", "attachments", "payments"] as const;
export type RestSource = typeof restSources[number];
type Page = { records: unknown[]; nextCursor: string | null };
type SourceStatus = "complete" | "access_denied" | "unavailable" | "invalid";
export type RestContextEvent = JobSourceRecord & {
  direction?: "inbound" | "outbound" | "unknown";
  subject?: string;
  active: boolean | null;
  timestampField: "create_date" | "timestamp" | "start_date";
};
export type RestSourceResult = { status: SourceStatus; pages: number; events: RestContextEvent[]; issue?: string };
export type RestJobContext = {
  jobUUID: string;
  jobNumber: string;
  sources: Record<RestSource, RestSourceResult>;
  // REST lists are complete only for their own resources; this is not Diary parity.
  diaryCoverage: "unverified" | "verified";
};

const MAX_PAGES = 20;
const MAX_ROWS = 2_000;
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?$/).nullable().optional();
const parent = z.object({ uuid: uuidSchema, generated_job_id: z.string() }).passthrough();
const related = z.object({ uuid: uuidSchema, related_object: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("job")), related_object_uuid: uuidSchema,
  active: z.union([z.literal(0), z.literal(1)]).optional() }).passthrough();
const note = related.extend({ create_date: timestamp, note: z.string().optional() });
const email = related.extend({ timestamp, direction: z.string().optional(), subject: z.string().optional(), message_text: z.string().optional(),
  body: z.string().optional(), text: z.string().optional(), message: z.string().optional(),
  message_html: z.string().optional(), html: z.string().optional() });
const sms = related.extend({ timestamp, direction: z.string().optional(), message: z.string().optional() });
const activity = z.object({ uuid: uuidSchema, job_uuid: uuidSchema, start_date: timestamp,
  active: z.union([z.literal(0), z.literal(1)]).optional() }).passthrough();
const payment = z.object({ uuid: uuidSchema, job_uuid: uuidSchema, timestamp,
  active: z.union([z.literal(0), z.literal(1)]).optional() }).passthrough();
const schemas = { notes: note, email, sms, activities: activity, attachments: related.extend({ timestamp }), payments: payment };

function eventFromRaw(source: RestSource, raw: unknown, jobUUID: string): RestContextEvent {
  const row = schemas[source].parse(raw) as {
    uuid: string; job_uuid?: string; related_object_uuid?: string; create_date?: string | null;
    start_date?: string | null; timestamp?: string | null; active?: 0 | 1;
    direction?: string; subject?: string; note?: string; message_text?: string; body?: string; text?: string;
    message?: string; message_html?: string; html?: string;
  };
  const owner = source === "activities" || source === "payments" ? row.job_uuid : row.related_object_uuid;
  if (owner !== jobUUID) throw new Error("ServiceM8 child Job mismatch");
  const at = source === "notes" ? row.create_date : source === "activities" ? row.start_date : row.timestamp;
  const active = row.active === undefined ? null : row.active === 1;
  const direction = source === "email" || source === "sms"
    ? row.direction === "inbound" || row.direction === "outbound" ? row.direction : "unknown" : undefined;
  const emailBodies = [row.message_text, row.body, row.text, row.message, row.message_html, row.html];
  const body = source === "notes" ? row.note
    : source === "email" ? emailBodies.find((value) => value !== undefined && value.length > 0) ?? emailBodies.find((value) => value !== undefined)
    : source === "sms" ? row.message : undefined;
  const timestampField = source === "notes" ? "create_date" : source === "activities" ? "start_date" : "timestamp";
  return { source, sourceId: row.uuid, eventType: source === "notes" ? "note" : source === "activities" ? "activity" : source === "attachments" ? "attachment" : source === "payments" ? "payment" : source,
    timestamp: at ?? null, timestampField, active, ...(direction ? { direction } : {}),
    ...(source === "email" && row.subject !== undefined ? { subject: row.subject } : {}),
    contentState: body === undefined ? "unavailable" : body.length === 0 ? "empty" : "full", ...(body !== undefined ? { content: body } : {}) };
}

async function readSource(
  source: RestSource, jobUUID: string, readPage: (cursor: string | null) => Promise<Page>,
  readDetail?: (uuid: string) => Promise<unknown>,
): Promise<RestSourceResult> {
  const events: RestContextEvent[] = [];
  const cursors = new Set<string>();
  const ids = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  try {
    do {
      if (pages >= MAX_PAGES || events.length >= MAX_ROWS) throw new Error("ServiceM8 pagination limit");
      const page = await readPage(cursor);
      pages += 1;
      if (!Array.isArray(page.records)) throw new Error("ServiceM8 invalid page");
      for (const raw of page.records) {
        const listed = eventFromRaw(source, raw, jobUUID);
        if (ids.has(listed.sourceId)) throw new Error("ServiceM8 duplicate source ID");
        ids.add(listed.sourceId);
        const detail = readDetail ? eventFromRaw(source, await readDetail(listed.sourceId), jobUUID) : null;
        const event = detail ? { ...detail, timestamp: detail.timestamp ?? listed.timestamp } : listed;
        if (event.sourceId !== listed.sourceId) throw new Error("ServiceM8 detail identity mismatch");
        if (detail?.timestamp && listed.timestamp && detail.timestamp !== listed.timestamp) {
          throw new Error("ServiceM8 detail timestamp mismatch");
        }
        events.push(event);
        if (events.length > MAX_ROWS) throw new Error("ServiceM8 record limit");
      }
      cursor = page.nextCursor;
      if (cursor !== null) {
        if (cursors.has(cursor)) throw new Error("ServiceM8 pagination cycle");
        cursors.add(cursor);
      }
    } while (cursor !== null);
    return { status: "complete", pages, events };
  } catch (error) {
    // Never return a partial collection or the vendor response body as evidence.
    const status = error instanceof ServiceM8ApiError
      ? error.status === 403 ? "access_denied" : "unavailable"
      : "invalid";
    const issue = error instanceof ServiceM8ApiError ? `http_${error.status}`
      : error instanceof z.ZodError ? "invalid_record_schema"
      : error instanceof Error && ["ServiceM8 child Job mismatch", "ServiceM8 duplicate source ID",
          "ServiceM8 detail identity mismatch", "ServiceM8 detail timestamp mismatch", "ServiceM8 pagination cycle",
          "ServiceM8 pagination limit", "ServiceM8 record limit", "ServiceM8 invalid page"].includes(error.message)
        ? error.message.replaceAll("ServiceM8 ", "").replaceAll(" ", "_").toLowerCase()
        : "read_failed";
    return { status, pages, events: [], issue };
  }
}

export async function readRestJobContext(client: ServiceM8Client, jobUUID: string): Promise<RestJobContext> {
  uuidSchema.parse(jobUUID);
  const job = parent.parse(await client.getJob(jobUUID));
  if (job.uuid !== jobUUID) throw new Error("ServiceM8 parent Job mismatch");
  const readers: Record<RestSource, (cursor: string | null) => Promise<Page>> = {
    notes: (cursor) => client.listJobNotesPage(jobUUID, cursor),
    email: (cursor) => client.listJobEmailsPage(jobUUID, cursor),
    sms: (cursor) => client.listJobSmsPage(jobUUID, cursor),
    activities: (cursor) => client.listJobActivitiesPage(jobUUID, cursor),
    attachments: (cursor) => client.listJobAttachmentsPage(jobUUID, cursor),
    payments: (cursor) => client.listJobPaymentsPage(jobUUID, cursor),
  };
  const sources = {} as Record<RestSource, RestSourceResult>;
  for (const source of restSources) {
    const detail = source === "notes" ? (uuid: string) => client.getJobNote(uuid)
      : source === "email" ? (uuid: string) => client.getJobEmail(uuid) : undefined;
    sources[source] = await readSource(source, jobUUID, readers[source], detail);
  }
  return { jobUUID, jobNumber: job.generated_job_id, sources, diaryCoverage: "unverified" };
}

/** Optional reconciliation of a separately obtained Diary inventory; no inferred matches. */
export function reconcileRestJobContext(
  context: RestJobContext, diary: readonly JobDiaryEntry[], verifiedMatches: readonly VerifiedMatch[] = [],
) {
  const records = restSources.flatMap((source) => context.sources[source].events);
  return buildJobContext(diary, records, verifiedMatches);
}

export type ContextTask = "latest_communication" | "customer_response" | "blockers" | "next_action";

export function checkContextForTask(context: RestJobContext, task: ContextTask) {
  const required: readonly RestSource[] = task === "latest_communication" || task === "customer_response"
    ? ["email", "sms"] : restSources;
  const gaps: string[] = [];
  for (const source of required) {
    const result = context.sources[source];
    if (result.status !== "complete") gaps.push(`${source}:${result.status}`);
    else if ((source === "email" || source === "sms" || source === "notes") &&
      result.events.some((event) => event.contentState === "unavailable")) gaps.push(`${source}:content_unavailable`);
    if (result.events.some((event) => event.timestamp === null)) gaps.push(`${source}:timestamp_unavailable`);
    if (task === "customer_response" && (source === "email" || source === "sms") &&
      result.events.some((event) => event.direction === "unknown")) gaps.push(`${source}:direction_unknown`);
  }
  if ((task === "blockers" || task === "next_action") &&
    context.sources.attachments.events.length > 0) gaps.push("attachments:content_unavailable");
  if ((task === "blockers" || task === "next_action") &&
    context.sources.activities.events.length > 0) gaps.push("activities:scheduled_time_only");
  // Calls, Service and status changes can affect all four questions, including
  // which communication is actually latest. REST source coverage cannot prove Diary parity.
  if (context.diaryCoverage !== "verified") gaps.push("diary:unverified");
  return { ready: gaps.length === 0, gaps, scope: required };
}
