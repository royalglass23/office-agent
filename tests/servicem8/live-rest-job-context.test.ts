import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ServiceM8ApiError, type ServiceM8Client } from "@/lib/servicem8/client";
import { checkContextForTask, readRestJobContext, restSources } from "@/lib/servicem8/rest-job-context";
import { buildUnifiedJobContext } from "@/lib/servicem8/unified-job-context";
import { answerUnifiedJobQuestion } from "@/lib/servicem8/unified-job-agent";

// Opt-in, read-only account-key probe. This does not prove Office Agent staff OAuth.
loadEnvConfig(process.cwd());
const live = process.env.SERVICEM8_LIVE_VERIFY === "1";
const base = "https://api.servicem8.com/api_1.0/";
const fixtures = ["R260609", "R260611"] as const;
type DiarySnapshot = { index: number; at: string; type: string; objectType: string | null;
  objectId: string | null; previewState: "empty" | "truncated" | "present"; visibleInMichaelUI: boolean };
const diarySnapshots = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/servicem8-diary-snapshots.json"), "utf8")) as
  { jobs: Record<string, DiarySnapshot[]> };

function liveReader(key: string) {
  const request = async (path: string) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(new URL(path, base), {
          method: "GET",
          headers: { "X-API-Key": key, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
      } catch { throw new ServiceM8ApiError("ServiceM8 GET unavailable", 503, true); }
      if (response.ok) return response;
      if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      throw new ServiceM8ApiError("ServiceM8 GET unavailable", response.status, response.status === 429 || response.status >= 500);
    }
    throw new ServiceM8ApiError("ServiceM8 GET unavailable", 503, true);
  };
  const page = async (resource: string, filter: string, cursor: string | null) => {
    const query = new URLSearchParams({ $filter: filter, cursor: cursor ?? "-1" });
    const response = await request(`${resource}.json?${query}`);
    return { records: await response.json() as unknown[], nextCursor: response.headers.get("x-next-cursor") };
  };
  const related = (job: string) => `related_object eq 'job' and related_object_uuid eq '${job}'`;
  const byJob = (job: string) => `job_uuid eq '${job}'`;
  return {
    getVendor: async () => (await request("vendor.json")).json() as Promise<unknown>,
    getJob: async (job: string) => (await request(`job/${job}.json`)).json() as Promise<unknown>,
    getJobNote: async (id: string) => (await request(`dbonote/${id}.json`)).json() as Promise<unknown>,
    getJobEmail: async (id: string) => (await request(`email/${id}.json`)).json() as Promise<unknown>,
    listJobsByNumber: async (jobNumber: string) => page("job", `generated_job_id eq '${jobNumber}'`, null),
    listJobNotesPage: (job: string, cursor: string | null) => page("note", related(job), cursor),
    listJobEmailsPage: (job: string, cursor: string | null) => page("email", related(job), cursor),
    listJobSmsPage: (job: string, cursor: string | null) => page("sms", related(job), cursor),
    listJobActivitiesPage: (job: string, cursor: string | null) => page("jobactivity", byJob(job), cursor),
    listJobAttachmentsPage: (job: string, cursor: string | null) => page("attachment", related(job), cursor),
    listJobPaymentsPage: (job: string, cursor: string | null) => page("jobpayment", byJob(job), cursor),
  };
}

describe.skipIf(!live)("live account-key REST context verification", () => {
  it.each(fixtures)("reads %s without writing or printing customer data", async (jobNumber) => {
    const key = process.env.SERVICEM8_API_KEY_FULL;
    if (!key) throw new Error("SERVICEM8_API_KEY_FULL is unavailable");
    const reader = liveReader(key);
    const vendor = await reader.getVendor();
    if (!Array.isArray(vendor) || vendor.length !== 1 || vendor[0]?.uuid !== process.env.SERVICEM8_ALLOWED_ACCOUNT_UUID) {
      throw new Error("ServiceM8 account binding failed");
    }
    const parent = await reader.listJobsByNumber(jobNumber);
    if (parent.nextCursor !== null || parent.records.length !== 1) throw new Error("Job lookup incomplete or ambiguous");
    const job = parent.records[0] as { uuid?: string; generated_job_id?: string };
    if (!job.uuid || job.generated_job_id !== jobNumber) throw new Error("Job lookup mismatch");
    const context = await readRestJobContext(reader as unknown as ServiceM8Client, job.uuid);
    const snapshot = diarySnapshots.jobs[jobNumber];
    const unified = buildUnifiedJobContext(context, snapshot.map((entry) => ({
      diaryKey: `${jobNumber}:${entry.index}`, timestamp: entry.at, eventType: entry.type,
      objectType: entry.objectType, objectId: entry.objectId,
      contentPreview: entry.previewState === "truncated" ? "..." : entry.previewState === "present" ? "present" : "",
      visibleInUi: entry.visibleInMichaelUI,
    })));
    const evidence = Object.fromEntries(restSources.map((source) => [source, {
      status: context.sources[source].status, issue: context.sources[source].issue, pages: context.sources[source].pages,
      count: context.sources[source].events.length,
      fullContent: context.sources[source].events.filter((event) => event.contentState === "full").length,
      emptyContent: context.sources[source].events.filter((event) => event.contentState === "empty").length,
      unavailableContent: context.sources[source].events.filter((event) => event.contentState === "unavailable").length,
      missingTimestamp: context.sources[source].events.filter((event) => event.timestamp === null).length,
    }]));
    console.log(JSON.stringify({ jobNumber, auth: "account_api_key", diaryCoverage: context.diaryCoverage, sources: evidence }));
    console.log(JSON.stringify({ jobNumber, unified: {
      diaryRows: unified.diaryObserved, matchedById: unified.matchedById,
      matchedByUniqueTime: unified.matchedByUniqueTime, diaryOnly: unified.diaryOnly,
      restOnly: unified.restOnly,
      visibleDiaryOnly: unified.events.filter((e) => e.match === "diary_only" && e.visibleInUi).map((e) => ({
        type: e.eventType, at: e.timestamp,
      })),
      sourceOnly: unified.unlinkedSources.map((e) => ({
        type: e.eventType, at: e.timestamp, active: e.active,
      })),
    } }));
    console.log(JSON.stringify({ jobNumber, taskReadiness: Object.fromEntries(
      (["latest_communication", "customer_response", "blockers", "next_action"] as const)
        .map((task) => [task, checkContextForTask(context, task)])) }));
    console.log(JSON.stringify({ jobNumber, communicationTimeline: ["notes", "email", "sms"].flatMap((source) =>
      context.sources[source as "notes" | "email" | "sms"].events.map((event) => ({
        type: source === "notes" ? "note" : source === "sms" ? "sms" : event.direction === "inbound" ? "reply" : "email",
        at: event.timestamp, active: event.active,
      }))).filter((event) => event.active !== false).sort((a, b) => b.at!.localeCompare(a.at!)) }));
    const activityPage = await reader.listJobActivitiesPage(job.uuid, null);
    console.log(JSON.stringify({ jobNumber, activityTimes: activityPage.records.map((raw) => {
      const row = raw as { start_date?: string; end_date?: string; edit_date?: string; active?: number };
      return { start: row.start_date ?? null, end: row.end_date ?? null, edit: row.edit_date ?? null, active: row.active ?? null };
    }) }));
    expect(context.jobNumber).toBe(jobNumber);
    for (const source of restSources) expect(context.sources[source].status).toBe("complete");
    expect(snapshot.filter((entry) => entry.visibleInMichaelUI)).toHaveLength(jobNumber === "R260609" ? 20 : 47);
    expect(unified.events).toHaveLength(snapshot.length);
    expect(unified.events.filter((event) => event.visibleInUi &&
      ["note", "email", "reply", "sms"].includes(event.eventType) && !event.sourceId)).toHaveLength(0);
    expect(unified.matchedById + unified.matchedByUniqueTime).toBe(jobNumber === "R260609" ? 10 : 29);
    if (process.env.SERVICEM8_LIVE_AGENT_VERIFY === "1") {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL;
      if (!apiKey || !model || process.env.OPENAI_DATA_CONTROLS_VERIFIED !== "true") {
        throw new Error("Configured OpenAI proof controls unavailable");
      }
      const options = { apiKey, model };
      const latest = unified.events.find((event) => event.match !== "diary_only" && event.sourceId &&
        ["email", "reply", "sms"].includes(event.eventType));
      const reply = unified.events.find((event) => event.match !== "diary_only" && event.sourceId && event.eventType === "reply");
      if (!latest || !reply) throw new Error("Live communication reference unavailable");
      const questions = [
        { kind: "answer" as const, text: "What was the latest customer-facing communication, and what was the latest customer reply?" },
        { kind: "answer" as const, text: "What currently blocks progress, and what should the office team check next?" },
        { kind: "email_draft" as const, text: "Draft a concise, polite follow-up based on the latest customer reply. Ask one useful question appropriate to the job's current state. Do not promise a date or price." },
      ];
      for (const [index, question] of questions.entries()) {
        const result = await answerUnifiedJobQuestion(unified, question, options);
        const allText = `${result.answer} ${result.subject} ${result.body}`;
        const hasContactLeak = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:\+?64|0)2\d[\d -]{6,}\b|\b\d{1,4}\s+\w+(?:\s+\w+){0,3}\s+(?:Road|Street|Avenue|Drive)\b/i.test(allText);
        const citedLatest = result.citations.includes(`${latest.source}:${latest.sourceId}`);
        const citedReply = result.citations.includes(`${reply.source}:${reply.sourceId}`);
        const projectSignal = jobNumber === "R260609" ? /\b(?:BC|consent)\b/i.test(allText)
          : /\b(?:payment|install|complete|finish|satisf|issue)\w*\b/i.test(allText);
        const actionSignal = /\b(?:follow|check|confirm|ask|review|update)\w*\b/i.test(allText);
        console.log(JSON.stringify({ jobNumber, agentQuestion: index + 1, kind: question.kind,
          citationCount: result.citations.length, citedLatest, citedReply,
          reportedGapCount: result.gaps.length, answerLength: result.answer.length,
          subjectLength: result.subject.length, bodyLength: result.body.length,
          draftHasQuestion: result.body.includes("?"), projectSignal, actionSignal, hasContactLeak }));
        expect(hasContactLeak).toBe(false);
        if (index === 0) { expect(citedLatest).toBe(true); expect(citedReply).toBe(true); }
        if (index > 0) { expect(projectSignal).toBe(true); expect(actionSignal).toBe(true); }
        if (question.kind === "email_draft") expect(result.body.includes("?")).toBe(true);
      }
    }
  }, 300_000);
});
