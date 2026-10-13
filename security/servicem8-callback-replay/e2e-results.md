# E2E results - ServiceM8 callback replay

> Historical strict-E2E result. The `BLOCKED` verdict remains unchanged; its current product-scope
> effect is reconciled in `scope-reconciliation.md`.

- Reviewed commit: `8d17c2bd404571a4a0929fdc2fe655ca8cc874c3`
- Environment: `office-agent-staging.vercel.app` is reachable, but an isolated ServiceM8 tenant is not provisioned
- Command: not run
- Required matrix rows: 7
- Executed browser/live replay tests: 0
- Evidence validator: exit 1; required environment, command, fixture, hash, project, and report fields are absent
- Verdict: **BLOCKED**

The staging Vercel project returned `200` for `/health` and `/api/servicem8/manifest`. A browser-observed OAuth attempt on 13 October 2026 reached token exchange, then failed closed before connection persistence when ServiceM8 returned HTTP `402` for `GET /api_1.0/vendor.json`. ServiceM8 documents `402` as an account-not-in-good-standing response. No response body, OAuth code, state, access token, or account identifier is retained here.

That attempt used the live Royal Glass ServiceM8 tenant, so it is excluded from strict E2E evidence. No authorised isolated ServiceM8 tenant, replay harness, dedicated Staff A/B fixtures, or second-account fixture is available. Production JWT replay was not authorised or attempted.

A user-observed production launch confirmed the named greeting, local page interaction, and reset after navigation. This is useful product evidence but is deliberately excluded from strict E2E PASS evidence because it targeted production, used no controlled fixtures, and retained no trace/report.

On 13 October 2026, a separately authorised production diagnostic used Michael and an existing
synthetic Job. Production OAuth account binding completed successfully and ServiceM8 rendered the
Job Action modal, but the authentic signed event contained no usable freshness or uniqueness
claims. The application stopped before OAuth lookup or any ServiceM8 API data request. Carla was
not invoked because the same pre-authorization gate prevents a meaningful Staff B result. No
identifiers, tokens, Job content, Company content, or personal information are retained in this
evidence. This production observation remains excluded from strict E2E PASS evidence.
