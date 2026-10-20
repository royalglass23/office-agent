---
status: accepted
---

# Hold Job-based outputs when Diary coverage has a known gap

Phase 2 intends to use the full ServiceM8 Job Diary as evidence for Job briefs, email drafts, Inbox context and work-attention flags. If a relevant item is visible to staff in the Job Diary but unavailable to the Office Agent through its authorised read sources, Job-based outputs are held until that gap is resolved. Missing communication or operational events could change their summary or recommended action. This decision does not block the public one-URL background report.

**Owner amendment, 19 October 2026:** The first email improvement may ship before the Diary gate. It asks staff what the email should achieve and drafts from only the Job data already available to Office Agent. The draft must show that limited evidence boundary, avoid claims about unchecked history and remain editable for staff review and sending. Using expanded Diary evidence in later drafts remains behind the coverage gate.

**Superseding owner decision, 20 October 2026:** The owner found that the current email output needs the whole Job Diary before the agent can act. The bounded-email exception above is withdrawn. The existing email draft and Job summary must not be treated as ready for operational use from the current Job-and-notes reader. Before generating any Job-based draft, summary, recommendation, attention flag or Job-linked reply, the agent must complete the authorised full-Diary read for that selected Job and establish that relevant UI-visible items and required contents were retrieved. A failed, denied, truncated or missing relevant read blocks the affected output and produces a clear explanation and retry or resolution path. The global UI/API parity audit is required before enabling these outputs; the public company report remains independent.
