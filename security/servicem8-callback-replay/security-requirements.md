# Security requirements - ServiceM8 callback replay

> Historical strict-E2E requirements for the reviewed callback candidate. See
> `scope-reconciliation.md` for the later bounded global-menu Phase 1 decision. These requirements
> still govern every scope outside that decision.

- Mode: retrofit
- Reviewed commit: `9fe172b7673d59647007f920ef828004ef8ee879`
- Target environment: local isolated checks plus a user-observed production happy path; no production JWT replay was authorised or performed.
- Historical authorisation boundary: at the time of this audit, residual-risk acceptance covered only the named greeting. The later bounded global-menu slice is governed by `scope-reconciliation.md`; this record still does not authorise broader Job access, writes, sending, persistence, new sources, or autonomous actions.

## Actors and assets

- ServiceM8 is the expected callback issuer and shares the Add-on App Secret with this service.
- Royal Glass staff launch the menu item and must only receive data ServiceM8 authorises for their signed staff UUID.
- Internet callers and anyone possessing a captured callback JWT are untrusted.
- Protected assets are OAuth tokens, callback JWTs, account/staff/Job identifiers, Staff identity, and Job/Company data.

## Acceptance criteria

1. Invalid signatures, algorithms, event shapes, accounts, or permissions fail closed before data access.
2. A global-menu callback must contain a signed `iat` and `jti`, be no more than five minutes old, and be no more than 30 seconds in the future before any ServiceM8 API request occurs.
3. A global-menu replay identity is account-scoped and atomically consumed before OAuth lookup or ServiceM8 API access.
4. Missing or unusable freshness claims return a safe response without OAuth lookup or ServiceM8 data access.
5. The OAuth Vendor account and signed Staff identity are checked before rendering the named greeting.
6. No raw callback JWT, OAuth token, App Secret, Job content, client data, or chat input is logged or retained as test evidence.
7. Job Actions, multi-account/restricted-role support, and capabilities beyond the reconciled bounded global-menu slice remain disabled until their applicable E2E tests pass.

## Approved residual risk

A valid menu JWT captured before its first legitimate consumption could be used once during its five-minute acceptance window. The decision is not a ServiceM8 platform guarantee. Its later extension to the bounded global-menu Phase 1 slice is recorded in `scope-reconciliation.md` and must be revisited before expanding that scope.

## Abuse cases

- Replay a captured valid JWT immediately, after five minutes, or after the replay row expires.
- Reuse a `jti` across accounts or alter the account, staff, event, algorithm, signature, or arguments.
- Submit malformed, oversized, injection-shaped, or claim-conflicting input.
- Use valid signed context from one staff member or account to retrieve another tenant's data.
- Extract callback or OAuth credentials from logs, errors, URLs, browser state, or retained test artifacts.
- Exhaust database/OAuth/API capacity with repeated public callback requests.

## Non-goals

- No writes to ServiceM8.
- No production penetration testing or capture/replay of a production callback token.
- No claim that local testing creates a ServiceM8 freshness or replay guarantee absent from its published contract.
- No capability beyond the later bounded Phase 1 decision in `scope-reconciliation.md`.
