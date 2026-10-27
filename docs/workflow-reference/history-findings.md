# ServiceM8 history findings for Office Agent

Review completed: 23 October 2026. Status: **research findings and candidate rules; not an enabled
agent capability or approved replacement for company policy**.

## What was reviewed

The owner authorised the existing RGTools ServiceM8 account API, all staff, and all accessible
history from the earliest retained records through the run cutoff. The Royal Glass account and
its Pacific/Auckland timezone were verified through the API. Requests were GET-only using the
existing RGTools reader. No ServiceM8, database or application configuration was changed.

Event cutoff: **23 October 2026, 16:29:22 Pacific/Auckland**. The main collection finished at
16:36:06; the additional outbound-text pass finished at 16:36:14. These are live collection
intervals, not a transactionally frozen historical database snapshot.

| Accessible collection | Unique records | Successful pages |
| --- | ---: | ---: |
| Staff, including inactive | 91 | 1 |
| Jobs, all statuses including inactive | 8,766 | 9 |
| Notes | 32,618 | 33 |
| Emails, inbound and outbound | 38,428 | 39 |
| SMS, inbound and outbound | 4,041 | 5 |
| Job activities / bookings / recorded time | 21,054 | 22 |
| Attachment metadata | 67,118 | 68 |
| Payment records | 2,644 | 3 |
| Form-response records | 613 | 1 |
| Job allocations | 92 | 1 |
| Knowledge articles, current and inactive | 27 | 1 |
| **Total** | **175,492** | **183** |

Every listed collection reached a successful response without a next-cursor header. The merged
email cursor walk repeated 38 source IDs. Duplicates were removed before analysis.
There were no missing record IDs, HTTP failures or page-limit stops in these completed walks.
See [coverage and checks](history-coverage.json) and [source contracts](history-source-contracts.md).

Job date fields begin on 1 January 2022; email timestamps begin on 22 February 2022 and SMS on
1 January 2022. Eight payment records have 2020/2021 timestamps, the earliest 17 November 2020.
Those earlier dates may reflect imported/manual history. This establishes the earliest accessible
records by source, not a certified account creation date or recovery of purged history. Job `date`
can also mean scheduled date; it should not be called account inception.

The roster contains 13 active and 78 inactive records. All were in scope; there was no Roxy-only
filter. Outbound email records refer to 12 sender UUIDs and outbound SMS to 10. Note editor,
booking assignee, sender and job owner are separate roles; they were not treated as interchangeable.

## How the evidence was analysed

All retrieved job descriptions/relevant text fields, note text, email bodies and SMS messages
were screened for workflow language. A separate pass processed all **26,505 outbound emails**,
with enhanced HTML conversion and heuristic removal of quoted replies and signatures. Screening
was followed by contextual checks of selected examples from 2022–2026 and relevant Knowledge
articles. This was not a manual, line-by-line review of every message.

The [pattern counts](history-outbound-patterns.json) are lexical screening results. They can include
template repetitions, supplier communications, synonyms, quotations that cleaning missed, and false
positives. For example, mentioning attached photos is not necessarily requesting photos, and
mentioning a variation is not evidence that one was approved. Counts are discovery aids, not
validated incident totals, policy confidence scores or customer-only response statistics.

Saved findings use paraphrases, placeholders, aggregate counts and de-identified source aliases.
They do not include customer names, contacts, addresses, full message bodies or credentials.
Evidence aliases use a SHA-256 digest prefix of the source UUID; the dated evidence register
allows a future authorised reader to match them against live records.

## Candidate decision rules supported by contextual examples

All rules below need owner/team confirmation before becoming agent policy. "Supported" means the
specific practice was visible in the checked records; it does not mean universal applicability.

| ID | Candidate rule | What the agent should prepare or recommend | Evidence / exception |
| --- | --- | --- | --- |
| HR-01 | Qualify by product, service model and referral context. | Identify the product and supply-only/supply-and-install request. Ask lead source when relevant; route an uncertain fit to staff. | Active shower enquiry guidance distinguishes key referrals, builder/renovation work and standalone referrals. Do not apply that shower policy to all products. K-77b2b84a247719d6. |
| HR-02 | Collect the missing information needed for the next decision in one clear request. | Ask for the applicable plan/photo, approximate dimensions, full site address, finish/design and timeframe; omit questions already answered. | E-a128b774a3d1733f, 22 October 2026: kitchen plan/photo requested before a ballpark figure and later templating. |
| HR-03 | Keep preliminary estimates distinct from a final agreed scope/price. | Label estimates, list unresolved measurements/specifications, and identify the next review step. | E-34d180580c235198, 20 October 2026: estimate first, final price dependent on dimensions/design/hardware. Historical amounts and technical specifications are not defaults. |
| HR-04 | Make measurement readiness product-specific. | For the shower example, confirm tiling/grouting and obtain readiness photos before final measuring. Use the relevant product checklist for other work. | E-34d180580c235198 and E-b89b1c3b1a8acb56, 20 October 2026; active shower knowledge K-286404d53e806bd4. This is not a rule to wait for every finish on every product. |
| HR-05 | Clarify who owns measurement, collection/delivery and installation responsibilities. | Explain the permitted service options for that product, with responsibilities and exclusions. | E-ae666496adc7a807, 23 October 2026: splashback supply-only versus measure/supply/install. E-31ffca9aa34eddfe, 5 October 2026: DGU supply-only with measurement/delivery options. Avoid a universal supply-only restriction. |
| HR-06 | Resolve a design/drawing conflict before recommending release to manufacture. | Name the conflicting detail, request confirmation and route technical/consent questions to the appropriate reviewer. | E-218f490b82560b03, 22 October 2026: gate position differed between updated drawing and consented plans. E-b3d8132f573a6f47, 8 October 2026: alternate system required review/repricing. |
| HR-07 | Check the applicable acceptance and deposit terms before advancing preparation. | Prepare the invoice/terms explanation and ask accounts to verify payment when needed. Check existing payment evidence before another reminder. | E-b89b1c3b1a8acb56, 20 October 2026: deposit and readiness conditions stated. E-1f3c23876b6f8172, 21 December 2022: half-deposit wording. E-6d37e22f85e62177, 20 October 2026: correction for an earlier deposit already paid. Not every job has identical terms. |
| HR-08 | Treat installation dates and lead times as conditional until confirmed. | State the proposed window, outstanding dependencies and when staff will confirm. Check materials, readiness and availability afresh. | E-74e60929699c1cd4, 14 October 2026: materials preparation before timing confirmation. E-2c2541b4df42fa12, 17 December 2025: timing depended on timber completion. Do not reuse an old lead time as current capacity. |
| HR-09 | Follow up using the correct quotation/revision and the client's stated timeframe. | Reference the actual quote/date, ask for feedback or intended timing and offer clarification. Respect a documented hold. | E-747e77bfd53f89c3, 21 October 2026; E-ab1d5d30f003185f, 2 December 2023; E-d6914c3fc1641b00, 16 October 2026. No fixed company-wide cadence was established. |
| HR-10 | Treat changed scope as a revision/variation requiring review. | Identify what changed, prepare the revised scope/price impact and request approval before committing to changed work. | E-74e60929699c1cd4, 14 October 2026: approval followed by materials preparation. E-20bdb2cb43a5a82a, 14 October 2026: updated quotation and highlighted drawings. Technical/pricing authority stays with staff. |
| HR-11 | Investigate an issue before promising a repair outcome, compatibility or warranty remedy. | Acknowledge, request the relevant photos/details, summarise options and refer the technical assessment. | E-b7a4141b18c3940a, 21 October 2026: replacement options depended on sourcing compatible hardware. Do not infer fault, coverage or universal technical rules from prior correspondence. |
| HR-12 | Prepare a clear handoff with one next action, a responsible person and the evidence still needed. | Show the task, reason, proposed owner, due-date basis, blocker and completion evidence. Keep closure/document/payment checks visible. | Repeated follow-up/readiness/approval examples and existing product/client packs support the structure. Assigning authority, exact deadlines and closure criteria still requires confirmation. |

Evidence dates and aliases are in [the evidence register](history-evidence-register.md). These are
generic candidate rules, not live recommendations that a particular customer currently needs a reply.

## Material conflicts and things the agent must not guess

1. **Minimum charges conflict in active Knowledge articles.** "Minimum charge for our service"
   lists a $335 + GST supply-only mirror minimum; "Supply only job-- Minimum charge of 390+gst."
   lists $390 + GST. Both were active and not marked draft in the API. Confirm the authoritative
   product/service price list and effective date before using either figure.
2. **Site-visit policy depends on context.** An October 2026 shower email says no free on-site
   measure/quotation visit; another October email offers a free site assessment. The active service
   menu also distinguishes commercial clients. Separate remote estimate, assessment, final
   measurement and paid design service; obtain the current eligibility rules.
3. **Service models differ.** Recent splashback correspondence permits supply-only; recent shower
   correspondence rejects shower supply-only. The active service menu's splashback entry also
   differs from the recent email. Resolve by product, client type and approved exception.
4. **Deposit wording is common but not universal.** Enhanced text screening found 134 "50%"
   deposit-context occurrences, alongside other percentages. These are phrase occurrences, not
   independently verified agreed terms. Use the accepted quote/invoice and authorised current rule.
   The payment records' deposit flag was never true in this collection; that does not prove no
   deposits were paid.
5. **There is no proven universal follow-up interval.** Old patterns reflect workload, customer
   timing and project complexity. No SLA should be derived from the median gap between messages.
6. **An internal handover/process proposal is inactive.** K-735c266d0104721f proposes signed stage
   checks, variation approval and acceptance before invoicing. Its inactive state prevents treating
   it as current company policy merely because it reads like an instruction.
7. **Technical/warranty content is not automatically validated guidance.** Existing product articles
   and emails can identify what needs review, but do not replace current technical evidence or an
   authorised person's judgement. Historical glass specifications, regulatory statements and
   warranty wording were not certified by this review.

## Data implications for next-action recommendations

- Only 145 of 8,766 job records populate the inspected `customfield_in_charge`. That does not mean
  the other jobs are ownerless: ownership may be held in allocations, queues, bookings or notes.
  Do not use this one field as the sole owner source.
- 1,568 job records have no job address field and 4,888 have no job description field. Treat these
  as field observations across all historical/inactive jobs, not as that many current intake failures.
  Relevant information can be in other records or documents.
- Activities include 313 starts later than the cutoff, some extending into 2028. Scheduled starts
  are commitments/placeholders to verify, not evidence that installation occurred.
- The scan reads 67,118 attachment metadata records; it did not download/read every file. Exact
  specifications and exclusions inside PDFs/plans/photos remain outside this content review.
- Form responses were enumerated, not interpreted against each form's question definitions. Their
  timestamp is UTC; collection date strings must not be mixed with account-local event times for
  a future exact-time rule.
- 97 email records had no usable body in the first pass; 33 required HTML fallback. The enhanced
  outbound pass produced 70 empty bodies after cleaning. Missing content is not an empty conversation.

## What the agent can learn next

The strongest first capability is to prepare **a short situation summary, the missing facts, one
recommended next action and a matching draft** for staff review. It should choose a product-specific
checklist, keep source timestamps, and explain when it cannot determine a safe next step.

Confirm [the policy decisions](history-policy-decisions.md), then turn the accepted entries above
into versioned company rules and the [response patterns](history-response-patterns.md) into approved
draft templates. This research does not enable Job outputs, train a model automatically, change
the full-Diary gate or approve autonomous messages/writes.
