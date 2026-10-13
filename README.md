# RG Office Assistant

Read-only ServiceM8 Office Assistant proof. A fresh, one-time global Add-ons-menu launch binds a
short-lived server session to the signed staff identity. Staff can search only the five approved
test Job cards by address or Job number and ask “What happened?”. The answer uses bounded core
Job/customer fields and Job notes. OpenAI selects up to three authorised evidence references; the
server builds the visible summary and dated evidence timeline directly from those records. Email,
SMS, forms, attachments, schedule activity, writes, and outbound messages remain excluded.

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
