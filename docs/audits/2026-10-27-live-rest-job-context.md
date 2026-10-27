# Live REST Job Context verification — R260609 and R260611

Checked 27 October 2026 (Pacific/Auckland). This is a read-only, account-key REST comparison against Michael's signed-in ServiceM8 UI and a separately connected MCP Diary inventory. The local `SERVICEM8_API_KEY_FULL` was used **only in HTTP GET requests** and was never printed. It is a write-capable credential, so this run does **not** establish least-privilege or Michael-bound Office Agent OAuth behavior. No customer names, addresses, contact details, message bodies, raw UUIDs, tokens, or file links are retained here.

## Assessment

| Category | Result | Evidence and limit |
| --- | --- | --- |
| Office Agent sign-in as Michael | **FAIL** | Michael was signed in to ServiceM8, but launching **RG Office Assistant Staging** from its Add-ons menu displayed “Invalid Response Received.” The new local builder is not deployed there, and no signed Office Agent session used it. |
| Account-key REST parent and source retrieval | **PASS** for these two Jobs | Exact Job lookup and parent detail succeeded. Notes, Email, SMS, Activities, Attachments and Payments each returned one page with no `x-next-cursor`; all six source collections passed local validation for both Jobs. This proves terminal REST pagination for this snapshot, not a general upper bound or full Diary coverage. |
| Email/SMS/Note UI inventory and timing | **PASS** for type/direction/time snapshot | R260609: seven Email/reply plus three active Notes matched ten UI rows by type and exact Auckland-local second. One additional REST Note is inactive. R260611: 24 Email/reply, one SMS and four Notes matched 29 UI rows in the same way. No stable per-row Email/SMS UI ID or exact body comparison was established. |
| Source text retrieval | **PARTIAL** | Note detail returned nonempty text for 4/4 on each Job; Email detail returned nonempty text for 7/7 and 24/24; the SMS list returned nonempty text for 1/1 on R260611. These are source fields retrieved by GET, not a verified byte-for-byte match to the UI. Zero empty bodies were observed. Activity, Attachment and Payment rows carry no body in this builder and remain `unavailable`, not genuinely empty. |
| Activity/Booking chronology | **FAIL** for Diary event parity | REST returned five R260609 and three R260611 Activity rows, all currently inactive. Their `start_date` values are scheduled times, and `edit_date` values are last edits. Neither field was proved to identify the corresponding UI Diary Booking/change event time. |
| MCP Diary reconciliation | **PARTIAL** | Separate MCP inventory returned 20 R260609 and 50 R260611 entries. Michael's UI showed 20 and 47 Diary rows respectively. Communication timing aligns; unresolved calls, Service, creation, status, file/photo grouping and payment presentation are retained as gaps. MCP has no declared terminal cursor, full-body or same-staff identity contract. |
| Task-specific readiness | **FAIL** for all four tasks | The live builder reported `ready:false` for latest communication, customer response, blockers and next action on both Jobs. `diary:unverified` blocks all four; unresolved file content and Activity time semantics also block blocker/next-action claims. The global Job-answer gate remains false. |

## Job-by-job REST coverage

All counts below are raw resource records, including inactive rows. `Full` means a nonempty source text field was returned, not that UI body parity was proved. Every listed collection reached a terminal REST cursor in one page.

| Job | Notes | Email | SMS | Activities | Attachments | Payments | REST terminal result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| R260609 | 4 (3 active; 4 full text) | 7 (7 source texts) | 0 | 5 (all inactive) | 9 | 0 | **PASS** for six collections |
| R260611 | 4 (4 active; 4 full text) | 24 (24 source texts) | 1 (1 source text) | 3 (all inactive) | 8 | 3 | **PASS** for six collections |

An initial R260609 run marked Notes invalid because ServiceM8 returns `related_object` as both `job` and `Job`. The builder now normalizes this vendor field while still requiring the exact parent Job UUID. A regression test covers the capitalized form. An intermittent R260611 run was also inconclusive until the live GET probe classified HTTP failures separately and retried bounded 429/5xx responses. The final run completed all collections. Neither failed intermediate run is counted as coverage evidence.

## Diary-to-source reconciliation

| Job | Michael UI | Account-key REST communication match | MCP inventory | Unresolved distinction |
| --- | ---: | --- | ---: | --- |
| R260609 | 20 Diary rows | 7 Email/reply + 3 active Notes: **10/10** UI type/time matches | 20 | The other ten UI/MCP rows include photo/file/quote, creation, Service and Diary-labelled changes. Source identity, grouping and content are not fully joined. The extra inactive REST Note is not inserted as a visible Diary event. |
| R260611 | 47 Diary rows | 24 Email/reply + 1 SMS + 4 Notes: **29/29** UI type/time matches | 50 | MCP includes three payment-related entries that are not individual visible UI Diary rows; REST has three Payment rows. Ten call entries and two status-related entries still lack a demonstrated complete, same-staff REST history and body join. |

The 39/39 figure is an **event type plus exact timestamp comparison**, not an identity or content match. Rows with the same timestamp can be distinct events. The builder's optional Diary reconciliation therefore accepts only an explicit source ID or independently verified mapping; it leaves unmatched REST rows outside the Diary event timeline rather than creating duplicates. No live automatic ID join or full-context completeness claim was made.

For R260609, the five Activity scheduled starts range across historical and later dates, while the currently visible Diary includes newer change entries. For R260611, the three scheduled starts likewise do not establish when a Booking was created, cancelled or changed. All eight Activity rows are inactive at this read. `start_date` is retained as a scheduled-time provenance field; it is not promoted to a Diary event timestamp. Attachment and Payment metadata can support bounded existence claims, but no file bytes or payment-history presentation parity were verified.

## Interpretation checks

| Question | Local result | Evidence limit |
| --- | --- | --- |
| Latest communication | **FAIL to enable** | REST Email/SMS lists and timestamps completed, but the full Diary sequence, including calls, is unverified. |
| Customer response | **FAIL to enable** | Email/SMS direction and source text are present; same-staff Diary and exact UI body joins remain open. |
| Blockers | **FAIL to enable** | A relevant blocker could be in an unmatched call, status change, attachment or other Diary entry. Activity scheduled time is not event time. |
| Next action | **FAIL to enable** | No live agent recommendation was generated. The per-task check and `isJobDiaryCoverageVerified()` remain closed. |

## Reproduction

From `D:\Royal Glass Dev\office-agent`, with the ignored local `.env` containing the owner's configured key and allowed account binding:

```powershell
$env:SERVICEM8_LIVE_VERIFY='1'
npm test -- --run tests/servicem8/live-rest-job-context.test.ts --silent=false
Remove-Item Env:\SERVICEM8_LIVE_VERIFY
npm test -- --run tests/servicem8/rest-job-context.test.ts tests/servicem8/job-context-builder.test.ts tests/servicem8/client.test.ts tests/servicem8/job-diary-gate.test.ts
npm run typecheck
```

The opt-in live test calls only GET endpoints, prints aggregate metadata and source timestamps, and fails if a collection is not complete. It does not use the Office Agent OAuth connection. The final live run passed 2/2 Jobs. The local builder regression includes parent denial, cursor cycles, duplicate source IDs, child ownership, missing versus empty content and the observed `Job` capitalization. UI comparison used Michael's already signed-in ServiceM8 browser, reducing Diary DOM to event types and Unix timestamps before converting to `Pacific/Auckland`. The separate ServiceM8 MCP connector was reduced to counts, event types, ID presence and preview state; its customer text was not retained.

## Decision and next gate

**PARTIAL milestone; NO-GO for Job recommendations.** Account-key REST collection and communication inventory are strong for these two Jobs. The first required next proof is a working Office Agent staging launch as Michael and the same six reads through its staff-impersonated OAuth client. Then compare source IDs and sufficient full bodies with the same staff's UI, prove the MCP Diary's staff binding and end-of-history behavior or provide an equivalent supported history source, and resolve the extra payment presentation and missing call/status/Service history. Keep the Job-answer gate closed until those checks pass for representative Jobs.
