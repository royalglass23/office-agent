# Security sign-off - servicem8-callback-replay

> Historical strict-E2E record. Its blanket Phase 1 blocker is superseded only for the bounded
> single-account global-menu slice in `scope-reconciliation.md`. It remains binding for Job
> Actions, multi-account/restricted-role claims, new sources, persistence, writes, sending, and
> autonomous actions.

- Stack: node (`marker:package.json`)
- Mode: retrofit
- Date: 2026-10-13
- Reviewed-commit: `8d17c2bd404571a4a0929fdc2fe655ca8cc874c3`
- Verdict: **BLOCKED**

## Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| Security requirements and data classification | PASS | `security-requirements.md`, `data-classification.md` |
| Threat model and architecture review | PASS | `threat-model.md`, `security-report.md` |
| E2E coverage matrix | PASS | `e2e-matrix.md` |
| Strict E2E execution | BLOCKED | Staging host is reachable, but the live-tenant OAuth attempt stopped at Vendor account binding with ServiceM8 HTTP 402; isolated ServiceM8 environment, command, fixtures, hashes, browser project, and report remain absent |
| Authentication and freshness | PASS locally / BLOCKED E2E | Menu `iat + jti`, age/skew, signature, and missing-claim tests pass |
| Authorization and tenant isolation | BLOCKED | RPL-006 restricted-staff and cross-account journeys unexecuted |
| Replay/idempotency | PASS locally / BLOCKED E2E | Atomic replay and stale/future tests pass; real staging replay unavailable |
| Input/output validation | PASS | `security-tests.md`, `pentest.md` |
| Secrets and sensitive data | PASS for repository/local evidence | `data-classification.md`, `pentest.md` |
| Database security | PARTIAL | Parameterized queries/encryption pass; role least privilege unverified |
| Rate limiting/availability | PARTIAL | Input/API timeouts exist; application callback throttling absent |
| Dependency audit and production build | PASS | `security-tests.md` |

## Release decision

At the time of this sign-off, the bounded Phase 0 named-greeting proof was the only accepted scope. The later bounded global-menu Phase 1 scope is recorded in `scope-reconciliation.md`; this sign-off still does not approve capabilities beyond it.

Job Actions, multi-account/restricted-role claims, and data access beyond the reconciled bounded global-menu slice remain blocked until an authorised isolated environment executes the applicable E2E matrix with zero failures/skips/flakes and validates the exact reviewed commit.

A user-authorised production diagnostic on 13 October confirmed the production OAuth connection
can bind successfully, but a real signed Job Action on a synthetic Job has no usable freshness or
uniqueness claims. The callback therefore stopped before OAuth lookup or ServiceM8 API access. This
is safe fail-closed behavior and live evidence for the blocker, not a strict E2E PASS.
