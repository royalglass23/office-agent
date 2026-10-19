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
  draft(
    evidence: readonly ProofEvidence[], purpose: string, recipient: EmailRecipient, revision: EmailRevision,
    candidates: readonly EmailCandidate[], facts: readonly EmailFact[],
  ): Promise<{ candidateId: string; factId: string }>;
};

export type EmailCandidate = { id: string; subjectReason: string; question: string };
export type EmailFact = { id: string; text: string; citations: string[] };

export const emailRecipients = ["customer", "builder", "supplier", "internal"] as const;
export type EmailRecipient = typeof emailRecipients[number];
export const emailRevisions = ["shorter", "warmer", "more-formal"] as const;
export type EmailRevision = typeof emailRevisions[number] | "standard";

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

export class ProofGoalClarificationError extends Error {
  constructor(message = "State the specific question to ask the customer") {
    super(message);
    this.name = "ProofGoalClarificationError";
  }
}

export class ProofEmailSuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofEmailSuggestionError";
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

function isCustomerUpdate(objective: string) {
  return /^(?:(?:give|provide|send|share|write|draft)\s+(?:the\s+)?(?:customer|client)\s+(?:an?\s+)?(?:progress\s+)?update|update\s+(?:the\s+)?(?:customer|client))\b/i.test(objective);
}

function customerFollowUpQuestion(purpose: string) {
  const raw = /\bask\s+(?:(?:them|the customer|the client)\s+)?(.+)$/i.exec(purpose)?.[1];
  if (!raw) return null;
  const withReason = raw.replace(/[.!?]+$/, "").trim();
  let clause = withReason;
  for (const match of withReason.matchAll(/\s+(because|now that|given that|since|as)\b/gi)) {
    const marker = match[1].toLowerCase();
    const tail = withReason.slice(match.index).trim();
    if (marker === "as" && (
      /\b(?:early|late|soon)\s*$/i.test(withReason.slice(0, match.index)) ||
      /^as\s+(?:early|late|soon)\s+as\b/i.test(tail) ||
      (/^as\s+(?:(?:the|a|an)\s+)?(?:[\w'-]+\s+){0,5}(?:date|time|day|slot)$/i.test(tail) &&
        !/\b(?:has|have|had|is|was|were|are|been|approved|received|confirmed|paid|completed|booked|accepted|sent|arrived)\b/i.test(tail))
    )) continue;
    if (marker === "since" && /^since\s+(?:last|this)\s+(?:week|month|year|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(tail)) continue;
    clause = withReason.slice(0, match.index).trim();
    break;
  }
  if (!clause || clause.length > 160) return null;
  if (/^(?:whether|if)\s+they\s+have\s+any\s+questions$/i.test(clause)) {
    return "Please let us know if you have any questions.";
  }
  const directed = clause.replace(/\bthey\b/gi, "you").replace(/\bthem\b/gi, "you").replace(/\btheir\b/gi, "your");
  if (/^(?:whether|if|when|what|where|which|how)\b/i.test(directed)) {
    return `Could you please let us know ${directed}?`;
  }
  if (/^for\s+(?:your|the|an?)\s+\S/i.test(directed)) {
    return `Could you please share ${directed.replace(/^for\s+/i, "")}?`;
  }
  if (/^to\s+(?:confirm|share|provide|send|tell|approve|review|choose|suggest)\b/i.test(directed)) {
    return `Could you please ${directed.replace(/^to\s+/i, "")}?`;
  }
  return null;
}

export function validateEmailGoal(requestedPurpose: string, recipient: EmailRecipient) {
  const purpose = normalizeText(requestedPurpose.trim());
  if (!purpose || purpose.length > 500) throw new Error("Email purpose is invalid");
  if (recipient === "customer" && isCustomerUpdate(emailObjective(purpose)) &&
      /\bask\b/i.test(purpose) && !customerFollowUpQuestion(purpose)) {
    throw new ProofGoalClarificationError();
  }
  return purpose;
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

function emailCandidates(purpose: string, recipient: EmailRecipient): EmailCandidate[] {
  const candidates: EmailCandidate[] = [];
  const add = (id: string, subjectReason: string, question: string) => candidates.push({ id, subjectReason, question });
  const bc = /\bBC\b|\bbuilding consent\b/i.test(purpose);
  const programming = /\bprogram(?:med|ming)?\b/i.test(purpose);
  if (bc && programming) add("bc-programming", "BC status and programming", "Could you please confirm whether BC approval has been received and whether this Job can be programmed?");
  else if (bc) add("bc-status", "BC approval status", "Could you please confirm whether BC approval has been received?");
  else if (programming) add("programming", "Programming", "Could you please confirm whether this Job can be programmed?");
  if (/\bquote\b/i.test(purpose)) add("quote", "Quote follow-up", "Could you please confirm the current quote position and any next steps?");
  const day = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.exec(purpose)?.[1];
  if (day) {
    const installation = /\binstall(?:ation|ing)?\b/i.test(purpose);
    add("proposed-day", installation ? "Installation timing" : "Timing", `Would ${day} suit you ${installation ? "for installation" : "for the next step"}?`);
  } else if (/\binstall(?:ation|ing)?\b/i.test(purpose) && /\bdate|timing|schedule\b/i.test(purpose)) {
    add("installation-date", "Installation timing", "Could you please share your preferred installation date?");
  }
  if (/\bsite measure\b/i.test(purpose)) add("site-measure", "Site measure follow-up", "Could you please confirm the next step for the site measure?");
  if (recipient === "builder" && /\bcoordinat|site|access\b/i.test(purpose)) {
    add("builder-site", "Site timing and access", "Could you please confirm site timing and access requirements?");
  }
  if (recipient === "supplier" && /\bcoordinat|material|deliver\b/i.test(purpose)) {
    add("supplier-materials", "Materials and delivery", "Could you please confirm material availability and expected delivery timing?");
  }
  if (/\b(?:send|share|provide)\b.{0,50}\b(?:photos?|pictures?)\b/i.test(purpose)) {
    const subject = /\b(window|glass|door|pool|site|area)\b/i.exec(purpose)?.[1]?.toLowerCase();
    if (subject) add("condition-photos", "Photos of the Job", `Could you please send photos showing the current condition of the ${subject}?`);
    else add("job-photos", "Job photos", "Could you please send photos showing the current Job condition?");
  }
  if (candidates.length === 0) {
    if (recipient === "customer" && isCustomerUpdate(emailObjective(purpose))) {
      add("customer-update", "Progress update", "Could you please let us know if you have any questions about this Job?");
    } else if (/^(?:(?:please )?(?:ask (?:the )?(?:customer|builder|supplier) to )?confirm (?:the )?next steps?|(?:request|ask for) (?:an? )?update|follow up(?: on (?:the )?next steps?)?|coordinate (?:the )?next steps?)\.?$/i.test(purpose)) {
      add("next-step", "Next steps", "Could you please confirm the next step for this Job?");
    } else throw new ProofGoalClarificationError("I can draft questions about Job timing, quote or BC status, site access, materials, photos, or next steps. Which should this email ask about?");
  }
  return candidates;
}

function emailFacts(job: ProofJob): EmailFact[] {
  const facts: EmailFact[] = [];
  if (job.status) facts.push({ id: "job-status", text: `The Job is recorded as ${normalizeText(job.status)}.`, citations: ["job:record"] });
  return facts;
}

function buildEmailDraft(
  selection: { candidateId: string; factId: string },
  job: ProofJob,
  purpose: string,
  recipient: EmailRecipient,
  revision: EmailRevision,
  candidates: readonly EmailCandidate[],
  facts: readonly EmailFact[],
) {
  if (Object.keys(selection).sort().join(",") !== "candidateId,factId") {
    throw new ProofEmailSuggestionError("Email suggestion is invalid");
  }
  const candidate = candidates.find((item) => item.id === selection.candidateId);
  let fact = selection.factId === "none" ? null : facts.find((item) => item.id === selection.factId);
  if (!candidate || (selection.factId !== "none" && !fact)) throw new ProofEmailSuggestionError("Email suggestion is invalid");
  if (recipient === "customer" && isCustomerUpdate(emailObjective(purpose)) && !fact) {
    fact = facts[0];
    if (!fact) throw new ProofGoalClarificationError("The checked Job records do not support a progress update. Please choose a question-only goal or verify the update in ServiceM8.");
  }
  const normalizedAddress = normalizeText(job.address);
  const shortAddress = normalizedAddress.length > 70
    ? `${normalizedAddress.slice(0, 67).replace(/\s+\S*$/, "").trim()}…`
    : normalizedAddress;
  const jobReference = shortAddress ? `${shortAddress} (${job.jobNumber})` : job.jobNumber;
  const subject = `${jobReference} – ${candidate.subjectReason}`;
  if (subject.length > 200) throw new ProofEmailSuggestionError("Email suggestion is invalid");
  const greeting = recipient === "internal" ? "Hi team," : revision === "more-formal" ? "Dear team," : "Hello,";
  const address = normalizedAddress ? ` at ${normalizedAddress}` : "";
  const introduction = revision === "shorter" ? [] : [`I'm writing regarding Job ${job.jobNumber}${address}.`];
  const warmer = revision === "warmer" ? ["I hope you're well."] : [];
  const closing = revision === "shorter" ? "Thanks,\nRoyal Glass" : "Kind regards,\nRoyal Glass";
  const body = [greeting, ...warmer, ...introduction, ...(fact ? [fact.text] : []), candidate.question, closing].join("\n\n");
  if (body.length > MAX_EMAIL_BODY_LENGTH) throw new ProofEmailSuggestionError("Email suggestion is invalid");
  return { subject, body, citations: [...new Set(["job:record", "company:record", ...(fact?.citations ?? [])])] };
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

    async draftEmail(requestedJobNumber: string, requestedPurpose: string, recipient: EmailRecipient = "customer", revision: EmailRevision = "standard") {
      if (!drafter) throw new Error("Email drafting is not configured");
      if (!emailRecipients.includes(recipient)) throw new Error("Email recipient is invalid");
      if (revision !== "standard" && !emailRevisions.includes(revision as typeof emailRevisions[number])) throw new Error("Email revision is invalid");
      const purpose = validateEmailGoal(requestedPurpose, recipient);
      const { job, company, evidence, coverage } = await selectedJobEvidence(requestedJobNumber);
      const candidates = emailCandidates(purpose, recipient);
      const facts = emailFacts(job);
      if (recipient === "customer" && isCustomerUpdate(emailObjective(purpose)) && facts.length === 0) {
        throw new ProofGoalClarificationError("The checked Job records do not support a progress update. Please choose a question-only goal or verify the update in ServiceM8.");
      }
      const selection = await drafter.draft(evidence, purpose, recipient, revision, candidates, facts);
      const draft = buildEmailDraft(selection, job, purpose, recipient, revision, candidates, facts);
      return {
        job: { jobNumber: job.jobNumber, address: job.address, customerName: company.name },
        purpose,
        recipient,
        draft,
        sources: draft.citations.map((id) => evidence.find((item) => item.id === id)).filter((item): item is ProofEvidence => item !== undefined),
        coverage,
      };
    },
  };
}
