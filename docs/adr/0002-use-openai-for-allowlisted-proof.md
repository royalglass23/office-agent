---
status: accepted
---

# Use OpenAI only for the allowlisted read-only proof

OpenAI's API is the Approved Proof Provider for the first Office Assistant proof. The application
may send bounded, normalised core Job/customer fields and diary-note text only from `R260766`,
`R260680`, `R260209`, `R260270`, and `R260208`, and only to answer “What happened to this Job?”
The configured model must be recorded with the test evidence.

## Considered Options

- A deterministic summarizer proves the data pipeline but does not prove that an AI office
  assistant can produce a useful grounded explanation.
- Approving OpenAI for all production Jobs would accelerate later testing but would exceed the
  owner's current data and feature authorization.

## Consequences

- Requests for any Job outside the allowlist must not send Job data to OpenAI during the proof.
- Email drafting, Suggested Next Actions, additional ServiceM8 sources, writes, and outbound
  messages remain excluded.
- Adding a Job, source, provider, or purpose requires a new explicit scope decision.
- Structured credentials, callback claims, account identifiers, raw API objects, and attachment
  binaries remain excluded from model input.
- The owner's content approval does not replace verification of the configured OpenAI API
  organisation's retention and data-control settings; record that verification before the live
  production proof.
