# Unified Job Context live verification

Checked 27 October 2026 (Pacific/Auckland). The local builder used GET-only ServiceM8 REST calls with the configured account key, a fresh read of the separate ServiceM8 MCP Diary connector, and Michael's same-day signed-in ServiceM8 UI inventory. The MCP inventory was saved as a metadata-only fixture: type, timestamp, object ID where supplied, preview state and whether the row appeared in the UI. Customer names, contacts, addresses, message text, attachment links and credentials are absent from this report and fixture.

## Assessment

| Category | Result | Evidence |
| --- | --- | --- |
| REST retrieval | **PASS** for both jobs | All six collections reached a terminal cursor in one page. Note and Email detail GETs returned nonempty full text; the one SMS list body was nonempty. |
| Unified timeline | **PARTIAL** | Every observed Diary row remains in the timeline. Explicit Note IDs and unique communication type/time pairs enrich 10 R260609 and 29 R260611 rows. Unlinked REST records are kept in a separate evidence list, so attachments, payments and scheduled activities are not presented as new Diary events. |
| UI comparison | **PARTIAL** | 20/20 R260609 and 47/47 R260611 UI Diary rows were inventoried by event type and time. All 39 visible Email, reply, SMS and Note rows matched REST source type and exact second. UI body equality and stable ID parity for Email/SMS remain unproved. |
| Agent interpretation | **PASS** for the six bounded live questions/drafts tested | Both jobs: latest communication/reply answer cited the actual latest sourced Email and customer reply; blocker/next-check answer and review-only draft cited source text with verified quote anchors. Drafts asked a job-appropriate question. No messages were sent. This is a test result for these prompts and snapshots, not general accuracy certification. |
| Office Agent staging path | **FAIL** | The builder and live test harness run locally. The staging Add-on previously displayed “Invalid Response Received”; a signed Michael Office Agent launch and deployed route were not verified. The existing Job-output gate remains closed. |

## Job-by-job reconciliation

| Job | UI Diary | MCP Diary | REST full-text joins | Visible Diary rows without verified full REST source | Separate REST metadata |
| --- | ---: | ---: | --- | --- | --- |
| R260609 | 20 | 20 | 3 Notes by ID; 7 Email/replies by unique type and second | 10: 3 Address Check Diary entries; 1 Photo; 1 Quote; 1 grouped Photos; 1 Service; 1 Job Created; 2 File Attachment rows | 1 inactive Note, 5 inactive Activities and 9 Attachments remain unlinked. The attachment metadata may describe visible file/photo rows, but identity/grouping was not proved. |
| R260611 | 47 | 50 | 4 Notes by ID; 24 Email/replies plus 1 SMS by unique type and second | 18: 10 Calls; 3 Photo/grouped Photos; 2 Quote-related rows; 1 Invoice; 1 status change; 1 Job Created | 3 inactive Activities, 8 Attachments and 3 Payments remain unlinked. The three MCP Payment entries were not individual rows in the observed UI inventory. |

**Missing-record finding:** no visible Email, reply, SMS or Note row was absent from the completed REST communication collections. The 28 other visible Diary rows listed above lack a verified full REST source join; this does not mean their events are absent from ServiceM8. No source record is silently discarded. The 29 REST metadata records above are separate from the Diary timeline until their identity and event-time semantics are proved. R260609's inactive Note is intentionally not treated as a visible Note. `start_date` on the eight inactive Activities is a scheduled time, not a Diary event time.

The 39 communication joins are 7 Note object IDs plus 32 unique type-and-second matches. The latter are strong candidates corroborated by the UI inventory, but are labelled as time matches rather than source-ID matches. A duplicated type/time would remain unmatched. Email/Note source text was read from detail endpoints; 4/4 Notes and 7/7 Emails on R260609, and 4/4 Notes and 24/24 Emails on R260611 were nonempty. The 1/1 R260611 SMS text was nonempty. This proves retrieval, not byte-for-byte UI body equality. Diary previews with empty or shortened text remain marked as unavailable or preview-only until enriched.

## Live agent checks

For each job, the harness asked: (1) latest customer-facing communication and latest customer reply, (2) current blocker and next office check, and (3) a concise review-only follow-up draft based on the latest reply. The provider was given only matched, active, full REST Email/SMS/Note text plus a type/time list of Diary gaps. It could not cite an attachment, call, status change or scheduled activity as if its content had been read. Responses used `store:false`. The verifier required every citation to have an 8+ character quote found in the cited source text. It also checked that the first answer cited both the actual latest communication and latest reply, that the other answer/draft contained a job-specific signal and action, that the draft asked a question, and that output contained no detected email, phone or street address.

| Job | Latest communication/reply | Blocker and next check | Review-only draft | Outcome |
| --- | --- | --- | --- | --- |
| R260609 | Cited latest outbound Email and latest inbound reply; recognized consent/project timing context | Cited source text and reported Diary gaps | Asked for a relevant update without promising date or price | **PASS** for tested prompts |
| R260611 | Cited latest outbound Email and latest inbound reply | Cited source text and reported Diary gaps; recognized work/payment completion signals | Asked a completion-appropriate follow-up question | **PASS** for tested prompts |

The first live draft pass exposed two concrete failures: the response schema incorrectly required nonempty answer text for a draft, and a generic R260611 draft omitted a useful question. Both were repaired and rerun. A stricter quote-anchor check also rejected an unsupported or inexact quote in an intermediate R260609 run; the result was withheld. Final separate live runs passed all three prompts for each job. The test does not claim every sentence is independently entailed by its anchor, and staff review remains necessary before copying a draft.

## Remaining gaps and severity

| Gap | Severity | Practical limit |
| --- | --- | --- |
| Staging launch and signed-staff Office Agent path unavailable | **High** | Local account-key proof cannot establish Michael's Office Agent OAuth behavior or a working deployed feature. |
| Ten R260611 Calls have no full source text in this builder | **High** for general blockers/next-action claims | Answers must disclose this gap and avoid claiming complete call history. |
| Address Check/Service/status/creation and file grouping lack source joins | **Medium** | The timeline shows their existence and time, not independently verified full content or identity. |
| Attachment bytes and Email/SMS UI body equality unverified | **Medium** | Do not claim document contents or exact body parity. |
| MCP staff binding and terminal-history contract unverified | **Medium** | The separate MCP inventory is a same-day comparison, not proof that Office Agent can obtain identical staff-scoped Diary results. |
| Agent answer/draft quality tested on two jobs only | **Medium** | No general recommendation release or automatic sending. |

## Reproduction

From `D:\Royal Glass Dev\office-agent` with the owner's ignored local `.env` and no credentials printed:

```powershell
$env:SERVICEM8_LIVE_VERIFY='1'
$env:SERVICEM8_LIVE_AGENT_VERIFY='1'
npm test -- --run tests/servicem8/live-rest-job-context.test.ts --silent=false
Remove-Item Env:\SERVICEM8_LIVE_AGENT_VERIFY
Remove-Item Env:\SERVICEM8_LIVE_VERIFY
npm test -- --run tests/servicem8/unified-job-context.test.ts tests/servicem8/job-context-builder.test.ts tests/servicem8/rest-job-context.test.ts
npm run typecheck
npx eslint lib/servicem8/unified-job-context.ts lib/servicem8/unified-job-agent.ts tests/servicem8/unified-job-context.test.ts tests/servicem8/live-rest-job-context.test.ts
```

Live calls were GET-only to ServiceM8 and POST-only to the configured OpenAI Responses API for answer/draft testing; no ServiceM8 record was modified and no customer communication was sent. The live test logs only job numbers, type/time metadata, aggregate counts, citation and quote-validation outcomes, and output-length/PII-pattern checks. The local test results were 11/11 focused unit tests, typecheck PASS, targeted ESLint PASS, R260609 3/3 live agent prompts PASS and R260611 3/3 PASS in final separate runs.

## Decision

**Proceed with a bounded staging implementation and staff review of read-only, cited answers and copy-only drafts.** The two-job live proof shows the communication retrieval and join are useful. It does **not** prove the Office Agent staging login path or complete Diary history. Keep the existing production Job-output gate closed, do not enable automatic recommendations or sending, and present the known Diary-only categories whenever an answer depends on them. Before production release, verify signed-staff staging access, direct UI body parity for sampled messages, and full-content paths or explicit user-visible limits for the ten Calls and other unmatched event types.
