# Phase 0 live runbook

This runbook closes the live evidence that local tests cannot prove. A deployment is not a Phase 0
GO until every required row below has redacted evidence and no stop condition is triggered.

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

Company is the only child/client endpoint enabled in this Phase 0 build, and its Staff B denial is a
mandatory Phase 0 gate. Before any other Phase 1 source is enabled, repeat the Staff B known-Job
test independently for that source.

## Mandatory stop

Report **NO-GO** and do not start Phase 1 if callback freshness is unavailable or untrustworthy,
account binding differs, Staff B sees any restricted Job data, a child endpoint leaks data, OAuth
refresh/revocation does not fail closed, the modal requires weakened browser security, or any API
key, administrator-token fallback, write scope, or ServiceM8 mutation is required.
