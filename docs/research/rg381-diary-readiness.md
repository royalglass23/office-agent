# RG-381: full Job Diary reader readiness

Checked 21 October 2026. This is a local contract review, not a new ServiceM8 Job read or a release pass. The Job-answer gate remains closed.

## Verified read boundary

- The [ServiceM8 MCP developer page](https://developer.servicem8.com/docs/mcp-server) links to the [ChatGPT/Claude connection guide](https://support.servicem8.com/help-center/tips-trick-more/more/how-to-connect-servicem8-to-chatgpt-with-mcp). Neither publishes an add-on staff-binding rule or a `get_job_diary` end-of-history contract.
- The available `get_job_diary` tool declaration accepts a Job UUID/number and returns `entries[]` with `content_preview`. It declares no cursor, next page, total count, full body or current-staff field. The connected ServiceM8 tool list has a staff **list**, but no current-user identity read. A staff list cannot prove who authorised the MCP token. This declaration is from the separate chat connector; the Office Assistant's staging `tools/list` response has not been retained as a contract artifact.
- The staging OAuth callback proved that an independently consented MCP token could call `get_job_diary` for two parent Jobs checked through staff-impersonated REST. It did not prove that the MCP grant belongs to the launching staff member or has the same access. The REST parent-Job check cannot establish MCP staff binding.
- R260609 and R260611 had matching historical inventory counts in the earlier probe, but the MCP response does not expose a reliable final-page or total-count condition. Repeating a count-only read cannot close this gap.
- All seven R260609 email/reply previews and ten R260611 email previews inspected through the separate connector ended in an ellipsis. A visible ellipsis is evidence that a preview is shortened. A preview without an ellipsis is **not** evidence that it contains all meaningful detail. The staging probe now reports `previewEndsInEllipsis` per entry, without returning preview text, and still reports staff binding, full content and pagination as `unverified`.

## REST enrichment boundary

The existing staff-impersonated REST audit reads paginated Job email metadata under `read_email`. ServiceM8 documents [Job email history](https://developer.servicem8.com/reference/listemailmessages) and [one email record](https://developer.servicem8.com/reference/getemailmessage). These are candidate sources for complete text **after** a Diary email row has been matched to exactly one authorised email record on the selected Job.

That identity match is not established. The MCP email rows in the fixtures have no object UUID, and timestamp alone can collide. Email REST detail may fill a matched preview, but it cannot prove the MCP sequence is complete, identify the MCP staff principal, or supply historic Service, call and status-change detail. Do not choose a REST email solely by timestamp or copy a full body into a summary from an ambiguous match. The current audit intentionally discards email bodies; it is not a summary reader.

## Required proof before implementing a live summary reader

1. Obtain a supported contract or same-staff staging evidence that binds the MCP grant to the Office Assistant launch staff and demonstrates a denied-access case. The approved Royal Glass Jobs are account-wide visible, so a denied case needs its own authorised fixture or a provider-supported identity/access proof.
2. Obtain a trustworthy complete-sequence condition: documented cursor exhaustion, a declared total, or another provider-supported end-of-history signal. Missing/failed pages and response limits must block the answer.
3. Establish per-event detail rules. Enrich shortened email previews through unique, same-Job REST identity matches; handle calls, Service and status changes with supported detail or explicitly stop if the available title/preview cannot support an accurate claim. Attachments may be described as added from metadata; their contents require a separate authorised read.
4. Reconcile the complete sequence and material detail against fresh same-staff ServiceM8 UI views for the approved fixtures, then seek owner review. Only then can RG-381 add a per-Job reader and the requested one-paragraph, short-bullets output behind the existing release gate.

**Current decision: BLOCKED for a full-Diary summary.** No supported complete, staff-bound read path has been established. Keep `isJobDiaryCoverageVerified()` false; no Job summary, draft or recommendation should use this inventory.
