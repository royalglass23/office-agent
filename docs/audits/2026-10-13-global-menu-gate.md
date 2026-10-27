# Historical global-menu gate and Phase 0 evidence

Status: dated evidence record from 13 October 2026. The provisioning and repeat-test steps below
describe that earlier proof; use the current workflow index and code for present readiness. This
file was moved from `docs/phase-0-runbook.md` during the 27 October document cleanup so its
signed-staff acceptance and gate decision remain traceable.

The original runbook text follows as historical evidence.

This runbook closes the live evidence that local tests cannot prove. A deployment is not a Phase 0
GO until every required row below has redacted evidence and no stop condition is triggered.

This is the original three-scope Phase 0 runbook. The later Job Diary Notes scope change is tracked
in `docs/audits/RG-380-job-diary-coverage.md`; do not use this provisioning section to configure that
four-scope release.

## Provisioning

1. Create an isolated Postgres database for this spike and apply `npm run db:migrate`.
2. Configure the eight variables in `.env.example` in one production-like Vercel environment.
3. Create a private/unlisted ServiceM8 Web Service Hosted Add-on with only
   `vendor read_jobs read_customers`.
4. Set the activation, return, callback, and manifest URLs to the stable HTTPS deployment.
5. Validate `/api/servicem8/manifest` against ServiceM8's current v1 manifest validation.
6. Connect as an authorised Royal Glass account administrator.

Never paste secrets, JWTs, access tokens, refresh tokens, Job descriptions, client contact details,
or response bodies containing personal data into this file or logs.

## Evidence record

Record only the date, tester, redacted Job reference, HTTP outcome, whether any fields leaked, and a
link to restricted evidence storage where needed.

| Gate | Expected | Result |
| --- | --- | --- |
| Real callback claim inspection | `alg=HS256`; record whether usable `iat`, `exp`, `jti`, or equivalent exists without recording values | NOT RUN |
| Staff A direct Job read | Allowed; rendered Job matches the open card | NOT RUN |
| Staff A filtered Job list | Test Job present under the same impersonation header | NOT RUN |
| Staff B filtered Job list | Test Job absent and no fields leaked | NOT RUN |
| Staff B direct known-UUID read | Denied and no body/log/cache leak | NOT RUN |
| Staff A Company read after allowed Job | Company matches the Job's `company_uuid` | NOT RUN |
| Staff B direct Company UUID for Job X | Denied and no body/log/cache leak | NOT RUN |
| Cross-account staff UUID | Denied with no fallback | NOT RUN |
| OAuth state replay | Denied | NOT RUN |
| OAuth account mismatch | Denied | NOT RUN |
| Access-token refresh race | One rotation stored atomically; concurrent callers recover | NOT RUN |
| Revoked grant | Reconnect guidance; no API-key fallback | NOT RUN |
| Timeout / 429 / 5xx | Bounded safe retry; no stale or cross-user result | NOT RUN |
| ServiceM8 modal | Renders and remains usable in supported browsers with CSP intact | NOT RUN |

## Latest staging attempt

- Date: 13 October 2026
- Reviewed commit: `8d17c2bd404571a4a0929fdc2fe655ca8cc874c3`
- Staging reachability: `/health` and `/api/servicem8/manifest` returned `200`.
- OAuth result: token exchange completed, then account binding failed closed before persistence when
  ServiceM8 returned HTTP `402` for `GET /api_1.0/vendor.json`.
- Interpretation: ServiceM8's HTTP response-code documentation defines `402` as the account not
  being in good standing. Resolve that account state or use an authorised isolated test tenant in
  good standing; do not bypass Vendor account binding.
- Evidence hygiene: no OAuth code, state, access token, callback JWT, account identifier, response
  body, or client data is recorded in this repository.
- Gate effect: **BLOCKED**. No Staff A/B, cross-account, refresh, replay, or real-modal evidence can
  count toward the Phase 0 gate from this attempt.

## Production diagnostic - Michael synthetic Job

- Date: 13 October 2026
- Authorization boundary: user-authorised read-only production diagnostic using an existing
  synthetic Job; no replay, revocation, load, mutation, or cross-account testing.
- OAuth account binding: **PASS for the production add-on**. The consented read-only connection was
  stored and the connected page rendered successfully.
- Job Action signature: **PASS**. ServiceM8 rendered the real modal and the callback signature and
  event shape verified.
- Job Action freshness: **FAIL/BLOCKED**. The real signed Job Action did not contain usable
  freshness or uniqueness claims. The application stopped before OAuth lookup or any ServiceM8 API
  data request.
- Staff session binding: **NOT RUN on the superseded Job Action route**. Michael and Carla are both
  authorised for account-wide Job access; the relevant proof is that each independently launches
  the global assistant, is bound to the correct staff identity, and receives no state from the
  other's conversation.
- Evidence hygiene: no callback JWT, OAuth value, account/staff/Job UUID, Job content, Company
  content, or personal information is retained here.
- Gate effect: **BLOCKED**. Do not weaken the callback gate to obtain Staff A/B evidence.

Company is the only child/client endpoint enabled in this Phase 0 build. There is no Staff B
known-Job denial requirement because Royal Glass ServiceM8 access is account-wide. Before any
Phase 1 source is enabled, confirm independent Michael and Carla global sessions, correct staff
binding on every request, and fail-closed behavior for invalid, expired, replayed, or cross-account
launches.

The owner initially supplied the following production Job cards as the acceptance-test set. They
remain the repeatable Michael/Carla test set, but they are no longer an application access
allowlist.

Production acceptance-test Job references supplied on 13 October 2026:

- `R260766`
- `R260680`
- `R260209`
- `R260270`
- `R260208`

The owner confirmed on 13 October 2026 that the five-Job access restriction should be removed. The
application may search account-wide Jobs and send bounded core/customer fields and diary-note text
from the staff-selected Job to OpenAI only for the read-only “What happened?” workflow or the
review-only Email Draft proof. This does not authorise new data sources, providers, write actions,
outbound actions, or future features. The specific OpenAI model is deployment configuration and
must be recorded with the test evidence.

## Bounded “What happened?” implementation candidate

The local candidate now implements the ADR-0001/ADR-0002 proof behind
`ASSISTANT_PROOF_ENABLED=false` by default. It uses a fresh global-menu launch to mint a signed,
30-minute staff-bound session; each submitted form token is one-time, and database-backed search
and summary buckets rate-limit repeated work. It searches Jobs under the signed staff identity,
repeats the selected parent Job read before customer/Note access, sends the signed staff UUID on
every ServiceM8 read, and requests a non-stored strict JSON-schema response from the configured
OpenAI model. The model returns only up to three authorised evidence IDs; server code constructs
all displayed summary and timeline text from the corresponding normalised ServiceM8 evidence.

On 13 October 2026, the owner reported that all five supplied Job-number checks worked in
independent Michael and Carla sessions, with correct staff separation and no ServiceM8 writes or
outbound messages. Address search remains a known deferred defect: unrelated legacy Jobs with an
empty Company UUID can abort the account-wide scan. The accepted proof therefore covers exact Job
number selection only and must not be represented as working natural-language address search.

After that acceptance, the owner explicitly authorised a second bounded outcome: staff may enter
an email purpose for the Selected Job and receive a review-only subject/body draft from the same
core Job/customer fields and Job diary notes. The assistant must not send or save the draft, and
must continue to disclose excluded sources. OpenAI selects only authorised evidence IDs for this
outcome; server code constructs the displayed subject and body from the normalised staff purpose
and selected-Job data, so model-authored claims are never displayed.

## Phase 0 gate record — 13 October 2026

```text
Gate ID: PHASE-0-TO-PHASE-1
Current stage: Phase 0
Candidate next stage: Phase 1 global Add-ons-menu assistant
Required evidence: Independent Michael and Carla live sessions; correct staff/session separation;
  bounded What happened and review-only Email Draft results; no ServiceM8 write or outbound action;
  no mandatory-stop condition triggered.
Evidence obtained: The owner confirmed the live Michael and Carla checks passed on 13 October 2026.
  The previously accepted What happened checks and the Email Draft acceptance checks completed
  successfully within the documented exact-Job-number boundary.
Unresolved findings: Natural-language address search remains deferred and must not be represented
  as accepted. No Phase 0 gate blocker remains.
Gate result: PASS
User authorised transition: YES
Authorisation reference: On 13 October 2026 the owner explicitly instructed Codex to reconcile
  the obsolete Phase 0 security records and start the bounded Phase 1 global Add-ons-menu
  conversational assistant.
```

## Authorised Phase 1 boundary — 13 October 2026

Phase 1 starts as a narrow extension of the accepted production proofs, not as a general-purpose
agent. A fresh Global Launch opens a staff-bound conversation. For this first slice, the staff
member supplies exactly one Job number and may ask either what happened or for an email draft. The
existing proof readers continue to use only core Job/customer fields and Job diary notes. Email,
SMS, forms, attachments, schedule activity, additional providers, persistent transcripts, writes,
sending, and autonomous actions remain excluded.

The claimless Job Action route remains data-disabled. Natural-language intent is supported, but
natural-language address search remains deferred because its Phase 0 defect was not accepted. Each
form submission uses a fresh one-time staff-bound session; unsupported requests and requests with
zero or several Job numbers stop before ServiceM8 access.

The historical strict-E2E security audit remains `BLOCKED` for claimless Job Actions, isolated
multi-account/restricted-role claims, and any later expansion. Its former blanket statement that it
blocks all Phase 1 work is superseded only for this single-account, global-menu, read-only boundary.
See `security/servicem8-callback-replay/scope-reconciliation.md`.

For a future deployment or repeat of this production proof:

1. verify and record the configured OpenAI API organisation's retention/data-control settings;
2. configure the exact `OPENAI_MODEL` and record it with the test evidence;
3. deploy without enabling the proof, apply the existing security-state migration, and verify
   health/configuration;
4. upload the v0.2.0 global-menu-only manifest and reconnect only if ServiceM8 requires it;
5. enable the proof explicitly; and
6. run independent Michael and Carla sessions without retaining Job content, prompts, or model
   responses in logs or repository evidence.

## Mandatory stop

Report **NO-GO** and do not start Phase 1 if callback freshness is unavailable or untrustworthy,
account binding differs, an invalid/replayed/cross-account launch sees any Job data, a child
endpoint leaks data, OAuth refresh/revocation does not fail closed, the modal requires weakened
browser security, or any ServiceM8 API-key or administrator-token fallback, write scope, or
ServiceM8 mutation is required.
