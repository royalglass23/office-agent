# Office Agent capability ideas

Original owner-supplied Roxy capability list and candidate expansion ideas, moved from
`docs/roxy-office-agent-ideas.md` on 27 October 2026. These are source ideas, not approved
scope; use the published Phase 2 PRD for the five selected capabilities.

## Phase 2 candidate list

Phase 2 can make the Office Agent useful across several office tasks. The owner has expressed particular interest in email drafting and the one-URL background check; these lead the candidate list, but they are not the whole phase. The order below is a proposal for discussion, not an approved implementation scope.

The five starting capabilities and expanded Job history are detailed in the [Phase 2 PRD](../phase-2-prd.md).

### Start with useful reviewable work

1. **Better email drafting.** Ask who the email is for and what it should achieve. Write a body that carries out that goal, with a suggested editable subject led by the selected Job address and reason for writing. Show supporting Job facts and clarify an ambiguous goal or recipient.
2. **One-URL background and opportunity report.** Start from a construction project or company URL and combine public construction-company background, relevant property/site information, photos and evidence-based Royal Glass collaboration ideas in one report. Confirm ambiguous company matches and show unavailable sections.
3. **Better Job and client brief.** Provide a concise Job overview, key dated events, open questions and source links so staff can verify it before acting. Extend the current bounded Job summary only when additional sources have been separately assessed.
4. **Work needing attention.** Let staff filter Jobs and review explainable flags such as unanswered enquiries, outstanding Quotes or overdue invoices. A flag should show the record and date that caused it, rather than guess urgency.
5. **Inbox triage and reply preparation.** Summarise ServiceM8 Inbox enquiries, identify ones needing a response and prepare a reply for staff review. This requires a separately assessed Inbox source and permissions.

### Expand after the core review flow works

6. **SMS drafts and follow-ups.** Prepare concise Job-specific SMS, Quote follow-ups and payment reminders for staff approval using checked message, Quote and invoice facts.
7. **Knowledge answers.** Answer staff questions from approved Royal Glass Knowledge articles and ServiceM8 help content, with links to the relevant article.
8. **Availability and booking proposals.** Show staff, Queues and Allocation Windows, then propose a booking or allocation for review. Check live availability before any eventual write.
9. **Job administration proposals.** Prepare status changes, Queue moves and diary notes for staff review, with the intended change shown clearly.
10. **Quote and invoice preparation.** Draft descriptions and line items from checked Job facts and approved pricing/tax inputs; staff review all amounts before creation.
11. **Forms, categories and reference lookups.** Find relevant Forms and completed Job Forms, plus categories, badges and tax rates where the connected account exposes them.
12. **Reports and recurring reviews.** Build explainable business reports and optionally schedule read-only reviews such as Action Required, with recipients and notification settings chosen by staff.

The first release of each candidate should produce something staff can inspect. Sending, saving, ServiceM8 writes and scheduled notifications need their own scope and approval decisions. Each added source needs permission and completeness checks; a summary should say what was not checked.

## Roxy's list

Source: screenshot supplied by the owner, `Image_20261006133658_908_2.png`. These are ideas to assess, not an implementation approval or a claim that every source is available.

- Find and summarise Jobs and clients, including Job details and Diary history.
- View Jobs by filter and identify work needing attention, including outstanding Quotes and overdue invoices.
- Read and summarise ServiceM8 Inbox messages to help identify enquiries needing attention.
- Prepare emails and SMS to clients for approval, including replies, Quote follow-ups and payment reminders for individual Jobs.
- Check staff availability and view staff, Queues and Allocation Windows.
- Prepare bookings and Job Allocations for review.
- Prepare Job status changes, Queue moves and Job Diary notes for review.
- Draft Quotes and Invoices with descriptions and line items for review.
- Look up available Forms and check for completed Forms recorded against Jobs.
- Look up categories, badges and tax rates.
- Answer questions using the business's Knowledge articles and ServiceM8 help content.
- Create reports and explore business data where reporting features and permissions are available.
- Run recurring tasks on a configured schedule, such as reviewing Action Required each weekday at 9 am, with notifications according to task settings.

## Proposed addition from the owner — one-URL opportunity report

Combine the P2 Background Check, Photo Website, Job Homes Information and Company Office ideas into one workflow. Staff provide one construction project or company URL. The agent produces one reviewable report about a construction-related company, with property context where relevant:

- **Property/home information:** Find suitable sources for the facts Royal Glass needs where the URL can be matched to the right property. Use an authoritative address/parcel source where suitable. Homes.co.nz was considered but its current terms do not permit automated commercial use without consent. Show an unresolved match rather than guessing.
- **Project and product photos:** Find relevant publicly accessible images and show each image with its source page and original image link. Record attribution and usage limits; a public image is not automatically licensed for reuse.
- **Company background:** If a company is associated with the page, identify the legal entity and present sourced public details such as directors, incorporation date, registered office and status. Require staff confirmation if several entities could match.
- **Company-only boundary:** Directors may appear as sourced company-register facts, but the agent does not investigate directors, staff or any other individual as the report subject.
- **Company working relationship:** Assess published services, project examples and public reviews as separate evidence of work quality. Keep company claims, independent evidence and Royal Glass experience distinct; mark unsupported conclusions as not established. Payment behaviour is deferred.
- **Collaboration opportunities:** Use the company's published services and projects to suggest possible Royal Glass work in balustrades, pool fencing and swimming pool projects. For each suggestion, explain the observed fit, cite the supporting pages and propose a practical first approach. Label these as hypotheses for staff review, not established opportunities or promises from the company.

The single URL is a starting point, not a guarantee that every section can be filled. The report should mark each item as verified, inferred or unavailable, and should not contact the company, copy restricted material or write to ServiceM8 without a separate scope decision.
