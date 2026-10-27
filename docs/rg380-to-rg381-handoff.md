# RG-380 to RG-381: full Job Diary summary handoff

Prepared 20 October 2026 for a new local `office-agent` task. Read this with [RG-380 coverage](audits/RG-380-job-diary-coverage.md), [the staging MCP probe](audits/RG-380-mcp-staging-probe.md), and [the read-path research](research/rg380-historic-diary-read-paths.md). Repository branch: `dev`. RG-380's NO-GO audit conclusion was pushed in `fda8d25`; the Job-answer gate in `lib/servicem8/job-diary-gate.ts` remains closed.

## User outcome

Give staff **one plain-language paragraph and short bullet points** explaining what happened across the selected Job's full ServiceM8 Diary. The product does not need to show a source matrix, raw event IDs, full message bodies, or file bytes. Mention an attachment as added without reading its bytes; read it only before making a claim about its contents. Do not silently present a partial Diary as complete. Job summaries, drafts and recommendations stay closed until the authorised read is sufficiently complete.

## Established evidence

- Owner-approved read-only Jobs: R260766, R260609, R260611 and R260445. The owner is the reviewer. Do not change any ServiceM8 Job. The owner declined a public developer-community post.
- The staging Office Assistant's separate MCP consent and `get_job_diary` call worked for R260609 and R260611. The callback reported `inventory_only` with 18 and 45 entries respectively, matching earlier UI totals. `staffBinding`, `fullContent` and `pagination` all remain `unverified`.
- A *separate connector*, not the Office Assistant staff OAuth session, showed the expected title categories: R260609 includes Service and Job Created; R260611 includes ten calls and two status changes. All seven R260609 email/reply previews and ten R260611 email previews ended in an ellipsis. The MCP tool's declared entry field is `content_preview`; no full-body, total-count, cursor, or current-staff field is declared.
- The existing ten-scope REST audit can read Notes, Email, Activities, Attachments, SMS and Payments. REST email detail is a candidate for filling truncated email text. These source inventories do not establish a complete Diary sequence or historic Service, call and status-change content. Count-only probes will not resolve this.
- The Office Assistant currently returns only redacted MCP metadata and does not save MCP tokens or Diary content. The separately connected ServiceM8 chat token must not be reused in the app. Production MCP is not configured. Linear was unavailable due to connector reauthentication when RG-380 was concluded.

## Next work

1. Resolve the read-path contract before enabling output: determine whether the Office Assistant's MCP grant can be tied to the launching staff identity and whether `get_job_diary` has a reliable end-of-history/completeness condition. Inspect the actual tool declaration and supported read-only identity calls; do not infer staff binding from the REST parent-Job check alone.
2. Determine which event previews lack meaningful detail. Use the already granted, staff-impersonated REST sources to enrich truncated emails and other supported types only after matching the selected Job. Keep raw customer content out of Git and logs. If MCP cannot establish completeness or staff access, document the precise unsupported path and leave the gate closed.
3. If a viable source set exists, build a per-Job fail-closed reader and summary renderer: one paragraph, short key-event bullets, no evidence display. Add focused tests for omitted/failed pages, truncated content, denied Job/staff, duplicate events and unsupported event types. Then use approved Jobs for a same-staff staging UI comparison and owner review before considering a release pass.

## Boundaries for the new task

Read `AGENTS.md` and the relevant Next.js guide in `node_modules/next/dist/docs/` before code changes. Do not create a branch/worktree, commit, push, deploy, expand OAuth scopes, write to ServiceM8, or close Linear without the applicable explicit authority. Preserve unrelated worktree changes. Treat RG-380 as an audit completed with a **NO-GO release verdict**; RG-381 remains blocked on the complete authorised read path. Do not ask the owner to run more count-only tests.
