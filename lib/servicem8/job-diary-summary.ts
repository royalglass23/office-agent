declare const authorizedJobLaunchBrand: unique symbol;

/** Issued by a future server-side authorization module; never derived from request JSON. */
export type AuthorizedJobLaunch = { readonly [authorizedJobLaunchBrand]: true };

const DIARY_SOURCES = ["notes", "sms", "attachments", "email", "schedule"] as const;
export type DiarySourceName = (typeof DIARY_SOURCES)[number];

export type DiaryEntry = {
  source: DiarySourceName;
  id: string;
  text: string;
  createdAt: string;
};

export type DiaryPage = { entries: DiaryEntry[]; nextCursor: string | null };

export type DiaryReader = {
  requireJobAccess(launch: AuthorizedJobLaunch): Promise<void>;
  readPage(launch: AuthorizedJobLaunch, source: DiarySourceName, cursor: string | null): Promise<DiaryPage>;
};

export type SummaryPoint = { text: string; citations: string[] };

export type JobDiarySummary = {
  headline: SummaryPoint;
  overview: SummaryPoint;
  currentState: SummaryPoint[];
  decisions: SummaryPoint[];
  outstandingActions: SummaryPoint[];
  risksAndQuestions: SummaryPoint[];
  timeline: { at: string; point: SummaryPoint }[];
  coverage: {
    includedSources: DiarySourceName[];
    excludedSources: { source: DiarySourceName; reason: string }[];
    itemCount: number;
    truncated: boolean;
    snapshotAt: string;
  };
};

export type DiarySummarizer = {
  summarize(entries: readonly DiaryEntry[]): Promise<Omit<JobDiarySummary, "coverage">>;
};

type Dependencies = {
  reader: DiaryReader;
  summarizer: DiarySummarizer;
  enabledSources: readonly DiarySourceName[];
  excludedSources?: readonly { source: DiarySourceName; reason: string }[];
  now?: () => Date;
};

const MAX_ENTRIES = 200;
const MAX_PAGES_PER_SOURCE = 20;
const MAX_TEXT_LENGTH = 2_000;
const MAX_TOTAL_TEXT_LENGTH = 20_000;

function normaliseText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[token redacted]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[uuid redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone redacted]")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseEntry(value: DiaryEntry, source: DiarySourceName): { entry: DiaryEntry; truncated: boolean } {
  if (value.source !== source || !/^[A-Za-z0-9_-]{1,100}$/.test(value.id) ||
      !Number.isFinite(Date.parse(value.createdAt)) || typeof value.text !== "string") {
    throw new Error("Invalid diary entry");
  }
  const text = normaliseText(value.text);
  return {
    entry: {
      source,
      id: value.id,
      text: text.slice(0, MAX_TEXT_LENGTH),
      createdAt: new Date(value.createdAt).toISOString(),
    },
    truncated: text.length > MAX_TEXT_LENGTH,
  };
}

function checkCitations(summary: Omit<JobDiarySummary, "coverage">, references: Set<string>) {
  const points = [
    summary.headline,
    summary.overview,
    ...summary.currentState,
    ...summary.decisions,
    ...summary.outstandingActions,
    ...summary.risksAndQuestions,
    ...summary.timeline.map((item) => item.point),
  ];
  for (const point of points) {
    if (!point || typeof point.text !== "string" || !Array.isArray(point.citations) ||
        (references.size > 0 && point.citations.length === 0) ||
        point.citations.some((reference) => !references.has(reference))) {
      throw new Error("Summary contains an unsupported citation");
    }
  }
}

export function createJobDiarySummaryModule({
  reader, summarizer, enabledSources, excludedSources = [], now = () => new Date(),
}: Dependencies) {
  return {
    async summarizeJobDiary(launch: AuthorizedJobLaunch): Promise<JobDiarySummary> {
      await reader.requireJobAccess(launch);
      const entries: DiaryEntry[] = [];
      const references = new Set<string>();
      const includedSources: DiarySourceName[] = [];
      let truncated = false;
      let totalTextLength = 0;

      for (const source of enabledSources) {
        includedSources.push(source);
        let cursor: string | null = null;
        const cursors = new Set<string>();
        for (let pageNumber = 0; pageNumber < MAX_PAGES_PER_SOURCE; pageNumber += 1) {
          const page = await reader.readPage(launch, source, cursor);
          for (const rawEntry of page.entries) {
            const normalised = normaliseEntry(rawEntry, source);
            const { entry } = normalised;
            const reference = `${source}:${entry.id}`;
            if (references.has(reference)) continue;
            if (entries.length === MAX_ENTRIES || totalTextLength + entry.text.length > MAX_TOTAL_TEXT_LENGTH) {
              truncated = true;
              break;
            }
            references.add(reference);
            entries.push(entry);
            totalTextLength += entry.text.length;
            if (normalised.truncated) truncated = true;
          }
          if (truncated || page.nextCursor === null) break;
          if (cursors.has(page.nextCursor)) throw new Error("Repeated diary page cursor");
          cursors.add(page.nextCursor);
          cursor = page.nextCursor;
          if (pageNumber === MAX_PAGES_PER_SOURCE - 1) truncated = true;
        }
        if (truncated) break;
      }

      const result: Omit<JobDiarySummary, "coverage"> = entries.length === 0 ? {
        headline: {
          text: enabledSources.length === 0 ? "No diary sources selected" :
            truncated ? "No content in the partial diary snapshot" : "No diary content available",
          citations: [],
        },
        overview: {
          text: enabledSources.length === 0 ? "Select a diary source to summarize." :
            truncated ? "The source read was incomplete; later entries may exist." :
              "No entries were found in the included sources.",
          citations: [],
        },
        currentState: [],
        decisions: [],
        outstandingActions: [],
        risksAndQuestions: [],
        timeline: [],
      } : await summarizer.summarize(entries);
      checkCitations(result, references);
      return {
        ...result,
        coverage: {
          includedSources,
          excludedSources: DIARY_SOURCES.filter((source) => !includedSources.includes(source)).map((source) => ({
            source,
            reason: enabledSources.includes(source) ? "Not read because the summary limit was reached" :
              excludedSources.find((item) => item.source === source)?.reason ?? "Not enabled in this summary",
          })),
          itemCount: entries.length,
          truncated,
          snapshotAt: now().toISOString(),
        },
      };
    },
  };
}
