/** Reconciles read-only Diary inventory with independently verified source records. */
export type JobDiaryEntry = {
  diaryKey: string;
  source?: string | null;
  sourceId?: string | null;
  eventType: string;
  timestamp: string | null;
  contentPreview?: string | null;
};

export type JobSourceRecord = {
  source: string;
  sourceId: string;
  eventType: string;
  timestamp: string | null;
  contentState: "full" | "empty" | "unavailable";
  content?: string;
};

export type VerifiedMatch = { diaryKey: string; source: string; sourceId: string };

export function buildJobContext(
  diary: readonly JobDiaryEntry[],
  sources: readonly JobSourceRecord[],
  verifiedMatches: readonly VerifiedMatch[] = [],
) {
  const sourceKey = (source: string, id: string) => `${source}\0${id}`;
  const sourceByKey = new Map<string, JobSourceRecord>();
  for (const record of sources) {
    const key = sourceKey(record.source, record.sourceId);
    if (sourceByKey.has(key)) throw new Error("Duplicate source ID");
    if (record.contentState === "full" && !record.content) throw new Error("Full content missing");
    if (record.contentState !== "full" && record.content) throw new Error("Content state mismatch");
    sourceByKey.set(key, record);
  }
  const verified = new Map<string, string>();
  for (const match of verifiedMatches) {
    if (verified.has(match.diaryKey)) throw new Error("Multiple matches for Diary entry");
    verified.set(match.diaryKey, sourceKey(match.source, match.sourceId));
  }
  const usedSources = new Set<string>();
  const diaryKeys = new Set<string>();
  const events = diary.map((entry) => {
    if (diaryKeys.has(entry.diaryKey)) throw new Error("Duplicate Diary key");
    diaryKeys.add(entry.diaryKey);
    const explicitKey = entry.source && entry.sourceId ? sourceKey(entry.source, entry.sourceId) : undefined;
    if (verified.has(entry.diaryKey) && explicitKey && verified.get(entry.diaryKey) !== explicitKey) {
      throw new Error("Verified source conflicts with Diary ID");
    }
    const matching = verified.get(entry.diaryKey) ?? explicitKey;
    const source = matching ? sourceByKey.get(matching) : undefined;
    if (verified.has(entry.diaryKey) && !source) throw new Error("Verified source missing");
    if (source && (usedSources.has(matching!) || source.eventType !== entry.eventType)) throw new Error("Invalid source match");
    if (source) usedSources.add(matching!);
    const preview = entry.contentPreview ?? "";
    return {
      diaryKey: entry.diaryKey,
      eventType: entry.eventType,
      timestamp: entry.timestamp,
      source: source ? { system: source.source, id: source.sourceId, timestamp: source.timestamp } : null,
      contentState: source?.contentState ?? (preview.length === 0 ? "unavailable" : "preview_only"),
      content: source?.contentState === "full" ? source.content! : source?.contentState === "empty" ? "" : undefined,
      previewTruncated: /(?:\.\.\.|\u2026)\s*$/.test(preview),
      timestampMatch: source ? source.timestamp === entry.timestamp : null,
    };
  });
  for (const key of verified.keys()) if (!diaryKeys.has(key)) throw new Error("Verified Diary entry missing");
  return {
    events,
    // An unlinked REST row may be a second view of a Diary event. Never add it to the timeline as a new event.
    unresolvedSources: sources.filter((source) => !usedSources.has(sourceKey(source.source, source.sourceId)))
      .map((source) => ({ source: source.source, sourceId: source.sourceId, eventType: source.eventType, timestamp: source.timestamp })),
  };
}
