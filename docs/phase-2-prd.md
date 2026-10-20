# RG Office Assistant — Phase 2 PRD

Status: Published for owner and staff review in [Linear RG-375](https://linear.app/royalglass/issue/RG-375/rg-office-assistant-phase-2-prd)<br>
Date: 19 October 2026<br>
Scope: Five capabilities, supported by expanded read-only Job history<br>
Source: Owner's Phase 2 discussion and Roxy's capability list in [roxy-office-agent-ideas.md](roxy-office-agent-ideas.md)

## Problem Statement

Royal Glass office staff must piece together Job history across ServiceM8 screens before they can respond accurately or see what needs attention. A separate company search takes time and can mix verified identity with self-published project claims. Staff need one source-led view that makes missing evidence visible and supports their own decisions.

## Solution

Phase 2 should help staff understand a Job, decide what needs attention, prepare a useful response, and assess whether a construction-company partnership is worth pursuing. It delivers five capabilities:

1. better emails that achieve the stated goal, with an editable address-based subject;
2. the one-URL property, photo, company and collaboration report;
3. clearer Job and client briefs;
4. a view of Jobs needing attention, with reasons for each flag; and
5. Inbox summaries and reply drafts.

The full Job Diary is the shared evidence prerequisite for every Job-based output, including the email draft and Job summary currently produced by the Phase 1 proof, the improved Phase 2 email draft, Job/client brief, attention view and Job-linked Inbox reply. The current Job-and-notes reader is insufficient for operational use. The target is the full history staff can see in the Job Diary, not merely notes. The agent must finish the authorised read and coverage check for the selected Job before producing an output based on that Job. A missing relevant item, unreadable required content or failed source blocks the affected Job-based output and shows staff what could not be read; a partial history must never be presented as complete. The public one-URL company report remains independent because it does not use a ServiceM8 Job.

Staff may select a Job and the agent may perform the preparatory reads needed to establish coverage. The gate applies before it presents a Job summary, recommendation, attention decision or draft for staff to act on.

## User Stories

1. As an office coordinator, I want to select a Job by address or Job number, so that the agent uses the intended Job.
2. As an authorised staff member, I want Job records checked under my account and staff access, so that I only see information I am allowed to see.
3. As an office coordinator, I want every available Job Diary item in one dated chronology, so that I can understand what happened without losing emails, replies, calls, bookings, quotes, files, photos or creation details.
4. As an office coordinator, I want a clear coverage statement when a source is missing, denied, unreadable or incomplete, so that I do not mistake a partial history for the whole Diary.
5. As an estimator, I want the readable contents of quote files and other attachments and labelled AI interpretations of photos, so that I can advise from the underlying evidence.
6. As an office coordinator, I want a concise Job and client brief with original-record links, so that I can check the summary before acting.
7. As an office coordinator, I want to state the email recipient and desired outcome, so that the draft actually carries out my request in an appropriate voice.
8. As an office coordinator, I want an editable address-led subject and body, so that I can correct the draft before copying and sending it myself.
9. As an office coordinator, I want the draft to show supporting records and uncertainties, so that it does not present an unconfirmed booking, approval, payment or reply as fact.
10. As an office coordinator, I want Inbox messages shown with their verified Job links, so that I can prepare a reply without attaching an enquiry to the wrong Job.
11. As an office coordinator, I want clear, rule-based attention flags for unanswered enquiries, sent Quotes and overdue invoices, so that I can review work that may need follow-up.
12. As an office coordinator, I want unknown data to produce an indeterminate state, so that a failed source is not read as “no action required.”
13. As a business owner, I want to enter one construction-company or project URL and confirm the matched company, so that the report is about the right legal entity.
14. As a business owner, I want company facts, relevant project/property context and individually attributed photo references, so that I can inspect the evidence without treating unrelated or template images as company work.
15. As a business owner, I want potential fit, potential friction and practical collaboration approaches with cited reasoning, so that I can decide which companies warrant a conversation or trial.
16. As an authorised staff member, I want to download, reopen and compare dated report versions, so that I can see what changed and when each source was checked.
17. As a designated admin, I want a 12-month keep-or-delete review, so that old report versions receive a deliberate retention decision.
18. As a staff member, I want a failed fetch, ambiguous match or unsupported source explained with a retry or selection path, so that I can recover without relying on invented results.
19. As a staff member, I want duplicate clicks and reruns handled predictably, so that the same input does not silently overwrite a saved report or create confusing copies.

### Users and jobs to be done

- **Office coordinator:** Find the right Job, understand the latest customer and operational activity, and prepare the next communication.
- **Estimator or technical staff:** See quote, attachment, photo and scheduling context before advising the office or customer.
- **Business owner:** Review work needing attention and assess a prospective project or company for Royal Glass collaboration.

The Office Agent continues to open from the global ServiceM8 Add-ons menu. A Job is selected deliberately by address or Job number; the agent must not infer the intended Job from an unrelated ServiceM8 page.

## Implementation Decisions

### Product principles

- **Show the source.** Every material fact, attention flag and business-opportunity rationale links to its underlying record or public page where a stable link is available.
- **Separate fact from suggestion.** ServiceM8 records and public company facts are facts with source and time. AI summaries, urgency assessments and collaboration ideas are labelled suggestions.
- **Show coverage before acting.** Every Job-based output depends on a completed, authorised Job Diary read. Show the sources and items checked, their times and any unavailable, denied or incomplete content. If relevant coverage is incomplete, stop that output and show the gap.
- **Staff decide.** Phase 2 produces reviewable drafts and reports. It does not send email, contact prospects, book staff, modify Jobs or create Quotes or invoices.
- **Read the selected Job first.** Authorise and re-read the parent Job before reading any child records, using the signed account and staff context and the staff-bound OAuth connection.

### Shared requirement: expanded Job history

The agent shall assemble a chronological, deduplicated Job history. Each entry has an event type, occurred time where known, source record ID, concise preview and link or safe preview action. The reader shall paginate every enabled source to completion or explicitly report why it stopped. A source failure must not silently produce an empty history. Staff want the agent to read the full contents of available documents and to interpret Job photos with AI where possible, not merely list file metadata. Unsupported file types, unreadable pages, image-analysis failures and truncated content must be visible in source coverage.

| Requested history item | Phase 2 intent | Current evidence / discovery need |
| --- | --- | --- |
| Job created | Show creation date, creator where available, initial/current Job fields and address. | ServiceM8 Job fields include creator and a `date` that may represent creation or scheduling; do not treat that field alone as an exact creation timestamp. Verify the UI event against the account's read sources. [Job API](https://developer.servicem8.com/reference/listjobs) |
| Diary notes | Read full available note text, author and time. | Existing Phase 1 source; [Notes API](https://developer.servicem8.com/reference/listnotes). |
| Emails sent and received | Show direction, sender/recipient, subject, date, readable body and any linked attachment, where available. | ServiceM8 now documents a [merged inbound/outbound Job email list](https://developer.servicem8.com/reference/listemailmessages) and [single-email read](https://developer.servicem8.com/reference/getemailmessage) with `read_email`. Verify returned content, pagination and parity with the account's Job Diary. |
| SMS sent and received | Show direction, participants, time and message body when present in the Job Diary. | ServiceM8 documents a [merged inbound/outbound Job SMS list](https://developer.servicem8.com/reference/listsmsmessages) with `read_sms`; verify UI parity. |
| Customer replies | Identify the actual reply, its time and whether it remains unanswered. Avoid classifying a new unrelated message as a reply. | Test Job-linked email and [Inbox message](https://developer.servicem8.com/reference/listinboxmessages) relationships, including `converted_to_job_uuid`, against the ServiceM8 UI. |
| Calls | Show recorded call event, direction, time and note or transcript only if exposed. Do not claim a call occurred from an unverified note. | Inbox documents `phone_call` message type; verify whether it covers Job Diary calls and whether content is available. [Inbox API](https://developer.servicem8.com/reference/listinboxmessages) |
| Bookings and allocation | Show scheduled and completed visits, assigned staff and changes where source records allow. | [Job Activity](https://developer.servicem8.com/reference/listjobactivities) and [Job Allocation](https://developer.servicem8.com/reference/listjoballocations) use `read_schedule`; verify history versus current-state coverage. |
| Quotes | Show quote status, sent time, amount and document or line-item detail only when the corresponding read source is confirmed. | Job fields expose quote dates/sent flags; quote files may be attachments. Establish authoritative amount and version source before using it for attention flags. [Job API](https://developer.servicem8.com/reference/listjobs), [Attachments API](https://developer.servicem8.com/reference/listattachments) |
| File attachments | Show name, type, source and date; read and summarise the full contents where technically possible, with source page or section references. Mark unsupported, password-protected or unreadable files explicitly. | [Attachment metadata](https://developer.servicem8.com/reference/listattachments) and [file download](https://developer.servicem8.com/reference/downloadattachmentfile) are documented; permitted types, extraction quality and size limits need proof. |
| Photos | Show the image, source and date, and have AI describe relevant visual content where possible. Never treat an AI visual interpretation as a measured fact. | Attachment metadata includes image dimensions; photo scopes are listed in [OAuth scopes](https://developer.servicem8.com/docs/authentication). Confirm exact read path, account behaviour, image-processing controls and consent before processing. |
| Other visible diary items | Preserve types discovered in the UI audit, such as forms, invoices, status changes or payments; do not silently collapse them into notes. | Identify each item's authoritative read source and what its timestamp means before adding it to the history. |

The source audit must compare a set of synthetic or specifically authorised Jobs against what staff see in the ServiceM8 Job Diary. Record the count and type of items visible in the UI, read through each API, omitted, duplicated and inaccessible. **The current email draft and Job summary, plus all new Phase 2 Job-based outputs, must not be used operationally until the full-history read and UI/API parity gate passes.** For each selected Job, perform the read and coverage check before generating its draft, brief, flag or reply. If a relevant item or required content cannot be retrieved, do not generate that output from partial evidence; show the missing source and a retry or resolution path. This supersedes the earlier bounded-email exception. A coverage label is not a waiver for missing diary items.

### Capability requirements

#### A. Better email drafting

Staff select a Job or an Inbox message and state **who the email is for** and **what it should achieve**. Recipient classes include customers, builders, suppliers and internal staff; the draft's greeting, tone and request must fit the class while using the same evidence rules. The agent may ask one focused clarification if the recipient, requested outcome or necessary fact is unclear. It proposes an editable subject and body. For Job-specific emails, the default subject starts with the Job address and the reason for writing; use Job number when the address is absent or ambiguous. Staff can edit both fields and request a revision.

The body must perform the requested task, such as sharing a progress update and asking a specific question, instead of repeating the user's instruction. The first improved email slice uses the verified full Job Diary history; an Inbox-based draft is added with the later Inbox slice. It must not imply a booking, quote approval, payment, customer reply or completed work that the checked records do not establish. Show material supporting records and the completed source coverage beside the draft. If the selected Job's relevant Diary read is incomplete, withhold the draft and explain the gap. After review, staff copy the subject and body and send the email themselves. The Office Agent neither saves a ServiceM8 draft nor sends the message in Phase 2.

**Acceptance examples:** A customer progress update is written to the customer, not as a request for someone else to write one; an unconfirmed BC approval remains a question; an incomplete email-history source prevents the Job-based draft and identifies the gap; a subject can be edited before copying.

The first staff evaluation set combines three email scenarios: **customer Job updates or replies**, **builder or supplier coordination**, and **Quote follow-ups**. Each scenario includes a stated outcome, selected Job evidence, expected recipient voice, an editable subject, and a staff review of factual accuracy and whether the draft actually achieves the outcome. Internal staff handover remains an eligible draft type but is not part of this first evaluation set.

#### B. One-URL business background and opportunity report

For the first release, staff provide one public **project page or company website** URL. A property-listing or personal-profile URL is outside that first input set. The report's only subject is a **construction-related company**: for example a builder, developer, architect's company, pool construction business, specialist trade or relevant construction supplier/installer with published construction services or projects. Project/property context is included when relevant. If the URL identifies a property, the agent seeks site details useful to Royal Glass, such as an authoritative address, parcel, aerial context and visible project features. It collects relevant public project/product photos as linked references, identifies the associated company, and retrieves sourced public company details such as legal name, directors, incorporation date, registered office and status where available. Director names are company-register facts only; the report does not investigate directors, employees or other people as separate subjects. A company homepage may have no specific property, and the report should show that section as not applicable. If the page points to several properties or companies, staff select the match before the report treats it as fact. If the construction connection or legal-entity match cannot be established, show it as unverified rather than inventing a company profile.

The report proposes Royal Glass collaboration ideas in balustrades, pool fencing or swimming-pool projects. Each idea states the observed fit, linked supporting pages, uncertainty and a practical first approach (for example referral, supply and installation, or ongoing project collaboration). Suggestions are hypotheses for staff to assess, not assertions of interest from the other company. Public images are initially represented by individually identifiable source links, page attribution and a verified or unverified project association. A generic gallery or apparent template image is not evidence that the matched company completed the pictured work. Displaying, downloading, AI-processing or storing a copy requires checking the source's rights; a public image is not automatically licensed for reuse. New Zealand company lookups should prefer the [Companies Register](https://companies-register.companiesoffice.govt.nz/help-centre/getting-support-to-use-the-companies-register/searching-the-companies-register/) or [NZBN API](https://portal.api.business.govt.nz/api/nzbn) after confirming entity identity. The Register supports public lookup; automated NZBN API access requires a subscription and approved keys, so neither source is assumed connected yet.

The primary business question is whether collaborating with this company could benefit Royal Glass **and what could make the relationship difficult**. The report should present two evidence-led sections: **potential fit** (relevant projects, customers, locations, services, recurring demand and a practical collaboration model) and **potential friction** (delivery capacity, communication, quality, health and safety, contractual clarity or company-status concerns where evidence supports them). For each concern show the source, date, exact company match, materiality and a question or document that could resolve it. Do not output a single opaque "headache" or quality score, or treat no public result as proof of no problem.

Beyond NZBN, investigate the official Companies Register status and filings; relevant completed public-sector awards on GETS; company-level WorkSafe published prosecution outcomes and accepted enforceable undertakings; relevant product-certification registers for suppliers; the company's own project portfolio; and independently sourced reviews where permitted. Keep these source types distinct: a tender award shows a contract award, not satisfactory completion; a published project photo shows a claim or site context, not workmanship proof; a public review is not a verified project reference. The strongest follow-up evidence is direct: ask the company for comparable completed-project references, capacity/programme, insurance, health-and-safety approach, scope/variation process and warranty or rework handling, then record Royal Glass staff's assessment. This follows [NZ Government Procurement's due-diligence guidance](https://www.procurement.govt.nz/guides/guide-to-procurement/source-your-suppliers/conducting-due-diligence-checks/) to verify identity, capacity, past performance and financial ability from more than one source. Assess **published project evidence** and **public reviews** separately: show source, date, subject, review count and limits of each. The report must distinguish company self-description, independent evidence and Royal Glass's own experience. It must say **not established** rather than assign a positive or negative verdict from missing or thin data. Payment behaviour remains deferred from the first report at the owner's earlier direction; do not infer how the company pays from public mentions or reviews.

Use web search, including Google Search when staff search manually, to **discover** project pages, published awards, news, reviews and possible company-name variants from the supplied URL and verified company identity. Open each original page and assess its publisher, date, entity match and access terms before citing it. A search snippet is a lead, not evidence; an empty result does not establish that no issue exists. For automated plugin search, choose a supported licensed search service before implementation. [Google's Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) is closed to new customers and scheduled to end for existing customers on 1 January 2027, so it is not the assumed integration. [Google Search's index is incomplete](https://developers.google.com/search/docs/fundamentals/how-search-works); Google Maps reviews are a separate [Places API](https://developers.google.com/maps/documentation/places/web-service/policies) source with display, attribution and storage restrictions.

The first report appears in an **Office Agent report screen** with a download option. Its screen and download include a short method trail: starting URL, selected company match, sources opened, checked time, evidence class (official record, company-published, independent or Royal Glass verified), unavailable checks and how each recommendation follows from evidence. Save completed reports in the app's PostgreSQL database so all authorised Royal Glass Office Agent staff can reopen them. A saved report includes the input URL, selected subject identity, Royal Glass's generated findings and recommendations, source links, checked date, source availability and report version. Do not assume third-party review text or images may be retained in the database or download; check each selected source's terms first. Rerunning a URL **creates a new dated version** and preserves earlier versions so staff can compare changes; it does not overwrite a previous report. Repeated submission of one in-flight request must resolve to the same pending run or ask staff to choose a new run; it must not silently create duplicate versions. Each version becomes **due for a keep-or-delete review after 12 months**, decided by the business owner or a designated admin. Record the decision before an automated deletion policy is introduced. Keep project/product photos as attributed source references in the first design; storing copies requires a separate source-rights and storage decision. The current database stores security state only, so report tables, account/staff access checks, deletion and retention behaviour need a dedicated design and migration before release. A report is a dated snapshot; reopening it must not imply the public sources are still current.

**Property-source finding:** [Homes.co.nz terms](https://homes.co.nz/terms) prohibit automated viewing without consent and limit use to personal purposes or agents listing properties; it is not an approved automated source for this business report unless suitable permission is obtained. Its own [HomesEstimate explanation](https://homes.co.nz/homesestimate) calls the estimate a starting point rather than a formal valuation. For authoritative location matching, [LINZ NZ Addresses](https://data.linz.govt.nz/layer/123113-nz-addresses/) is openly licensed for commercial use with attribution, while [LINZ](https://www.linz.govt.nz/products-services/data/types-linz-data/property-ownership-and-boundary-data) is authoritative for title and cadastral records. Aerial and visible site features are wanted for Royal Glass relevance; their available sources, licences and confidence still need verification.

**Acceptance examples:** A construction project URL produces one company report with found/unavailable sections; a company website produces a company report even when no property is involved; a trading name with multiple company matches prompts selection; a personal-profile URL is outside the first input set; each photo retains its source and uncertain attribution; a template portfolio image is not presented as a completed company project; project examples and public reviews appear as separate evidence; a public contract award is not described as proof of workmanship; a WorkSafe result links to the exact company and outcome; an empty public search is labelled unknown rather than safe; each opportunity links to evidence and does not invent previous work. Staff can see how the report was made and concrete follow-up questions before deciding whether to pursue a partnership or trial project.

#### C. Better Job and client brief

From a deliberately selected Job, show a short current-state summary, a chronological history, the latest customer communication, quote and booking position, open questions, and the sources checked. Staff can open or inspect the supporting records. Where no linked customer reply or quote detail is available, say so rather than inferring a negative outcome.

**Acceptance examples:** A Job with notes, a quote file, an inbound reply, a photo and a booking displays all five as distinct events when their sources pass the audit; a failed attachment read is marked incomplete; conflicting records are shown as conflicting.

#### D. Work needing attention

Provide staff filters for Jobs with a clear reason to review, initially including unanswered customer enquiry, outstanding Quote and overdue invoice only where the source and business rule have been validated. **Explicit rules over checked record fields decide which Jobs appear.** AI may explain the rule and supporting evidence in plain language but does not decide list membership or silently raise priority. Each card shows the Job, evidence date, rule that fired, reason and suggested next action. Staff can dismiss or act outside the agent; Phase 2 does not change ServiceM8 status.

The provisional Quote follow-up rule is **7 calendar days from the verified sent timestamp**, provided no customer response, acceptance, decline or superseding Quote is recorded. The seven-day period is an initial setting that Royal Glass may change; it is not a permanent policy. An inbound customer enquiry or reply with no recorded staff response is flagged after **one business day (8 working hours)**. Count only Monday–Friday, 9am–5pm in New Zealand local time, excluding applicable New Zealand public holidays; verify which regional holidays apply to Royal Glass before release. The message-to-response linking rule still needs definition. An invoice is flagged beginning **the calendar day after its verified due date** if it remains unpaid and has not been voided or superseded. The source of the due date, current balance/payment state and exclusions must be verified before enabling this rule; an invoice date alone is not necessarily its due date. Before building each flag, agree its source field, clock start, exclusion conditions and who should see it. Unknown data must produce **unable to determine**, not **no action required**.

**Acceptance examples:** A recent customer reply is not hidden by an older sent email; a Quote that was accepted or superseded is not flagged from an old sent timestamp; an invoice without a verified due date is not called overdue.

#### E. Inbox triage and reply preparation

Show authorised ServiceM8 Inbox messages with sender, channel, received time, message content, current state and any linked Job. Allow staff to inspect the original, identify messages that appear to need a response, and prepare a review-only reply using the message plus selected Job history. A message without an unambiguous Job link must stay unlinked until staff selects one. Reading must not mark messages read, archive them or create a reply in ServiceM8.

**Acceptance examples:** An Inbox email converted to a Job can be traced to that Job after verification; an unlinked enquiry is not attached by name similarity alone; a phone-call type is represented as a call record only to the extent its source actually supports; reply drafts quote no unsupported facts.

### Delivery order and gates

1. **Owner priority: better email drafting.** Its delivery depends on steps 3 and 4: do not generate a new Phase 2 Job-based email draft from the bounded current reader.
2. **Independent one-URL report:** Deliver the company match and sourced report, then project/property/photo evidence and collaboration recommendations, then saved dated versions and comparison. This path does not wait for the ServiceM8 Diary audit and may release before email while that gate is unresolved.
3. **Source coverage proof:** Catalogue the official read surfaces and approved scopes, test them with synthetic or specifically authorised content, and reconcile the API result to the ServiceM8 UI for all requested history types. A missing relevant UI-visible item blocks every new Phase 2 Job-based output, including email.
4. **Unified Job history:** Build the read-only source adapters, coverage object and event view. Validate parent-Job authorisation, staff/account isolation, pagination, deduplication and source failures. The completed read is a prerequisite before generating any selected-Job output.
5. **Email, Job/client brief, attention view and Inbox triage:** Introduce each output only after its source linkage and completeness are demonstrated. Keep every attention flag explainable.

The owner decided on 20 October 2026 that the agent must read the full Job Diary before any Job-based action or output, including the current email draft and Job summary. This replaces the earlier bounded-email release exception. The one-URL public company report may release independently when its own evidence and staff-review checks pass. Each gate requires evidence from the relevant source and staff review of representative outputs. Local tests alone do not establish live ServiceM8 permissions, account feature availability or complete diary coverage. Expanding OAuth scopes, external data access and AI inputs requires an explicit scope decision and environment-specific validation before release.

## Testing Decisions

Use the staff-visible Office Agent flow as the main acceptance seam, as confirmed by the owner. For the public report, test URL submission, entity selection, evidence display, download, saved-version reopening and comparison. For Job features, test the global ServiceM8 launch, deliberate Job selection, Job brief, email drafting, Inbox triage and attention view with synthetic or specifically authorised records. Under those flows, use focused source-adapter, matching, chronology, coverage and rule tests. Extend the existing assistant-route, Job-context, Job Diary, OAuth and security test patterns rather than adding a second product entry point. The Job Diary UI/API parity audit is a release gate, not a mock-only test. Final staff evaluation must cover customer updates/replies, builder or supplier coordination and Quote follow-ups. Use office coordinator and estimator accounts for Job flows, owner/staff accounts for report access, and designated admin access for retention decisions.

Required negative and recovery cases include wrong-account or wrong-staff access, ambiguous Job/entity matches, source timeout, partial pagination, unreadable document, failed photo analysis, conflicting history, duplicate events, duplicate report requests, expired source links and a re-opened report whose source has since changed. A source failure must produce visible incomplete or indeterminate coverage. Report fixtures must include a real company homepage, a project URL with property context, a company URL with no property, a namesake, and a page with apparently unrelated or template project photos such as the [Top View pilot](research/company-background-pilot-top-view.md). Staff must be able to trace each material output claim to its source.

### Measures of success

- Staff can find and confirm the intended Job without a wrong-Job summary or draft.
- Every supported history type on the agreed test Jobs appears once, with a source and date; missing or failed types are named.
- Staff judge draft emails as accurately carrying out the stated purpose and requiring fewer manual corrections than the Phase 1 template.
- Attention flags are auditable and have an agreed false-positive review process.
- Inbox replies remain linked to the right message and Job, or explicitly unlinked.
- Background reports cite every company fact, image and opportunity rationale; staff can reject a mistaken entity match.

No numeric target is set until a baseline and a small staff evaluation set have been recorded.

## Out of Scope

- Sending email or SMS, saving a ServiceM8 draft, contacting prospects, changing Jobs, booking staff, or creating Quotes and invoices.
- Background reports about an individual person; director names are only company-register facts.
- A partnership approval, financial-strength finding, payment-behaviour assessment, workmanship verdict or opaque “headache” score from desk research.
- Automated Homes.co.nz access without suitable permission; copied external photos or review text without source rights.
- Treating the existing Phase 1 Job reader as complete Diary coverage before the UI/API parity gate passes.

## Further Notes

### Open product decisions

1. Customers, builders, suppliers and internal staff are in scope for drafting. Staff review, copy and send themselves; no ServiceM8 draft save or send action is in Phase 2. Select representative Royal Glass examples for the first three agreed evaluation scenarios and define the success rubric with staff.
2. Which ServiceM8 Job Diary items are visible in the Royal Glass account but absent from the documented read APIs, especially sent/received email, customer replies and calls?
3. Full available attachment contents and AI interpretation of photos are requested. Which file types, size/page limits, processing environment and retention rules are acceptable before enabling each type?
4. The initial Quote, unanswered-reply and overdue-invoice thresholds are set above. Verify the authoritative due-date, payment and response-link sources, applicable regional public holidays, and which role owns each follow-up.
5. Project pages and company websites are the first accepted URL types. Which example URLs should form the acceptance set, including a page with no property and an ambiguous company match?
6. The report will appear in an Office Agent report screen, be downloadable and be saved in PostgreSQL for all authorised Office Agent staff. Reruns create dated versions, each due for keep-or-delete review after 12 months by the business owner or designated admin. Define the renewal period and deletion workflow before implementing retention.
7. Property context should prioritise site details relevant to glass and pools: authoritative address, parcel, aerial view and visible project features. Homes.co.nz is unsuitable as an automated commercial source without permission under its current terms; select permitted LINZ, council or licensed sources for the chosen facts.
8. Confirm which construction company types and example projects best represent Royal Glass's prospective collaborators; exclude profiles of individual people.
9. Project evidence and public reviews are both wanted and must stay separate. Which review sites and project examples should be included in the first acceptance set, and how will staff flag a mistaken attribution? Which supplier-provided references and documents should Royal Glass ask for before a partnership decision?

### Existing boundary and source note

The current implementation reads core Job/customer fields and notes for the initial proof and constructs a review-only email draft and summary from that bounded evidence. The owner has now identified that this coverage is inadequate before using either output operationally; this document records the required gate but does not itself disable the existing route. This PRD proposes a broader source set; it does not claim those reads or AI analyses are implemented, granted or live-tested. The older [Job Diary design](job-diary-summary-design.md) records the Phase 1 boundary and an earlier API review that predates the currently documented [Job email list](https://developer.servicem8.com/reference/listemailmessages). The [Phase 2 source verification note](research/phase-2-source-verification.md) maps the documented read surfaces and public-source constraints; it is desk research, not Royal Glass UI/API parity proof. ServiceM8's current [scope list](https://developer.servicem8.com/docs/authentication) includes `read_email`, `read_inbox`, `read_schedule`, photo and attachment scopes; returned content and UI parity still require a fresh source audit.
