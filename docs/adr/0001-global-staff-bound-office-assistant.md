---
status: accepted
---

# Use a global staff-bound Office Assistant

The Office Assistant will open globally from the ServiceM8 Add-ons menu rather than from a Job
Action. A successfully verified, fresh, one-time Global Launch establishes the staff-bound
conversation; the staff member then finds and confirms a Job inside that conversation. All
ServiceM8 reads remain impersonated as that staff member so ServiceM8 continues to enforce their
current permissions. The claimless Job Action callback remains data-disabled and no additional
Office Assistant sign-in is required for the initial global flow.

## Considered Options

- A Job Action would supply the Job automatically, but the observed callback has no trustworthy
  freshness or uniqueness claims and therefore cannot authorise Job data access.
- An additional Google or Microsoft sign-in could protect a Job Action, but it adds user friction
  that is unnecessary when the verified Global Launch already establishes fresh staff context.
- A generic knowledge-only chatbot would avoid ServiceM8 data risk, but it would not satisfy the
  initial tasks of summarising a Job, explaining its history, suggesting a next action, and drafting
  an email from Job context.

## Consequences

- The user must identify a Job after opening the assistant globally.
- Staff may describe the Job naturally by address or provide its Job number. Address is the normal
  reference; Job number is also supported.
- A single authorised match may become the Selected Job directly. Multiple matches must be shown
  for explicit staff selection; the assistant must not guess from similar addresses or customers.
- The first proof is intentionally smaller than the planned first release: find and explicitly
  select a Job, then produce a read-only account of what happened from the Initial Job Context.
- The provisional Proof Answer is a short plain-English summary followed by a dated evidence
  timeline. This is a testable presentation choice, not a permanent answer format.
- Email Drafts and Suggested Next Actions are deferred until that proof works reliably. The Office
  Assistant does not send email or mutate ServiceM8.
- The first release's Initial Job Context is deliberately limited to core Selected Job and customer
  fields plus Job diary notes.
- Responses must disclose that email, SMS, forms, attachments, and schedule activity are excluded.
  They must not describe the Initial Job Context as a complete Job history, because an omitted
  source could materially change a staff member's decision or action.
- Extended Job History sources may be added later, one source at a time, only with their required
  ServiceM8 scope and privacy, access-control, pagination, and source-citation evidence.
- Every Job and child-resource read must use the Global Launch staff identity and ServiceM8's
  impersonation control.
- Royal Glass uses account-wide Job access in ServiceM8, so Michael and Carla are expected to be
  able to read the same test Job. Their proof sessions must launch independently, bind to the
  correct staff identity, and must not share conversation state.
- Negative access tests apply to invalid, expired, replayed, or cross-account launches—not to an
  invented Michael-versus-Carla per-Job restriction.
- Staff may search any Job readable in the connected Royal Glass ServiceM8 account. Only the Job
  they deliberately select may provide customer fields and diary-note text to OpenAI for the
  read-only proof. The model is deployment configuration. Adding another source, provider,
  purpose, write action, or outbound action requires a new scope decision.
