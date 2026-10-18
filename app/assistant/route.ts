import { getConfig } from "@/lib/config";
import { parseConversationMessage } from "@/lib/assistant/conversation";
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
  renderConversationDraftPrompt,
  renderConversationGuidance,
  renderConversationProofAnswer,
  renderConversationAssistant,
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
  "Access-Control-Allow-Origin": "*",
};

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...responseHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

class AssistantInputError extends Error {}

function html(body: string, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(body, { status, headers: { ...responseHeaders, ...extraHeaders } });
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
  const restartValues = form.getAll("restart");
  if (restartValues.length > 0) {
    if (restartValues.length !== 1 || restartValues[0] !== "1" || form.size !== 2) {
      throw new AssistantInputError("Invalid restart request");
    }
    return { session, restart: true, message: undefined, query: undefined, jobNumber: undefined, emailPurpose: undefined };
  }
  const queryValues = form.getAll("query").filter((value) => value.trim().length > 0);
  const jobValues = form.getAll("jobNumber").filter((value) => value.trim().length > 0);
  const purposeValues = form.getAll("emailPurpose");
  const messageValues = form.getAll("message").filter((value) => value.trim().length > 0);
  if (messageValues.length > 1 || (messageValues.length === 1 && messageValues[0].length > 500)) {
    throw new AssistantInputError("Invalid message");
  }
  if (messageValues.length === 1) {
    if (queryValues.length > 0 || jobValues.length > 0 || purposeValues.length > 0) {
      throw new AssistantInputError("Choose a message or one proof action");
    }
    return { session, message: messageValues[0].trim() };
  }
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
    message: undefined,
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
    const actionUrl = new URL("/assistant", config.appBaseUrl);
    const consumeRateSlot = async (action: "request" | "search" | "summary" | "draft") => {
      const limit = assistantRateLimit(identity, action);
      for (const hash of limit.hashes) {
        if (await consumeEventHash(hash, limit.expiresAt)) return null;
      }
      return limit;
    };
    const requestLimit = await consumeRateSlot("request");
    if (requestLimit) {
      return html(
        renderProofMessage(
          "Please wait",
          `The bounded assistant is busy. Wait ${requestLimit.retryAfterSeconds} seconds, then reopen it from ServiceM8.`,
        ),
        429,
        { "Retry-After": String(requestLimit.retryAfterSeconds) },
      );
    }
    if (!(await consumeEventHash(
      assistantSessionHash(form.session),
      new Date(Date.now() + 31 * 60 * 1000),
    ))) {
      return html(renderProofMessage("Session already used", "Reopen the Office Assistant from ServiceM8."), 409);
    }

    if (form.restart) {
      const nextSession = await issueAssistantSession(identity, config.sessionSigningSecret, new Date(), identity.launchExpiresAt);
      return html(renderConversationAssistant("there", actionUrl, nextSession));
    }

    const conversationIntent = form.message ? parseConversationMessage(form.message) : null;
    if (conversationIntent?.kind === "guidance" || conversationIntent?.kind === "draft") {
      const nextSession = await issueAssistantSession(
        identity,
        config.sessionSigningSecret,
        new Date(),
        identity.launchExpiresAt,
      );
      if (conversationIntent.kind === "draft") {
        return html(renderConversationDraftPrompt(
          form.message!,
          conversationIntent.jobNumber,
          actionUrl,
          nextSession,
        ));
      }
      return html(renderConversationGuidance(
        form.message!,
        conversationIntent.message,
        actionUrl,
        nextSession,
      ));
    }
    const requestedJobNumber = conversationIntent?.kind === "history"
      ? conversationIntent.jobNumber
      : form.jobNumber;

    const takeRateLimit = async (action: "search" | "summary" | "draft") => {
      const limit = await consumeRateSlot(action);
      if (!limit) return null;
      const retrySession = await issueAssistantSession(
        identity,
        config.sessionSigningSecret,
        new Date(),
        identity.launchExpiresAt,
      );
      return html(
        renderProofMessage(
          "Please wait",
          `The bounded proof is busy. Wait ${limit.retryAfterSeconds} seconds and try again.`,
          actionUrl,
          retrySession,
        ),
        429,
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    };
    const initialRateLimit = await takeRateLimit(
      form.emailPurpose ? "draft" : requestedJobNumber ? "summary" : "search",
    );
    if (initialRateLimit) return initialRateLimit;

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

    if (requestedJobNumber) {
      let answer;
      try {
        answer = await proof.answerWhatHappened(requestedJobNumber);
      } catch (error) {
        if (error instanceof ProofResolutionError && conversationIntent?.kind === "history") {
          return html(renderConversationGuidance(
            form.message!,
            `I couldn’t find one clear match for Job ${requestedJobNumber}. Check the Job number and try again.`,
            actionUrl,
            nextSession,
          ));
        }
        throw error;
      }
      safeLog("info", "Completed selected Job history proof", logContext);
      if (conversationIntent?.kind === "history") {
        return html(renderConversationProofAnswer(form.message!, answer, actionUrl, nextSession));
      }
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

    const summaryRateLimit = await takeRateLimit("summary");
    if (summaryRateLimit) return summaryRateLimit;
    const answer = await proof.answerWhatHappened(matches[0].jobNumber);
    safeLog("info", "Completed selected Job history proof", logContext);
    return html(renderProofAnswer(answer, actionUrl, nextSession));
  } catch (error) {
    if (error instanceof AssistantInputError) {
      return html(renderProofMessage("Request rejected", "Enter one Job address or Job number."), 400);
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
