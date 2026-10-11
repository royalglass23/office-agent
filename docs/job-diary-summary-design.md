# ServiceM8 Job Diary summary module design

Date: 12 October 2026
Status: synthetic module implemented; no live Job data or AI provider call authorised

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
3. an independently authenticated Royal Glass user is mapped to the same ServiceM8 account and
   staff identity; and
4. ServiceM8 permits that staff identity to read the parent Job.

Until independent user authentication or explicit residual-risk acceptance exists, production code
must not create `AuthorizedJobLaunch` for a claimless callback. Synthetic tests may use an in-memory
adapter that creates a non-production fixture launch.

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

The production `DiaryReader` must send the same `x-impersonate-uuid` on the parent Job and every
enabled child-source request. It first reads the parent Job, then reads child sources. A denied parent
read stops everything.

The `DiarySummarizer` receives validated, bounded, normalised text rather than raw API objects.
Structured access tokens, callback identity, account fields, contact fields, and attachment binaries
are not forwarded. Recognisable email addresses, phone numbers, UUIDs, and JWT-shaped strings in
free-form text are redacted. This pattern-based filtering cannot guarantee removal of every secret
or personal detail; no live AI adapter may be connected before a separate privacy decision.

## What “Job Diary” means through the documented API

The ServiceM8 UI aggregates several record types. The current documented read surfaces are not one
complete-diary endpoint:

| Source | Documented surface | Scope / status | Initial decision |
| --- | --- | --- | --- |
| Job notes | [`GET /api_1.0/note.json`](https://developer.servicem8.com/reference/listnotes), filtered by Job UUID | `read_job_notes` | First live source after its Staff B denial test passes. |
| Attachment/form metadata and extracted text | [`GET /api_1.0/attachment.json`](https://developer.servicem8.com/reference/listattachments) | `read_attachments` | Separate slice; do not download binaries initially. |
| SMS history | [`GET /api_1.0/sms.json`](https://developer.servicem8.com/reference/listsmsmessages), cursor-paginated and filtered by Job UUID | Scope/permission behaviour requires confirmation and Staff B testing | Excluded from first slice. |
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

This proves the module shape and summary contract without using Royal Glass client data or weakening
the callback gate.

Rendering is outside this synthetic module. Any future UI must render summary text as text, not
HTML, and include a regression test for escaped untrusted content before live use.

Implemented in `lib/servicem8/job-diary-summary.ts`, with public-interface tests in
`tests/servicem8/job-diary-summary.test.ts`. This does not implement a production reader, AI adapter,
or route connection. A real `AuthorizedJobLaunch` issuer still requires the live-test gates below.

## Live-test gates

Before enabling live Job notes:

1. add only `read_job_notes` to the OAuth grant and reconnect;
2. independently prove Staff A can read the parent Job and its Notes;
3. prove Staff B cannot list or directly retrieve the same Job or any Note belonging to it;
4. resolve the callback identity/replay decision;
5. confirm retention, disclosure, regional processing, and contractual terms before sending any
   note text to an AI provider; and
6. run the modal journey with synthetic or specifically authorised test content.
7. verify the summary renderer escapes untrusted source and model text.

Attachments, SMS, email, schedule, contacts, and other diary-adjacent sources each require their own
scope and permission-denial evidence before joining `includedSources`.

## Rejected shapes

- `summarizeJobDiary(accountUUID, staffUUID, jobUUID)` — shallow and unsafe because callers can
  supply identity and resource identifiers.
- One route method that fetches every endpoint and calls a model — spreads authentication,
  pagination, privacy, and coverage rules across callers.
- A `string` summary return value — hides missing sources, truncation, and unsupported claims.
- Calling the UI result “the whole diary” without a coverage object — misleading when ServiceM8
  exposes diary content through separate or undocumented surfaces.
