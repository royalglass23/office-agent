# Office Agent workflow and delivery reference

Originally saved: 23 October 2026. Index and evidence checkpoint updated: 27 October 2026
(Pacific/Auckland).

This folder preserves the enquiry-to-close workflow, the larger charts and the architecture and
business-knowledge discussion. It is a planning reference. The proposed rules, tools and delivery
sequence have not been approved as an implementation contract or company policy.

This is the repository's starting index for continuing this work. The files live in
`D:\Royal Glass Dev\office-agent\docs\workflow-reference`; future sessions should use these saved
documents and the linked audits rather than reconstructing decisions from chat.

## Current checkpoint — 27 October 2026

Owner decision on 27 October: [complete, staff-authorised Job history is now a hard MVP gate](history-policy-decisions.md#approved-mvp-coverage-decision--27-october-2026),
with a later [limited staging pilot clarification](history-policy-decisions.md#staging-pilot-clarification--27-october-2026).
The three bounded staging checks may use available Email, SMS and Note text with a clear coverage
label; broader MVP Job answers and drafts still require verified full history. The
[local staging checkpoint](../audits/2026-10-27-local-staging-slice.md) records the code status.
No full-history reader has been verified or released.

The [local staging slice implementation record](../audits/2026-10-27-local-staging-slice.md)
documents code added after the local unified-context verification. It is not a deployed or
signed-staff acceptance result; the checkpoint table below remains the live evidence boundary.

| Area | What is established | Limit / next step |
| --- | --- | --- |
| History research | All-staff source inventory: 175,492 unique records across 11 collections, through 23 October 2026 at 16:29:22 Auckland time. | A dated source review, not a continuously updated feed or a manual reading of every message. Attachment metadata was inventoried; file contents were not read. |
| Candidate business knowledge | 12 candidate rules, nine response patterns and ten unresolved policy decisions are saved below. | Owner/Roxy/relevant staff must resolve policy conflicts and approve scope, wording and exceptions before these become agent policy. |
| Local communication proof | The latest two-job unified-context report records 39 communication rows matched by Note ID or unique type/time, and six bounded answer/draft prompts passing in final runs. | Account-key REST reads plus a separate MCP connector; Email/SMS stable identity and UI body equality remain unproved. These results do not certify every answer or complete Diary access. |
| Complete Diary and application readiness | Visible Diary inventories were compared; known unmatched calls, file/grouping and other event categories are documented. The current Job-output gate returns `false`. | Staging launch displayed “Invalid Response Received”. Signed-staff Office Agent access, complete-history guarantees and remaining content joins still need proof. No general Job-output release or automatic sending is approved by these documents. |
| Delivery architecture | One conversational assistant with controlled tools, ServiceM8 records, approved knowledge and staff review is the saved design direction. | Proposed architecture and delivery sequence are planning references; actual implementation and release authority must be checked separately. |

### Latest verification reports — read in this order

1. [Unified Job Context live verification](../audits/2026-10-27-unified-live-verification.md):
   latest bounded local answer/draft results, reconciliation details and remaining gaps.
2. [Live REST Job Context verification](../audits/2026-10-27-live-rest-job-context.md):
   six source collections for two Jobs, retrieved communication text and staging-launch failure.
3. [Job Context completeness verification](../audits/2026-10-27-job-context-verification.md):
   broader four-Job inventory, completeness criteria and earlier findings from the same day.

The later unified report advances the earlier reports' local interpretation evidence. It does
not resolve their staging, staff-binding or complete-history gaps. The 21 October readiness
record and 23 October research remain dated references; use the later reports for what was
subsequently tested. This index summarizes saved reports; updating it did not rerun the live tests.

## How to keep this reference current

1. Read this checkpoint, the relevant business document and the latest applicable audit before
   proposing behaviour. Check current code when deciding whether a capability is implemented.
2. Record a business-policy decision in [the policy decision record](history-policy-decisions.md)
   with its rule/topic, exact decision, product/client scope, exceptions, approver, effective date,
   supporting evidence and any superseded policy. Unresolved items stay unresolved.
3. Save new verification as a dated report under `docs/audits/`; record identity/access method,
   tested scope, result and remaining limits. Link it here and say which earlier conclusion changes.
4. Keep research snapshots intact. Add dated amendments for corrections or newer evidence; do not
   silently turn observed historical wording into approved current policy.
5. Update this checkpoint when status changes. Separate proposed, approved, implemented, locally
   tested and deployed. Documentation alone does not enable features or authorise external actions.

If sources conflict, record the conflict and seek the relevant policy decision. For implementation
status, current code plus the applicable verification/release evidence takes precedence over an
older planning chart. Existing repository instructions and explicit user authority still apply.

## Start here

- [Shareable history findings report](servicem8-history-findings.pdf) and
  [plain-text version](servicem8-history-findings.txt): generated 27 October 2026 from the existing
  23 October research snapshot, with candidate rules, response patterns, policy questions and evidence.
- [ServiceM8 history findings](history-findings.md): completed all-staff source review through
  23 October 2026, 16:29:22 Pacific/Auckland; 12 candidate decision rules and policy conflicts.
- [Client response patterns and next actions](history-response-patterns.md): nine draft patterns
  and the information each next-action recommendation should contain.
- [Policy decisions for owner/team review](history-policy-decisions.md).
- [Read coverage and checks](history-coverage.json), [outbound screening counts](history-outbound-patterns.json)
  and [de-identified evidence register](history-evidence-register.md).
- [Method fingerprints](history-method-fingerprints.json): saved research-method checksums.
- [Official source contracts](history-source-contracts.md): the supported reads and their limits.
- [Large interactive workflow and delivery map](office-agent-workflow.html): open in a browser.
  Eight views, zoom controls, delivery tables, source links and print styles. Diagrams are embedded
  and work without an internet connection.
- [Original complete chart](workflow-full.svg): scalable version of the user's supplied chart.
- [Recommended architecture](workflow-architecture.svg).
- [Business logic and questions for Roxy](business-logic-and-roxy.md).
- [ServiceM8 history review requirements](history-review-requirements.md).

## Charts and editable sources

| View | Scalable chart | Mermaid source |
| --- | --- | --- |
| Enquiry and qualification | [SVG](workflow-intake.svg) | [Mermaid](workflow-intake.mmd) |
| Technical review and quotation | [SVG](workflow-quote.svg) | [Mermaid](workflow-quote.mmd) |
| Procurement, installation and completion | [SVG](workflow-delivery.svg) | [Mermaid](workflow-delivery.mmd) |
| Invoicing, payment and close | [SVG](workflow-accounts.svg) | [Mermaid](workflow-accounts.mmd) |
| Management across stages | [SVG](workflow-management.svg) | [Mermaid](workflow-management.mmd) |
| Architecture | [SVG](workflow-architecture.svg) | [Mermaid](recommended-architecture.mmd) |
| Delivery sequence | [SVG](workflow-rollout.svg) | [Mermaid](workflow-rollout.mmd) |
| Original complete workflow | [SVG](workflow-full.svg) | [Mermaid](original-workflow.mmd) |

The split views retain the workflow loops and use continuation nodes between sections. Node AD,
Daily Job Status Reporting, is unconnected in the original source. The proposed management view
connects reporting conceptually across the job workflow; that is an addition to the design.

## Recommended delivery architecture

1. Keep ServiceM8 as the operational source of truth for clients, jobs, messages, quotations,
   bookings, invoices and job evidence.
2. Retain the existing Next.js/TypeScript application as the conversational staff surface,
   launched through a ServiceM8 Web Service Hosted Add-on.
3. Use OpenAI Responses function calling for conversation and tool requests. Application code
   authorises reads, validates arguments, checks evidence and enforces approval for writes.
4. Keep managed PostgreSQL for approved company knowledge, confirmed staff preferences, bounded
   task state and minimal audit metadata. Provider, region and retention remain decisions.
5. Start with a small tool catalogue. The names in the charts are proposed interfaces, not proof
   of matching ServiceM8 endpoints or implemented capabilities.
6. Add bounded scheduled/event processing after the read experience is verified. Small checks
   could use a protected Vercel Cron endpoint and durable PostgreSQL task records. Use leases,
   deduplication, retry/backoff and visible failure handling. Add a worker only when needed.
7. Introduce document, supplier and accounting adapters one at a time when a confirmed need and
   supported integration justify them.

One assistant can support the whole workflow as its approved tools grow. Separate agents or an
additional automation platform are not required for the initial design.

## Proposed evidence and action logic

Read authorised evidence -> identify stage and missing information -> apply approved rules ->
recommend next action or prepare draft -> staff review -> approved action through a validated tool.

Keep workflow stage separate from urgency. Do not create a new native ServiceM8 status for every
chart box. Define mappings to existing records, statuses, checklists and other approved signals.

For a proposed write: preview the exact target/content, obtain staff approval, re-read current
state, apply once and record the result. Changed content or targets require renewed approval.

## Current evidence boundary

Following the original reference save, the owner explicitly authorised RGTools account API reads,
all staff, and the earliest accessible history. The completed review enumerated 175,492 unique
records across 11 source collections and saved de-identified findings in this folder. See the
findings and coverage files above for scope and limitations.

At this save, the local `isJobDiaryCoverageVerified()` function still returns `false`. The README
and RG-381 readiness record say Job-derived summaries, drafts and recommendations remain gated.
This reference does not change that gate. The later historical research is a source-based
review and does not establish a complete staff-bound UI Diary or enable application Job outputs.

Existing implementation references:

- [Architecture handoff](../office-agent-architecture-handoff.md).
- [RG-381 readiness](../research/rg381-diary-readiness.md).
- [RG-380 audit](../audits/RG-380-job-diary-coverage.md).
- [Diary gate](../../lib/servicem8/job-diary-gate.ts).
- [Job Context completeness audit](../audits/2026-10-27-job-context-verification.md).
- [Live REST audit](../audits/2026-10-27-live-rest-job-context.md).
- [Unified live audit](../audits/2026-10-27-unified-live-verification.md).

The proposed delivery order is Diary evidence, approved stage/ownership/priority mapping,
attention-queue verification, read-only staff pilot and manual reporting, scheduled checks,
then individually approved action tools. Existing project security, authorisation and rollout
gates continue to apply.

## External documentation consulted

- [ServiceM8 Add-on types](https://developer.servicem8.com/docs/add-on-types).
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling).
- [ServiceM8 object webhooks](https://developer.servicem8.com/docs/webhooks-overview).
- [ServiceM8 event webhooks](https://developer.servicem8.com/reference/post_event_webhook_subscription).
- [Vercel Cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Save and verification

### Original exports and sharing copies

The original chart/share exports are in
`C:\Users\PC\Documents\Codex\2026-10-23\can-2\outputs`:

| Export | Contents / status |
| --- | --- |
| `can-2-chart-files.zip` | Original chart bundle for sharing. |
| `office-agent-chatgpt-context.txt` | Combined reference text prepared 27 October from the earlier saved documents. |
| `office-agent-reference-files.zip` | Reference sharing snapshot; it does not automatically include later report or audit additions. |
| `servicem8-history-findings.pdf` and `.txt` | Shareable history report; copies are indexed in this repository above. Research cutoff remains 23 October. |

These exports are frozen copies, not the current project checkpoint. Regenerate a sharing package
when newer decisions/audits need to travel with it. The original `work` folder contains scratch
material and restricted source extracts; it is not part of the reference sharing bundle. Keep
credentials and raw customer evidence out of reference documents and sharing packages.

### Reference update log

- **27 October 2026:** consolidated the file index, linked the three current verification reports,
  recorded approval/readiness limits and added repository entry points in `AGENTS.md`, the root
  README and architecture handoff. No new live verification was performed for this index update.

The HTML, SVGs and original Mermaid sources were copied from this chat's generated deliverables.
Additional Mermaid files preserve the split views. The HTML was previously checked in a browser:
all eight views rendered, the original had 30 nodes, section switching and zoom worked, and
external network requests could be blocked without preventing the embedded diagrams from working.

This save adds reference files only. It does not implement tools, enable outputs, alter ServiceM8
records, change credentials, deploy, commit, push or create a branch.
