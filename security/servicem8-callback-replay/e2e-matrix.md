# E2E matrix - ServiceM8 callback replay

| Requirement or threat | Actor and boundary | Journey or abuse case | Test | Expected result | Required |
| --- | --- | --- | --- | --- | --- |
| MENU-001 | Authorised Staff A -> ServiceM8 global Add-ons | Open the menu item without a Job card | Isolated staging browser test | Correct first-name greeting; no Job context; complete iframe response | yes |
| RPL-001 | Captured-token holder -> public callback | Submit the exact real staging callback twice | Isolated staging replay harness | Second use returns 409; no OAuth or ServiceM8 API call/data | yes |
| RPL-002 | Captured-token holder -> public callback | Replay a staging callback after five minutes and after replay retention | Isolated staging delayed-replay harness | Freshness rejection occurs before OAuth/API access | yes |
| RPL-003 | Internet caller -> public callback | Invalid signature, algorithm, type, size, or schema | `events-route.test.ts`, `verify-event.test.ts` | 401; no storage or API access | yes |
| RPL-006A | Restricted Staff B -> OAuth/API | Request a synthetic Job available only to Staff A | Dedicated Staff A/B staging fixtures | Denied; no Job/Company fields in response or logs | yes |
| RPL-006B | Account B -> Account A data | Submit a test event containing Account A's synthetic Job UUID under Account B | Two isolated staging accounts | Denied; no cross-account information disclosed | yes |
| SAFE-UI | Authorised Staff A -> ServiceM8 page | Submit local proof text, navigate away, and return | Isolated staging browser test | Local interaction works; content disappears; no network message submission | yes |

The local unit suite covers RPL-003 and the code seams supporting RPL-001/RPL-002. A user-observed production launch confirmed the happy path and reset-on-navigation behavior, but production manual evidence cannot satisfy this strict E2E gate. The required isolated environment, replay harness, Staff A/B fixtures, and second account are not provisioned.
