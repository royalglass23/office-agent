# RG Office Agent — Assistant Architecture Handoff

Status: **Planning only — no implementation authority**
Repository: `D:\Royal Glass Dev\office-agent`
Branch observed: `dev`
Prepared: 21 October 2026

For the saved files and newer evidence, start with the
[project reference index](workflow-reference/README.md). This handoff preserves the architecture
discussion from 21 October; it is not the latest verification status.

## Purpose

This handoff captures the current product and architecture direction for RG Office Agent so a new
session can continue the discussion without rebuilding the context. It does not authorise code
changes, database migrations, new OAuth scopes, ServiceM8 writes, deployment, commit, push, ticket
closeout, or movement to another task, stage, or phase.

## Product definition

RG Office Agent is intended to be a personal assistant for the staff member currently logged into
ServiceM8. Its purpose is to improve staff efficiency through one natural conversation rather than
a collection of separate screens and coded workflows.

The assistant should:

1. greet the verified logged-in staff member by name;
2. show all Job cards assigned to or coordinated by that staff member that need attention;
3. prioritise those Jobs from critical to least urgent and explain the evidence for each priority;
4. ask what the staff member needs;
5. initially help with email drafting, Job summarisation, and recommendations; and
6. later gain quotation, scheduling, invoicing, booking, BC Check, Company Check, and other
   capabilities by adding approved tools rather than rebuilding the assistant.

## Core design decision

The product should be designed as:

```text
One conversational assistant
+ verified ServiceM8 staff identity
+ a small catalogue of ServiceM8 tools
+ personal and company memory
+ approval controls
```

It should not be designed as a separate coded feature, route, or interface for every action such as
summarising, drafting, recommending, quoting, or scheduling.

OpenAI is the reasoning and conversation layer. Application code is the trusted boundary that
authenticates the user, exposes narrowly scoped tools, validates results, protects customer data,
and enforces approvals.

## Recommended deployment shape

Use a **ServiceM8 Web Service Hosted Add-on**. ServiceM8 is the doorway and staff-facing surface;
the RG Office Agent backend, OpenAI calls, tools, memory, and database run in Royal Glass-controlled
hosted infrastructure.

```text
ServiceM8 Add-on menu
        |
        | signed launch containing account and staff identity
        v
RG Office Agent backend
        |
        +-- staff session and authorisation boundary
        +-- OpenAI conversational agent
        +-- read/write approval policy
        +-- managed PostgreSQL
        |
        v
Allowlisted ServiceM8 tools
```

The Web Service Hosted Add-on is preferred over a ServiceM8 Simple Function because the assistant
needs a continuing conversation, database access, memory processing, and room for future tools.

## Initial tool-first assistant

The smallest useful read-only tool catalogue is:

### `get_my_work_queue()`

Returns the verified staff member and all Jobs assigned to or coordinated by them, together with
objective attention signals such as status, stage, booking or due dates, an unanswered customer
message, missing information, an approaching commitment, or an operational blocker.

### `get_job(job_number)`

Returns the authorised core record for one deliberately selected Job.

### `get_job_diary(job_number)`

Returns the complete authorised Diary for the selected Job, including enough identity, content,
pagination, and completeness evidence to support a reliable answer.

Email drafting, summarisation, and recommendations are model capabilities using this evidence.
They do not require separate ServiceM8 tools or separate product modules.

## Proposed opening experience

An example opening interaction is:

> Good morning, Michael. You have 12 assigned Jobs. Two need urgent attention, four should be
> reviewed today, and six have no immediate issue. What would you like help with?

The attention list should show the Job, priority, concise reason, and evidence. The model must not
invent the meaning of `critical`. Royal Glass needs a small approved priority policy with objective
signals. Hard priority boundaries should be deterministic; OpenAI may explain the result and make a
contextual recommendation.

A possible starting vocabulary is:

- **Critical:** safety issue, legal or BC deadline, imminent work blocked, or urgent customer
  escalation.
- **High:** customer awaiting a response, overdue follow-up, booking conflict, or missing
  information blocking progress.
- **Medium:** quote or approval waiting, or upcoming work needing preparation.
- **Normal:** active Job with no detected blocker.
- **Monitor:** no immediate action, but keep visible.

This rubric remains a proposal and needs owner and staff review against real Royal Glass Jobs.

## Brain and memory

The OpenAI model is the assistant's brain, but it does not automatically retrain itself from each
conversation. The assistant becomes more useful through a deliberate memory layer around the
model.

Use four memory scopes:

1. **Conversation memory** — temporary context for the current chat and selected Job.
2. **Personal staff memory** — confirmed durable preferences such as tone, summary detail, and
   prioritisation preferences, isolated by account and staff identity.
3. **Royal Glass company memory** — approved shared rules, terminology, workflows, and escalation
   policy, with versioning and controlled approval.
4. **Outcome memory** — concise confirmed outcomes or corrections that improve future help without
   copying ServiceM8 history.

Current user instructions must override session context, and session context must override older
memory. Memories are advisory, inspectable, editable, and forgettable. A staff member should be able
to ask what the assistant remembers and instruct it to forget or limit a preference to the current
session.

Initially, long-term memory should be confirmation-based. The assistant may identify a candidate
preference or correction, but it should ask whether to save it and whether it is personal or a
proposed Royal Glass-wide rule. A personal preference must never silently become company policy.

Do not store secrets, OAuth tokens as memory, complete customer conversations, unnecessary personal
information, temporary ServiceM8 status, model guesses, or instruction-shaped content copied from
Diary records.

## Database direction

Use a managed, standard PostgreSQL database from the beginning. The repository already uses
PostgreSQL through `pg`, `DATABASE_URL`, migrations, UUIDs, indexes, constraints, and JSONB. The
database engine does not need to change; the next architecture work is to define the assistant's
bounded schema and lifecycle.

The provider should support:

- standard PostgreSQL portability;
- connection pooling suitable for serverless hosting;
- encryption in transit and at rest;
- automated backups and point-in-time recovery;
- separate staging and production databases;
- a region suitable for New Zealand users;
- monitoring for storage, connections, and slow queries; and
- `pgvector` availability if semantic retrieval is justified later.

Do not introduce a separate vector database initially. PostgreSQL structured fields, JSONB, normal
indexes, and full-text search should be used first. `pgvector` is an optional later extension, not a
requirement for the initial memory system.

Proposed logical data areas are:

```text
accounts
staff_profiles
staff_memories
company_knowledge
conversations
tool_audit_events
oauth_connections
```

Every tenant-owned record must be scoped by ServiceM8 `account_uuid`; every staff-owned record must
also be scoped by `staff_uuid`.

## Managing data growth

ServiceM8 remains the source of truth for Jobs, Diary, quotes, bookings, schedules, invoices,
attachments, and customer operational data. RG Office Agent should read that information on demand
instead of becoming a second copy of ServiceM8.

Manage growth through the following lifecycle:

```text
Live ServiceM8 data -> use for current task -> discard or short cache
Conversation turns -> compact -> retain only active state
Candidate preference -> confirm -> deduplicate -> store compact memory
Superseded or expired memory -> archive metadata if required -> delete content
```

Rules for bounded growth:

- compact long conversations rather than replaying every message and tool result;
- load only the few memories relevant to the current request;
- update structured preferences instead of appending near-duplicate notes;
- assign expiry dates to temporary memories and inactive conversations;
- retain audit metadata without copying unnecessary customer content;
- provide user-facing view, edit, and forget controls;
- run scheduled cleanup for expired sessions, caches, memories, and replay records; and
- review retention periods as an explicit privacy decision before implementation.

Candidate retention periods discussed in planning, but not yet approved, were short-lived Job
caches, raw conversations retained only briefly before deletion or compaction, durable confirmed
staff preferences retained until changed or deleted, and versioned company rules retained until
superseded.

## Later capability growth

Keep the same assistant and add capabilities as allowlisted tools:

```text
Read tools -- may run automatically after authorisation
  get_my_work_queue
  get_job
  get_job_diary
  check_company
  check_bc_requirements

Preparation tools -- produce a reviewable draft
  prepare_quote
  prepare_booking
  prepare_schedule_change
  prepare_invoice

Write tools -- require explicit confirmation and separate approval policy
  create_quote
  update_booking
  send_email
  issue_invoice
  update_job
```

Adding a tool does not itself grant authority to call it. Each new data source, OAuth scope, write
operation, or external destination needs its own acceptance evidence and explicit owner approval.

## Current blocking gate

The current full Job Diary gate remains closed. `RG-380` recorded a **NO-GO** because complete
same-staff Diary coverage, full content, pagination, and UI/API parity have not been proved. The
current application intentionally blocks Job-derived summaries, drafts, recommendations, and other
outputs while this gate is closed.

The MCP Diary tool has supplied useful inventory evidence, but it has not proved complete content,
pagination, same-staff binding, file access, or a stable completeness contract. Do not treat matching
counts or labels as clearance.

The next implementation dependency remains the authorised full-Diary read path under `RG-381`.
This architecture discussion does not authorise implementing it or advancing beyond it.

## Anti-drift gates

Do not move to the next task, phase, or stage merely because planning is complete or a local test is
green. Every transition requires both the named evidence gate and explicit user authorisation.

1. **Architecture gate:** owner approves the assistant, tool, memory, and database boundaries.
2. **Diary evidence gate:** complete same-staff Diary retrieval and UI/API parity pass for the
   authorised fixtures and roles.
3. **Attention-queue gate:** `get_my_work_queue()` matches staff-visible assignments and the approved
   Royal Glass priority rubric on representative Jobs.
4. **Read-only assistant gate:** greeting, queue, Job selection, summary, draft, recommendation,
   citations, isolation, memory controls, and failure paths pass in the isolated environment.
5. **Write-capability gate:** each proposed write tool receives separate scope, approval UX,
   security evidence, and owner authorisation.
6. **Production gate:** deployment, production data changes, OAuth consent, and staff rollout remain
   separate explicit decisions.

A failed or incomplete gate stops the workflow. It does not automatically start remediation or
permit work on the next gate.

## Decisions still open

- Exact managed PostgreSQL provider and deployment region.
- Approved Royal Glass attention-priority rubric.
- Precise definition of “named to” or “coordinated by” for a staff member's Job queue.
- Final retention periods for conversations, memories, audit metadata, and caches.
- Whether all durable memories require confirmation or whether a later low-risk automatic policy is
  acceptable.
- Whether to use the OpenAI Responses tool loop, Agents API, or Agents SDK after the ServiceM8 data
  boundary is proved.
- Whether a ServiceM8-hosted MCP path can ever satisfy same-staff, complete-Diary requirements or
  whether the existing REST/OAuth adapter remains the trusted tool implementation.
- Web and mobile presentation details inside the ServiceM8 Add-on surfaces.

## Repository state at handoff creation

The repository was on `dev`, tracking `origin/dev`. Existing RG-381 work was already present and was
not modified by this planning handoff:

- modified `lib/servicem8/mcp-diary-probe.ts`;
- modified `tests/servicem8/mcp-diary-probe.test.ts`;
- untracked `docs/research/rg381-diary-readiness.md`; and
- untracked `docs/rg380-to-rg381-handoff.md`.

This handoff is a new documentation file only. No tests were required for the documentation-only
addition. Nothing was committed, pushed, deployed, migrated, or changed in ServiceM8, OpenAI, the
database, or Linear.

## Suggested next-session instruction

> Read `docs/office-agent-architecture-handoff.md` and the existing RG-380/RG-381 evidence. Continue
> the architecture discussion from the first unresolved decision. Do not implement, migrate, change
> OAuth scopes, deploy, commit, push, or advance a gate unless I explicitly authorise that action.
