import { z } from "zod";
import { getConfig } from "@/lib/config";
import { assistantRateLimit, assistantSessionHash, issueAssistantSession, verifyAssistantSession } from "@/lib/security/assistant-session";
import { correlationId, safeLog } from "@/lib/security/safe-log";
import { ServiceM8Client, requireVendorAccount } from "@/lib/servicem8/client";
import { ServiceM8ProofReader } from "@/lib/servicem8/proof-reader";
import { readRestJobContext } from "@/lib/servicem8/rest-job-context";
import { buildUnifiedJobContext } from "@/lib/servicem8/unified-job-context";
import { answerUnifiedJobQuestion } from "@/lib/servicem8/unified-job-agent";
import type { JobAgentResult } from "@/lib/servicem8/unified-job-agent";
import type { RestJobContext } from "@/lib/servicem8/rest-job-context";
import { renderStagingJobSlice, type StagingView } from "@/lib/servicem8/staging-job-slice-html";
import { consumeEventHash } from "@/lib/storage/consumed-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formSchema = z.object({ session: z.string().min(1).max(4096), jobNumber: z.string().regex(/^[A-Z]\d{6}$/),
  action: z.enum(["view", "latest", "check", "draft"]) }).strict();
const headers = { "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

function response(view: StagingView, status = 200) {
  return new Response(renderStagingJobSlice(view), { status, headers });
}

function latestCommunicationCited(context: RestJobContext, result: JobAgentResult) {
  const messages = [...context.sources.email.events, ...context.sources.sms.events]
    .filter((event) => event.active !== false && event.timestamp && event.contentState === "full")
    .sort((a, b) => b.timestamp!.localeCompare(a.timestamp!));
  const latest = messages[0];
  const reply = messages.find((event) => event.direction === "inbound");
  if (!latest) return false;
  const ids = new Set(result.citations);
  return ids.has(`${latest.source}:${latest.sourceId}`) &&
    (!reply || ids.has(`${reply.source}:${reply.sourceId}`));
}

export async function POST(request: Request) {
  const requestId = correlationId();
  const config = getConfig();
  if (!config.stagingJobSliceEnabled || !config.assistantProof.enabled) return new Response("Unavailable", { status: 404 });
  const actionUrl = new URL("/assistant/staging", config.appBaseUrl);
  if (request.headers.get("content-type")?.split(";", 1)[0].toLowerCase() !== "application/x-www-form-urlencoded") {
    return new Response("Invalid request", { status: 400 });
  }
  let form: z.infer<typeof formSchema>;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 8192) throw new Error("Oversized form");
    const fields = new URLSearchParams(body);
    if (fields.size !== 3 || [...new Set(fields.keys())].length !== 3) throw new Error("Invalid fields");
    form = formSchema.parse(Object.fromEntries(fields));
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
  let identity: Awaited<ReturnType<typeof verifyAssistantSession>>;
  try {
    identity = await verifyAssistantSession(form.session, config.sessionSigningSecret);
    if (identity.accountUUID !== config.allowedAccountUUID) throw new Error("Wrong account");
  } catch {
    return new Response("Session expired or invalid. Reopen the add-on from ServiceM8.", { status: 401 });
  }
  if (!(await consumeEventHash(assistantSessionHash(form.session), new Date(identity.launchExpiresAt * 1000)))) {
    return new Response("Session already used. Reopen the add-on from ServiceM8.", { status: 409 });
  }
  const session = await issueAssistantSession(identity, config.sessionSigningSecret, new Date(), identity.launchExpiresAt);
  const base: StagingView = { actionUrl, session };
  const limit = assistantRateLimit(identity, form.action === "draft" ? "draft" : "summary");
  let slot = false;
  for (const hash of limit.hashes) {
    if (await consumeEventHash(hash, limit.expiresAt)) { slot = true; break; }
  }
  if (!slot) return response({ ...base, error: "Please wait before trying again." }, 429);
  try {
    const client = new ServiceM8Client(identity.accountUUID, identity.staffUUID);
    await requireVendorAccount(client, identity.accountUUID);
    const reader = new ServiceM8ProofReader(client);
    const matches = await reader.listJobsByNumber([form.jobNumber]);
    if (matches.length !== 1 || matches[0].jobNumber !== form.jobNumber) {
      return response({ ...base, error: "The Job was not found uniquely or access was denied." }, 404);
    }
    const job = await reader.getJob(matches[0].uuid);
    if (job.uuid !== matches[0].uuid || job.jobNumber !== form.jobNumber) throw new Error("Parent Job mismatch");
    const jobView = { jobNumber: job.jobNumber, status: job.status, address: job.address };
    if (form.action === "view") return response({ ...base, job: jobView });
    const context = await readRestJobContext(client, job.uuid);
    if (context.jobNumber !== form.jobNumber || context.jobUUID !== job.uuid) throw new Error("Context parent mismatch");
    for (const source of ["email", "sms", "notes"] as const) {
      const result = context.sources[source];
      if (result.status !== "complete" || result.events.some((event) => event.active !== false &&
        (event.contentState !== "full" || !event.timestamp ||
          ((source === "email" || source === "sms") && event.direction === "unknown")))) {
        return response({ ...base, job: jobView,
          error: "The communication record is incomplete. No answer or draft was generated." }, 503);
      }
    }
    const unified = buildUnifiedJobContext(context, []);
    const questions = {
      latest: { kind: "answer" as const, text: "What is the latest recorded customer-facing Email or SMS, and the latest recorded customer reply? Qualify the source scope." },
      check: { kind: "answer" as const, text: "From the verified communications only, what is one proposed next office check? Disclose missing history and do not make a policy, pricing, schedule or technical decision." },
      draft: { kind: "email_draft" as const, text: "Prepare a concise follow-up email with one job-appropriate question based on the latest verified reply. No promises or send action." },
    };
    const result = await answerUnifiedJobQuestion(unified, questions[form.action], {
      apiKey: config.assistantProof.apiKey, model: config.assistantProof.model,
    });
    if (form.action === "latest" && !latestCommunicationCited(context, result)) {
      throw new Error("Latest message or reply not cited");
    }
    safeLog("info", "Completed staging Job check", { requestId, action: form.action });
    return response({ ...base, job: jobView, result, action: form.action });
  } catch {
    safeLog("warn", "Staging Job check failed closed", { requestId, action: form.action });
    return response({ ...base, error: "This Job check could not be verified. Review it in ServiceM8 or try again." }, 503);
  }
}
