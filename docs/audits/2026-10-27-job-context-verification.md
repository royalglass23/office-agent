# ServiceM8 Job Context completeness verification

Checked 27 October 2026 (Pacific/Auckland). Scope: read-only Royal Glass ServiceM8 connector, repository adapters, RG-380/RG-381 evidence, and local offline reconciliation tests. No Job was changed and no communication was sent. This report contains no customer names, contact details, message bodies, file links, tokens, or raw ServiceM8 UUIDs.

## Assessment

| Category | Result | Evidence and limit |
| --- | --- | --- |
| Fresh Diary inventory | **PARTIAL** | Connector returned dated rows for four previously authorised fixtures. Its result has no declared cursor, total, or end-of-history proof, and uses a separate identity from Office Agent staff OAuth. |
| Diary-to-source reconciliation | **PARTIAL** | Prior staff-impersonated REST inventories give candidate Notes, Email, SMS, Payments, Activity and Attachment matches. No fresh REST item/body read or current per-item stable match was available in this verification. |
| Full-text retrieval | **FAIL** | Current `get_job_diary` supplies `content_preview`. Visible ellipses prove shortening; empty previews do not establish empty content. Prior work found full Email/SMS through separate endpoints, but this run did not re-read or join those bodies. |
| Timeline timestamps and provenance | **PARTIAL** | Original Diary times and object types can be retained. Most rows have no object UUID; timezone/event-time meaning and two apparent future times need checking against the UI. |
| Duplicate avoidance | **PARTIAL** | Local builder tests join only stable IDs or explicitly verified matches and keep unmatched sources outside the event timeline. Live source deduplication is not proved. |
| Agent interpretation | **FAIL** | Latest communication, customer response, blockers and next action cannot be evaluated reliably from previews and unjoined source bodies. No live agent interpretation was accepted. |
| Representative job types | **PARTIAL** | Four existing approved fixtures were read; calls, service, status, payments, attachments and changed bookings remain without complete matched detail. A completed Form and denied-staff fixture remain missing. |

## Five-gate execution

| Order | Gate | Result on 27 October | Exact remaining proof |
| --- | --- | --- | --- |
| 1 | Staff-authenticated retrieval | **PARTIAL** | The signed Office Agent launch identity is used by the REST client with [`x-impersonate-uuid`](https://developer.servicem8.com/docs/authentication); the route checks parent Job and account before MCP consent, and denied/mismatched parents stop in local tests. A fresh staging read as Michael plus a real denied-staff fixture have not been run. The separately consented MCP token still lacks a proved link to that staff identity. |
| 2 | Complete Diary retrieval | **FAIL** | Current connector inventories agree closely with the UI, but `get_job_diary` declares no cursor/total/end-of-history condition. ServiceM8's [REST pagination contract](https://developer.servicem8.com/docs/pagination) applies to REST lists; its public [MCP page](https://developer.servicem8.com/docs/mcp-server) does not supply the missing Diary contract. Count and timestamp matches cannot prove that an omitted event would be detected. |
| 3 | Full Email/SMS/Note content | **PARTIAL** | Earlier REST results showed available communication content. Local staff-impersonated GET adapters now cover [Email detail](https://developer.servicem8.com/reference/getemailmessage) and [Note detail](https://developer.servicem8.com/reference/getnotes); the existing paginated [SMS list](https://developer.servicem8.com/reference/listsmsmessages) includes message text. Current Diary previews are truncated/empty and no current source bodies have been joined to verified row identities. |
| 4 | Fresh UI/API parity | **PARTIAL** | R260609 matches 20/20 UI versus connector by type/order/second; R260611 matches 47/47 non-payment rows, while three connector payment rows have no corresponding visible Diary row. This compares Michael's UI with a separate connector, not Office Agent's signed-staff API session. |
| 5 | Interpretation | **FAIL** | No complete, staff-bound context exists to support live latest-communication, blocker or next-action conclusions. Offline reconciliation tests do not substitute for reviewed agent outputs. |

**Decision:** The five-gate GREEN GO is not achieved. Gate 2 is the first technical stop. Keep the existing Job-answer gate false while the provider-supported completeness and staff-binding contract is resolved.

This run made local repository and test changes only. It did not change OAuth grants, deploy the staging app, commit or push code, change ServiceM8 Job records, or send communications. The fresh UI view used the already signed-in Michael browser session; it cannot substitute for a new signed Office Agent staging probe.

## Fresh job-by-job coverage

The connector reads below are **not** same-staff Office Agent app reads. The connector schema exposes `entries[]`, title, timestamp, `content_preview`, optional object type and optional object UUID, without a pagination or total contract. Counts are observations only. Older RG-380 source inventories are from 19–20 October, not fresh REST comparisons.

| Job | Fresh Diary rows | Earlier reference | Source ID present | Empty previews | Visibly shortened previews | Coverage result |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| R260609 | 20 | RG-380 recorded 18 UI/connector rows; task brief cites 19 in another snapshot | 7/20 | 3 | 7 | **PARTIAL**: fresh Michael UI has 20 rows; all 20 type/order/timestamp positions align, but source identity/content remain unproved. |
| R260611 | 50 | 45 UI/connector rows | 6/50 | 5 | 11 | **PARTIAL**: fresh Michael UI has 47 Diary rows; its 47 non-payment rows align in order and exact time. Three connector payment rows have no visible Diary row. |
| R260766 | 36 | 3 initial UI rows, then 6 in a later connector read | 19/36 | 1 | 1 | **PARTIAL**: extensive subsequent activity; old UI fixture is obsolete. |
| R260445 | 74 | 68 in prior connector read | 16/74 | 5 | 40 | **PARTIAL**: Quote Approved was previously seen; full current parity is unproved. |

All four Jobs had newer rows than the old snapshots. The UI's Unix seconds for R260609 and R260611 convert exactly to the connector's timestamp strings in `Pacific/Auckland`; this resolves their apparent UTC offset. R260445's latest connector string was `2026-10-28 13:55:21`, later than the 27 October local calendar day at this check. Its UI timestamp has not been inspected, so its time semantics remain unverified. Preserve the raw timestamp and confirm that fixture before making a timing claim.

### Fresh ServiceM8 UI comparison, 27 October

An already authenticated ServiceM8 browser session displayed staff member Michael. The Jobs search opened R260609 and R260611 without editing either Job. For each visible Job Diary row, a read-only DOM observation recorded its displayed type and the `data-timestamp` Unix seconds attribute; no bodies, names, addresses, contact details or signed file links were retained. Converting those seconds to `Pacific/Auckland` matched the connector's local timestamp strings exactly.

- **R260609:** 20 UI rows and 20 connector rows align at every type/order/timestamp position. This is strong inventory parity for the current UI and separate connector, but it is not a stable source-ID or full-content match and does not prove Office Agent MCP staff binding.
- **R260611:** 47 UI Diary rows align at every type/order/timestamp position with the connector's 47 non-payment rows. The connector has three additional payment-labelled rows. The UI Billing tab confirms the Job is paid, but does not display those three as separate Diary rows. A “Show 3 hidden diary items” control revealed call entries; it did not resolve the payment difference. Treat the payment rows as connector-only until their event semantics and source identities are reconciled. Do not force them into a one-to-one Diary count.

The current UI proves the old counts are stale. Exact type and time alignment is valuable but still cannot establish complete content, same-staff app access, or a guaranteed end of the connector's sequence.

## Diary-to-source reconciliation

| Source or event | Earlier app REST evidence | Fresh Diary observation | Current conclusion |
| --- | --- | --- | --- |
| R260609 Notes and Email | 3 active Notes among 4; 7 active Emails including one inbound, with preliminary timestamp alignment | Notes and Email/reply remain visible; 7 previews end in ellipses | Candidate rows only. Body, thread, author and stable identity are not joined. |
| R260609 Activity and attachments | 1 active/4 inactive activities; 8 active/1 inactive attachments | Booking, photo/group, quote and file labels were in the earlier UI; new Diary total is 20 | Activity edit time is not the Booking event time. Attachment grouping and version/bytes remain unproved. |
| R260611 Notes, Email, SMS, Payments | 4 Notes, 20 Emails, 1 outbound SMS, 2 payments in the older ten-scope audit | Current Diary total is 50 and retains call, message and payment labels | Historical timestamp/type candidates only. Additional rows need fresh source and UI review. |
| Calls, Service, creation, status history | No confirmed staff-bound REST historical source for every such row | These categories occur in the approved fixtures | No absence claim follows from missing API rows. They remain blocking coverage gaps. |
| R260766 and R260445 | Prior small-job and Quote Approved reference evidence | Both changed materially since reference reads | Useful representative fixtures, but no current UI parity. |

One pair of R260609 rows has identical visible metadata (type, optional object ID, title and timestamp). It may represent two genuine entries, a grouped presentation, or a duplicate. It is **not** counted as a confirmed duplicate without a stable event/source identity and UI comparison. Missing object UUIDs likewise cannot prove an event is missing or duplicated.

## Full content and timeline interpretation

The connector returned `content_preview`, not an asserted full body. Across the four Jobs, 14 previews were empty and 59 ended in an ellipsis. An empty preview is **unavailable content** unless a matched source explicitly confirms a genuinely empty body. A preview without an ellipsis is still not a full-text guarantee. A read-only connector `fetch` attempt for an R260609 Note object returned `Resource type is not accessible via the API: dboNote`; it did not provide Note detail. Prior endpoint evidence establishes that Email and SMS bodies can be retrieved separately, but full-content retrieval **for these current rows** was not verified here. No attachment bytes were read. A file may be described as added only after its event identity is checked; its contents cannot be inferred from metadata.

The new offline `buildJobContext` function preserves Diary key, event type and original timestamp; matched source system, ID and timestamp; full/empty/unavailable content state; truncation indicator; and timestamp disagreement. It accepts a join only by explicit source ID or a separately verified mapping. Unmatched REST records remain `unresolvedSources` and are not added as new timeline events. It neither establishes MCP sequence completeness nor binds the connector to the launching staff member. Consequently, it cannot currently support a complete live chronology.

## Interpretation checks

| Question | Outcome | Reason |
| --- | --- | --- |
| Latest communication | **FAIL** for live Jobs | Recent rows and time semantics need UI/source confirmation; previews do not establish full message content. |
| Customer response | **FAIL** for live Jobs | Reply labels are visible, but direction, thread and complete body are not joined for current rows. |
| Blockers | **FAIL** for live Jobs | A blocker can be in truncated/empty content or an unmatched call/service event. |
| Next action | **FAIL** for live Jobs | No safe action can be derived from the incomplete chronology and content. |

Offline builder tests cover stable-ID joining, an explicitly verified match, same-time ambiguity, unavailable versus genuine empty content, timestamp disagreement and duplicate/missing identity rejection. These are reconciliation tests, not claims that an agent correctly interpreted the live Jobs.

## Remaining gaps by severity

- **Critical:** No demonstrated complete-sequence/end-of-history condition for `get_job_diary`; no proven same-staff MCP binding or denied-access result. Keep the Job-answer gate closed.
- **Critical:** Current Email/SMS full bodies, calls, Service and status events are not jointly matched to the current Diary; latest communication, blockers and next action remain unsafe to assert.
- **High:** R260611's three connector-only payment rows need semantic/source reconciliation. R260609 and R260611 have fresh type/time UI comparison, but stable identity/content parity is outstanding. R260766 and R260445 need new UI reference if used for acceptance.
- **High:** R260609/R260611 connector times agree with UI Unix seconds after `Pacific/Auckland` conversion. R260445's apparent future date and Booking event time versus scheduled start/last edit still require verification.
- **Medium:** Attachment grouping, quote/invoice versions, one identical-metadata row pair, and full file content are unresolved; inspect file bytes only for claims about contents.
- **Medium:** No completed-Form fixture or approved denied-staff fixture. Absence from the sampled Jobs says nothing about account-wide absence.

## Reproduction and evidence

1. Review `docs/audits/RG-380-job-diary-coverage.md`, `docs/audits/RG-380-mcp-staging-probe.md`, `docs/research/rg381-diary-readiness.md`, and `docs/rg380-to-rg381-handoff.md`.
2. With the connected read-only **ServiceM8** account, call `get_job_diary` for R260609, R260611, R260766 and R260445. Locally reduce results to count, object-ID presence, empty-preview count, ellipsis count and timestamps; do not print bodies, customer details or raw IDs. The results above were observed on 27 October 2026.
3. Run `npm test -- --run tests/assistant-mcp-probe-routes.test.ts tests/servicem8/mcp-diary-probe.test.ts tests/servicem8/job-context-builder.test.ts tests/servicem8/job-diary-audit.test.ts tests/servicem8/client.test.ts tests/servicem8/job-diary-gate.test.ts` (**56 passed**), `npm run typecheck` (**passed**), and `npx eslint tests/assistant-mcp-probe-routes.test.ts lib/servicem8/client.ts tests/servicem8/client.test.ts lib/servicem8/job-context-builder.ts tests/servicem8/job-context-builder.test.ts` (**passed**).
4. For a future acceptance run, use the *same signed staff member* in the app and UI, read parent Job then each granted REST source through all cursors, and compare source IDs plus sufficient content. Record failed/denied reads as unavailable, never zero. Keep restricted raw evidence outside Git. The 27 October browser UI comparison covered type/order/exact timestamp, not source IDs or message bodies.

## MVP decision

**PARTIAL for read-only, offline MVP development; FAIL for enabling Job-derived summaries, recommendations or drafts.** Development may proceed on the isolated builder and synthetic interpretation fixtures while the existing `isJobDiaryCoverageVerified()` gate remains false. Production release requires a staff-bound, complete-sequence read contract, fresh item-level UI parity, source/body joins for material events, timestamp verification and negative access/error tests. Counts alone cannot lift the gate.

## RGTools REST comparison and Office Agent follow-up

The RGTools implementation was inspected in `apps/web/lib/servicem8/client.ts`, `apps/web/modules/quote-movement/sync.ts`, and `apps/web/modules/job-progress/registry.ts`. RGTools uses a read-only account API key for REST reads, a separate write credential for its write operations, a request timeout and bounded retries. Its collection readers start with `cursor=-1`, follow `x-next-cursor` until absent, reject a repeated cursor or page limit, and fail rather than treating a partial collection as complete. Its conversation snapshot intentionally filters and caps Notes and Email for that product; it is not evidence of complete Job history. Office Agent already had OAuth refresh, bounded retries, signed-staff impersonation and REST page readers, so only the proven pagination/collection behavior was adapted. The RGTools API key cannot be imported into Office Agent without losing Office Agent's signed-staff OAuth authorization boundary.

Office Agent already had a staff-impersonated OAuth GET client and page readers for Jobs, Notes, Email, SMS, Activities, Attachments and Payments. The new `lib/servicem8/rest-job-context.ts` composes those existing readers locally. It checks the parent Job before child reads, consumes each source to a terminal cursor, rejects duplicate IDs and mismatched Job ownership, fetches full Note and Email detail by ID, and retains the SMS list body. Each event preserves its source resource, source UUID, timestamp field, direction where available, active state, and `full` / `empty` / `unavailable` content state. A source failure discards its partial rows and reports access denial, unavailability or invalid data without emitting customer details. Optional Diary reconciliation uses only a shared source ID or an explicit verified mapping, leaving unmatched REST rows outside the Diary event timeline. No same-time or same-text heuristic merges them.

| Task check | Required REST resources | Additional gate | Current result |
| --- | --- | --- | --- |
| Latest communication | Complete Email and SMS pages, content and timestamps | Verified full Diary sequence, including calls | **FAIL**: Diary sequence unverified. |
| Customer response | Same, with known inbound/outbound direction | Verified Diary sequence | **FAIL**: Diary sequence unverified. |
| Blockers | All six resource collections and material text | Verified Diary sequence; attachment contents and Activity timing if material | **FAIL**: Diary sequence unverified; file and Activity semantics remain open. |
| Next action / recommendations | Same as blockers | Same-staff UI parity and evidence review before global gate opens | **FAIL**: `isJobDiaryCoverageVerified()` remains false. |

These checks are a local readiness model, not a production recommendation path. The REST reader has not been run against the live staff OAuth connection in this environment; its test evidence uses synthetic, non-customer fixtures. It does not retrieve call, Service, Job creation or status history, establish an MCP pagination/staff-binding contract, or prove Diary-to-REST identity joins. MCP remains a read-only inventory aid where REST lacks a corresponding historical resource, and its previews cannot be promoted to full content.

Reproduce the local checks with `npm test -- --run tests/servicem8/rest-job-context.test.ts tests/servicem8/job-context-builder.test.ts tests/servicem8/client.test.ts`, `npm run typecheck`, and `npx eslint lib/servicem8/rest-job-context.ts tests/servicem8/rest-job-context.test.ts`. The tests cover terminal cursor pagination, staff-bound detail methods, denied parent and detail reads, duplicate IDs, cursor cycles, mismatched child ownership, and genuine empty versus unavailable content. A future live acceptance run must use the same signed staff member in Office Agent and ServiceM8 UI, retain restricted raw IDs outside Git, and compare each material item, body and timestamp before changing the Job-answer gate.
