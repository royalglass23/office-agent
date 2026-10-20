---
status: accepted
---

# Save dated versions of opportunity reports

Phase 2 will show one-URL background and opportunity reports about construction-related companies in the Office Agent with a download option and save completed reports in PostgreSQL. All authorised Royal Glass Office Agent staff may reopen them. Rerunning a URL creates a new dated version, preserving earlier versions for comparison. Each version becomes due for keep-or-delete review after 12 months by the business owner or a designated admin. The renewal period and deletion workflow remain to be defined before retention actions are implemented.

The app currently uses PostgreSQL for OAuth and other security state only, so this decision requires new report tables, access controls and an environment-specific migration. A saved version is a snapshot of the sources checked at that time; it must show its checked date and must not imply the source facts are still current. The first design stores public photo links and attribution, not copied photo assets. The independent background-report release path does not require completion of the ServiceM8 Job Diary coverage gate.
