# History evidence register

De-identified source references used in the findings. No customer text or identities are reproduced.
Email dates are account-local (Pacific/Auckland). Knowledge dates are source edit dates, not policy effective dates.

Aliases are the prefix E (event), J (job), S (staff) or K (knowledge), followed by the first 16 hex
characters of SHA-256(source UUID). This is pseudonymisation for reference, not a new source ID.
A future authorised reader can re-read the permitted source, calculate the alias and compare its timestamp.
A staff alias on an email means the sender field; a note alias would mean the editor field.

| Evidence alias | Source | Source timestamp | Job alias | Staff alias |
| --- | --- | --- | --- | --- |
| E-1f3c23876b6f8172 | email | 2022-12-21 10:31:25 | J-dbfc785aec9f0110 | S-e3a4069bdc742c66 |
| E-20bdb2cb43a5a82a | email | 2026-10-14 08:00:41 | J-847ba4f3e827c10f | S-123ecae91a80d0c5 |
| E-218f490b82560b03 | email | 2026-10-22 11:49:18 | J-72b79fd2cd3611fa | S-123ecae91a80d0c5 |
| E-2c2541b4df42fa12 | email | 2025-12-17 13:17:54 | J-1abbb75ad5d95656 | S-826725e652325f44 |
| E-31ffca9aa34eddfe | email | 2026-10-05 13:21:09 | J-16b72110a4e8fe1a | S-e3a4069bdc742c66 |
| E-34d180580c235198 | email | 2026-10-20 13:27:41 | J-fc3a4e147d89694d | S-826725e652325f44 |
| E-6d37e22f85e62177 | email | 2026-10-20 17:01:25 | J-4e4d0f2610cb32e3 | S-826725e652325f44 |
| E-747e77bfd53f89c3 | email | 2026-10-21 13:18:49 | J-e4b9e4a445e4ca80 | S-c74d4b12250e049b |
| E-74e60929699c1cd4 | email | 2026-10-14 15:41:29 | J-b3362f8ec6e31baf | S-826725e652325f44 |
| E-a128b774a3d1733f | email | 2026-10-22 17:42:37 | J-3b193524ceb1c908 | S-e3a4069bdc742c66 |
| E-ab1d5d30f003185f | email | 2023-12-02 11:47:13 | J-cb0fcdd9b068fcb0 | S-e3a4069bdc742c66 |
| E-ae666496adc7a807 | email | 2026-10-23 12:49:15 | J-2cdec0f01874deaa | S-826725e652325f44 |
| E-b3d8132f573a6f47 | email | 2026-10-08 16:09:56 | J-b4fd7c93c7f94f84 | S-123ecae91a80d0c5 |
| E-b7a4141b18c3940a | email | 2026-10-21 11:26:51 | J-7eb4c4518717086e | S-e3a4069bdc742c66 |
| E-b89b1c3b1a8acb56 | email | 2026-10-20 16:01:41 | J-fc3a4e147d89694d | S-826725e652325f44 |
| E-d6914c3fc1641b00 | email | 2026-10-16 16:29:46 | J-0ff8a7c4033c66c3 | S-c74d4b12250e049b |
| K-286404d53e806bd4 | knowledge article | 2025-11-23 22:53:29 | — | — |
| K-735c266d0104721f | knowledge article | 2025-11-23 22:43:54 | — | — |
| K-77b2b84a247719d6 | knowledge article | 2025-11-24 11:57:03 | — | — |

## Knowledge status observed

| Alias | Identifiable internal article | Active / draft status |
| --- | --- | --- |
| K-39dae02e30c64026 | Minimum charge for our service | Active; is_draft=0 |
| K-9f2143b2ea2e0bd5 | Supply only job-- Minimum charge of 390+gst. | Active; is_draft=0 |
| K-77b2b84a247719d6 | Handling Shower Enquiry Inquiries (With VIP Path) | Active; is_draft=0 |
| K-286404d53e806bd4 | Shower Screen / Shower Enclosure knowledge | Active; is_draft=0 |
| K-735c266d0104721f | New Article (handover/process proposal) | Inactive; is_draft=0 |

Status was rechecked through the same read-only API during contextual review. An active/non-draft
flag is not evidence of policy approval, effective date or precedence when two articles conflict.
