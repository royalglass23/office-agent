export type ConversationIntent =
  | { kind: "history"; jobNumber: string }
  | { kind: "draft"; jobNumber: string }
  | { kind: "recommend"; jobNumber: string }
  | { kind: "guidance"; message: string };

export function parseConversationMessage(message: string, selectedJobNumber?: string): ConversationIntent {
  const explicitJobNumbers = [...new Set(message.toUpperCase().match(/\b[A-Z]\d{6}\b/g) ?? [])];
  const jobNumbers = explicitJobNumbers.length === 0 && selectedJobNumber ? [selectedJobNumber] : explicitJobNumbers;
  if (jobNumbers.length !== 1) {
    return {
      kind: "guidance",
      message: "Include one exact Job number, for example: What happened to R260766?",
    };
  }
  const requestsHistory = /\bwhat\s+happened\b|\bsummari[sz]e\b|\bsummary\b|\bhistory\b/i.test(message);
  const requestsDraft = (
    /\b(?:draft|write|prepare)\b.*\bemail\b/i.test(message) ||
    /\bemail\b.*\b(?:draft|write|prepare)\b/i.test(message)
  );
  const requestsNextStep = !requestsDraft && /\b(?:next step|what (?:should|do) (?:we|i) do next|what(?:'s| is)? next|recommend|suggest|follow up next)\b/i.test(message);
  const separateHistoryTask = requestsHistory && requestsDraft && /\b(?:and|then)\s+(?:draft|write|prepare)\b/i.test(message);
  if (separateHistoryTask || Number(requestsHistory && !requestsDraft) + Number(requestsDraft) + Number(requestsNextStep) !== 1) {
    return {
      kind: "guidance",
      message: requestsHistory && requestsDraft
        ? "Ask for one task at a time: what happened, what next, or an email draft."
        : "Ask what happened, what to do next, or for an email draft for one Job.",
    };
  }
  if (requestsDraft) {
    return { kind: "draft", jobNumber: jobNumbers[0] };
  }
  if (requestsHistory) {
    return { kind: "history", jobNumber: jobNumbers[0] };
  }
  if (requestsNextStep) {
    return { kind: "recommend", jobNumber: jobNumbers[0] };
  }
  throw new Error("Conversation intent classification failed closed");
}
