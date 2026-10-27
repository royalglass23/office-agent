# Scope reconciliation — 13 October 2026

## Current gate

The authoritative product gate is the committed Phase 0 `PASS` in
`docs/audits/2026-10-13-global-menu-gate.md`, followed by the owner's explicit 13 October 2026 instruction to start
Phase 1. The authorised slice is a single-account, global Add-ons-menu, staff-bound conversation
using only the already accepted “What happened?” and review-only Email Draft proofs.

That acceptance is supported by the production evidence recorded in the runbook: independent
Michael and Carla Global Launches, correct staff/session separation, exact-Job-number results from
core Job/customer fields and Job diary notes, and no ServiceM8 write or outbound action. Royal
Glass confirmed that its staff have account-wide Job access; this slice does not claim that a
restricted-role fixture was tested.

## Historical audit status

The other files in this directory record a strict secure-SDLC audit of an older callback candidate
and remain truthful historical evidence. Their `BLOCKED` verdict is not converted to `PASS`. Their
blanket statements that all Phase 1 data access is blocked are superseded only for the bounded
global-menu slice above.

The historical findings remain open and binding for:

- the claimless ServiceM8 Job Action route;
- any multi-account or restricted-role support claim;
- any new ServiceM8 or external data source;
- persistent conversation or Job content;
- any ServiceM8 write, draft save, message send, or autonomous action; and
- any broader staff or customer rollout represented as strict security E2E certified.

## Controls retained by the bounded slice

- Global Launch requires signed `iat + jti`, bounded age/skew, and atomic one-time consumption.
- OAuth connection persistence and signed event ingress require the configured single allowed
  Vendor account UUID; foreign accounts fail before persistence, replay storage, API access, or
  assistant-session issuance.
- A short-lived signed session carries the verified account and staff identity; every submitted
  token is one-time.
- OAuth Vendor account binding and `x-impersonate-uuid` remain mandatory for every ServiceM8 read.
- Job Actions remain data-disabled.
- A message must select exactly one Job number and a supported read-only/review-only intent before
  ServiceM8 is accessed.
- Unsupported or ambiguous requests fail closed to guidance.
- A general per-account/staff request bucket runs before one-time session consumption and rotation;
  narrower search, summary, and draft buckets protect expensive downstream work.
- No transcript, raw callback, OAuth token, Job content, prompt, or model output is retained as
  conversation history or test evidence.

This reconciliation is a scope decision, not a strict secure-SDLC `PASS` for the historical audit.
