import type { RestContextEvent, RestJobContext, RestSource } from "./rest-job-context";

export type DiaryRecord = {
  diaryKey: string;
  timestamp: string | null;
  eventType: string;
  objectType?: string | null;
  objectId?: string | null;
  contentPreview?: string | null;
  visibleInUi?: boolean | null;
};

export type UnifiedEvent = {
  diaryKey: string | null;
  timestamp: string | null;
  eventType: string;
  source: RestSource | null;
  sourceId: string | null;
  sourceTimestamp: string | null;
  timestampField: RestContextEvent["timestampField"] | null;
  match: "source_id" | "unique_type_timestamp" | "diary_only" | "rest_only";
  active: boolean | null;
  visibleInUi: boolean | null;
  contentState: "full" | "empty" | "unavailable" | "preview_only";
  content?: string;
  previewTruncated: boolean;
};

export type UnifiedJobContext = {
  jobUUID: string;
  jobNumber: string;
  events: UnifiedEvent[];
  unlinkedSources: UnifiedEvent[];
  sourceStatus: RestJobContext["sources"];
  diaryObserved: number;
  matchedById: number;
  matchedByUniqueTime: number;
  diaryOnly: number;
  restOnly: number;
};

const sourceType = (record: RestContextEvent) => record.source === "email"
  ? record.direction === "inbound" ? "reply" : record.direction === "outbound" ? "email" : "unknown_email"
  : record.source === "notes" ? "note"
    : record.source === "attachments" ? "attachment"
      : record.source === "payments" ? "payment"
        : record.source === "activities" ? "activity" : "sms";

const normalize = (value: string) => value.trim().toLowerCase().replaceAll(" ", "_");
const key = (source: string, id: string) => `${source}\0${id}`;

/**
 * Diary is the visible event inventory. REST records enrich it when identity is
 * explicit or type+time is unique on both sides. Unmatched records stay visible
 * as separate evidence, never silently become a second copy of a Diary event.
 */
export function buildUnifiedJobContext(rest: RestJobContext, diary: readonly DiaryRecord[]): UnifiedJobContext {
  const sources: (RestContextEvent & { source: RestSource })[] =
    (Object.entries(rest.sources) as [RestSource, RestJobContext["sources"][RestSource]][])
      .flatMap(([source, result]) => result.status === "complete" ? result.events.map((event) => ({ ...event, source })) : []);
  const used = new Set<string>();
  const diaryKeys = new Set<string>();
  const matched = new Map<string, { record: RestContextEvent & { source: RestSource }; method: "source_id" | "unique_type_timestamp" }>();

  for (const entry of diary) {
    if (diaryKeys.has(entry.diaryKey)) throw new Error("Duplicate Diary key");
    diaryKeys.add(entry.diaryKey);
    if (!entry.objectId) continue;
    const candidates = sources.filter((record) => record.sourceId === entry.objectId &&
      normalize(sourceType(record)) === normalize(entry.eventType));
    if (candidates.length > 1) throw new Error("Ambiguous Diary source ID");
    const record = candidates[0];
    if (!record) continue;
    if (entry.timestamp && record.timestamp && entry.timestamp !== record.timestamp) {
      throw new Error("Diary source ID timestamp mismatch");
    }
    const sourceKey = key(record.source, record.sourceId);
    if (used.has(sourceKey)) throw new Error("Source linked to multiple Diary rows");
    used.add(sourceKey);
    matched.set(entry.diaryKey, { record, method: "source_id" });
  }

  // Timestamp matching is limited to messages and notes. Attachment grouping,
  // payment presentation and scheduled Activity time have different semantics.
  const eligible = new Set(["note", "email", "reply", "sms"]);
  for (const entry of diary) {
    if (matched.has(entry.diaryKey) || entry.objectId || !entry.timestamp || !eligible.has(normalize(entry.eventType))) continue;
    const diaryCandidates = diary.filter((other) => other.timestamp === entry.timestamp &&
      normalize(other.eventType) === normalize(entry.eventType) && !matched.has(other.diaryKey));
    const sourceCandidates = sources.filter((record) => !used.has(key(record.source, record.sourceId)) &&
      record.active !== false && record.timestamp === entry.timestamp &&
      normalize(sourceType(record)) === normalize(entry.eventType));
    if (diaryCandidates.length !== 1 || sourceCandidates.length !== 1) continue;
    const record = sourceCandidates[0];
    used.add(key(record.source, record.sourceId));
    matched.set(entry.diaryKey, { record, method: "unique_type_timestamp" });
  }

  const events: UnifiedEvent[] = diary.map((entry) => {
    const match = matched.get(entry.diaryKey);
    const record = match?.record;
    const preview = entry.contentPreview ?? "";
    return {
      diaryKey: entry.diaryKey, timestamp: entry.timestamp, eventType: normalize(entry.eventType),
      source: record?.source ?? null, sourceId: record?.sourceId ?? null,
      sourceTimestamp: record?.timestamp ?? null, timestampField: record?.timestampField ?? null,
      match: match?.method ?? "diary_only", active: record?.active ?? null,
      visibleInUi: entry.visibleInUi ?? null,
      contentState: record?.contentState ?? (preview ? "preview_only" : "unavailable"),
      ...(record?.content !== undefined ? { content: record.content } : {}),
      previewTruncated: /(?:\.\.\.|\u2026)\s*$/.test(preview),
    };
  });
  const unlinkedSources: UnifiedEvent[] = sources.filter((record) => !used.has(key(record.source, record.sourceId)))
    .map((record) => ({ diaryKey: null, timestamp: record.timestamp, eventType: sourceType(record),
      source: record.source, sourceId: record.sourceId, sourceTimestamp: record.timestamp,
      timestampField: record.timestampField, match: "rest_only", active: record.active,
      visibleInUi: null, contentState: record.contentState,
      ...(record.content !== undefined ? { content: record.content } : {}), previewTruncated: false }));
  events.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? "") ||
    (a.diaryKey ?? "").localeCompare(b.diaryKey ?? ""));
  return {
    jobUUID: rest.jobUUID, jobNumber: rest.jobNumber, events, unlinkedSources, sourceStatus: rest.sources,
    diaryObserved: diary.length,
    matchedById: events.filter((event) => event.match === "source_id").length,
    matchedByUniqueTime: events.filter((event) => event.match === "unique_type_timestamp").length,
    diaryOnly: events.filter((event) => event.match === "diary_only").length,
    restOnly: unlinkedSources.length,
  };
}
