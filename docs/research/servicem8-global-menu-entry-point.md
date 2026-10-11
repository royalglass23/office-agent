# ServiceM8 global Add-ons menu entry-point proof

Research date: 12 October 2026

Scope: Web Service Hosted Add-on launch from ServiceM8's web **Add-ons** menu

Source policy: current first-party ServiceM8 documentation and API reference only

## Conclusion

A small global-entry proof is supported by ServiceM8's published Add-on SDK:

- add a `menuItems` record with `type: "addon"`, a public icon URL, and a callback event;
- route that event through the existing HTTPS Web Service Hosted Add-on callback;
- validate the signed account and staff UUIDs, but do **not** require or invent a Job UUID; and
- return a complete HTML document for ServiceM8 to render in its UI.

The proof can safely render a chatbot-style shell that remains interactive while that rendered page
is open. It must not claim persistence after the staff member navigates away.

Two material gaps remain in the published contract:

1. ServiceM8 does not publish a menu-item-specific `eventArgs` shape. The real signed launch must be
   captured and inspected before the production schema is considered proven.
2. ServiceM8 documents `client.closeWindow()` for popup launches such as Job and Client actions,
   not for a full-page menu item. The exit behaviour must be tested in the real ServiceM8 web UI.

## 1. Manifest shape

ServiceM8 documents `menuItems` as the capability for adding entries under the web platform's
**Addons** menu. For the web menu, `type` is `addon`; `name`, `iconURL`, and either `event` or
`actionURL` are required. The `event` value invokes the add-on backend when the menu item is
clicked. Event names are case-insensitive, and ServiceM8 recommends lower case. See the
[Manifest Reference](https://developer.servicem8.com/docs/manifest-reference) and the
[Add-on Capabilities page](https://developer.servicem8.com/docs/add-on-capabilities).

The smallest event-based addition to the current manifest is structurally:

```json
{
  "menuItems": [
    {
      "name": "RG Office Assistant",
      "type": "addon",
      "iconURL": "https://office-agent-ashy.vercel.app/icon.png",
      "event": "rg_office_assistant_menu"
    }
  ]
}
```

This is a research example, not a deployed ServiceM8 setting. The live v1 manifest schema is
available from ServiceM8 at
[`https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json`](https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json),
and ServiceM8 says its server-side validation still applies even when editor/schema validation
passes. See the [Manifest Reference](https://developer.servicem8.com/docs/manifest-reference).

The existing Job action can remain alongside the new `menuItems` entry. ServiceM8 says an add-on
may define multiple actions and multiple menu items; neither capability is mandatory. See the
[Manifest Reference](https://developer.servicem8.com/docs/manifest-reference).

## 2. Signed launch data and the no-Job boundary

For a Web Service Hosted Add-on, ServiceM8 sends an HTTPS `POST` whose body is an HS256-signed JWT;
the App Secret is the signing key, and the decoded data is the same Add-on SDK event object used by
ServiceM8-hosted functions. The callback's response is rendered inside the ServiceM8 UI in an
iframe. See [Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons).

The common event-data table documents these relevant fields:

- `eventVersion`;
- `eventName`;
- `auth.accountUUID`, the account that generated the event; and
- `auth.staffUUID`, the staff member who generated the event.

It does **not** document a staff name in the signed event. See
[Event Data](https://developer.servicem8.com/docs/sample-event-data).

The same page documents `eventArgs.jobUUID` only for a button launched from a Job Card and
`eventArgs.companyUUID` only for a button launched from a Client Card. It does not publish an
`eventArgs` table or example for a global menu-item launch. Therefore:

- the menu handler must be separate from the current Job-action schema;
- it must not require, synthesize, or infer a Job UUID; and
- the exact menu-item `eventArgs` shape is **REQUIRES LIVE SERVICEM8 UI TEST**.

For the smallest fail-closed local proof, it is reasonable to test an expected menu event with the
common signed fields and an empty `eventArgs` object, while treating that object as a provisional
test fixture rather than a documented ServiceM8 guarantee. A live launch containing a different
shape should be rejected without data access, then the observed non-sensitive shape can be reviewed
before deliberately updating the validator.

The existing callback-freshness stop remains applicable. ServiceM8's published hosted-callback
contract establishes signature/origin but does not add a menu-specific freshness or replay
guarantee. The global proof must preserve the existing `428` stop and make no ServiceM8 API request
when usable freshness claims are absent. See
[Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons) and
[Event Data](https://developer.servicem8.com/docs/sample-event-data).

## 3. Named greeting and `read_staff`

The signed event provides `auth.staffUUID`, not a name. ServiceM8's Staff API is the documented
source for the staff member's `first` and `last` fields:

```text
GET https://api.servicem8.com/api_1.0/staff/{uuid}.json
```

The endpoint requires the `read_staff` OAuth scope. See
[Retrieve a Staff Member](https://developer.servicem8.com/reference/getstaffmembers) and the
[Authentication scope table](https://developer.servicem8.com/docs/authentication).

Accordingly, the exact greeting `Hi, [Staff Name]—anything I can help with?` is not available from
the documented signed event alone. It requires all of the following:

1. add `read_staff` to the requested OAuth permissions;
2. obtain an OAuth grant/access token that actually includes that additional scope;
3. use the signed `auth.staffUUID` as the staff record identifier; and
4. perform the Staff request only after the launch has passed the existing security gate.

ServiceM8 documents incremental OAuth authorisation: an app may request additional scopes later,
and the user consents to those permissions. It also states that Web Service Hosted Add-ons must
implement OAuth2 and that their callback event does not receive the Simple Function-only temporary
access token. See [Authentication](https://developer.servicem8.com/docs/authentication),
[Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons), and
[Event Data](https://developer.servicem8.com/docs/sample-event-data).

Therefore a real named greeting needs an explicitly approved scope/authentication change and live
authorisation. Adding `read_staff` text to a local manifest does not by itself prove that the
currently stored Royal Glass OAuth grant contains that scope.

The initial local proof used a clearly labelled generic greeting. On 12 October 2026 the user then
explicitly authorised `read_staff` locally and in Vercel and authorised implementation of the named
greeting. The implementation may therefore retrieve only the signed staff UUID after the existing
freshness and account-binding gates. The fail-closed freshness behaviour must not be bypassed merely
to retrieve a name.

## 4. Page lifetime and exit behaviour

ServiceM8 describes menu items as giving the add-on a "complete canvas" inside the ServiceM8 user
experience. A hosted callback response is rendered in an iframe and may include the Client JS SDK.
Those statements support an interactive page while it remains rendered; they do not establish
conversation persistence after navigation. See
[Add-on Capabilities](https://developer.servicem8.com/docs/add-on-capabilities) and
[Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons).

ServiceM8's detailed Client JS SDK contract limits `client.closeWindow()` to an event launched in a
**popup window**, giving Job and Client actions as examples. It does not say that the method closes
or leaves a full-page menu-item launch. See
[Client JS SDK: Closing Windows](https://developer.servicem8.com/docs/client-api#closing-windows).

Consequences for the proof:

- do not describe a custom Close button using `client.closeWindow()` as supported for this launch;
- do not use `window.close()`, `history.back()`, parent-frame manipulation, or an invented
  ServiceM8 destination as if ServiceM8 documents it;
- provide clear on-page wording that staff can leave using the surrounding ServiceM8 navigation;
  and
- **REQUIRES LIVE SERVICEM8 UI TEST:** confirm that the normal ServiceM8 navigation remains visible
  and usable, identify the actual supported path out, and only then decide whether a custom
  `Leave assistant` control can invoke a documented/supported mechanism.

If the surrounding navigation is not available or not clear in the real launch, the exit part of
the requested proof is not complete; a locally rendered button is not substitute evidence.

## 5. Minimum local proof contract

The smallest safe proof can establish locally that:

1. the manifest has a distinct web `menuItems` entry and still validates against ServiceM8's v1
   manifest schema;
2. a separately named menu event is accepted without a Job UUID;
3. a Job-action event still requires its Job UUID;
4. neither event path makes a ServiceM8 API request when verified freshness is unavailable;
5. the menu response renders a complete escaped HTML page with a clearly labelled generic
   first-stage greeting;
6. text entry and deterministic, local-only chatbot-shell interactions remain usable on that page;
7. the page explicitly says that no AI, Job Diary data, cross-page persistence, or named-staff lookup
   is active; and
8. the page tells staff to use ServiceM8 navigation to leave, pending the live exit test.

No Job, Customer, Job Note, Diary, or Staff API read is needed for that local proof.

## 6. Required live ServiceM8 UI test

After an authorised manifest/configuration update and deployment, test all of the following in the
ServiceM8 web platform:

| Test | Evidence required |
| --- | --- |
| Menu placement | `RG Office Assistant` appears under the global **Add-ons** menu and launches without opening a Job Card. |
| Signed event shape | Record only field names/types and redacted identifiers from the verified event; confirm `eventName`, common auth fields, actual `eventArgs`, and any usable temporal claims. Never record the JWT or tokens. |
| No invented Job context | Launch succeeds without a Job UUID and no Job API call occurs. |
| Freshness fail-closed | If the real event still lacks usable freshness claims, the callback returns the existing `428` response and performs no OAuth lookup or ServiceM8 data access. |
| Rendering and interaction | The response renders in the actual full-page ServiceM8 surface; text input/button interactions continue working while the page stays open. |
| Exit | Confirm exactly which surrounding ServiceM8 navigation control leaves the page. Separately test `client.closeWindow()` only as an experiment; do not ship or claim it unless it succeeds and ServiceM8 confirms support for menu pages. |
| Navigation away and return | Confirm the proof makes no persistence promise: content may reset after leaving/reopening and must not be described as persistent. |
| Named greeting, later approved stage | After `read_staff` and reauthorisation are explicitly approved, confirm the access token includes `read_staff`, retrieve only the signed staff UUID, render the correct first name, and verify denial/error paths remain fail-closed. |

The local implementation now includes the named greeting, but the named greeting, global entry
point, and exit behaviour are not proven until the real ServiceM8 tests above pass with a grant that
actually contains `read_staff`.

## Sources reviewed

All sources were accessed on 12 October 2026:

1. ServiceM8, [Manifest Reference](https://developer.servicem8.com/docs/manifest-reference).
2. ServiceM8, [Add-on Capabilities](https://developer.servicem8.com/docs/add-on-capabilities).
3. ServiceM8, [Web Service Hosted Add-ons](https://developer.servicem8.com/docs/web-service-hosted-add-ons).
4. ServiceM8, [Event Data](https://developer.servicem8.com/docs/sample-event-data).
5. ServiceM8, [Client JS SDK](https://developer.servicem8.com/docs/client-api).
6. ServiceM8, [Authentication](https://developer.servicem8.com/docs/authentication).
7. ServiceM8, [Retrieve a Staff Member](https://developer.servicem8.com/reference/getstaffmembers).
8. ServiceM8, [List all Staff Members](https://developer.servicem8.com/reference/liststaffmembers).
9. ServiceM8, [Add-on manifest v1 JSON Schema](https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json).
