# RG-380 — Job Diary read coverage audit

Status: **INCOMPLETE — operational Job outputs blocked**
Prepared: 20 October 2026
Contract: [RG-380](https://linear.app/royalglass/issue/RG-380/05-audit-full-job-diary-read-coverage-and-access) and [Phase 2 PRD](../phase-2-prd.md)

## Current evidence and limit

The production stored connection granted `vendor read_jobs read_customers read_job_notes read_staff` in a read-only check on 20 October; its access token was expired. Both deployed manifest endpoints now return v0.2.1 with those five plus `read_email read_schedule read_attachments`. The owner completed new OAuth consent on the **staging** callback URL. The staging audit route then passed its exact eight-scope stored-grant check and returned a source inventory for R260609, supplied by the owner below. A read-only local metadata query still found the old expired five-scope **production** connection; it says nothing about the separate staging database. No token or customer data was printed. `ServiceM8Client` sends the OAuth bearer token with `x-impersonate-uuid` for the signed staff member. `createOfficeAssistantProof` re-reads the selected parent Job before reading its Company or Notes. No administrator-token path exists in that reader. These are **code and source-inventory findings**, not evidence that the UI and API match. The Office Assistant withholds its current Job summary, draft, recommendation and Phase 0 Job context until the full Diary parity audit and per-Job completeness check pass.

The official [scope list](https://developer.servicem8.com/docs/authentication) and [pagination guide](https://developer.servicem8.com/docs/pagination) were checked on 20 October 2026. The read surfaces below are documented possibilities. No Royal Glass UI/API parity result or staff sign-off has been recorded. **Do not mark any row complete from documentation or mock tests.**

## Source and access matrix

For each representative Job, copy this table into an evidence record and fill every `—` field. `0` means an observed, successful empty result; `—` means not tested. Record one row per visible subtype when its path, scope or timestamp differs.

| UI Diary type | Candidate API read | Required scope | Stored grant at audit | UI count | API count | Matched source IDs / timestamp meaning / content | Pages / duplicates / unreadable / missing | Result |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| Job creation | Job detail; historic creation event unproved | `read_jobs` | Configured | — | — | `date` may be created or scheduled; verify against UI | — | Unverified |
| Notes | Note list and detail | `read_job_notes` | Configured | — | — | Confirm body, author and `create_date` | — | Unverified |
| Outbound and inbound Job email, including replies | [Job email list](https://developer.servicem8.com/reference/listemailmessages) and detail | `read_email` | Absent | — | — | Confirm body, direction, thread, attachment, sent/received meaning | — | Scope gap |
| Outbound and inbound Job SMS, including replies | [Job SMS list](https://developer.servicem8.com/reference/listsmsmessages) | `read_sms` | Absent | — | — | Confirm message, direction and timestamp | — | Scope gap |
| Calls and Inbox conversion | [Inbox list](https://developer.servicem8.com/reference/listinboxmessages) and detail | `read_inbox` | Absent | — | — | Confirm call content, linked Job and conversion | — | Scope gap; Job call history unproved |
| Bookings and visits | [Job Activity](https://developer.servicem8.com/reference/listjobactivities) | `read_schedule` | Absent | — | — | Confirm past changes, cancellations and event time | — | Scope gap |
| Staff allocations | [Job Allocation](https://developer.servicem8.com/reference/listjoballocations) | `read_schedule` | Absent | — | — | Confirm current versus historic assignments | — | Scope gap |
| Quotes and versions | Job flags plus attachment metadata/file | `read_jobs`, `read_attachments` | Job only | — | — | Confirm version, sent time, document and outcome | — | Scope gap |
| Files | [Attachment metadata/file](https://developer.servicem8.com/reference/listattachments) | `read_attachments`; check `read_job_attachments` coverage | Absent | — | — | Confirm full bytes, type and content availability | — | Scope gap |
| Photos | Attachment/photo reads | `read_attachments`; check `read_job_photos` coverage | Absent | — | — | Confirm image association, bytes and interpretation | — | Scope gap |
| Forms | [Form Response list](https://developer.servicem8.com/reference/listformresponses) and generated document | `read_forms`, possibly `read_attachments` | Absent | — | — | Confirm all answers and document content | — | Scope gap |
| Status and queue changes | Current Job fields; historic event read unproved | `read_jobs`; check queue read | Job configured | — | — | Current value does not prove historic changes | — | Historic path unverified |
| Invoice events and payments | Job fields, attachment and [Job Payment list](https://developer.servicem8.com/reference/listjobpayments) | `read_jobs`, `read_attachments`, `read_job_payments` | Job only | — | — | Confirm version, issue/due date, payment and void state | — | Scope gap |

`Absent` in the matrix records the five-scope production grant at the original audit; it does not describe the newly consented staging connection or prove what other integrations can see. The owner subsequently approved and deployed the three-scope probe change documented below.

### Authorised UI fixtures observed on 20 October 2026

The existing ServiceM8 browser session is signed in as **Michael**. The owner authorised R260766 and R260609 for this audit and will review the matrix. The counts below are **staff UI observations only**. No app OAuth/API parity or owner review is claimed yet. Customer names, addresses, message bodies and signed file links are deliberately omitted from this repository record.

| Job | Visible Diary item types and counts | Additional content visible | Separate connector count / app API parity | Gaps for this fixture |
| --- | --- | --- | --- | --- |
| R260766 | Note 1; Email 1; Job Created 1. Total 3. | Note body and email subject/body are shown. | 3 / app source counts 1 Note, 1 Email, 0 Activity, 0 Attachment | Note/Email content and identity matching pending; Job Created has no proved historical read path. |
| R260609 | Note 3; Booking 1; Email 6; Customer Reply 1; Photo 1; Quote 1; grouped Photos entry 1; Service 1; Job Created 1; File Attachment 2. Total 18 Diary entries. | Email and reply bodies, quote link, two file links, booking detail and a photo group are shown. Individual photo count and file contents have not been checked. | 18 / app source counts 4 Notes, 7 Emails, 5 Activities, 9 Attachments including inactive records | Item-level email/booking/attachment matching pending; Service and Job Created history remain unproved. |

The R260609 view has a current booking card as well as the Diary Booking event; it is not counted as a second Diary entry. The two file links also appear within the Service item; count them as two File Attachment entries unless an API identity comparison proves a distinct record. Neither fixture contains every requested event type, so further synthetic/authorised fixtures are needed before any full-history pass decision.

### Candidate fixture found on 20 October

At the owner's request to find a useful Job among many, a read-only, redacted Diary-type scan of 15 invoice-sent Jobs in the connected Royal Glass ServiceM8 account found **R260611**. The separate connector reports 45 visible entries, including **1 SMS, 10 call-labelled entries, 2 payment-labelled entries, 1 invoice attachment, and 2 status-change entries**. This is a real Job, not a synthetic fixture. No customer name, address, message body, phone number, raw UUID or file link was copied into this record. The connector identity is separate from the Office Assistant staff OAuth identity, and its type labels do not prove API coverage. None of the 15 sampled Jobs had a form-labelled entry; this bounded scan cannot establish that the account has no Forms. The owner explicitly approved R260611 as an RG-380 fixture on 20 October, so it was added to the staging route's hard-coded allowlist. This does not grant new OAuth scopes or establish same-staff parity.

The [SMS history endpoint](https://developer.servicem8.com/reference/listsmsmessages) documents a Job UUID filter, inbound/outbound direction, message text and cursor pagination; the [scope list](https://developer.servicem8.com/docs/authentication) assigns it `read_sms`. The [Job Payment endpoint](https://developer.servicem8.com/reference/listjobpayments) documents Job UUID, timestamp, amount, method and `read_job_payments`. The owner approved adding these two read-only scopes for a staging probe on 20 October. Local code and both v0.2.2 manifest sources request ten scopes, but **the new grant has not been consented or tested on staging**. The route reports SMS direction/content presence and payment timestamps without phone numbers, message bodies, amounts, methods or notes. The ten call-labelled entries have no confirmed matching API source: [Inbox messages](https://developer.servicem8.com/reference/listinboxmessages) support `phone_call` and `converted_to_job_uuid`, but that does not prove all existing Job Diary calls are Inbox conversions. Status-change history likewise remains unproved by the current Job detail. Do not equate a successful ten-scope inventory for R260611 with full Diary coverage.

**Rollout gate:** Test staging before any production deployment of this candidate. Set staging `SERVICEM8_OAUTH_SCOPES` to the exact ten-scope string in `.env.example`, deploy staging, confirm its served manifest is v0.2.2 with ten scopes, update the *staging* ServiceM8 manifest, then complete fresh staging OAuth consent on the staging callback URL. The previous eight-scope grant must return `grant_incomplete` until that consent succeeds. Run R260611 through the signed staff audit and compare its SMS/payment metadata with the Diary. Do **not** deploy the ten-scope code to production while its environment still contains the eight-scope setting: `getConfig` would reject the deployment configuration. Even after setting production to ten, its old stored grant cannot pass without separate production manifest upload and consent on the production callback. Keep production promotion outside this staging probe and retain the Job-answer gate closed.

The separately connected ServiceM8 `get_job_diary` tool returned the same 3 and 18 item counts and UI type sequence. It returned UUIDs for Notes and Job Created events but not for Email, Customer Reply, Booking, Photos, Quote, Service or File Attachment items. This connector uses its own connection and is **not** evidence of the Office Assistant's approved scopes, Michael's impersonated app read, complete bodies or binary content. Do not populate the app API count or source-ID match columns from it.

### Preliminary timestamp reconciliation

The separate Diary connector was read again on 20 October with only the two authorised Jobs. Its redacted type/timestamp inventory agrees with the owner's staging audit metadata as follows. These are **candidate matches**, not the required same-staff ID and content proof:

| Fixture | Candidate match | Remaining check |
| --- | --- | --- |
| R260766 | The single Note and outbound Email both have the same `2026-10-08 11:51:24` timestamps in the Diary connector and staging audit. | Compare their full bodies and source identities through the signed staff app path. Job Created at `11:51:23` still has no proved API read. |
| R260609 | Three visible Note timestamps match the three active API Notes; the fourth API Note is inactive. All seven visible Email/reply timestamps match the seven API Emails, including one inbound reply. | Compare body, thread, author, and source IDs; timestamps alone can coincide. |
| R260609 | The visible single Photo timestamp matches an active image; the grouped Photos entry ends at `2026-09-09 12:26:21`, while four active image records have timestamps from `12:26:16` through `12:26:21`. Three active PDF records share the Quote/File entry times. | Confirm image grouping, PDF identity, file bytes, and quote version. The new redacted `attachmentRole` field may help classify PDFs after deployment; a filename or timestamp is not proof of content. |
| R260609 | The visible Booking Diary event is at `2026-09-27 22:52:12`; the one active Job Activity is scheduled to start `2026-10-25 09:00:00`. | The newly added `lastEditAt` is the activity's **last modification** time, not a documented Booking Diary event time. Rerun the staging audit after deployment and compare, then inspect change history if it differs. |

The connector's R260609 Service item and both Jobs' Job Created items remain unmatched. The [Diary posting guide](https://developer.servicem8.com/docs/posting-an-add-on-job-diary-item) documents create-only access, and the [Job Admin Activity read endpoint](https://developer.servicem8.com/reference/listjobadminactivities) is only an investigation candidate requiring `read_job_admin_activity`; its public response fields and Diary coverage are undocumented. See [the read-path research](../research/rg380-historic-diary-read-paths.md). Do not request that scope or mark those types covered until ServiceM8 confirms the path and an authorised same-staff test succeeds.

### Staging app source inventory supplied by the owner

The owner supplied the redacted R260609 result from `/assistant/audit`, audited at `2026-10-19T23:19:32.048Z`. All four source reads reported one page, no duplicate IDs and `status: complete`. The route verifies a signed staff session, the parent Job and the exact eight-scope stored grant before these reads. The payload does not expose the staff UUID, raw source IDs or contents; the staff identity and UI item matches still require reviewer confirmation.

| Source | API records | Active / inactive | Preliminary UI comparison |
| --- | ---: | ---: | --- |
| Notes | 4 | 3 / 1 | The UI showed 3 Note entries; the extra API record is inactive. Match timestamps and contents before calling these the same items. |
| Email | 7 | 7 / 0 | Six outbound and one inbound record may correspond to the UI's 6 Email and 1 Customer Reply entries. Direction and count alone do not prove identity or content. |
| Job activities | 5 | 1 / 4 | The UI showed one Booking entry and a separate current booking card. The active API activity starts on 25 October; the four inactive activities include earlier and future dates. No booking match is established. |
| Attachments | 9 | 8 / 1 | Three active PDFs, five active images and one inactive PDF cannot be equated directly with the UI's Photo, grouped Photos, Quote and two File Attachment entries. Grouping and duplicate links need review. |

The owner also supplied the redacted R260766 result, audited at `2026-10-19T23:21:58.190Z`. Notes: one active record at `2026-10-08 11:51:24` with content present. Email: one active outbound record at the same timestamp with content present. Activities and Attachments: zero records. Each source reported one page, no duplicates and `status: complete`. This aligns by type and count with the UI's one Note and one Email, but their identity and content are not yet matched. The UI's Job Created item has no proved historical read path.

The owner reported that the two staging audit results looked good on 20 October 2026. No per-item match decisions or body/file-content comparison were supplied, so that feedback is recorded as a successful source-inventory smoke test rather than a full parity sign-off. These inventories do not cover Job Created or the R260609 Service entry, do not read body/file bytes, and do not prove full Diary parity.

### Scope decision for the R260609 probe

The current grant already includes `read_jobs` and `read_job_notes`. The smallest **documented first probe**, subject to owner approval and a new app OAuth grant, adds `read_email`, `read_schedule`, and `read_attachments`. These map respectively to the six Email plus one Customer Reply items, the Booking item, and the Photo/grouped Photos, Quote and two File Attachment items. The [Attachment list](https://developer.servicem8.com/reference/listattachments) and [file download](https://developer.servicem8.com/reference/downloadattachmentfile) explicitly require `read_attachments`; the official [attachment guide](https://developer.servicem8.com/docs/attaching-files-to-a-job-diary) says the Attachment endpoint includes photos and PDFs. Verify that this single scope returns all five relevant R260609 Diary entries before considering `read_job_photos` or `read_job_attachments` separately. It is not yet proven that one Photo and one grouped Photos Diary item map to one record each.

This is a **probe set, not a coverage pass**. The `Request a Free Quote Service` and `Job Created` entries have no proved historical read path or stable API IDs in the current evidence. Do not add `read_service_templates` on the assumption that a template definition reconstructs a past service event. Test the three-scope probe with the same impersonated staff identity and parent-Job check, reconcile timestamps and bodies/files item by item, then decide whether a further endpoint or a documented irreducible gap remains. `publish_diary_items` is write-only for Add-on-attributed entries and cannot fill a read gap ([authentication scopes](https://developer.servicem8.com/docs/authentication)).

On 20 October 2026 the owner approved requesting these three additional read scopes for the R260609/R260766 probe. The code and both manifest sources were aligned to the exact eight-scope set and deployed; both live manifest endpoints returned HTTP 200 and v0.2.1 with eight scopes. The owner reports completing fresh staging consent on the staging callback URL. The OAuth exchange checks exact scopes. Production's stored grant remains the original five-scope connection. Raw message bodies and files stay out of Git; record only redacted match evidence here.

For the **broader RG-380 inventory**, R260611 now justifies `read_sms` and `read_job_payments`, approved for a bounded staging probe. `read_inbox` and `read_forms` remain candidates until a matching call path or Form fixture is established. `read_job_photos`, `read_job_attachments`, `read_job_queues`, and `read_service_templates` require a specific failed match or endpoint need before request. The next fixture should deliberately cover Forms rather than expand all scopes speculatively. The staging route has produced redacted source inventories for the first two authorised Jobs; item-level reconciliation and R260611's first staging audit remain pending.

## Reproducible fixture and review procedure

1. Select synthetic Jobs, or record the owner's explicit authorisation for each real Job. Record account UUID and staff role in a restricted evidence store; use pseudonymous Job labels in this document. Include both an office coordinator and estimator, a wrong-staff case, and a wrong-account case. Do not copy customer bodies, files or tokens into Git.
2. In ServiceM8, have the staff reviewer enumerate **every** Diary item for each Job. Capture a restricted export or screenshot with the UI item type, source label, event time, body/file availability and a stable reviewer-assigned item key. Cover an inbound and outbound email/reply and SMS, call, changed booking, quote/version, invoice/payment, photo/file, form, note, creation and status event. A fixture missing a type cannot clear that type.
3. From the same signed staff and connected account, read the parent Job first. Record the returned Job UUID and the staff-visible match before any child read. A denied or mismatched parent stops the fixture. Do not use an API key, administrator token or another staff identity to fill a gap.
4. For each approved source, record the endpoint, granted scope, request time, HTTP result and pagination until the endpoint's end condition. Record each source ID, Job link, timestamp field and meaning, body or binary availability, duplicates and unreadable items. Follow `x-next-cursor` where documented; Inbox uses its own offset/limit contract. Keep the raw response only in the approved restricted location.
5. Match each UI item to API item(s) by stable IDs and content, not by count alone. Classify `matched`, `missing`, `duplicate`, `unreadable`, `scope denied`, `request failed`, `pagination incomplete`, or `no approved read path`. Never turn a denied/failed page into a zero count. Note any API-only item separately.
6. Have the office coordinator and estimator review the reconciled matrix. Record reviewer, date, fixture label, disputed matches and decision. The audit passes only when every relevant visible type has complete authorised content and a repeatable read path for both roles, with no blocking gap. Otherwise leave Job outputs closed and pass the exact gap to RG-381 or the access decision owner.

## Negative cases to execute

| Case | Expected result | Current evidence |
| --- | --- | --- |
| Wrong account, wrong staff or denied parent Job | Stop before child reads; no fallback credential | Existing client/proof unit tests; live check pending |
| Denied child scope or source timeout | Incomplete coverage, not zero events | Live check pending |
| Partial/cycling pagination | Incomplete coverage with last cursor/page recorded | Existing bounded Notes reader test; other sources pending |
| UI-visible item with no API match/read path | Blocking gap with item type and reviewer key | Live check pending |
| Duplicate IDs across pages/sources | One matched item plus duplicate record | Live check pending |
| Unreadable document or photo | Incomplete content, no generated Job output | Live check pending |
| Current assistant Job summary, email, recommendation | Staff-visible incomplete state and no model call | Focused route regression; deployment/browser check pending |

## Exit decision

**Blocked pending same-staff app API parity.** R260766, R260609 and R260611 are authorised fixtures, and the owner is the named reviewer. The first two staging route outputs prove the then-stored connection passed the exact eight-scope check and returned Notes, Email, Job Activity and Attachment metadata; the owner reported that source-inventory test looked good. R260611 is newly allowed but has no staging app inventory or ten-scope consent yet. None of these findings proves item-level UI/API matches or complete content. The production connection remains an expired five-scope grant, and no form-labelled fixture was found in the bounded scan. A proposed CLI download of staging environment secrets was rejected by automatic approval review, so no direct staging database query was made. Keep the code gate closed. Obtain the owner's item-by-item comparison, a form fixture and a confirmed historic read path for Job Created, Service, calls and status changes before RG-380 sign-off; then implement and verify RG-381's per-Job completeness check before opening the gate.

**Question prepared for ServiceM8 developer support:** Is there a supported read-only OAuth endpoint for the *historic* Job Diary, including Job Created and Service events? If so, please provide the resource, required scope, pagination, Job/staff access and `x-impersonate-uuid` behavior, stable event IDs, exact event timestamps, and body/file availability. Does `jobadminactivity` return those existing rows? If there is no supported full-history read, please confirm that limitation. No support request was sent from this audit.
