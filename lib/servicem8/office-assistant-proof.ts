import { z } from "zod";
import { uuidSchema } from "./event-schema";

const MAX_JOB_SEARCH_PAGES = 100;
const MAX_JOB_SEARCH_MATCHES = 20;
const MAX_NOTES = 200;
const MAX_NOTE_PAGES = 20;
const MAX_TEXT_LENGTH = 2_000;
const MAX_TOTAL_NOTE_TEXT = 20_000;
const MAX_EMAIL_BODY_LENGTH = 5_000;

const jobSchema = z.object({
  uuid: uuidSchema,
  companyUUID: uuidSchema,
  jobNumber: z.string().trim().min(1).max(100),
  address: z.string().max(500),
  status: z.string().max(100),
  jobDescription: z.string().max(20_000),
  workDoneDescription: z.string().max(20_000),
  createdAt: z.string().max(100),
}).strict();

const companySchema = z.object({
  uuid: uuidSchema,
  name: z.string().max(500),
}).strict();

const noteSchema = z.object({
  uuid: uuidSchema,
  jobUUID: uuidSchema,
  text: z.string(),
  createdAt: z.string().max(100),
}).strict();

export type ProofJob = z.infer<typeof jobSchema>;
export type ProofCompany = z.infer<typeof companySchema>;
export type ProofNote = z.infer<typeof noteSchema>;

export type ProofReader = {
  listJobsByNumber(jobNumbers: readonly string[]): Promise<unknown[]>;
  listJobsPage(cursor: string | null): Promise<{ jobs: unknown[]; nextCursor: string | null }>;
  getJob(jobUUID: string): Promise<unknown>;
  getCompany(companyUUID: string): Promise<unknown>;
  readNotesPage(jobUUID: string, cursor: string | null): Promise<{ notes: unknown[]; nextCursor: string | null }>;
};

export type ProofEvidence = {
  id: string;
  at: string | null;
  text: string;
};

export type ProofAnswerContent = {
  summary: { text: string; citations: string[] };
  timeline: { at: string; text: string; citations: string[] }[];
};

export type ProofSummarizer = {
  summarize(evidence: readonly ProofEvidence[]): Promise<{ summary: { citations: string[] } }>;
};

export type ProofEmailDrafter = {
  draft(evidence: readonly ProofEvidence[], purpose: string): Promise<{ citations: string[] }>;
};

export class ProofResolutionError extends Error {
  constructor() {
    super("Selected Job could not be resolved uniquely");
    this.name = "ProofResolutionError";
  }
}

export class ProofSearchTooBroadError extends Error {
  constructor() {
    super("Enter a more specific Job reference");
    this.name = "ProofSearchTooBroadError";
  }
}

type Dependencies = {
  reader: ProofReader;
  summarizer: ProofSummarizer;
  drafter?: ProofEmailDrafter;
  now?: () => Date;
};

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function searchableTokens(value: string) {
  return normalizeSearch(value).split(" ").filter(Boolean);
}

function normalizeText(value: string) {
  const dates: string[] = [];
  const protectedText = value.replace(/\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/g, (candidate) => {
    const parts = candidate.split(/[-/.]/).map(Number);
    const [year, month, day] = parts[0] > 999 ? parts : [parts[2], parts[1], parts[0]];
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return candidate;
    dates.push(candidate);
    return `\uE000DATE${dates.length - 1}\uE001`;
  });
  return protectedText
    .replace(/<[^>]*>/g, " ")
    .replace(/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[token redacted]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[uuid redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [secret redacted]")
    .replace(/\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, "Basic [secret redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gi, "[secret redacted]")
    .replace(/(["']?)(password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\1\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/gi, "$1$2$1=[secret redacted]")
    .replace(/\s+/g, " ")
    .replace(/\uE000DATE(\d+)\uE001/g, (_marker, index: string) => dates[Number(index)] ?? "")
    .trim();
}

function emailObjective(purpose: string) {
  return purpose
    .replace(/^ask\s+(?:the\s+)?[a-z'-]+\s+to\s+/i, "")
    .replace(/^(?:please\s+|could you please\s+)/i, "")
    .replace(/\s+(?:because|since|as)\b.*$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

function emailSubject(jobNumber: string, objective: string) {
  let topic = objective
    .replace(/\s+(?:with|before|after)\b.*$/i, "")
    .replace(/^(\S+)\s+(?:the|an?)\s+/i, "$1 ")
    .trim();
  const withoutTiming = topic.replace(/\s+for\s+(?:next|this|last)\s+(?:week|month|year)(?:'s)?\b.*$/i, "");
  if (withoutTiming.split(/\s+/).length >= 3) topic = withoutTiming;
  const confirmation = /^confirm\s+(?:whether\s+|if\s+)?(?:the\s+)?(.+)$/i.exec(objective);
  const followUp = /^follow up after (?:the )?(.+)$/i.exec(objective);
  const followUpWith = /^follow up with .+?\s+(?:about|regarding|on)\s+(?:the\s+)?(.+)$/i.exec(objective);
  const request = /^request\s+(?:an?\s+)?(.+)$/i.exec(objective);
  const customerUpdate = /^(?:give|provide|send)\s+(?:the\s+)?(?:customer|client)\s+(?:an?\s+)?(.+)$/i.exec(objective);
  const generalTopic = /^(?:discuss|check|review|clarify|arrange|coordinate)\s+(?:the\s+|an?\s+)?(.+)$/i.exec(objective);
  if (confirmation) topic = `Confirm ${confirmation[1]}`;
  else if (followUp) topic = `${followUp[1]} follow-up`;
  else if (followUpWith) topic = `${followUpWith[1]} follow-up`;
  else if (request) topic = `${request[1]} request`;
  else if (customerUpdate) topic = customerUpdate[1];
  else if (generalTopic) {
    const detail = generalTopic[1].replace(/\s+(?:with|before|after)\b.*$/i, "").trim();
    if (detail) topic = `Regarding ${detail}`;
  }
  topic = topic.replace(/^./, (letter) => letter.toUpperCase());
  const clipped = topic.length <= 55
    ? topic
    : topic.slice(0, 55).replace(/\s+\S*$/, "").trim() || topic.slice(0, 55);
  return `${jobNumber} – ${clipped}`;
}

function normalizeDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("ServiceM8 returned an invalid timestamp");
  return new Date(timestamp).toISOString();
}

function buildSummary(
  answer: { summary: { citations: string[] } },
  evidence: readonly ProofEvidence[],
  job: ProofJob,
): ProofAnswerContent["summary"] {
  const references = new Set(evidence.map((item) => item.id));
  const selected = answer.summary?.citations;
  if (!Array.isArray(selected) || selected.length === 0 || selected.length > 3 ||
      new Set(selected).size !== selected.length || selected.some((citation) => !references.has(citation))) {
    throw new Error("Proof answer has an unsupported citation");
  }

  const selectedNotes = selected
    .filter((citation) => citation.startsWith("note:"))
    .map((citation) => evidence.find((item) => item.id === citation)?.text)
    .filter((text): text is string => typeof text === "string");
  const base = `Job ${job.jobNumber} at ${job.address || "address not supplied"} is recorded as ${job.status || "status not supplied"}.`;
  const text = selectedNotes.length === 0 ? base : `${base} Key diary evidence: ${selectedNotes.join(" ")}`;
  return { text, citations: ["job:record", ...selected.filter((citation) => citation.startsWith("note:"))] };
}

function evidenceTimeline(evidence: readonly ProofEvidence[]) {
  return evidence
    .filter((item): item is ProofEvidence & { at: string } => item.at !== null)
    .map((item) => ({ at: item.at, text: item.text, citations: [item.id] }))
    .sort((left, right) => left.at.localeCompare(right.at));
}

function buildEmailDraft(
  selection: { citations: string[] },
  evidence: readonly ProofEvidence[],
  job: ProofJob,
  company: ProofCompany,
  purpose: string,
) {
  const references = new Set(evidence.map((item) => item.id));
  const selected = selection.citations;
  if (
    !Array.isArray(selected) || selected.length === 0 || selected.length > 5 ||
    new Set(selected).size !== selected.length || selected.some((citation) => !references.has(citation))
  ) {
    throw new Error("Email draft has an unsupported citation");
  }

  const selectedNotes = selected
    .filter((citation) => citation.startsWith("note:"))
    .map((citation) => evidence.find((item) => item.id === citation))
    .filter((item): item is ProofEvidence => item !== undefined);
  const normalizedAddress = normalizeText(job.address);
  const address = normalizedAddress ? ` at ${normalizedAddress}` : "";
  const programmingRequest = /\bprogram(?:med|ming)?\b/i.test(purpose) && /\bBC\b/i.test(purpose);
  const approvalUncertain = selectedNotes.some((note) => /\bBC\b.{0,60}\b(?:not|pending|awaiting|unconfirmed|declined|rejected|revoked)\b/i.test(note.text));
  const approvedInEvidence = !approvalUncertain && selectedNotes.some((note) =>
    /\bBC\b\s+(?:(?:has\s+been|was|is)\s+)?approved\b(?!\s*\?)/i.test(note.text));
  const objective = emailObjective(purpose);
  const subject = programmingRequest
    ? `${job.jobNumber} – ${approvedInEvidence ? "Confirm programming after BC approval" : "Confirm BC status and programming"}`
    : emailSubject(job.jobNumber, objective);
  const request = programmingRequest
    ? approvedInEvidence
      ? "Could you please confirm whether this Job can now be programmed following the BC approval?"
      : "Could you please confirm whether BC approval has been received and whether this Job can now be programmed?"
    : `Could you please ${objective.replace(/^./, (letter) => letter.toLowerCase())}?`;
  const prefix = [
    "Hello,",
    "",
    `I'm writing regarding Job ${job.jobNumber}${address}.`,
  ].join("\n") + "\n\n";
  const suffix = "\n\nKind regards,\nRoyal Glass";

  return {
    subject,
    body: `${prefix}${request}${suffix}`.slice(0, MAX_EMAIL_BODY_LENGTH),
    citations: ["job:record", "company:record", ...selectedNotes.map((note) => note.id)],
  };
}

function jobEvidence(job: ProofJob, company: ProofCompany): ProofEvidence[] {
  const description = normalizeText(job.jobDescription);
  const workDone = normalizeText(job.workDoneDescription);
  const facts = [
    `Job number: ${job.jobNumber}`,
    `Status: ${job.status || "Not supplied"}`,
    `Address: ${job.address || "Not supplied"}`,
    `Job description: ${description || "Not supplied"}`,
    `Work completed description: ${workDone || "Not supplied"}`,
  ].join("\n");
  return [
    { id: "job:record", at: job.createdAt ? normalizeDate(job.createdAt) : null, text: facts },
    { id: "company:record", at: null, text: `Customer: ${normalizeText(company.name) || "Not supplied"}` },
  ];
}

export function createOfficeAssistantProof({ reader, summarizer, drafter, now = () => new Date() }: Dependencies) {
  async function jobsByNumber(jobNumbers: readonly string[]) {
    const rows = await reader.listJobsByNumber(jobNumbers);
    return rows
      .map((row) => jobSchema.parse(row))
      .filter((job) => jobNumbers.includes(job.jobNumber));
  }

  async function selectedJobEvidence(requestedJobNumber: string) {
    const jobNumber = requestedJobNumber.trim().toUpperCase();
    const matches = await jobsByNumber([jobNumber]);
    if (matches.length !== 1) throw new ProofResolutionError();
    const listedJob = matches[0];
    const job = jobSchema.parse(await reader.getJob(listedJob.uuid));
    if (job.uuid !== listedJob.uuid || job.jobNumber !== jobNumber) {
      throw new Error("ServiceM8 returned a different Job");
    }

    const company = companySchema.parse(await reader.getCompany(job.companyUUID));
    if (company.uuid !== job.companyUUID) throw new Error("ServiceM8 returned a different Company");

    const evidence = jobEvidence(job, company);
    const noteIds = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | null = null;
    let noteTextLength = 0;
    let truncated = false;

    for (let page = 0; page < MAX_NOTE_PAGES; page += 1) {
      const result = await reader.readNotesPage(job.uuid, cursor);
      for (const rawNote of result.notes) {
        const note = noteSchema.parse(rawNote);
        if (note.jobUUID !== job.uuid) throw new Error("ServiceM8 returned a Note for a different Job");
        if (noteIds.has(note.uuid)) continue;
        const text = normalizeText(note.text);
        if (evidence.length - 2 === MAX_NOTES || noteTextLength + text.length > MAX_TOTAL_NOTE_TEXT) {
          truncated = true;
          break;
        }
        noteIds.add(note.uuid);
        const clipped = text.slice(0, MAX_TEXT_LENGTH);
        evidence.push({ id: `note:${evidence.length - 1}`, at: normalizeDate(note.createdAt), text: clipped });
        noteTextLength += clipped.length;
        if (text.length > clipped.length) truncated = true;
      }
      if (truncated || result.nextCursor === null) break;
      if (cursors.has(result.nextCursor)) throw new Error("Repeated Note page cursor");
      cursors.add(result.nextCursor);
      cursor = result.nextCursor;
      if (page === MAX_NOTE_PAGES - 1) truncated = true;
    }

    return {
      job,
      company,
      evidence,
      coverage: {
        included: ["core Job/customer fields", "Job diary notes"],
        excluded: ["email", "SMS", "forms", "attachments", "schedule activity"],
        noteCount: evidence.length - 2,
        truncated,
        snapshotAt: now().toISOString(),
      },
    };
  }

  return {
    async searchJobs(query: string) {
      const tokens = searchableTokens(query);
      if (tokens.length === 0) return [];
      const exactJobNumber = query.trim().toUpperCase();
      if (/^[A-Z]\d{6}$/.test(exactJobNumber)) return jobsByNumber([exactJobNumber]);

      const matches: ProofJob[] = [];
      const cursors = new Set<string>();
      let cursor: string | null = null;
      for (let page = 0; page < MAX_JOB_SEARCH_PAGES; page += 1) {
        const result = await reader.listJobsPage(cursor);
        for (const row of result.jobs) {
          const job = jobSchema.parse(row);
          const haystack = normalizeSearch(`${job.jobNumber} ${job.address}`);
          if (tokens.every((token) => haystack.includes(token))) {
            matches.push(job);
            if (matches.length > MAX_JOB_SEARCH_MATCHES) throw new ProofSearchTooBroadError();
          }
        }
        if (result.nextCursor === null) return matches;
        if (cursors.has(result.nextCursor)) throw new Error("Repeated Job page cursor");
        cursors.add(result.nextCursor);
        cursor = result.nextCursor;
      }
      throw new Error("Job search exceeded the page limit");
    },

    async answerWhatHappened(requestedJobNumber: string) {
      const { job, company, evidence, coverage } = await selectedJobEvidence(requestedJobNumber);
      const content = await summarizer.summarize(evidence);
      const summary = buildSummary(content, evidence, job);
      return {
        job: { jobNumber: job.jobNumber, address: job.address, status: job.status, customerName: company.name },
        summary,
        timeline: evidenceTimeline(evidence),
        coverage,
      };
    },

    async draftEmail(requestedJobNumber: string, requestedPurpose: string) {
      if (!drafter) throw new Error("Email drafting is not configured");
      const purpose = normalizeText(requestedPurpose.trim());
      if (!purpose || purpose.length > 500) throw new Error("Email purpose is invalid");
      const { job, company, evidence, coverage } = await selectedJobEvidence(requestedJobNumber);
      const selection = await drafter.draft(evidence, purpose);
      const draft = buildEmailDraft(selection, evidence, job, company, purpose);
      return {
        job: { jobNumber: job.jobNumber, address: job.address, customerName: company.name },
        purpose,
        draft,
        coverage,
      };
    },
  };
}
