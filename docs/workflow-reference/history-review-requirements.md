# Requirements for a ServiceM8 history review

Prepared: 23 October 2026. Planning only; no customer-history reads were performed for this
reference save. A metadata inspection of available tools is not a live completeness test.

## Later authorisation and completed research

After the original planning note, the owner authorised the existing RGTools ServiceM8 API,
all staff rather than only Roxy, and all accessible history rather than a recent sample. The
completed source review and de-identified outputs are recorded in [history-findings.md](history-findings.md),
[history-coverage.json](history-coverage.json) and [history-source-contracts.md](history-source-contracts.md).
The event cutoff was 23 October 2026, 16:29:22 Pacific/Auckland. This supersedes the unresolved
account/people/time-window choices below for this research run. It does not clear the Office Agent
application's Diary evidence gate or authorise autonomous communications or writes.

The remaining sections preserve the original pre-authorisation requirements and connector inspection.

## What is needed before a scoped review can run

1. **Correct account and authorised read access.** Identify the intended Royal Glass account.
   The connected tool catalogue currently offers ServiceM8 and DEV-SERVICEM8 connections;
   their labels alone do not establish the account identity or staff permissions. Use the
   supported connection/OAuth process. Do not paste passwords or access tokens into chat.
2. **Named people and attribution.** Identify Roxy's ServiceM8 staff record and any relevant
   shared sender identity. Job assignment and message authorship are different signals.
   Confirm whether the scope is Roxy's work, selected staff or all relevant company jobs.
3. **Time range and job scope.** Choose a start date and an explicit as-of timestamp. Agree job
   types and included statuses. Completed/lost jobs show outcomes; active jobs show current
   practice. A representative sample can identify candidate rules before any broader review.
4. **Complete usable content.** Read the required messages/notes and relevant quote, booking,
   variation, completion and payment evidence. Attachments need full authorised content only
   when a conclusion depends on their contents. Titles/previews cannot support all claims.
5. **A supported way to enumerate the scope.** Prove how all jobs and history pages are found,
   including limits, final pages, failed pages and deduplication. Record unavailable/deleted
   material and access failures. Do not describe a capped result set as an exhaustive crawl.
6. **An approved analysis and storage destination.** Confirm where customer material may be
   processed and what may be retained. Prefer minimal evidence references and derived candidate
   rules; copying complete histories into a second database is not necessary for the design.
   Existing OpenAI data-control and project authorisation requirements continue to apply.
7. **Roxy/owner review.** Review candidate patterns, exceptions and outdated practices before
   turning them into company rules used for recommendations or customer-facing drafts.

These requirements define a concrete scope for a future instruction. Asking what access is
needed does not itself authorise a company-wide crawl or new external data destination.

## Current connector observations

Observed from the tool declarations available in this chat on 23 October 2026:

| Tool | What it establishes | What remains unproved |
| --- | --- | --- |
| list_jobs | Lists job identifiers/summary fields, filters, a limit and returned/total counts. | The declaration does not expose a pagination cursor; exhaustive retrieval must be established separately. |
| search | Finds relevant jobs/clients. | Results are explicitly capped and cannot be paginated; do not use this for exhaustive history analysis or infer absence/totals. |
| get_job_diary | Declares entry metadata, author, timestamp, title and content_preview; object IDs may be present. | No declared full-body, cursor, reliable end-of-history or current-staff identity contract. |
| fetch | Accepts search IDs/resource URLs and returns text and metadata. | It has not been proved to retrieve full content for every Diary event type or establish complete sequence/staff parity. |

No live account, author, job or message read was made during this inspection. A claim such as
"all Diary entries" in a tool description does not alone prove full event content or completeness.

## Existing project prerequisite

The local [Diary gate](../../lib/servicem8/job-diary-gate.ts) still returns false.
The [RG-381 readiness record](../research/rg381-diary-readiness.md) identifies missing proof for:

- complete, authorised history bound to the intended staff identity;
- reliable pagination/end-of-history and failure/truncation detection;
- enough event content to support the proposed claims;
- unambiguous identity matching before any authorised enrichment; and
- same-staff ServiceM8 UI/API comparison and denied-access handling.

Do not bypass this by changing the model, using another automation platform, treating previews
as full content or silently broadening permissions. A supported export could be assessed as a
separate approved research source, but would not by itself clear the application's live Diary gate.

## Proposed review method after the prerequisites are satisfied

1. Establish account, people, period, permitted content and an as-of timestamp.
2. Demonstrate complete usable evidence on a small approved sample and compare it with ServiceM8.
3. Enumerate the agreed job set and record coverage, exclusions and errors.
4. Build an evidence-linked sequence per job; distinguish staff actions from customer responses.
5. Extract candidate rules, timing patterns, draft style and exceptions, with denominators and
   counterexamples. A frequent pattern is not automatically the correct policy.
6. Ask Roxy to confirm the highest-value findings and resolve inconsistencies.
7. Publish only approved knowledge for the agent, with source references, versions and scope.

## Meaning of "up to present"

A review has an explicit cutoff time. New messages, quote decisions, bookings and payments can
arrive afterwards. A one-time review is not continuous monitoring. Future client drafts and next
actions must use fresh authorised evidence, rather than relying on the historical analysis as a
current operational record.

## Open decisions

- Which ServiceM8 account and staff identities?
- Roxy only, selected staff, or a wider company scope?
- What start date, job types/statuses and initial sample?
- Which supported read/export route proves full usable coverage?
- Which processing/storage destination and retention rules?
- Who confirms the proposed rules and resolves disagreements?
