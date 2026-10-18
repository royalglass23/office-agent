# RG Office Assistant

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

Copy `.env.example` to `.env.local` and provide a dedicated Phase 0 database and ServiceM8 public
application credentials. Apply the security-state schema before starting the application:

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
