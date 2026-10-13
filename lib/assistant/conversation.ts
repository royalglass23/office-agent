export type ConversationIntent =
  | { kind: "history"; jobNumber: string }
  | { kind: "draft"; jobNumber: string }
  | { kind: "guidance"; message: string };

export function parseConversationMessage(message: string): ConversationIntent {
  const jobNumbers = [...new Set(message.toUpperCase().match(/\b[A-Z]\d{6}\b/g) ?? [])];
  if (jobNumbers.length !== 1) {
    return {
      kind: "guidance",
      message: "Include one exact Job number, for example: What happened to R260766?",
    };
  }
  const requestsHistory = /\bwhat\s+happened\b|\bsummari[sz]e\b|\bsummary\b|\bhistory\b/i.test(message);
  const requestsDraft = (
    /\b(?:draft|write|prepare)\b.*\b(?:email|message)\b/i.test(message) ||
    /\b(?:email|message)\b.*\b(?:draft|write|prepare)\b/i.test(message)
  );
  if (Number(requestsHistory) + Number(requestsDraft) !== 1) {
    return {
      kind: "guidance",
      message: requestsHistory && requestsDraft
        ? "Ask for one task at a time: what happened, or an email draft."
        : "Ask what happened to the Job, or ask for an email draft.",
    };
  }
  if (requestsHistory) {
    return { kind: "history", jobNumber: jobNumbers[0] };
  }
  if (requestsDraft) {
    return { kind: "draft", jobNumber: jobNumbers[0] };
  }
  throw new Error("Conversation intent classification failed closed");
}
