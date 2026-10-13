import { getConfig } from "@/lib/config";
import { createOpenAIEmailDrafter, OpenAIEmailDraftError } from "@/lib/openai/email-drafter";
import { createOpenAIProofSummarizer, OpenAIProofError } from "@/lib/openai/proof-summarizer";
import {
  assistantRateLimit,
  assistantSessionHash,
  issueAssistantSession,
  verifyAssistantSession,
} from "@/lib/security/assistant-session";
import { correlationId, redactIdentifier, safeLog } from "@/lib/security/safe-log";
import { ServiceM8ApiError, ServiceM8Client, requireVendorAccount } from "@/lib/servicem8/client";
import {
  createOfficeAssistantProof,
  ProofResolutionError,
  ProofSearchTooBroadError,
} from "@/lib/servicem8/office-assistant-proof";
import { ServiceM8ProofReader } from "@/lib/servicem8/proof-reader";
import {
  renderEmailDraft,
  renderJobMatches,
  renderProofAnswer,
  renderProofMessage,
} from "@/lib/servicem8/render-context-html";
import { consumeEventHash } from "@/lib/storage/consumed-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

class AssistantInputError extends Error {}
class AssistantRateLimitError extends Error {}

function html(body: string, status = 200) {
  return new Response(body, { status, headers: responseHeaders });
}

async function readForm(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") throw new AssistantInputError("Unsupported form data");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 8_192) throw new AssistantInputError("Form data is too large");
  const form = new URLSearchParams(body);
  const singleton = (name: string, maximum: number) => {
    const values = form.getAll(name);
    if (values.length !== 1 || values[0].length === 0 || values[0].length > maximum) {
      throw new AssistantInputError(`Invalid ${name}`);
    }
    return values[0];
  };
  const session = singleton("session", 4_096);
  const queryValues = form.getAll("query").filter((value) => value.trim().length > 0);
  const jobValues = form.getAll("jobNumber").filter((value) => value.trim().length > 0);
  const purposeValues = form.getAll("emailPurpose");
  if (queryValues.length + jobValues.length !== 1) throw new AssistantInputError("Choose a search or one Job");
  if (queryValues.length === 1 && queryValues[0].length > 200) throw new AssistantInputError("Search is too long");
  if (jobValues.length === 1 && !/^[A-Z]\d{6}$/.test(jobValues[0])) throw new AssistantInputError("Invalid Job number");
  if (purposeValues.length > 1 || (purposeValues.length === 1 && (purposeValues[0].trim().length === 0 || purposeValues[0].length > 500))) {
    throw new AssistantInputError("Invalid email purpose");
  }
  if (purposeValues.length === 1 && jobValues.length !== 1) throw new AssistantInputError("Email draft requires one Job");
  return {
    session,
    query: queryValues[0]?.trim(),
    jobNumber: jobValues[0],
    emailPurpose: purposeValues[0]?.trim(),
  };
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const config = getConfig();
    if (!config.assistantProof.enabled) {
      return html(renderProofMessage("Proof unavailable", "The bounded assistant proof is not enabled."), 503);
    }

    const form = await readForm(request);
    const identity = await verifyAssistantSession(form.session, config.sessionSigningSecret);
    if (!(await consumeEventHash(
      assistantSessionHash(form.session),
      new Date(Date.now() + 31 * 60 * 1000),
    ))) {
      return html(renderProofMessage("Session already used", "Reopen the Office Assistant from ServiceM8."), 409);
    }

    const takeRateLimit = async (action: "search" | "summary" | "draft") => {
      const limit = assistantRateLimit(identity, action);
      if (!(await consumeEventHash(limit.hash, limit.expiresAt))) throw new AssistantRateLimitError();
    };
    await takeRateLimit(form.emailPurpose ? "draft" : form.jobNumber ? "summary" : "search");

    const logContext = {
      requestId,
      account: redactIdentifier(identity.accountUUID),
      staff: redactIdentifier(identity.staffUUID),
    };
    const client = new ServiceM8Client(identity.accountUUID, identity.staffUUID);
    await requireVendorAccount(client, identity.accountUUID);
    const proof = createOfficeAssistantProof({
      reader: new ServiceM8ProofReader(client),
      summarizer: createOpenAIProofSummarizer({
        apiKey: config.assistantProof.apiKey,
        model: config.assistantProof.model,
      }),
      drafter: createOpenAIEmailDrafter({
        apiKey: config.assistantProof.apiKey,
        model: config.assistantProof.model,
      }),
    });
    const actionUrl = new URL("/assistant", config.appBaseUrl);
    const nextSession = await issueAssistantSession(
      identity,
      config.sessionSigningSecret,
      new Date(),
      identity.launchExpiresAt,
    );

    if (form.jobNumber && form.emailPurpose) {
      const result = await proof.draftEmail(form.jobNumber, form.emailPurpose);
      safeLog("info", "Completed selected Job email draft proof", logContext);
      return html(renderEmailDraft(result, actionUrl, nextSession));
    }

    if (form.jobNumber) {
      const answer = await proof.answerWhatHappened(form.jobNumber);
      safeLog("info", "Completed selected Job history proof", logContext);
      return html(renderProofAnswer(answer, actionUrl, nextSession));
    }

    const matches = await proof.searchJobs(form.query!);
    if (matches.length === 0) {
      return html(renderProofMessage(
        "No Job matched",
        "Try a more specific address or Job number.",
        actionUrl,
        nextSession,
      ), 404);
    }
    if (matches.length > 1) return html(renderJobMatches(matches, actionUrl, nextSession));

    await takeRateLimit("summary");
    const answer = await proof.answerWhatHappened(matches[0].jobNumber);
    safeLog("info", "Completed selected Job history proof", logContext);
    return html(renderProofAnswer(answer, actionUrl, nextSession));
  } catch (error) {
    if (error instanceof AssistantInputError) {
      return html(renderProofMessage("Request rejected", "Enter one Job address or Job number."), 400);
    }
    if (error instanceof AssistantRateLimitError) {
      return html(renderProofMessage("Please wait", "The bounded proof is rate limited. Reopen it from ServiceM8 and try again shortly."), 429);
    }
    if (error instanceof ProofSearchTooBroadError) {
      return html(renderProofMessage("More detail needed", "Enter a more specific Job address or Job number."), 400);
    }
    if (error instanceof ProofResolutionError) {
      return html(renderProofMessage("Job not found", "The selected Job could not be resolved uniquely."), 404);
    }
    if (error instanceof ServiceM8ApiError) {
      safeLog("warn", "ServiceM8 assistant proof failed closed", { requestId, status: error.status });
      const status = error.status === 401 ? 401 : error.status === 429 ? 429 : 403;
      return html(renderProofMessage("Unable to read this Job", "ServiceM8 did not permit the bounded read."), status);
    }
    if (error instanceof OpenAIProofError) {
      safeLog("warn", "OpenAI assistant proof failed closed", { requestId, status: error.status });
      return html(renderProofMessage("Unable to summarise this Job", "No AI answer was accepted. Try again later."), 502);
    }
    if (error instanceof OpenAIEmailDraftError) {
      safeLog("warn", "OpenAI email draft proof failed closed", { requestId, status: error.status });
      return html(renderProofMessage("Unable to draft this email", "No email draft was accepted. Nothing was sent."), 502);
    }
    if (error instanceof Error && error.message === "Assistant session is invalid") {
      return html(renderProofMessage("Session expired", "Reopen the Office Assistant from ServiceM8."), 401);
    }
    safeLog("error", "Assistant proof failed", { requestId });
    return html(renderProofMessage("Unable to complete the proof", "The request failed safely."), 500);
  }
}
