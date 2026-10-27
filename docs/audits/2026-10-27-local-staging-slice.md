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
