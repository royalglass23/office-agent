# RG-380 — staging MCP Diary probe

Prepared 20 October 2026. This is an **uncommitted local candidate**, not a live Diary parity result or release approval. The Job-answer gate remains closed.

## What the candidate does

- On the exact staging origin, a signed Office Agent session may start one probe for R260766, R260609, R260611 or R260445. The existing REST reader first verifies the same staff member's access to that exact Job. The user then sees ServiceM8's own MCP consent screen.
- The separate MCP OAuth request uses `mcp`, PKCE S256, an encrypted ten-minute state and a single-use callback marker. The callback holds the MCP token only in memory, calls `initialize`, `tools/list` and **only** `get_job_diary` for the checked Job UUID, and returns an item count plus redacted timestamp/type/preview-length metadata. It never calls an MCP write tool or stores the token, raw Diary text or file bytes.
- The returned status is `inventory_only`, with `staffBinding`, `fullContent` and `pagination` explicitly `unverified`. A count match does not clear RG-380. ServiceM8's MCP grant may permit tools beyond reading; the app code's read-only allowlist is narrower than the grant.

## Registration and deployment boundary

Unauthenticated ServiceM8 dynamic client registration returned HTTP 201 for the staging redirect `https://office-agent-staging.vercel.app/assistant/mcp/callback`. The public client ID is `c29c52b3-ce32-738b-bfe6-262456f137eb`. No client secret, access token, refresh token or Job data was printed or saved. The request registered only this client and redirect; it did not connect a ServiceM8 account or read a Job.

After a separately approved scoped commit/push, set `SERVICEM8_MCP_CLIENT_ID` to that ID for the **staging** deployment only and redeploy staging. Do not add `mcp` to the existing REST manifest or `SERVICEM8_OAUTH_SCOPES`; this is a separate OAuth resource. Do not set the variable on production. The new form appears on the staging Office Assistant page only when the variable is set.

## Live acceptance test still required

1. Open the staging Office Assistant as Michael, choose R260609, and use **Check Diary read**. Review the ServiceM8 consent screen's actual permissions before accepting. If they are broader than acceptable for the test, stop and record that result.
2. Save the redacted JSON result. Confirm the Job number, entry count and every entry timestamp/type against the same staff's current ServiceM8 Diary view. Repeat for R260611 and R260445 to exercise calls and a historic status change, and R260766 for the small case. If a Job changed since screenshots were taken, use a fresh UI count.
3. Inspect an account/staff identity read from MCP if the tool list provides one; otherwise staff binding remains unverified. Test a Job that this staff member cannot access using a separately approved fixture; the probe must deny it. The current four-Job allowlist intentionally prevents arbitrary Job reads.
4. Determine whether MCP supplies **complete** content and file bytes for every entry and a trustworthy pagination/total contract. The present `get_job_diary` declaration exposes `content_preview`, not a full-body or file field. If those are absent, combine only documented per-source REST full reads after exact item matching; keep missing rows blocked.

Passing the one-time probe is only a feasibility result. RG-380 requires same-staff item-level UI/API parity, full content and denied-access evidence before the Job-answer gate can change.
