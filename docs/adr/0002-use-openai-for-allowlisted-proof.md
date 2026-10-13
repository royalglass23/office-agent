---
status: accepted
---

# Use OpenAI only for the selected-Job read-only proof

OpenAI's API is the Approved Proof Provider for the first Office Assistant proof. The application
may send bounded, normalised core Job/customer fields and diary-note text from any Job that the
authenticated staff member deliberately selects in the connected Royal Glass ServiceM8 account,
and only to answer “What happened to this Job?” The configured model must be recorded with the test
evidence. Search results are not sent to OpenAI; only the selected and re-read parent Job proceeds
to customer, note, and summarisation access.

## Considered Options

- A deterministic summarizer proves the data pipeline but does not prove that an AI office
  assistant can produce a useful grounded explanation.
- A five-Job allowlist reduced the initial production proof surface, but the owner explicitly
  removed that restriction on 13 October 2026 so staff can use the assistant as an account-wide
  office tool.

## Consequences

- Search and every subsequent Job read remain bound to the authenticated staff identity.
- The selected parent Job must be re-read before customer or diary-note access.
- No unselected search result may be sent to OpenAI.
- Email drafting, Suggested Next Actions, additional ServiceM8 sources, writes, and outbound
  messages remain excluded.
- Adding a source, provider, purpose, write action, or outbound action requires a new explicit
  scope decision.
- Structured credentials, callback claims, account identifiers, raw API objects, and attachment
  binaries remain excluded from model input.
- The owner's content approval does not replace verification of the configured OpenAI API
  organisation's retention and data-control settings; record that verification before the live
  production proof.
