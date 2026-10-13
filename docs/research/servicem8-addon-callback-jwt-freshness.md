# ServiceM8 Add-on callback JWT replay and freshness guarantees

Research date: 12 October 2026
Scope: Web Service Hosted Add-on action callbacks
Source policy: ServiceM8 first-party documentation, schema, package, and source only

## Conclusion

**No documented replay-prevention or freshness guarantee was found for the JWT sent to a Web
Service Hosted Add-on callback.**

ServiceM8 explicitly documents that:

- the callback is an HTTPS `POST` whose request body is a JWT;
- the JWT payload is the Add-on SDK event object; and
- the JWT is signed with HMAC-SHA-256 using the Add-on App Secret, which ServiceM8 describes as
  ensuring that only ServiceM8 can produce valid callback JWTs.

The reviewed first-party contract does **not** document any of the following for an action callback
JWT:

- `iat` (issued at);
- `exp` (JWT expiry);
- `nbf` (not before);
- `jti` (JWT identifier);
- a nonce or request identifier;
- a signed action timestamp;
- a maximum callback-token age;
- one-time-use or server-side token consumption; or
- a ServiceM8-side replay cache or replay-rejection rule.

Therefore, verifying the HS256 signature establishes the documented origin/integrity property, but
the published ServiceM8 contract does not provide enough information to establish when an action
JWT was created or whether ServiceM8 will prevent it from being used more than once.

This is a finding about the **published contract**, not proof that the ServiceM8 implementation has
no internal expiry or replay control. An undocumented internal behaviour is not a dependable
security guarantee for this integration.

## Evidence

### 1. The hosted-add-on contract promises a signed JWT, not freshness

The [Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons)
page says the callback receives a JWT in an HTTPS POST body, the encoded data is identical to the
Serverless Add-on event argument, and the token is signed with HMAC-SHA-256 using the App Secret.
It explains the signature as ensuring that only ServiceM8 can produce valid JWTs. The page does not
state a validity period, one-time-use rule, replay policy, or required temporal/unique claim.

The [Add-on Types](https://developer.servicem8.com/docs/add-on-types) page repeats only that a Web
Service Hosted Add-on receives event information in a JWT signed with the App Secret.

### 2. The documented action-event payload has no freshness or uniqueness field

The [Event Data](https://developer.servicem8.com/docs/sample-event-data) reference is the payload
contract to which the hosted-add-on page points. For an action event, it documents:

- `eventVersion`;
- `eventName`;
- `auth.accountUUID`;
- `auth.staffUUID`;
- `eventArgs.jobUUID` for a Job Action; and
- `eventArgs.companyUUID` for a Client Action.

Its published Job Action example contains no `iat`, `exp`, `nbf`, `jti`, nonce, action timestamp,
or callback request ID. The property table and action-specific table do not define an equivalent
field under another name.

The example should not be treated as proof that ServiceM8 will never add an undeclared claim.
However, the combination of the property table, action-event table, and example provides no
published field on which a callback consumer can base a freshness check.

### 3. `accessTokenExpiry` is not callback-JWT expiry

The Event Data reference describes `auth.accessTokenExpiry` as the expiry time, in seconds, of the
OAuth access token. It also marks `auth.accessToken` as provided to Simple Functions only.

The [Serverless Add-ons](https://developer.servicem8.com/docs/serverless-add-ons) page is explicit
that ServiceM8's Secure Token Service gives a **Simple Function** a short-lived OAuth access token
for each invocation, currently 900 seconds. That lifetime applies to the OAuth token used to call
ServiceM8 APIs. It is not documented as the lifetime of the outer JWT delivered to an externally
hosted callback, and it does not establish when that callback JWT was issued.

Consequently, `accessTokenExpiry` must not be reinterpreted as `exp` for the hosted callback JWT.

### 4. Webhook `entry.time` is not an action-launch timestamp

The Event Data reference documents `eventArgs.entry[0].time` only for **webhook events** and defines
it as the UTC time at which a subscribed record field changed. The separate action-event table
contains only the Job or Client UUID. A webhook record-change time is not a documented issuance
time, expiry, nonce, or replay guarantee for a user-clicked Job Action callback.

### 5. The manifest cannot request or configure freshness protection

The [Manifest Reference](https://developer.servicem8.com/docs/manifest-reference) and the live
[v1 manifest JSON Schema](https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json)
define an action destination using fields such as `name`, `type`, `entity`, `iconURL`, `event` or
`actionURL`, and `location`. They expose no callback TTL, nonce, timestamp, one-time-use, or replay
policy setting.

This absence does not prove that ServiceM8 has no internal control. It does show that an add-on
author cannot opt into or configure a documented freshness guarantee through the published v1
manifest.

### 6. The client-side reinvocation API adds no published guarantee

The [Client JS SDK](https://developer.servicem8.com/docs/client-api) documents
`client.invoke(eventName, eventParams)` for invoking additional server-side processing after an
add-on has rendered. It does not document a nonce, invocation timestamp, one-time-use token, or
replay semantics for the resulting web-service request.

### 7. First-party tooling does not add an external-callback security contract

The official [`@servicem8/addon-kit`](https://www.npmjs.com/package/@servicem8/addon-kit) package
(reviewed at version 1.3.1) targets ServiceM8-hosted Simple Functions. Its scaffolded `SM8Event`
type contains `eventName`, `eventArgs`, and `auth.accessToken`; it does not define callback-JWT
temporal or unique claims. Because Addon Kit is for hosted functions rather than external callback
verification, this is supporting negative evidence only, not the primary basis for the conclusion.

The official [ServiceM8 Add-on SDK samples](https://github.com/servicem8/addon-sdk-samples) were
also reviewed. They demonstrate platform-provided event objects and do not publish a Web Service
Hosted Add-on JWT verifier or a replay/freshness contract.

## Claim-by-claim result

| Candidate guarantee | Published for hosted action callback JWT? | Notes |
| --- | --- | --- |
| HS256 signature with App Secret | **Yes** | Explicitly documented. |
| `iat` | **No documented guarantee found** | Not in the event property table or action example. |
| `exp` | **No documented guarantee found** | `accessTokenExpiry` is for the Simple Function OAuth access token, not the callback JWT. |
| `nbf` | **No documented guarantee found** | Not in the published event contract. |
| `jti` | **No documented guarantee found** | Not in the published event contract. |
| Nonce/request ID | **No documented guarantee found** | Not in the published event contract or manifest. |
| Signed action timestamp | **No documented guarantee found** | Webhook `entry.time` is a record-change time and is not part of action event arguments. |
| Maximum JWT age / server-side expiry | **No documented guarantee found** | No lifetime is stated for the callback JWT. |
| One-time use / replay rejection | **No documented guarantee found** | No consumption or replay-cache behaviour is stated. |

## Live Phase 0 observation

A real Royal Glass Job Action callback inspected during Phase 0 had a valid ServiceM8 HS256
signature but no usable temporal or unique claim. No token value or identifier is recorded here.

That observation is consistent with the published action-event contract, but it is deliberately
kept separate from the documentation finding: one observed token does not establish a permanent
ServiceM8 platform guarantee.

## Security implication for this project

The current application can safely:

- require the documented HS256 algorithm;
- verify the signature with the App Secret;
- validate the expected event version, event name, and UUID-shaped context; and
- persist a hash to reject an exact callback JWT that the application has already consumed.

Those controls cannot prove that a **previously unseen** validly signed JWT is recent. A local TTL
starting when the application first sees a token records local receipt time, not ServiceM8 issuance
time, and must not be described as a ServiceM8 freshness guarantee.

The repository's Phase 0 stop condition therefore remains unresolved. The embedded workflow should
not proceed to retrieve ServiceM8 Job or Client data on the strength of this callback until one of
these occurs:

1. ServiceM8 publishes or provides a written, authoritative guarantee specifying callback-token
   expiry or one-time-use/replay behaviour; or
2. ServiceM8 adds a signed issuance/expiry/unique value that the application can validate and
   consume under a defined policy; or
3. the security design is formally changed to accept this residual replay risk, with the decision,
   compensating controls, and permitted operations explicitly approved. This would be a local risk
   acceptance, not a ServiceM8 guarantee.

## Developer Community search

Search date: **12 October 2026**

The official [ServiceM8 Developer Community](https://community.servicem8.com/) was searched through
its live Discourse search endpoint and public web indexing. Exact and broad variants included
`callback JWT`, `JWT`, `HS256`, `HMAC`, `Web Service Hosted`, `signed callback`, `replay`,
`freshness`, `expiry`, `expiration`, `iat`, `exp`, `jti`, `nonce`, `one-time use`, `idempotency`,
and `idempotent`.

No post was found that states a maximum age, one-time-use rule, server-side replay rejection, or a
temporal/unique claim that consumers can rely on for a Web Service Hosted Add-on **action callback
JWT**. This is a bounded negative search result, not proof that no such post exists: the community
describes itself as private and members-only, search indexing can be incomplete, and some broad
queries were rate-limited. The directly relevant topics returned by the live search were opened and
reviewed in full.

### Directly relevant community material

1. In [Security reviews off private add ons](https://community.servicem8.com/t/security-reviews-off-private-add-ons/1212),
   Cody wrote on 4 and 5 October 2026 that a security review should require HTTPS, validate each
   callback JWT's HMAC-SHA-256 signature with the App Secret, keep that secret confidential, limit
   OAuth scopes, and review data handling. The posts do not mention `iat`, `exp`, `nbf`, `jti`, a
   nonce, a maximum token age, one-time use, or replay rejection.

2. In [Webhook Authentication + Schema](https://community.servicem8.com/t/webhook-authentication-schema/1095),
   Cody wrote on 14 May 2026 that Add-on SDK web-service callbacks carry a JWT signed with the App
   Secret, allowing the receiver to validate that the request came from ServiceM8. This repeats the
   documented origin/integrity property and does not state a freshness or replay guarantee.

3. In [Private add-on: converted Simple Function won't route to a Self-Hosted callback, a new one does](https://community.servicem8.com/t/private-add-on-converted-simple-function-wont-route-to-a-self-hosted-callback-a-new-one-does/1196),
   a developer reported verifying an HS256 callback JWT, and Cody confirmed on 23 September 2026
   that the event payload is a JWT signed with the App Secret. The thread addresses routing,
   response format, and timeout behaviour; it does not define JWT age or replay semantics.

4. In [Self Hosted Add-On - returned Callback Html not displaying](https://community.servicem8.com/t/self-hosted-add-on-returned-callback-html-not-displaying/542),
   a community member posted .NET validation code on 7 March 2023 with
   `RequireExpirationTime = false`. The topic has no reply. This is evidence of one developer's
   implementation choice only; it is not ServiceM8 guidance and cannot establish a supported
   callback-token contract.

5. [Webhook callbacks, Idempotencey and headers](https://community.servicem8.com/t/webhook-callbacks-idempotencey-and-headers/1169)
   concerns Webhooks API deliveries rather than action callback JWTs. Cody wrote on 29 August 2026
   that there was no published guarantee that `event.id` was a retry-stable deduplication key and
   advised idempotent processing. The same thread says `x-addon-unique-id` is grouping/diagnostic
   context rather than a documented authentication or idempotency control. This supports a
   conservative approach to undocumented identifiers, but it does not answer the action-JWT
   freshness question.

The visible community profile for `Cody` did not show an administrator/moderator flag, staff badge,
group, or profile title when checked. The posts use ServiceM8-first-person language and link back to
official documentation, but this note does not elevate them to an authoritative supported guarantee.
Even if treated as ServiceM8 representative guidance, none states the missing freshness or replay
property.

### Cross-check against first-party documentation

After reviewing the community results, the current
[Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons) and
[Event Data](https://developer.servicem8.com/docs/sample-event-data) pages were checked again on
12 October 2026. They still document HTTPS, HMAC-SHA-256 signing with the App Secret, and the action
event payload fields, but no callback-JWT TTL, one-time-use rule, replay cache, or
`iat`/`exp`/`nbf`/`jti`/nonce equivalent. The community search therefore does not change this
research note's conclusion or the Phase 0 stop condition.

## Clarification request to ServiceM8

Request an answer that distinguishes implementation behaviour from a supported contract:

> For a Web Service Hosted Add-on action callback, is the HS256 JWT subject to a documented maximum
> age, one-time-use rule, or server-side replay rejection? If so, what exact lifetime and replay
> semantics can an add-on rely on, and which signed claim or request property should the callback
> validate? If no claim is provided, can ServiceM8 guarantee that the same JWT cannot be delivered
> or accepted more than once?

The ServiceM8 Help Center states that custom API/SDK development is self-service and that ServiceM8
Support does not provide development advice. It points developers to the public Developer Community,
where answers are not guaranteed. A community answer should therefore be treated as clarification
only unless ServiceM8 identifies it as an authoritative supported guarantee. See
[Does ServiceM8 provide support for custom development or the API and SDK?](https://support.servicem8.com/questions/integrations/does-servicem8-provide-support-for-custom-development-or-the-api-and-sdk).

## Sources reviewed

All sources were accessed on **12 October 2026**.

Primary sources used for the finding:

1. ServiceM8, [Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons).
2. ServiceM8, [Event Data](https://developer.servicem8.com/docs/sample-event-data).
3. ServiceM8, [Add-on Types](https://developer.servicem8.com/docs/add-on-types).
4. ServiceM8, [Serverless Add-ons](https://developer.servicem8.com/docs/serverless-add-ons).
5. ServiceM8, [Manifest Reference](https://developer.servicem8.com/docs/manifest-reference).
6. ServiceM8, [Add-on manifest v1 JSON Schema](https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json).
7. ServiceM8, [Client JS SDK](https://developer.servicem8.com/docs/client-api).
8. ServiceM8, [Frequently Asked Questions](https://developer.servicem8.com/docs/frequently-asked-questions).
9. ServiceM8, [Developer documentation index](https://developer.servicem8.com/llms.txt).
10. ServiceM8, [`@servicem8/addon-kit` on npm](https://www.npmjs.com/package/@servicem8/addon-kit), version 1.3.1.
11. ServiceM8, [Add-on SDK samples](https://github.com/servicem8/addon-sdk-samples).
12. ServiceM8 Help Center, [Does ServiceM8 provide support for custom development or the API and SDK?](https://support.servicem8.com/questions/integrations/does-servicem8-provide-support-for-custom-development-or-the-api-and-sdk).

Additional Add-on SDK pages searched for the candidate terms and related semantics, with no
contrary guarantee found:

- [Add-on Structure](https://developer.servicem8.com/docs/add-on-structure)
- [Add-on Capabilities](https://developer.servicem8.com/docs/add-on-capabilities)
- [Addon Kit](https://developer.servicem8.com/docs/addon-kit)
- [Examples](https://developer.servicem8.com/docs/examples)
- [Create a private ServiceM8 Add-on with AI](https://developer.servicem8.com/docs/create-private-addon-with-ai)
