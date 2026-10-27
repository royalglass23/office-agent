# Decisions needed before these findings become agent rules

Prepared from the authorised all-staff history review, 23 October 2026. The user authorised research
and saving de-identified findings. This list records unresolved policy choices, not a request to
re-authorise the completed review.

| Priority | Decision for owner / Roxy / relevant staff | Why the history cannot decide it alone |
| --- | --- | --- |
| 1 | Which versioned price/minimum-charge table is authoritative by product and service model? | Two active, non-draft Knowledge articles list $335 + GST and $390 + GST for supply-only mirror minimums. |
| 2 | Which products permit supply-only, installation-only or measurement-only, and for which clients? | Recent splashback/DGU examples and shower restrictions differ; the service menu and recent splashback correspondence also differ. |
| 3 | What is free assessment versus paid final measure/design, and when is a fee credited? | The service menu distinguishes commercial clients; live correspondence includes both free-assessment and paid-visit approaches. |
| 4 | Are the shower VIP/referral/builders/standalone rules still current? Who is on the approved exception/referral list? | The active enquiry article describes those branches; active state does not prove every historic/current exception. |
| 5 | What acceptance evidence and deposit terms apply to each job type/client/account arrangement? | 50% wording repeats, but other percentages and payment corrections occur. Historical wording and deposit flags do not establish reconciled balances. |
| 6 | What is the follow-up cadence, attempt limit, call threshold and hold policy? | Observed timing is inconsistent and project-dependent. No universal interval or SLA was verified. |
| 7 | What proves a booking is confirmed, and who can release work to manufacture? | Historical messages distinguish tentative slots, readiness, materials and design approval; authority limits are unstated. |
| 8 | How should job owner and escalation recipient be selected? | Creator, note editor, sender, booking assignee and owner differ; one inspected in-charge field is populated on only 145 historical records. |
| 9 | Which forms, completion documents, sign-offs and accounts checks are mandatory before closure? | Attachments/forms were inventoried; not every file or form definition was interpreted. An internal handover proposal is inactive. |
| 10 | Who approves technical/warranty answers and keeps product knowledge current? | Old correspondence and stored articles can contain superseded or context-specific statements. |

## Proposed order for turning findings into usable knowledge

1. Resolve the active price/service-policy conflicts.
2. Approve the product-specific intake/readiness checklists and exception rules.
3. Approve response tone and the [draft patterns](history-response-patterns.md).
4. Approve ownership, follow-up and escalation rules with concrete examples.
5. Store the accepted rules with approver, version, effective date, scope and supporting sources.
6. Validate the agent's evidence access and draft/recommendation behaviour under the existing
   project gates before enabling it for staff.

The model has not been trained or configured with these findings. This review does not clear the
Office Agent's complete-Diary gate, create ServiceM8 writes or approve customer sends.

## Approved MVP coverage decision — 27 October 2026

Decision: The owner confirmed that a Job answer or draft in the MVP requires a complete,
staff-authorised read of the selected Job's available ServiceM8 history, including Email, SMS,
Notes, Calls, file contents, status changes and other Diary-only events. If relevant history is
missing, unreadable or not provably complete, the Office Agent must withhold the Job output and
direct staff to the ServiceM8 Diary. This applies to staging bounded checks as well as broader
Job answers. It supersedes the earlier temporary staging exception for communication-only
answers. Searching for an exact Job and viewing its current basic fields may remain available.

Source and approval: owner instruction in the Office Agent Codex conversation on 27 October
2026, following the explanation of the [unified live verification gaps](../audits/2026-10-27-unified-live-verification.md).
Scope: Office Agent MVP Job answers and drafts. The decision does not approve account-key access,
new OAuth scopes, ServiceM8 writes, automatic sending, production release or a claim that complete
Diary retrieval is currently possible. Implementation status is tracked in the
[local staging checkpoint](../audits/2026-10-27-local-staging-slice.md).

## Staging pilot clarification — 27 October 2026

The owner clarified that the three bounded staging checks should remain usable during testing
with a visible **limited history** label. They use available Email, SMS and Note text for the
selected Job; they do not establish complete Call, file, status-change or Diary-only coverage.
The checks remain read-only or copy-only, require their existing source and citation validations,
and direct staff to the full ServiceM8 Diary before acting. This supersedes the staging portion
of the preceding hard-gate decision. The complete, staff-authorised history gate still applies
to the final MVP and the broader Job answer/draft paths.

Source and approval: owner reply in the Office Agent Codex conversation on 27 October 2026,
selecting “Yes, keep bounded checks working” with a limited-history label. Scope: the three
staging actions only; no new ServiceM8 source, sending, deployment or production release approved.
