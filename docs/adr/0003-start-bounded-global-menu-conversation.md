---
status: accepted
---

# Start the bounded global-menu conversation

## Decision

Phase 1 starts as a bounded conversational surface inside the existing global ServiceM8 Add-ons
menu entry. A fresh verified Global Launch creates a short-lived, staff-bound session. Each message
must contain exactly one Job number and may request only one of the two accepted capabilities:

- explain what happened using the existing read-only proof; or
- begin the existing review-only Email Draft proof by asking for its purpose.

Intent recognition is deterministic and server-side. It does not grant the model tools or decide
which ServiceM8 records to read. The existing proof boundary remains unchanged: core fields from
the selected Job and customer plus Job diary notes. The visible summary and draft remain built by
server code from authorised evidence selected by the configured OpenAI proof provider.

## Consequences

- Unsupported, ambiguous, zero-Job, and multi-Job messages return guidance before ServiceM8 access.
- Requests for both supported capabilities are ambiguous and return guidance without reading ServiceM8.
- Conversation state exists only in the rendered page and one-time signed form sessions; no chat
  transcript is persisted.
- The assistant cannot write to ServiceM8, save or send a draft, add a data source, choose a Job
  autonomously, or perform an autonomous action.
- Email, SMS, forms, attachments, and schedule activity remain excluded and disclosed.
- Natural-language address matching remains deferred. The conversation accepts natural-language
  requests around one exact Job number, not unrestricted natural-language Job search.
- The claimless Job Action callback remains data-disabled.
- OAuth persistence and every signed launch must match the configured single allowed Vendor account.
- A general per-account/staff request bucket limits guidance and replay traffic before session
  rotation; smaller intent-specific buckets continue to limit ServiceM8 and OpenAI work.
- Any new intent, source, persistence, provider, write, sending, or autonomous behavior requires a
  new scope decision and its own acceptance and security evidence.
