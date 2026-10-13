# RG Office Agent — ServiceM8 Feasibility and Prototype Plan

Assessment date: 9 October 2026
Repository: `royalglass23/rg-office-agent` / `D:\Royal Glass Dev\office-agent`
Scope: assessment and implementation plan only; no ServiceM8 or production changes

## A. Feasibility confirmation

**GO FOR SPIKE**

This is approval to build and run **Phase 0 only**: the ServiceM8 integration and
staff-permission proof. It is not approval to build the AI assistant, perform writes, or expose the
prototype to general staff.

The proposed architecture is supported by ServiceM8's current documentation:

- an externally hosted Vercel application can be a Web Service Hosted Add-on;
- an online Job Action can open a modal inside ServiceM8;
- the action callback receives signed account, staff, and Job context;
- OAuth supports staff impersonation through `x-impersonate-uuid`;
- ServiceM8 states that impersonation applies the selected staff member's security.

The decisive uncertainty is whether Royal Glass's actual permission configuration prevents a
restricted employee from retrieving a known Job UUID directly and from retrieving child records
belonging to that Job. That must be proven with two real test employees before Phase 1 begins.

## Status legend

- **VERIFIED** — stated by current official ServiceM8 documentation.
- **ASSUMED** — a proposed implementation choice, not a ServiceM8 guarantee.
- **UNKNOWN** — the official documentation reviewed does not answer it.
- **REQUIRES LIVE TEST** — only a real ServiceM8/Vercel test can close the question.

## Live ServiceM8 workload evidence

Snapshot taken read-only from the Royal Glass ServiceM8 account on 9 October 2026. The comparison
used ServiceM8's `STAFF:<uuid>` system filter and deduplicated records by Job UUID.

ServiceM8 marked the returned totals as non-exact. A broader allocation-oriented query also
returned duplicate rows when one Job had several staff allocations. These figures are therefore a
current operational snapshot, not an audited or exhaustive workload report.

| Staff | Distinct Jobs returned | Quotes | Work Orders | Customer response requiring action | Observed workload pattern |
| --- | ---: | ---: | ---: | ---: | --- |
| Abhi | 44 | 41 | 3 | 5 | Enquiries, Quote-stage follow-up, and missing customer information |
| Roy | 98 | 97 | 1 | 3 | Technical review, specification, and pricing decisions |
| May | 14 | 4 | 10 | 1 | Scheduling and delivery-stage coordination |

### Shared Jobs

| Staff overlap | Jobs in the snapshot | Interpretation |
| --- | --- | --- |
| Abhi and Roy | `R260066`, `R260724`, `R260340`, `Q252423` | All are Quotes; the overlap is consistent with an office-follow-up to technical/pricing handoff. |
| Roy and May | `Q250082` | Work Order requiring coordination by May and technical confirmation by Roy. |
| Abhi and May | None returned | No overlap in this snapshot. |
| All three | None returned | No overlap in this snapshot. |

`Q250082` is the clearest observed example of why assignment and recommended ownership must remain
separate. May has the Work Order in her staff list, while the Job description says Roy must confirm
the installed systems before PS1/PS3 preparation.

The assistant should represent that situation as:

```text
Current coordinator: May
Current blocker: Installed system has not been technically confirmed
Recommended next owner: Roy
Reason: PS1/PS3 preparation requires a technical system decision
```

This evidence supports the proposed deterministic responsibility matrix:

| Situation detected | Recommended owner |
| --- | --- |
| New enquiry, customer response, missing customer information, general Quote follow-up | Abhi |
| Technical interpretation, system selection, engineering/PS1 questions, pricing decision | Roy |
| Booking, scheduling, allocation, installation coordination | May |

The matrix is a next-action routing rule, not a statement that one person exclusively owns the Job.
The assistant must show the current assigned/coordinating staff separately from the recommended next
owner and must cite the Job evidence that caused any handoff recommendation.

## Documentation findings

| Question | Status | Finding |
| --- | --- | --- |
| Correct Add-on type | **VERIFIED** | Use a **Web Service Hosted Add-on**. A private/unlisted public application is allowed; it does not have to be listed in the Add-on Store. |
| UI entry point | **VERIFIED** | Define an online Job Action with `entity: "job"` and `location: "modal"`. Modal is the documented default for web actions and is recommended when the UI should remain inside ServiceM8. |
| Callback transport | **VERIFIED** | ServiceM8 invokes an HTTPS callback with HTTP POST. The request body is a JWT signed with HMAC-SHA-256 using the Add-on App Secret. |
| Account identity | **VERIFIED** | `auth.accountUUID` identifies the invoking account and corresponds to the single Vendor record. |
| Staff identity | **VERIFIED** | `auth.staffUUID` identifies the staff member who generated the action. |
| Current Job identity | **VERIFIED** | For a Job Action, `eventArgs.jobUUID` identifies the Job being viewed. |
| OAuth requirement | **VERIFIED** | A Web Service Hosted Add-on must implement OAuth 2.0. External web services do not receive the short-lived `auth.accessToken` supplied to ServiceM8-hosted Simple Functions. |
| Staff impersonation | **VERIFIED** | Send `x-impersonate-uuid` on OAuth-authenticated API requests. It must be an active staff UUID in the current account. It is not supported with API keys. |
| Restricted list behaviour | **VERIFIED** at contract level | ServiceM8 explicitly says a Jobs query impersonating a restricted employee returns only Jobs that employee may view. |
| Restricted direct Job GET | **REQUIRES LIVE TEST** | The direct `GET /job/{uuid}.json` endpoint documents `403` and `404`, and the generic impersonation rule covers GET requests, but the docs do not explicitly prove known-UUID denial under impersonation. |
| Minimum OAuth scopes | **VERIFIED** | `read_jobs` is required for Job retrieval; `read_customers` is required to resolve client/company details; `vendor` gives basic account information for binding the grant to the signed account. `read_staff` is optional unless the spike reads staff details. |
| Modal rendering | **VERIFIED** | ServiceM8 renders the callback's complete HTML response in an iframe. The response must not use an `X-Frame-Options` value that blocks framing. The Client JS SDK supports resize, close, and callback invocation. |
| CSP and iframe cookies | **UNKNOWN** | The reviewed docs do not publish an authoritative `frame-ancestors` origin list, iframe sandbox policy, `SameSite` requirements, or cross-browser third-party-cookie guarantees. |
| Access-token refresh | **VERIFIED** | Access tokens last 3,600 seconds. The authorization-code exchange returns access and refresh tokens. Refresh returns a replacement refresh token, which must be persisted atomically. |
| Callback freshness/replay fields | **UNKNOWN** | The docs do not promise `iss`, `aud`, `iat`, `exp`, `nbf`, `jti`, a signed timestamp, or a nonce in the callback JWT. |
| Web-service security obligations | **VERIFIED** | HTTPS, OAuth, secret protection, least privilege, privacy disclosure, data minimisation, deletion support, and restrictions on transfer/use of ServiceM8 data are documented requirements. |

Primary sources:

- [Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons)
- [Event Data](https://developer.servicem8.com/docs/sample-event-data)
- [Authentication and scopes](https://developer.servicem8.com/docs/authentication)
- [Manifest Reference](https://developer.servicem8.com/docs/manifest-reference)
- [Add-on Capabilities](https://developer.servicem8.com/docs/add-on-capabilities)
- [Client JS SDK](https://developer.servicem8.com/docs/client-api)
- [List all Jobs](https://developer.servicem8.com/reference/listjobs)
- [Retrieve a Job](https://developer.servicem8.com/reference/getjobs)
- [Platform Policy](https://developer.servicem8.com/page/platform-policy)
- [Add-on Store Requirements](https://developer.servicem8.com/docs/addon-store-requirements)

## Recommended technical flow

```text
ServiceM8 Job Action
  -> HTTPS POST containing signed JWT
  -> verify HS256 signature and expected event shape
  -> derive accountUUID, staffUUID, jobUUID only from verified claims
  -> load the OAuth grant bound to accountUUID
  -> call ServiceM8 with Bearer token + x-impersonate-uuid: staffUUID
  -> retrieve Job; stop immediately on denial
  -> retrieve only permitted, required child context
  -> escape and render a read-only HTML response in the ServiceM8 modal
```

There must be no API-key or administrator-token fallback. Every ServiceM8 request made for an
interactive user must go through one client that requires both the OAuth account connection and the
verified staff UUID.

### OAuth account binding

**ASSUMED implementation rule:** after OAuth completes, call the Vendor endpoint with the new OAuth
token and store the grant under that returned account UUID. On every action, require an exact match
between the JWT's signed `accountUUID` and the stored grant. Never select a grant from a browser
parameter.

The `vendor` scope is therefore part of the recommended Phase 0 scope set. The live connection must
confirm that this binding flow behaves as expected.

### Persistence decision

The callback-verification-only substep can run without a database. The complete external-hosted
Phase 0 cannot safely do so because refresh-token rotation requires durable, atomic storage.

Use one minimal encrypted persistence layer for:

- the account UUID and encrypted OAuth access/refresh tokens;
- access-token expiry and refresh coordination;
- OAuth `state` consumption;
- exact callback-JWT hashes if the live event format requires application-level replay detection.

Neon/Postgres is justified only for this small security state. Do not add conversation history,
Job caches, embeddings, or general application persistence during the spike.

### Replay limitation

Signature verification proves origin and integrity, not freshness. First capture a real action JWT
and inspect its header and claims without logging token contents or personal data.

- If ServiceM8 supplies documented/usable temporal and unique claims, validate them and consume the
  unique identifier once.
- If it supplies no freshness or uniqueness claim, a durable hash can reject an exact repeated JWT,
  but it cannot prove that a previously unseen signed token is recent.
- If safe freshness cannot be established, obtain written clarification from ServiceM8 or stop the
  embedded authenticated workflow. Do not describe a locally chosen TTL as a ServiceM8 guarantee.

## B. Technical implementation plan

### Phase 0A — signed launch proof

Create:

```text
app/
  api/
    servicem8/
      events/route.ts             # POST callback; verify and dispatch Job Action
  health/route.ts                 # non-sensitive deployment health check
lib/
  servicem8/
    event-schema.ts               # strict event schema and UUID validation
    verify-event.ts               # HS256-only verification with App Secret
    render-context-html.ts        # escaped, sanitized Phase 0 response
  security/
    safe-log.ts                   # identifiers redacted/hashed; no JWTs or tokens
tests/
  servicem8/
    verify-event.test.ts
    events-route.test.ts
```

The first deployed response displays only sanitized account, staff, and Job identifiers. It rejects
invalid signatures, wrong algorithms, wrong event name/version, missing claims, invalid UUIDs, and
unexpected methods/content.

Before claiming replay protection, inspect the real JWT claim set and record the result in this
document.

### Phase 0B — OAuth and impersonated Job retrieval

Create:

```text
app/
  api/
    servicem8/
      oauth/
        start/route.ts            # create state and redirect to ServiceM8 authorize URL
        callback/route.ts         # consume state; exchange code; bind Vendor UUID
        disconnect/route.ts       # explicit disconnect/logout path
lib/
  servicem8/
    oauth.ts                      # authorize, exchange, and refresh functions
    client.ts                     # OAuth-only client; staff UUID required on every call
    account-context.ts            # signed account/staff/Job context
    job-context.ts                # bounded Phase 0 Job and company read
  security/
    encryption.ts                 # authenticated encryption for stored tokens
    oauth-state.ts                # one-time OAuth state creation/consumption
  storage/
    oauth-connections.ts          # atomic token reads and refresh rotation
    consumed-events.ts            # replay records if required by observed JWT
db/
  migrations/
    0001_security_state.sql       # only OAuth/state/replay security tables
tests/
  servicem8/
    oauth.test.ts
    client.test.ts
    job-context.test.ts
  security/
    account-binding.test.ts
    token-refresh.test.ts
```

Update the event route only after the OAuth client is tested. It must:

1. verify the ServiceM8 event;
2. load the OAuth connection by signed account UUID;
3. fetch Vendor and require the same account UUID;
4. fetch the Job with `x-impersonate-uuid` set to signed staff UUID;
5. fetch the Company only after the Job request succeeds;
6. return a safely escaped, read-only result.

Do not add Diary, Queue, Quote detail, scheduling, or AI calls until the two-user gate passes.

### Phase 1 — only after Phase 0 passes

Create:

```text
app/
  api/
    assistant/
      context/route.ts            # bounded permitted context for current launch
      chat/route.ts               # allowlisted intents only; no tools with writes
components/
  assistant/
    AssistantPanel.tsx
    ContextSummary.tsx
    EmailDraft.tsx
lib/
  agent/
    intents.ts                    # supported-intent allowlist
    routing.ts                    # explicit Abhi/Roy/May next-owner rules
    recommendations.ts            # facts separated from recommendations
    prompts.ts                    # read-only, bounded prompts
  servicem8/
    extended-job-context.ts       # separately authorised optional context sources
tests/
  agent/
    routing.test.ts
    recommendations.test.ts
    prompts.test.ts
  assistant/
    read-only-boundary.test.ts
```

The exact way the interactive page continues from the initial POST response is a **REQUIRES LIVE
TEST** item. Prefer a short-lived application-signed launch token passed in an authorization header
over relying solely on third-party iframe cookies. Do not adopt redirect or cookie behaviour until
it works inside the actual ServiceM8 modal under the intended CSP.

The Phase 1 recommendation model must return these fields separately:

```text
currentAssignedStaff
currentCoordinator
observedFacts
blockerType
recommendedNextOwner
recommendationReason
```

Routing tests must include multi-person Jobs. In particular, the `Q250082` pattern must recommend Roy
for the technical confirmation without replacing May as the scheduling/delivery coordinator.

## C. Required ServiceM8 configuration

### Application and Add-on

- Create a ServiceM8 Developer Partner application/store item.
- Keep it private/unlisted for the spike.
- Select **Web Service Hosted Add-on**.
- Set the stable production-like Vercel callback URL to:
  `https://<host>/api/servicem8/events`.
- Set the activation URL to:
  `https://<host>/api/servicem8/oauth/start`.
- Set the Return URL host to the same host used by:
  `https://<host>/api/servicem8/oauth/callback`.
- Do not use changing Vercel preview hosts for the configured OAuth return flow.

### Job Action manifest

```json
{
  "$schema": "https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json",
  "name": "RG Office Assistant",
  "version": "0.1.0",
  "oauth": {
    "scope": "vendor read_jobs read_customers"
  },
  "actions": [
    {
      "name": "RG Office Assistant",
      "type": "online",
      "entity": "job",
      "event": "rg_office_assistant",
      "location": "modal",
      "iconURL": "https://<host>/icon.png"
    }
  ]
}
```

The manifest is a plan, not a deployed artifact. Validate it against ServiceM8's current v1 schema
and server-side validation during setup.

### Phase 0 OAuth scopes

Recommended initial set:

```text
vendor read_jobs read_customers
```

Add `read_staff` only if staff names/details must be read during the test. Do not request
`manage_*`, `create_jobs`, `publish_email`, `publish_sms`, `publish_job_notes`,
`publish_diary_items`, or scheduling-write scopes.

Later read-only context must be added incrementally and independently tested:

- `read_job_notes` for Diary/job notes;
- `read_job_queues` for Queue names;
- `read_schedule` for Job activities/allocations;
- `read_staff` for staff display data;
- `read_job_contacts` if Job Contacts are required.

## D. Environment variable names

Phase 0:

```text
APP_BASE_URL
SERVICEM8_APP_ID
SERVICEM8_APP_SECRET
SERVICEM8_OAUTH_REDIRECT_URI
SERVICEM8_OAUTH_SCOPES
DATABASE_URL
TOKEN_ENCRYPTION_KEY
SESSION_SIGNING_SECRET
```

Phase 1 only:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

Never log or expose their values. Vercel production and preview environments must not accidentally
share credentials or OAuth callback configuration.

## E. Phase 0 test plan

Use two active Royal Glass test employees whose ServiceM8 access difference is known and recorded:

- **Staff A** can view Job X.
- **Staff B** cannot view Job X.

Use a non-sensitive test Job where possible.

| Test | Expected result | Gate |
| --- | --- | --- |
| Valid Staff A action on Job X | Signed IDs validate; impersonated direct Job GET succeeds; displayed Job matches current card. | Required |
| Staff A Jobs list/filter | Job X appears when the same impersonation header is used. | Required |
| Staff B Jobs list/filter | Job X is absent; response contains no Job X fields. | Required |
| Staff B direct Job X UUID | No Job data is returned. Record status, body, headers, and whether identifiers or partial fields leak. | Required |
| Staff B child-resource request for Job X | Notes, contacts, allocations, company, or other sources planned for Phase 1 return no restricted data. | Required before that source is enabled |
| Staff UUID from another account | Request is rejected; no fallback or broader result. | Required |
| Missing/invalid callback signature | `401`/rejection page; no IDs, OAuth lookup, or ServiceM8 call. | Required |
| JWT algorithm substitution | Anything except expected HS256 is rejected. | Required |
| Missing/malformed account, staff, or Job UUID | Reject before OAuth lookup. | Required |
| Replayed callback | Behaviour matches the design justified by observed real JWT claims; exact duplicate is rejected where feasible. | Required |
| OAuth `state` missing/reused | OAuth callback is rejected. | Required |
| OAuth account mismatch | Vendor UUID and signed account UUID mismatch is rejected. | Required |
| Expired access token | One coordinated refresh occurs; replacement refresh token is stored atomically; original request retries once. | Required |
| Revoked/invalid grant | Fail closed and show reconnect guidance; never try an API key. | Required |
| ServiceM8 timeout/429/5xx | Bounded retry only where safe; no permission bypass or stale cross-user response. | Required |
| Modal on supported browsers | UI renders, resizes, and continues requests under intended CSP without weakening browser security. | Required |
| Top-level Vercel page only | Not accepted as iframe evidence. | Explicit non-proof |

For restricted requests, test the response body and derived display—not only the HTTP status. A
`403` or `404` label is insufficient if any sensitive fields were already fetched, logged, cached,
or sent to another service.

## F. Security risks and controls

1. **Direct UUID authorisation mismatch — critical.** List filtering may work while direct retrieval
   leaks a known Job. Phase 0 must prove both paths with Staff B.
2. **Child-resource leakage — critical.** Notes, contacts, company, schedule, and Queue endpoints may
   not behave identically. Authorise the parent Job first, send impersonation on every child request,
   and test every enabled endpoint independently.
3. **Administrator/API-key fallback — prohibited.** It would bypass the required ServiceM8 staff
   boundary. Fail closed if OAuth or impersonation fails.
4. **Cross-account token mix-up — critical.** Bind each OAuth grant to its Vendor UUID and require it
   to match signed `auth.accountUUID` before use.
5. **Browser-controlled identity — critical.** Never accept account, staff, or Job UUID replacements
   from query strings, forms, local storage, or chat JSON. Derive them from the verified launch.
6. **JWT replay/freshness gap — high.** The docs promise a signature but do not promise temporal or
   unique claims. Inspect a live token and stop if freshness cannot be made trustworthy.
7. **Refresh-token loss/race — high.** Refresh responses rotate the refresh token. Encrypt tokens at
   rest and update them atomically with refresh locking.
8. **Iframe session failure — high.** Third-party-cookie and CSP behaviour is undocumented. Test the
   real modal; do not disable CSRF or broad browser protections to make it work.
9. **Stored/reflected XSS — high.** Job descriptions, company names, notes, and AI text are untrusted.
   Escape HTML, use a restrictive CSP, and never inject raw ServiceM8 or model output.
10. **Logging leakage — high.** Never log JWT bodies, OAuth tokens, Job descriptions, client details,
    notes, emails, prompts, or model responses. Use correlation IDs and redacted identifiers.
11. **AI provider disclosure — Phase 1 gate.** ServiceM8 documentation does not specifically approve
    sending client/Job data to an AI provider. Complete privacy, consent, retention, regional
    processing, and contractual review first; then send only bounded data returned under the
    impersonated request.
12. **Facts versus recommendations — product risk.** Preserve source facts separately from inferred
    blockers and recommendations. Deterministic routing—not the model—maps work types to Abhi, Roy,
    or May.

## G. Stop conditions

Stop Phase 0 and report **NO-GO** if any of the following occurs:

- the callback's account, staff, or Job identity cannot be trusted;
- the OAuth grant cannot be bound to the same signed ServiceM8 account;
- Staff B can see Job X through list/filter or direct UUID retrieval;
- any restricted Job data leaks through a child endpoint, error, log, cache, or model call;
- the solution requires an API key, administrator token, or application-side permission filtering;
- callback replay/freshness cannot be handled to an acceptable security standard;
- the embedded UI requires unsafe framing, cookie, CSRF, or CSP settings;
- OAuth refresh/revocation cannot fail closed;
- a write scope or ServiceM8 mutation becomes necessary for the read-only proof.

## Phase transition rule

Phase 1 may start only after the Phase 0 evidence records:

- a successful Staff A invocation;
- a denied Staff B list/search result for Job X;
- a denied Staff B direct UUID retrieval for Job X;
- denied restricted child-resource reads for every source Phase 1 will use;
- correct OAuth account binding and refresh behaviour;
- safe operation in the actual ServiceM8 modal.

Until then, AI, email drafting, broader Job context, persistent conversations, autonomous actions,
and every ServiceM8 write remain out of scope.
