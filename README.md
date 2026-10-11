# RG Office Assistant

Phase 0 read-only feasibility spike for ServiceM8. It contains the existing staff-permission-aware
Job action plus a local-only chatbot interface proof launched from the global web Add-ons menu. The
menu launch resolves the signed staff member's first name through the read-only Staff API. It does
not contain AI, a ServiceM8 write path, Job Diary access, or cross-page chat persistence.

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

The live two-staff permission proof and modal test are intentionally not automated against a real
Royal Glass account. Follow [the Phase 0 runbook](docs/phase-0-runbook.md) and record redacted
evidence before treating the spike as a GO.
