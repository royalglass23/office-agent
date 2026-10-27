# RG Office Assistant

## Project reference

Start with the [workflow, research and current evidence index](docs/workflow-reference/README.md)
for saved charts, history findings, unresolved policy decisions and the latest verification reports.
Read its current checkpoint before relying on older implementation descriptions below.

RG-380 currently blocks Job summaries, email drafts and recommendations while the full ServiceM8
Job Diary UI/API audit and per-Job completeness check are incomplete. The add-on can still open
and search for a Job. The description below documents the bounded proof behind that release gate;
it is not a claim that Job outputs are available now.

## Bounded staging Job slice

The local staging slice is disabled by default. On the exact
`https://office-agent-staging.vercel.app` origin, `STAGING_JOB_SLICE_ENABLED=true` with the
existing assistant proof controls makes the signed global Add-ons-menu launch show an exact Job
lookup and three read-only communication checks. The backend uses the signed staff/account session
and existing OAuth `ServiceM8Client`; it does not use the local account key. Every request checks
the parent Job before reading child records. Answers and editable drafts cite full REST
Email/SMS/Note sources and show the unverified Diary/call/file gaps. The global RG-380 Job-output
gate remains closed. There is no ServiceM8 write or send action.

This code has not been deployed or tested through a signed-in ServiceM8 staging launch. The known
“Invalid Response Received” launch must be diagnosed with the actual add-on registration/callback
and hosting configuration. Do not enable the flag or claim staging acceptance from local tests.

Bounded read-only ServiceM8 Office Assistant. A fresh, one-time global Add-ons-menu launch binds a
short-lived server session to the signed staff identity. In the initial Phase 1 conversation, staff
provide one exact Job number and ask “What happened?” or ask for an email draft. The answer uses
bounded core Job/customer fields and Job notes from the staff-selected Job. OpenAI selects authorised evidence references;
the server builds the visible summary and dated evidence timeline directly from those records.
After reviewing that result, staff can provide a purpose and create a review-only email draft from
the same bounded evidence. OpenAI selects relevant evidence IDs and server code constructs every
visible word of the draft. The assistant does not send or save it. Email history, SMS,
forms, attachments, schedule activity, persistent transcripts, writes, outbound messages, and
autonomous actions remain excluded. Natural-language address search is deferred.

## Local checks

```powershell
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` and provide a dedicated database and ServiceM8 public
application credentials. Review the migration target before applying the schemas:

```powershell
npm run db:migrate
npm run dev
```

The AI proof is disabled by default. Enable it only after verifying the configured OpenAI API
organisation's data controls, then set `ASSISTANT_PROOF_ENABLED=true`, `OPENAI_API_KEY`,
`OPENAI_MODEL`, and `OPENAI_DATA_CONTROLS_VERIFIED=true`. Enabling the code does not deploy it,
upload the updated ServiceM8 manifest, or constitute live evidence.

Follow [the Phase 0 runbook](docs/phase-0-runbook.md) and record redacted Michael/Carla evidence
before treating the production proof as successful.

## Company checks

Company Check is a **separately registered ServiceM8 web-service Add-on**. It has its own
[`manifest-company-check.json`](manifest-company-check.json), callback at
`/api/company-check/events`, menu event `rg_company_check_menu`, and App ID/Secret. Its activation
uses a separate OAuth flow with only the `vendor` scope to confirm the authorised ServiceM8
account. The callback discards that Add-on's access and refresh tokens after verification; it
never writes to the Office Assistant connection. The existing RG Office Assistant manifest and
menu do not launch Company Check.

The separate Add-on opens the hosted report in a new browser tab. The top-level tab lets the
short-lived, HTTP-only staff cookie work without depending on third-party iframe cookies.
The Add-on remains independent of the Job Diary gate. Staff search a construction company by name, select an
official Companies Register result when needed, and review a sourced report with NZBN, directors,
company-published decision contacts, public projects, photo source links, and exact-address
Homes.co.nz checks. Reports and property results are account-scoped PostgreSQL snapshots; a new
run creates a dated version, and staff can compare and print a saved report.

The feature is disabled by default. The deployment needs migration
[`0002_company_check.sql`](db/migrations/0002_company_check.sql), reviewed OpenAI data controls,
`COMPANY_CHECK_ENABLED=true`, the new Add-on's `CC_APP_ID` and `CC_APP_SECRET`, an approved
`NZBN_API_KEY`, `OPENAI_API_KEY`, and `OPENAI_RESEARCH_MODEL`.
Create a separate ServiceM8 web-service Add-on registration with manifest URL
`https://<APP_BASE_URL host>/api/company-check/manifest` and web-service callback URL
`https://<APP_BASE_URL host>/api/company-check/events`. Set its Activation URL to
`https://<APP_BASE_URL host>/api/company-check/oauth/start` and its OAuth return URL to
`https://<APP_BASE_URL host>/api/company-check/oauth/callback`. Store its App Secret only in the host's
secret configuration. Do not reuse the RG Office Assistant App Secret. The separate registration
must be activated for the authorised ServiceM8 account before a live staff launch can be tested.
NZBN search and exact entity verification use the official NZBN API; obtain a subscription key
and validate against its sandbox before enabling the production flag. The Homes lookup uses
a PostgreSQL account-wide 12.5-second slot and a 30-day cache, separate from the ServiceM8
Check Address add-on. The automatic check runs only for a full address confirmed on the linked
company project page; an uncertain match never receives property facts.

The report links to source photos without embedding them in Office Agent until display rights are
confirmed. Director names from the register are company facts; a listed director is not
automatically the person authorised to decide on a project. The report is a staff research aid,
not a due-diligence clearance. The 12-month date marks review due; deletion remains an owner/admin
process to define before applying any retention action.
