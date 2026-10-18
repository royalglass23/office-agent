# Threat model - ServiceM8 callback replay

> Historical threat record. See `scope-reconciliation.md` for the bounded global-menu Phase 1
> decision; unresolved threats remain binding outside that exact scope.

## Flow and trust boundaries

`ServiceM8 -> HTTPS POST JWT -> /api/servicem8/events -> signature/schema/freshness check -> consumed_events -> OAuth connection -> Vendor/Staff API with x-impersonate-uuid -> JSON eventResponse -> ServiceM8 iframe`

Trust boundaries exist at the public callback, the Postgres database, the encrypted OAuth token store, the outbound ServiceM8 API, and the ServiceM8-rendered browser surface.

## Material threats

| ID | STRIDE | Attack | Existing mitigation | Residual risk | Status/severity |
| --- | --- | --- | --- | --- | --- |
| RPL-001 | Spoofing/elevation | Use a captured valid menu JWT before the legitimate request consumes it. | HS256 verification, strict schema, signed `iat + jti`, five-minute maximum age, account-scoped atomic consumption. | First-use theft inside five minutes remains possible. | Accepted only for the reconciled bounded global-menu scope; High for further extension. |
| RPL-002 | Spoofing | Replay the same menu event immediately or after the replay row expires. | Account-scoped `jti` hash is atomically inserted; default retention is ten minutes; menu tokens become stale after five minutes. | Real delayed-replay behavior lacks isolated E2E evidence. | Locally mitigated; E2E BLOCKED. |
| RPL-003 | Tampering | Change account, staff, event, algorithm, body, or temporal claims. | Fixed HS256 algorithm, App Secret verification, strict Zod schemas, 16 KiB token limit. | App Secret compromise defeats origin checking. | Medium. |
| RPL-004 | Information disclosure | Leak JWTs, OAuth tokens, identifiers, Staff/Job data, or chat text. | Generic errors, safe structured logging, identifier digests, no raw-token persistence, DOM-only test chat. | Browser URLs/screenshots and provider traces require operational care. | Medium. |
| RPL-005 | Denial of service | Send repeated malformed or valid callbacks to consume database/OAuth/API capacity. | 16 KiB input limit, early signature/schema rejection, database uniqueness. | No explicit callback rate limiter or verified upstream limit. | Medium open finding. |
| RPL-006 | Elevation/cross-tenant | Use signed context with a wrong OAuth grant, restricted staff, or known foreign Job UUID. | Vendor-account binding and `x-impersonate-uuid` on every read. | Dedicated restricted-staff and cross-account E2E evidence is absent. | High evidence gap; blocks multi-account/restricted-role claims and scope beyond the reconciled single-account slice. |
| RPL-007 | Repudiation | Security-relevant failures cannot be correlated without exposing identity. | Random request ID, event-category logs, redacted identifiers. | Alerting and retention policy were not independently verified. | Medium operational gap. |

## Scope decision

The current compensating-control design is accepted only for the explicitly reconciled global-menu capabilities. Independent user authentication remains the stronger design if later capabilities need authority beyond the short-lived signed ServiceM8 launch. No further scope inherits this acceptance automatically.
