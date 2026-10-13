# Data classification - ServiceM8 callback replay

> Historical audit record. See `scope-reconciliation.md` for the later bounded global-menu Phase 1
> decision; this file remains controlling for expansion beyond that scope.

| Data | Classification | At rest | In transit | Retention | Notes |
| --- | --- | --- | --- | --- | --- |
| Add-on App Secret | Secret | Vercel/local environment | Used server-side for HMAC verification | Secret-store lifecycle | Never log or persist in evidence. |
| Callback JWT | Secret/credential | Not stored raw | ServiceM8 to callback over HTTPS | Request lifetime only | Never copy into screenshots, chat, or evidence. |
| Menu replay identity | Confidential | SHA-256 hash in Postgres | Internal DB connection | JWT `exp`, otherwise ten minutes | Derived from account UUID and `jti`; the five-minute verifier window expires before the default row does. |
| Non-menu callback hash | Confidential | SHA-256 hash in Postgres | Internal DB connection | JWT `exp`, otherwise ten minutes | Claimless callbacks remain data-disabled. |
| OAuth access/refresh tokens | Secret | Encrypted in Postgres | HTTPS to ServiceM8 | Until disconnect/revocation | Refresh rotation is transactionally serialized. |
| Account/staff/Job UUIDs | Personal/internal identifiers | Callback payload; redacted logs | HTTPS | Request lifetime except non-reversible short log digests | Must not appear raw in public evidence. |
| Staff first name | Personal information | Not persisted by the callback | ServiceM8 API over HTTPS; rendered in iframe | Page lifetime | Fetched only for the signed staff UUID after the gate passes. |
| Job and Company data | Personal/confidential | Not persisted | ServiceM8 API over HTTPS | Response lifetime | Enabled only inside the bounded global-menu slice in `scope-reconciliation.md`; broader use remains disabled pending applicable E2E evidence. |
| Phase 0 test message | Potentially personal | Browser DOM only | None | Lost on refresh/navigation | No AI or server submission is implemented. |
