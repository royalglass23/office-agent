# Security report - ServiceM8 callback replay

> Historical strict-E2E record. Its blanket Phase 1 blocker is superseded only for the bounded
> single-account global-menu slice in `scope-reconciliation.md`. All broader findings remain open.

## Outcome

- Reviewed commit: `8d17c2bd404571a4a0929fdc2fe655ca8cc874c3`
- Mode: retrofit
- Verdict for the bounded Phase 0 menu implementation: local controls pass; strict E2E is **BLOCKED**.
- Historical verdict for unrestricted/broader Phase 1 data access: **BLOCKED**. The later bounded global-menu exception is documented in `scope-reconciliation.md`.

The current global-menu path requires a signed `iat + jti`, accepts at most five minutes of age with 30 seconds of future skew, uses an account-scoped replay identity, and atomically consumes it before OAuth or ServiceM8 data access. Missing claims remain fail-closed. This materially resolves the old claimless-menu design gap in local code.

At the time of this audit, the user accepted the remaining first-use theft risk only for the Phase 0 named greeting. The subsequent bounded global-menu decision is documented separately in `scope-reconciliation.md`. It does not substitute for isolated security E2E or approve broader sources, persistence, writes, sending, autonomy, Job Actions, or multi-account support.

## Open findings

- **High E2E-001:** the staging Vercel project is reachable, but no authorised isolated ServiceM8 tenant or executable real-token replay lane exists.
- **High ENV-001:** the 13 October staging OAuth attempt failed closed at Vendor account binding because ServiceM8 returned HTTP `402`, documented by ServiceM8 as the account not being in good standing.
- **High RPL-006:** restricted-staff, known-UUID, and cross-account authorization have not been exercised with dedicated fixtures.
- **High-if-expanded RPL-001:** a valid JWT captured before first consumption can be used once within five minutes; accepted only for the Phase 0 greeting.
- **High evidence gap RPL-002:** immediate and delayed replay controls pass locally but have not been verified with a real staging callback.
- **High RPL-007:** a user-authorised production diagnostic confirmed that a real signed Job Action
  on a synthetic Job has no usable freshness or uniqueness claims. The application correctly
  stopped before OAuth lookup or ServiceM8 API access, so Michael/Carla Job authorization remains
  untestable through this route.
- **Medium RPL-005:** no explicit application-level rate limiter protects the public callback.
- **Medium DB-001:** production/staging database least-privilege grants and retention controls are unverified.
- **Low CFG-001:** `sslmode=require` has a documented future driver-semantics warning; prefer `verify-full` before a `pg` major upgrade.

## Architecture and implementation review

- Authentication: fixed HS256 verification with a configured App Secret; strict event schemas and bounded input size.
- Freshness: menu-only signed `iat + jti` policy; five-minute maximum age and future-skew rejection.
- Replay: SHA-256 account/`jti` identity and parameterized atomic `INSERT ... ON CONFLICT DO NOTHING` before data access.
- Authorization: Vendor account binding plus `x-impersonate-uuid` on every read; real restricted/cross-account evidence remains missing.
- Data minimization: the menu path reads Vendor and only the signed Staff record; no Job context is accepted.
- Output/logging: HTML escaping, generic client errors, request correlation, redacted identifiers, no raw JWT/token persistence.
- OAuth storage: encrypted access/refresh tokens and transactionally serialized refresh rotation.
- Availability: bounded callback size and API timeouts exist; explicit rate limiting and cold-refresh latency resilience remain open.

## Standards review

### OWASP Top 10:2021

- A01 Broken Access Control: **BLOCKED** by RPL-006 E2E evidence.
- A02 Cryptographic Failures: **PASS locally/PARTIAL infrastructure**; TLS configuration and encrypted token storage exist, but database trust/role configuration is not independently verified.
- A03 Injection: **PASS** at the reviewed seam; schemas, escaping, and parameterized SQL are used.
- A04 Insecure Design: **PARTIAL**; threat model and bounded risk decision exist, while isolated abuse-case proof is missing.
- A05 Security Misconfiguration: **PARTIAL**; safe response headers/config checks exist, with DB TLS upgrade risk and environment evidence open.
- A06 Vulnerable and Outdated Components: **PASS**; production audit reported zero vulnerabilities.
- A07 Identification and Authentication Failures: **PASS locally/BLOCKED E2E** for freshness and replay.
- A08 Software and Data Integrity Failures: **PASS** for signed callback integrity and strict parsing.
- A09 Security Logging and Monitoring Failures: **PARTIAL**; safe correlation exists, but alerting/retention is unverified.
- A10 SSRF: **N/A**; callback input cannot select an outbound destination.

### OWASP ASVS 4.0 Level 2

- V1 Architecture: PASS; V4 Access Control: BLOCKED; V5 Validation: PASS; V6 Stored Cryptography: PASS locally; V7 Error/Logging: PASS locally; V8 Data Protection: PARTIAL; V9 Communications: BLOCKED for isolated E2E; V10 Malicious Code: PASS by audit; V11 Business Logic: BLOCKED by replay E2E/rate limiting; V12 Files: N/A; V13 API/Web Service: BLOCKED; V14 Configuration: PARTIAL. V2/V3 do not provide independent end-user auth/session assurance for future Phase 1 and must be designed there.

## API, database, secrets, and evidence

- API input and output checks pass locally; rate limiting and real wrong-role/cross-tenant tests remain open.
- SQL in the replay and OAuth seams is parameterized; tenant rows are keyed by account UUID. Database role grants were not inspected.
- Repository scanning found no tracked live environment file, private key, credential bundle, focused-test marker, or raw production token evidence.
- Local validation passed 78 tests, typecheck, full lint, production build, and the high-severity production dependency audit.
- Strict E2E remains BLOCKED with zero isolated browser/replay tests executed.

Read-only checks confirmed that the staging deployment serves `/health` and `/api/servicem8/manifest`. The earlier staging OAuth failure occurred before account binding or connection persistence. A later user-authorised production diagnostic successfully completed OAuth account binding, then confirmed that the Job Action freshness gate stops before any ServiceM8 data request. No application code, Vercel configuration, ServiceM8 setting, production credential, or production data was changed during this audit.
