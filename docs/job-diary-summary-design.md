# ServiceM8 Job Diary summary module design

Date: 12 October 2026
Status: bounded proof implemented locally; read-only R260202 connector probe completed; no live OpenAI proof executed

## Account-wide access decision (12 October 2026)

Royal Glass reports that its ServiceM8 staff can see each other's Jobs. The Job Diary feature
therefore uses **account-wide staff access**, not a per-staff Job visibility rule. The earlier
Staff A allowed / Staff B denied requirement in this design is withdrawn for this feature. This
is an owner-supplied operating policy, not a claim that ServiceM8 enforces a particular role model.

The diary's “by [staff member]” labels attribute recorded actions; they do not authenticate a
read-only launch or prove who viewed notes. The add-on must still reject invalid/replayed launches,
bind the OAuth connection to the expected ServiceM8 account, and read the parent Job before any
child Notes. Staff identity remains useful for attribution and the existing API impersonation
header, but it is not a separate per-Job authorization boundary under this policy. A different
ServiceM8 account must not be able to use this account's connection or data.

## Decision

Expose one deep module for the user-visible capability:

```ts
summarizeJobDiary(launch: AuthorizedJobLaunch): Promise<JobDiarySummary>
```

The caller supplies an opaque, server-created `AuthorizedJobLaunch`, not account, staff, or Job
UUID strings. The module owns parent-Job permission checking, diary-source pagination, validation,
normalisation, limits, model preparation, summarisation, citations, and coverage reporting.

This keeps the route shallow and prevents browser-controlled UUIDs from becoming authorisation
inputs.

## Authorization seam

`AuthorizedJobLaunch` may only be created by a launch-authorisation module after all of these are
true:

1. the callback has a valid ServiceM8 HS256 signature and expected event shape;
2. the callback hash is consumed under the approved replay policy;
3. the caller is bound to the same Royal Glass / ServiceM8 account through an approved
   authentication or launch policy; and
4. the parent Job is readable through that account's OAuth connection before any child Notes.

The ServiceM8 callback's signature alone does not establish freshness or an independent human
session. Until the callback replay and account-bound launch policy is resolved, production code
must not create `AuthorizedJobLaunch` for a claimless callback. Synthetic tests may use an in-memory
fixture launch. The account-wide decision removes the staff-visibility test, not this launch gate.

## Interface

```ts
type JobDiarySummary = {
  headline: SummaryPoint;
  overview: SummaryPoint;
  currentState: SummaryPoint[];
  decisions: SummaryPoint[];
  outstandingActions: SummaryPoint[];
  risksAndQuestions: SummaryPoint[];
  timeline: TimelinePoint[];
  coverage: {
    includedSources: DiarySourceName[];
    excludedSources: { source: DiarySourceName; reason: string }[];
    itemCount: number;
    truncated: boolean;
    snapshotAt: string;
  };
};

type SummaryPoint = {
  text: string;
  citations: string[];
};
```

Every factual summary point must cite one or more normalised diary-item references. The module must
return `coverage.truncated = true` when an entry, byte, page, or model-input limit is reached. It must
never label a partial snapshot as the whole diary.

The synthetic implementation reports `includedSources` as sources actually read, not all sources
configured for the run. Every other catalogued source appears in `excludedSources`, with an
explicit reason or a default reason. If a limit stops reading, `truncated` is true and later
sources are excluded as unread. A no-content result is used only after a complete read of at
least one selected source. Unconfigured or incomplete empty reads are labelled separately.

## Internal seams and adapters

The external interface remains one method. The implementation has two justified internal seams:

1. `DiaryReader` — production ServiceM8 adapter plus in-memory test adapter.
2. `DiarySummarizer` — eventual approved AI-provider adapter plus deterministic test adapter.

The production `DiaryReader` must send the same account-bound `x-impersonate-uuid` on the parent
Job and every enabled child-source request. It first reads the parent Job, then reads child sources.
A denied parent read stops everything. Two authorised staff members in the same account should be
able to read the selected test Job; invalid or cross-account launches must fail closed.

The `DiarySummarizer` receives validated, bounded, normalised text rather than raw API objects.
Structured access tokens, callback identity, account fields, contact fields, and attachment binaries
are not forwarded. Recognisable email addresses, phone numbers, UUIDs, and JWT-shaped strings in
free-form text are redacted. This pattern-based filtering cannot guarantee removal of every secret
or personal detail. The owner has made a bounded privacy decision allowing OpenAI API use only for
the five allowlisted proof Jobs and the read-only “What happened?” workflow.

## What “Job Diary” means through the documented API

### Approved initial evidence boundary

The first Office Assistant proof uses only core Selected Job and customer fields plus Job diary
notes. Its only conversational outcome is a read-only account of what happened on the Selected
Job. Email Drafts and Suggested Next Actions are deferred along with email, SMS, forms,
attachments, and schedule activity. These capabilities and sources are not considered unimportant:
missing one of them can materially change what staff should do next.

For this proof, the answer is presented as a short plain-English summary followed by a dated
evidence timeline. The format is provisional and may change after staff have verified the proof.

Until an Extended Job History source is separately enabled and verified, every summary, Email
Draft, and Suggested Next Action must disclose the included and excluded source coverage. The
assistant must not call the initial evidence a complete Job history or use an excluded source as
though it had been checked.

The ServiceM8 UI aggregates several record types. The current documented read surfaces are not one
complete-diary endpoint:

| Source | Documented surface | Scope / status | Initial decision |
| --- | --- | --- | --- |
| Job notes | [`GET /api_1.0/note.json`](https://developer.servicem8.com/reference/listnotes), filtered by Job UUID | `read_job_notes` | First live source after the account-bound launch and parent-Job checks pass. |
| Attachment/form metadata and extracted text | [`GET /api_1.0/attachment.json`](https://developer.servicem8.com/reference/listattachments) | `read_attachments` | Separate slice; do not download binaries initially. |
| SMS history | [`GET /api_1.0/sms.json`](https://developer.servicem8.com/reference/listsmsmessages), cursor-paginated and filtered by Job UUID | Scope and account-bound access behaviour require separate confirmation | Excluded from first slice. |
| Email history | No complete read surface was established in the reviewed official references | Unresolved | Report as excluded; do not infer from send-email documentation. |
| Schedule/time activity | [`GET /api_1.0/jobactivity.json`](https://developer.servicem8.com/reference/listjobactivities) | `read_schedule` | Operational context, not diary narrative; separate slice. |

“Complete” therefore means complete for the explicitly enabled and successfully paginated source
set, with exclusions shown to the user. It does not mean pixel/OCR reading of every attachment.

## First safe test slice

The first implementation should remain entirely synthetic:

1. Create the deep module and its small interface.
2. Use an in-memory `DiaryReader` containing synthetic notes, SMS-like entries, duplicates, unsafe
   HTML, and deliberately truncated content.
3. Use a deterministic `DiarySummarizer` adapter; do not call an external model.
4. Assert only through `summarizeJobDiary` that:
   - denied parent access produces no child reads and no summarizer call;
   - all pages from enabled sources are consumed once;
   - duplicate records are removed by stable source ID;
   - untrusted HTML tags are removed from summarizer input;
   - every factual point has a valid source citation;
   - exclusions and truncation are visible; and
   - no secret, contact field, raw API object, or callback identity reaches the summarizer adapter.

The synthetic module tests prove the summary contract without using Royal Glass client data or
weakening the callback gate.

## Read-only live probe: R260202

On 12 October 2026, the connected production ServiceM8 account resolved R260202 and its diary
read returned 23 entries (21 with preview text): 9 labelled Notes, 7 labelled Attachments, and 7
without a source type in the connector result. Only counts and source labels were recorded here;
no note text, customer details, or attachment content was copied into the repository or sent to
an AI provider.
This confirms the chosen Job exists and has mixed diary content. It does **not** prove that the
Office Agent OAuth connection can read Notes, that the previews contain full note text, or that
the connector response covers every historical diary item.

At the time of the probe, the Office Agent's configured and stored grant was
`vendor read_jobs read_customers`. The next source change requests
`vendor read_jobs read_customers read_job_notes` in both manifests and the exact OAuth allowlist.
ServiceM8 documents `read_job_notes` as required for `GET /api_1.0/note.json`. This code change
does not upgrade the existing token or production environment: the Vercel scope variable must be
updated, the new manifest uploaded, and the add-on reconnected. A direct Notes read through the
Office Agent remains untested until those steps and a read-only app-path probe are complete. The
connector probe is not a substitute for that test.

Rendering is outside this synthetic module. Any future UI must render summary text as text, not
HTML, and include a regression test for escaped untrusted content before live use.

Implemented in `lib/servicem8/job-diary-summary.ts`, with public-interface tests in
`tests/servicem8/job-diary-summary.test.ts`. This does not implement a production reader, AI adapter,
or route connection. A real `AuthorizedJobLaunch` issuer still requires the live-test gates below.

## Live-test gates

Before enabling live Job notes in the Office Agent:

1. deploy the four-scope code and manifest, set `SERVICEM8_OAUTH_SCOPES` to the exact same value in
   Vercel, upload the new manifest to ServiceM8, reconnect the add-on, and verify the stored grant;
2. verify the account-bound parent Job read and paginated Notes read for R260202 without logging
   note bodies; do not call the connector probe an app-path pass;
3. confirm that two authorised staff in the same account can read the test Job, and that invalid,
   replayed, or cross-account launches return no Job or Note data;
4. resolve the callback identity/replay decision before exposing a user-facing live Notes view;
5. confirm retention, disclosure, regional processing, and contractual terms before sending any
   note text to an AI provider;
6. run the modal journey with synthetic or specifically authorised test content; and
7. verify the summary renderer escapes untrusted source and model text.

Attachments, SMS, email, schedule, contacts, and other diary-adjacent sources each require their
own scope and account-bound access evidence before joining `includedSources`.

## Rejected shapes

- `summarizeJobDiary(accountUUID, staffUUID, jobUUID)` — shallow and unsafe because callers can
  supply identity and resource identifiers.
- One route method that fetches every endpoint and calls a model — spreads authentication,
  pagination, privacy, and coverage rules across callers.
- A `string` summary return value — hides missing sources, truncation, and unsupported claims.
- Calling the UI result “the whole diary” without a coverage object — misleading when ServiceM8
  exposes diary content through separate or undocumented surfaces.
