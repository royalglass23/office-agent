# RG Office Assistant — Phase 2 delivery plan

Status: Planning draft for owner and staff review<br>
Date: 19 October 2026<br>
Product contract: [Phase 2 PRD](phase-2-prd.md)<br>
Diary coverage decision: [ADR 0004](adr/0004-hold-phase-2-job-features-for-diary-coverage.md)
Report storage decision: [ADR 0005](adr/0005-save-versioned-opportunity-reports.md)
Source research: [Phase 2 source verification](research/phase-2-source-verification.md)

## Outcome and release shape

Phase 2 has five capabilities: improved email drafting, a one-URL background and opportunity report for a construction-related company, a richer Job/client brief, Jobs needing attention, and Inbox triage. All Job-based outputs, including the current Phase 1 email draft and Job summary, require a completed read of the selected Job's full ServiceM8 Job Diary and a verified UI/API coverage gate before operational use. The history includes all relevant visible items, full readable attachment contents and AI interpretation of photos where possible. The background report uses public sources and may ship independently after its own checks pass.

Plan three work paths. Email remains the owner's first desired outcome, but its technical blockers determine when it can release:

1. **Goal-led email path:** the current draft is based on too little Job history. Complete the Diary audit and unified history first, then ask what the email should achieve and draft an editable address-based subject and body from the verified full Job Diary. Staff review and send it themselves.
2. **Public background report path:** prove URL and entity matching, source permissions and attribution; then build the report, saved versions, review screen and download. Its release does not wait for the ServiceM8 Diary audit.
3. **Full-history ServiceM8 Job path:** audit the Royal Glass Diary against approved API reads; then build unified history before releasing improved email, the Job brief, Inbox triage or attention flags. A relevant UI-visible item without a usable authorised read source holds these new Job-based outputs under ADR 0004.

## First work package: evidence and access

| Proof | Concrete work | Exit evidence |
| --- | --- | --- |
| Diary inventory | With synthetic or specifically authorised Jobs, list every visible Diary type: creation, notes, emails, SMS, replies, calls, bookings, allocations, quotes, files, photos, forms, status and invoice/payment events. Compare each item with the documented API result, IDs, times and content. | A source matrix with UI count, API count, missing items, duplicates, unreadable contents and authorised scope for each type. |
| API connection | Confirm the current app's OAuth scopes, the added read scopes needed for email, Inbox, SMS, schedule, attachments and photos, and the Royal Glass account's actual API responses. | Approved scope list and repeatable test fixtures; no scope expansion or production connection change is implied by this plan. |
| Public-source sample | Choose a construction project page, construction company home page, page with no property, ambiguous company entity and unavailable page. Check company registry, permitted property/site sources, image attribution and public review sources. | Source and licence table plus expected/unknown facts for each URL; no Homes.co.nz automation without suitable permission. |

Do not call a source empty when a request failed, pagination stopped, a file could not be read or an image could not be analysed. Record those states in Source Coverage.

## Public background report path

1. **Resolve one URL.** Accept a public construction project page or construction-related company website. Identify the candidate company and any relevant project; require staff selection for ambiguous company matches. A property is optional. Individual people are not report subjects.
2. **Collect evidence.** Search from the supplied URL and verified company identity to discover projects, awards, coverage and reviews, then open and check the original pages. Retrieve permitted public company facts, project examples, relevant site context, photo links and review references. Check exact-company matches in official register records, relevant GETS awards, company-level WorkSafe outcomes and applicable product certificates. Keep company self-description, project evidence and independent reviews separate. Attach URL, checked time and confidence/uncertainty to each claim. Check each website's access terms and any photo/review display and storage rights before using its content. Select a supported licensed search provider for automated search; do not assume access to Google's closing Custom Search JSON API.
3. **Produce a partnership assessment.** Show potential fit and potential friction as separate evidence-led sections. Suggest balustrade, pool fencing and swimming-pool collaboration only where evidence supports it. Each suggestion names the observed fit and a practical first approach. Each concern names the supporting fact, its limits and the question or document needed to resolve it. Do not infer interest, payment behaviour, safe performance or a quality verdict from absent evidence. Offer a small trial project or reference check as a possible next step for staff to decide.
4. **Review and save.** Show the report in Office Agent, allow download, and save a dated version to PostgreSQL. All authorised Royal Glass Office Agent staff may reopen and compare versions. Save Royal Glass's findings and source links; keep external images as attributed links in the first design rather than copied image assets. Do not assume third-party review text can be retained.
5. **Review old versions.** Mark each version due for keep-or-delete review at 12 months. The business owner or designated admin decides whether to keep or delete it. Define any renewal period and the deletion workflow before implementing automated retention actions.

**Release gate:** Representative reports show correct entity matching, source links, unavailable sections, separated quality evidence, exact-company adverse-record attribution, useful fit/friction findings and follow-up questions, safe image attribution, staff access controls, dated version comparison and a working download. An absent public result is never presented as a clean bill of health. Reopening an old version clearly shows its checked date. The database migration and deletion process are reviewed before applying them to an environment.

## ServiceM8 Job path

1. **Build Extended Job History after the coverage proof.** Use source-specific readers behind one chronology and coverage model. Re-read and authorise the selected parent Job before its children; bind all reads to the launched staff member and connected account. Paginate, deduplicate and preserve source identity. Read full supported document contents and describe photos, while showing unreadable/unsupported items.
2. **Ship a Job/client brief.** Show current state, full available chronology, latest customer exchange, quote and booking position, open questions, source links and Source Coverage. Staff can inspect original records.
3. **Deliver goal-led email drafting.** Only after the Diary gate passes, ask who the email is for and what it should achieve, then produce an editable address-led subject and body from the verified full history. Evaluate customer updates/replies, builder or supplier coordination, and Quote follow-ups. If the selected Job's relevant Diary read is incomplete at draft time, withhold the draft and explain the gap. Staff copy and send themselves; no app send or ServiceM8 draft save.
4. **Add Inbox triage.** Show authorised messages, actual content and links to Jobs only when verified. Keep unlinked messages unlinked until staff choose a Job. Prepare review-only replies without changing Inbox state.
5. **Add Jobs needing attention.** Deterministic rules decide membership; AI only explains the cited evidence. Initial settings are: Quote follow-up after 7 calendar days from verified sent time without a recorded response or resolution; unanswered customer enquiry/reply after 8 working hours, Monday–Friday 9am–5pm NZ time excluding applicable public holidays; unpaid invoice from the calendar day after its verified due date. No flag is asserted when its required source or status is unknown.

**Release gate:** The agreed test Jobs reconcile with the ServiceM8 UI, including event contents and attachments; source failures visibly reduce coverage and block affected Job-based outputs; ambiguous Job matches require selection; drafts do not invent facts; attention flags pass positive and exclusion cases; staff confirm the output is useful. A known relevant Diary read gap blocks every new Phase 2 Job-based output, including the first improved email slice.

## Data and review design

- Keep report records separate from the existing OAuth/security-state tables. Include account identity, creating staff identity, source URL, selected subject identity, version/check times, structured findings, source references, coverage, review-due time and review state. Query by authorised account and staff session, and log material access or deletion actions without logging sensitive report contents.
- Treat the public report as a dated snapshot. A rerun creates a new immutable version; comparison highlights changed findings and changed or missing sources, without claiming that a missing web page disproves an older finding.
- Keep Job documents, email bodies, photos and model inputs within an approved processing and retention design. The current Phase 1 provider approval is bounded to its existing purpose; new source types and uses need a deliberate approval decision.
- For attention flags, record rule version, source record IDs, evaluated time and any indeterminate state so staff can understand why a Job appeared or did not appear.

## Decisions still needed before build or release

1. Representative Royal Glass examples for the three email scenarios and an outcome/accuracy review rubric.
2. A Royal Glass Diary/UI sample and the exact missing-item resolution if any type is not exposed by approved reads.
3. Supported attachment types, limits, photo/document processing location and retention.
4. Authoritative invoice due-date, payment and response-link sources; applicable regional public holidays; staff owner for each attention flag.
5. Sample public URLs, a supported search provider, and permitted review, aerial and property/site sources with attribution rules.
6. Renewal period and deletion workflow for reports kept at the 12-month review.

These are explicit release inputs. They do not prevent the read-only source audit, public-source sample evaluation or report UI/data design from beginning.

The owner-selected [Top View Construction pilot](research/company-background-pilot-top-view.md) tests company matching, project-source quality, photo attribution and partnership reasoning. The earlier [Watchman Pools pilot](research/company-background-pilot-watchman-pools.md) remains a separate representative pool-builder example.

## Linear delivery slices

All slices are subissues of [RG-375](https://linear.app/royalglass/issue/RG-375/rg-office-assistant-phase-2-prd) in the [Office Agent project](https://linear.app/royalglass/project/office-agent-062f321ba811/overview). Their numbers express the owner's priority order; blockers still govern when later work is ready.

| Priority | Slice | Blocked by |
| --- | --- | --- |
| 1 | [RG-376 — Goal-led email drafting after full Job Diary](https://linear.app/royalglass/issue/RG-376/01-goal-led-email-drafting-after-full-job-diary) | RG-381 |
| 2 | [RG-377 — One-URL company match and sourced background report](https://linear.app/royalglass/issue/RG-377/02-one-url-company-match-and-sourced-background-report) | None |
| 3 | [RG-378 — Project property, photo evidence and collaboration recommendations](https://linear.app/royalglass/issue/RG-378/03-project-property-photo-evidence-and-collaboration-recommendations) | RG-377 |
| 4 | [RG-379 — Save, compare and download dated report versions](https://linear.app/royalglass/issue/RG-379/04-save-compare-and-download-dated-report-versions) | RG-378 |
| 5 | [RG-380 — Audit full Job Diary read coverage and access](https://linear.app/royalglass/issue/RG-380/05-audit-full-job-diary-read-coverage-and-access) | None |
| 6 | [RG-381 — Read the full Job Diary with documents and photos](https://linear.app/royalglass/issue/RG-381/06-read-the-full-job-diary-with-documents-and-photos) | RG-380 |
| 7 | [RG-382 — Clear Job and client brief from verified history](https://linear.app/royalglass/issue/RG-382/07-clear-job-and-client-brief-from-verified-history) | RG-381 |
| 8 | [RG-383 — Explainable Jobs needing attention](https://linear.app/royalglass/issue/RG-383/08-explainable-jobs-needing-attention) | RG-381 |
| 9 | [RG-384 — Inbox summaries and review-only reply drafts](https://linear.app/royalglass/issue/RG-384/09-inbox-summaries-and-review-only-reply-drafts) | RG-381 |

The numbering preserves the owner's business priority: email is the first desired Job outcome. Dependency order is RG-380 → RG-381 → RG-376 before that outcome can release. At the time this plan was updated, the Phase 1 route still used Job fields and notes for summaries and drafts; verify its current behaviour after the separate email work before claiming the gate is implemented. R1–R3 remain independent of the ServiceM8 Diary gate and may release while it is unresolved. The earlier bounded-email release exception was superseded by the owner's 20 October 2026 decision.
