# Local staging Job slice — implementation checkpoint

Date: 27 October 2026 (Pacific/Auckland). Scope: local `dev` checkout. Approval: user requested
local implementation, commit and push; no deployment or production configuration approval.
This record advances the local code status after
[unified live verification](2026-10-27-unified-live-verification.md), not its live staging verdict.

## Implemented locally

- Existing signed ServiceM8 global menu event can open a staging-specific HTML form behind
  `STAGING_JOB_SLICE_ENABLED=true`, `ASSISTANT_PROOF_ENABLED=true`, verified OpenAI data controls,
  and the exact `https://office-agent-staging.vercel.app` origin.
- `/assistant/staging` verifies and consumes the short-lived account/staff session, rate limits
  requests, checks the authorised Vendor and exact parent Job, and then uses the existing
  staff-impersonated OAuth REST client to read the six paginated collections. No account-key path
  or ServiceM8 mutation is introduced.
- The UI shows the current Job, source coverage and known full-Diary limits. The three actions
  answer a bounded latest recorded communication/reply question, propose one communication-based
  office check, or prepare an editable, unsent draft. The global Job-output gate remains false.
- All active Email/SMS/Note bodies and timestamps must be available, and Email/SMS directions
  must be known. The model request is rejected if evidence exceeds its safe size instead of
  silently clipping. Citations require exact source quotes; the latest-message action also
  requires citations to the latest recorded message and latest inbound reply where present.

## Still unverified

- The ServiceM8 staging Add-on still needs an actual signed staff launch. The earlier
  “Invalid Response Received” failure has not been reproduced or diagnosed by this local work.
- The separate MCP Diary connector has no proven staff binding or terminal-history contract, so
  the staging route uses REST communication sources only and displays the Diary, Calls, attachment
  and status-history gaps. Same-staff UI body parity and broader job coverage need live testing.
- Staff approval is required before using a draft. Production release, writes and sends remain
  outside this slice.

## Local validation

- Full offline `npm test`: 293 passed, two skipped opt-in live tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with nine pre-existing test warnings and zero errors.
- `npm run build`: PASS; Next.js generated the new `/assistant/staging` dynamic route.

No account-key live harness, ServiceM8 staff launch or deployed request was run for this change.

## Presentation amendment — 27 October 2026

The user requested that the staging answer read naturally without the visible Evidence quotes or
Source coverage panels. This approved UI change removes those panels and the technical source
label from the Job card. A short plain-language note still directs staff to the full ServiceM8
Diary before acting because Calls and file contents may add context. The backend continues to
validate source citations and exact quote anchors, requires complete supported communication
reads, and withholds an answer when a required source is unavailable. This amendment changes
presentation only; it does not establish new live staging evidence or relax the production gate.
The local presentation check passed 9 focused tests, typecheck and targeted ESLint. No signed-staff
browser check was run for this amendment.

## Full-history MVP gate and chat presentation — 27 October 2026

The owner confirmed complete, staff-authorised Job history as a hard condition for MVP Job
answers and drafts, including the staging bounded checks. This supersedes the earlier bounded
communication-answer exception. The staging POST now stops before source reading and OpenAI
when the global Diary gate is closed, and also checks the selected Job's `diaryCoverage` before
any answer if that global gate is later opened. Current code reports coverage as unverified, so
no staging Job answer or draft is presently available. Exact Job lookup/current-field display
remains available for testing access.

The staging HTML now uses a one-turn chat layout: the chosen check appears as the staff message,
and the result or block appears as the assistant reply. On submission, a spinner and live status
show “Finding the Job…” or “Checking the full Job history…” until navigation completes. These
are request-progress labels, not claims that a particular server step or OpenAI generation has
started. The inline progress script has an exact CSP hash; no broad script permission was added.
It is a presentation enhancement, not a persistent conversation or streaming server-status feed.
The owner requested this interaction on 27 October 2026. At validation time, no commit, push,
deployment, new source scope or signed-staff browser verification had been performed for this
amendment.
Local validation for this amendment: 66 focused route/gate tests passed; TypeScript typecheck and
targeted ESLint passed. The second production build passed after the installed Next.js version
displayed a security-upgrade reminder and stopped the first run. The spinner has not yet been
verified inside the ServiceM8-hosted frame.

## Bounded staging checks restored — 27 October 2026

The owner clarified that all three bounded staging checks should keep working for pilot testing,
with a visible limited-history label. The staging-only full-Diary gate from the preceding
amendment was removed; `/assistant/staging` again reads the staff-authorised REST Job context and
can call OpenAI for the three fixed questions after the existing complete communication-text,
parent-Job, source-status and evidence checks. The broader `/assistant` Job gate remains closed.
The chat UI states before selection that only available emails, texts and notes are used and that
Calls, file contents and other Diary events are not checked. Submission progress now says it is
reading available messages and notes, not the full history.

This is a local correction to the pilot scope, not proof of complete Job history or a deployed
change. Focused route/gate tests: 65 passed; typecheck and targeted ESLint passed. Signed-staff
browser behaviour and the progress indicator still need staging verification.
