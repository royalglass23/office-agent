# RG-380 — Job Diary read coverage audit

Status: **INCOMPLETE — operational Job outputs blocked**
Prepared: 20 October 2026
Contract: [RG-380](https://linear.app/royalglass/issue/RG-380/05-audit-full-job-diary-read-coverage-and-access) and [Phase 2 PRD](../phase-2-prd.md)

## Current evidence and limit

The stored connection granted `vendor read_jobs read_customers read_job_notes read_staff` in a read-only check on 20 October; its access token was expired. Local code now requests those five plus `read_email read_schedule read_attachments`, but no new grant or deployed state has been verified. No token or customer data was printed. `ServiceM8Client` sends the OAuth bearer token with `x-impersonate-uuid` for the signed staff member. `createOfficeAssistantProof` re-reads the selected parent Job before reading its Company or Notes. No administrator-token path exists in that reader. These are **code and connection-metadata findings**, not evidence that the UI and API match. The only implemented Job history source is Notes. The Office Assistant withholds its current Job summary, draft, recommendation and Phase 0 Job context until the full Diary parity audit and per-Job completeness check pass.

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

`Absent` in the matrix means the stored connection lacked that permission when checked; it does not prove what other integrations can see. The owner subsequently approved the three-scope local probe change documented below. No OAuth reconnection or production deployment has been approved or completed.

### Authorised UI fixtures observed on 20 October 2026

The existing ServiceM8 browser session is signed in as **Michael**. The owner authorised R260766 and R260609 for this audit and will review the matrix. The counts below are **staff UI observations only**. No app OAuth/API parity or owner review is claimed yet. Customer names, addresses, message bodies and signed file links are deliberately omitted from this repository record.

| Job | Visible Diary item types and counts | Additional content visible | Separate connector count / app API parity | Gaps for this fixture |
| --- | --- | --- | --- | --- |
| R260766 | Note 1; Email 1; Job Created 1. Total 3. | Note body and email subject/body are shown. | 3 / — | The stored grant lacks `read_email`; creation timestamp semantics and app API parity unverified. |
| R260609 | Note 3; Booking 1; Email 6; Customer Reply 1; Photo 1; Quote 1; grouped Photos entry 1; Service 1; Job Created 1; File Attachment 2. Total 18 Diary entries. | Email and reply bodies, quote link, two file links, booking detail and a photo group are shown. Individual photo count and file contents have not been checked. | 18 / — | The stored grant lacks email, schedule and attachment scopes; the app has no implemented readers for those sources, and service history remains unproved. |

The R260609 view has a current booking card as well as the Diary Booking event; it is not counted as a second Diary entry. The two file links also appear within the Service item; count them as two File Attachment entries unless an API identity comparison proves a distinct record. Neither fixture contains every requested event type, so further synthetic/authorised fixtures are needed before any full-history pass decision.

The separately connected ServiceM8 `get_job_diary` tool returned the same 3 and 18 item counts and UI type sequence. It returned UUIDs for Notes and Job Created events but not for Email, Customer Reply, Booking, Photos, Quote, Service or File Attachment items. This connector uses its own connection and is **not** evidence of the Office Assistant's approved scopes, Michael's impersonated app read, complete bodies or binary content. Do not populate the app API count or source-ID match columns from it.

### Scope decision for the R260609 probe

The current grant already includes `read_jobs` and `read_job_notes`. The smallest **documented first probe**, subject to owner approval and a new app OAuth grant, adds `read_email`, `read_schedule`, and `read_attachments`. These map respectively to the six Email plus one Customer Reply items, the Booking item, and the Photo/grouped Photos, Quote and two File Attachment items. The [Attachment list](https://developer.servicem8.com/reference/listattachments) and [file download](https://developer.servicem8.com/reference/downloadattachmentfile) explicitly require `read_attachments`; the official [attachment guide](https://developer.servicem8.com/docs/attaching-files-to-a-job-diary) says the Attachment endpoint includes photos and PDFs. Verify that this single scope returns all five relevant R260609 Diary entries before considering `read_job_photos` or `read_job_attachments` separately. It is not yet proven that one Photo and one grouped Photos Diary item map to one record each.

This is a **probe set, not a coverage pass**. The `Request a Free Quote Service` and `Job Created` entries have no proved historical read path or stable API IDs in the current evidence. Do not add `read_service_templates` on the assumption that a template definition reconstructs a past service event. Test the three-scope probe with the same impersonated staff identity and parent-Job check, reconcile timestamps and bodies/files item by item, then decide whether a further endpoint or a documented irreducible gap remains. `publish_diary_items` is write-only for Add-on-attributed entries and cannot fill a read gap ([authentication scopes](https://developer.servicem8.com/docs/authentication)).

On 20 October 2026 the owner approved requesting these three additional read scopes for the R260609/R260766 probe. The local code, both manifest sources, example environment and local environment were aligned to the exact eight-scope set; this is **not** a deployed grant. The OAuth exchange still checks exact scopes. A fresh consent grant, after a separately authorised deployment and manifest upload, is required; token refresh alone cannot add permissions. Raw message bodies and files stay out of Git; record only redacted match evidence here.

For the **broader RG-380 inventory**, `read_sms`, `read_inbox`, `read_forms`, and `read_job_payments` are candidates only when an authorised fixture contains the corresponding visible type; none is justified by R260609 alone. `read_job_photos`, `read_job_attachments`, `read_job_queues`, and `read_service_templates` require a specific failed match or endpoint need before request. The next fixture should deliberately cover the missing types rather than expand all scopes speculatively. Only the local scope request changed; no reauthorisation was initiated.

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

**Blocked pending grant and parity.** R260766 and R260609 are authorised fixtures and the owner is the named reviewer, but their same-staff API reads and review decision are pending; these two Jobs also lack several required event types. The stored app access token has expired and still has the five-scope grant. The owner approved a local three-scope probe change, but has not approved deployment or completed fresh consent. No UI/API parity claim is possible, and the code gate remains closed. After an authorised release and consent, repeat the same-staff UI/API comparison and obtain owner review. RG-381 must still implement the per-Job completeness check before this gate can open.
