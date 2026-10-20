# RG-380 — staging MCP Diary probe

Prepared and deployed to staging on 20 October 2026. The live reads below are inventory results, not Diary parity results or release approval. The Job-answer gate remains closed.

## What the candidate does

- On the exact staging origin, a signed Office Agent session may start one probe for R260766, R260609, R260611 or R260445. The existing REST reader first verifies the same staff member's access to that exact Job. The user then sees ServiceM8's own MCP consent screen.
- The separate MCP OAuth request uses `mcp`, PKCE S256, an encrypted ten-minute state and a single-use callback marker. The callback holds the MCP token only in memory, calls `initialize`, `tools/list` and **only** `get_job_diary` for the checked Job UUID, and returns an item count plus redacted timestamp/type/preview-length metadata. It never calls an MCP write tool or stores the token, raw Diary text or file bytes.
- The returned status is `inventory_only`, with `staffBinding`, `fullContent` and `pagination` explicitly `unverified`. A count match does not clear RG-380. ServiceM8's MCP grant may permit tools beyond reading; the app code's read-only allowlist is narrower than the grant.

## Product outcome and minimum read requirement

The owner wants a plain-language summary of what happened across the full Job Diary: **one paragraph followed by short bullet points for the key events**. The product does not need to display an evidence matrix, raw event IDs, message bodies, or file bytes. IDs and comparisons in this audit are internal checks only, and a missing object UUID is not by itself a reason to reject a useful summary.

The summary still needs a complete, authorised sequence of Diary events and enough detail to describe material communications, calls, services, status changes, payments and attachments accurately. An attachment can be reported as added without downloading its bytes; describing its contents requires a separate authorised read. A preview may be sufficient for an individual event when it visibly contains the complete meaningful detail, but the current `content_preview` contract gives no guarantee that this holds for every event. The app must not silently omit or invent events when a page, source, or required detail is unavailable.

## Registration and deployment boundary

Unauthenticated ServiceM8 dynamic client registration returned HTTP 201 for the staging redirect `https://office-agent-staging.vercel.app/assistant/mcp/callback`. The public client ID is `c29c52b3-ce32-738b-bfe6-262456f137eb`. No client secret, access token, refresh token or Job data was printed or saved. The request registered only this client and redirect; it did not connect a ServiceM8 account or read a Job.

The approved candidate was committed and pushed on `dev`, and `SERVICEM8_MCP_CLIENT_ID` was set on the separate **staging** Vercel project. The form is available on the staging Office Assistant page. Do not add `mcp` to the existing REST manifest or `SERVICEM8_OAUTH_SCOPES`; this is a separate OAuth resource. Do not set the variable on production.

## Live R260609 result, 20 October 2026

The owner supplied the staging callback's redacted result for R260609: `status: inventory_only`, `toolAvailable: true`, and 18 entries. This proves that the staging consent and `get_job_diary` call completed for the parent Job that the REST precheck allowed. The count equals the earlier 18-item ServiceM8 UI inventory, but those observations were not contemporaneous and count agreement alone does not establish item parity.

The response contains 18 timestamps, four entries with an object UUID, and 14 without one. Three `dboNote` rows and one `JobStatusChange` row have object UUIDs; the other rows have a null or attachment object type and no object UUID. The apparent Service timestamp (`2026-09-08 13:28:33`) has neither an object type nor UUID. Several entries share `2026-09-08 13:28:32`, so timestamp alone cannot reliably match the Job Created row. Three previews are empty. The result omits titles and content, and explicitly reports `staffBinding`, `fullContent`, and `pagination` as `unverified`. No customer text, raw IDs, or tokens were saved here.

**Verdict:** MCP historic inventory is feasible in staging for this Job; full-Diary coverage remains unproved. Keep the Job-answer gate closed.

## Live R260611 result, 20 October 2026

The owner supplied a second staging callback result: `status: inventory_only`, `toolAvailable: true`, and 45 entries for R260611. The count matches the earlier 45-entry ServiceM8 Diary inventory, which included ten call-labelled entries and two status changes. The MCP metadata has four `dboNote` entries and two `JobStatusChange` entries with object UUIDs; 39 of 45 entries have no object UUID. The two status-change timestamps are `2026-09-14 10:32:41` and `2026-09-24 12:22:28`. The redacted result does not expose a call type or stable call ID, so it cannot prove that each of the ten calls is represented or supply its full content. Five previews are empty. `staffBinding`, `fullContent`, and `pagination` remain `unverified`.

**Verdict:** The staging MCP path returns the expected total and historic status-change metadata for this Job. It does not establish call-by-call or full-content parity. Keep the Job-answer gate closed.

## Summary-read decision, 20 October 2026

A separate read-only ServiceM8 connector check, using its own connection rather than the Office Agent staff OAuth session, returned the expected Diary title categories for both Jobs: R260609 had 18 entries including the Service and Job Created rows; R260611 had 45 entries including ten calls and two status changes. This strengthens the case that `get_job_diary` can supply a useful chronology. It does not prove that the staging staff's MCP grant has the same visibility.

The returned `content_preview` ends in an ellipsis for all seven R260609 Email/Customer Reply entries and for ten R260611 Email entries. Those previews cannot be treated as complete correspondence. The published tool result has no full-body, next-page, total-count, or current-staff field. The staging callback intentionally returns only metadata, so it cannot generate or validate the requested summary from its current output. No raw Diary text was saved in this audit.

**RG-380 audit outcome:** The read path is feasible for a dated event inventory but has not passed the minimum requirement for a reliable full-Diary summary. Treat the audit as a documented **NO-GO**, not as permission to open the Job-answer gate. Full email reads may be available through the already granted REST scope, but they do not establish MCP completeness, staff binding, or complete detail for every other event type. The desired paragraph-and-bullets renderer belongs to RG-381 after a complete authorised read path is established.

## Remaining live acceptance test

1. Establish whether MCP returns the complete event sequence and enough text or state for an accurate summary, including a trustworthy pagination or total contract. The present `get_job_diary` declaration exposes `content_preview` without a completeness guarantee. Use documented per-source REST reads only where an event needs more detail; do not require file bytes merely to say a file was added. More count-only probes cannot clear this gap.
2. Inspect an account/staff identity read from MCP if the tool list provides one; otherwise staff binding remains unverified. Test a Job that this staff member cannot access using a separately approved fixture; the probe must deny it. The current four-Job allowlist intentionally prevents arbitrary Job reads.
3. If a complete read path is established, capture fresh ServiceM8 UI inventories for R260609 and R260611 as the same staff member and reconcile every item by more than count and timestamp. Probe R260445 for the historic Quote Approved event and R260766 for the small case. If a Job changed since screenshots were taken, use a fresh UI count.

Passing the one-time probe is only a feasibility result. RG-380 requires an authorised, sufficiently complete Diary read, a representative same-staff UI comparison and denied-access check before the Job-answer gate can change. The user-facing outcome is a concise summary, not an evidence display.
