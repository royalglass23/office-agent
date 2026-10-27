<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project reference and continuity

Before planning or changing Office Agent behaviour, read
[`docs/workflow-reference/README.md`](docs/workflow-reference/README.md).
It indexes the saved workflows, research, policy questions and dated verification reports.

- Treat historical patterns and architecture proposals as candidates until their approval is recorded.
- Check the newest applicable audit and current code before claiming a capability is available.
  Local tests, account-key reads, staff OAuth access and deployed behaviour are separate evidence.
- Record new decisions and evidence in the indexed reference documents, including date, scope,
  source and approval status. Preserve older snapshots and identify what supersedes them.
- Reference documents do not grant permission for branches, commits, deployment or external writes.
