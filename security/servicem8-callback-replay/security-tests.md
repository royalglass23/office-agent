# Security tests - ServiceM8 callback replay

## Executed locally on 13 October 2026

- Reviewed commit: `8d17c2bd404571a4a0929fdc2fe655ca8cc874c3`
- Environment: local Windows workspace; no production JWT or ServiceM8 data used

| Check | Result | Evidence |
| --- | --- | --- |
| Invalid signature stops before storage/API | PASS | `tests/servicem8/events-route.test.ts` |
| Unsupported algorithm/type, oversized token, and unsafe declared lifetime rejected | PASS | `tests/servicem8/verify-event.test.ts` |
| Menu `iat + jti` maximum age and future skew enforced | PASS | `tests/servicem8/verify-event.test.ts` |
| Menu without `jti`, including `iat + exp`, stops before OAuth/API | PASS | `tests/servicem8/events-route.test.ts` |
| Account-scoped menu replay identity | PASS | `tests/servicem8/verify-event.test.ts` |
| Exact replay rejected before API access | PASS | `tests/servicem8/events-route.test.ts` |
| Job event does not inherit menu-only policy | PASS | `tests/servicem8/verify-event.test.ts` |
| Schema diagnostics omit field values | PASS | `tests/servicem8/events-route.test.ts` |
| Full unit suite | PASS | `npm test`: 12 files, 78 tests |
| TypeScript | PASS | `npm run typecheck` |
| Full ESLint | PASS | `npm run lint` |
| Production build | PASS with environment warning | `npm run build`; native Windows SWC failed and Next.js WASM fallback completed successfully |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high`: zero vulnerabilities |
| Tracked secret/key file inventory | PASS | Only `.env.example` matched; no tracked `.env`, private key, or credential bundle |
| Test bypass marker scan | PASS | No `test.only`, `describe.only`, `it.only`, `skip`, or `todo` marker found |

These local results do not replace the blocked isolated E2E requirements in `e2e-matrix.md`.
