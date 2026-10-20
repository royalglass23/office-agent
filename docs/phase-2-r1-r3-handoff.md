# Office Agent Phase 2 — R1–R3 handoff

Status: Brainstorming handoff as of 19 October 2026<br>
Prepared: 19 October 2026 (Pacific/Auckland)<br>
Workspace: `D:\Royal Glass Dev\office-agent`<br>
Linear project: [Office Agent](https://linear.app/royalglass/project/office-agent-062f321ba811/overview)<br>
Parent PRD: [RG-375](https://linear.app/royalglass/issue/RG-375/rg-office-assistant-phase-2-prd)

## Purpose and place in Phase 2

Royal Glass wants one URL to start a **construction-company** background and opportunity report. The URL may be a company website or a construction project page. The report should help staff decide whether a collaboration is worth exploring, what work Royal Glass might do together with that company, what might cause difficulty, and what to verify next. A person is not the report subject; director names are company-register facts only. Property information is included when the URL identifies a relevant project or site, and is not required for a company-only report.

The owner first prioritised goal-led email drafting ([RG-376](https://linear.app/royalglass/issue/RG-376/01-goal-led-email-drafting-after-full-job-diary)), then R1, R2 and R3. On 20 October 2026 the owner withdrew the earlier bounded-email exception: the current email draft and all other Job-based outputs need the full Job Diary read first. Email therefore depends on the Diary audit and reader even though it remains the first desired Job outcome. R1–R3 remain independent of the ServiceM8 Diary coverage gate and may proceed while email waits. These are planned tickets, not completed functionality.

## Agreed ticket sequence

| Slice | Existing Linear issue | Dependency | Intended result |
| --- | --- | --- | --- |
| R1 | [RG-377 — One-URL company match and sourced background report](https://linear.app/royalglass/issue/RG-377/02-one-url-company-match-and-sourced-background-report) | None | Staff enter a URL, confirm an ambiguous legal entity, and inspect a first sourced company report with initial fit, friction and gaps. |
| R2 | [RG-378 — Project property, photo evidence and collaboration recommendations](https://linear.app/royalglass/issue/RG-378/03-project-property-photo-evidence-and-collaboration-recommendations) | R1 | Add relevant project/site context, individually attributed photo references and more specific balustrade, pool-fencing and swimming-pool opportunities. |
| R3 | [RG-379 — Save, compare and download dated report versions](https://linear.app/royalglass/issue/RG-379/04-save-compare-and-download-dated-report-versions) | R2 | Save immutable dated versions, reopen and compare them, download a report, and mark versions for owner/admin retention review at 12 months. |

The owner approved the smaller outcome-based ticket plan and this order. Do not silently broaden the tickets or treat this handoff's brainstorm ideas as approved scope changes.

## Product flow proposed in the brainstorm

1. Staff enter **one URL**. The system reads that public page and identifies candidate construction companies and, where relevant, a project. If the page names several companies or the legal entity is uncertain, staff choose the intended report subject before official facts are attached. A company homepage can legitimately produce no property section.
2. Build an **evidence sheet** before generating prose. Each material finding records its original source URL, publisher, checked time, exact-entity link, evidence class and coverage state. Separate official company facts, the company's own statements, independent material, Royal Glass's later verified experience, and AI inference. Search results are discovery leads; open the original publisher page before citing a finding. A failed or absent source is not a clean record.
3. Generate a **decision-ready report** from that evidence. Show potential fit, potential friction and questions to resolve. Each collaboration suggestion states the observed reason, cited support, uncertainty and a practical first approach, such as a referral discussion, defined supply/install scope or small trial project. Do not turn missing evidence into a workmanship, payment or financial-strength verdict. Payment behaviour was explicitly deferred from this report.
4. R2 links each project or product photo to its publishing page and labels whether the photo-to-project and project-to-company attribution is confirmed. AI visual interpretation, if rights and processing are approved, remains an interpretation, not proof of authorship, completion, dimensions or compliance. Project/property context should explain a potential Royal Glass scope without claiming that the company performed work at a site merely because a page or aerial view shows it.
5. R3 saves a **dated snapshot** with the input URL, confirmed subject, findings, recommendations, source links, coverage and review state. A rerun makes a new version; comparison distinguishes a changed fact from a source that became unavailable. The PDF/download shows sources and checked dates. All authorised Royal Glass Office Agent staff may reopen reports; the owner or designated admin decides keep/delete at the 12-month review.

### Suggested report screen

- Header: confirmed legal company, trading name if supported, starting URL, run date and coverage summary.
- First read: potential Royal Glass opportunities, potential friction, and the best question or next conversation for each.
- Evidence: official facts, company claims, independent findings and unavailable checks in separate groups, each linked to the original source.
- Projects and photos: company role, project/location match, relevant product or site features, individual source links and attribution status; show “not applicable” for property on a company-only URL.
- Method and history: what was checked, what was not, saved versions and changes between runs.

These screen details are **proposals for the next discussion**, not a locked UI design. The approved [Phase 2 PRD](phase-2-prd.md) and the three Linear issues remain the acceptance contract.

## Evidence and source boundaries already recorded

- Prefer an exact-company official match via the [Companies Register](https://companies-register.companiesoffice.govt.nz/help-centre/getting-support-to-use-the-companies-register/searching-the-companies-register/) and, if approved for the app, the [NZBN API](https://portal.api.business.govt.nz/api/nzbn). A website domain, trading name or namesake alone does not establish legal identity. API subscription, credentials, returned fields and terms have not been live-proven for this app.
- Public web search can discover projects, awards, reviews and coverage, but snippets and an empty search cannot prove a claim or a clean history. Choose and validate a supported automated search provider. Google's [Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) is closed to new customers and is not the assumed integration.
- Consider exact-company Companies Register filings, relevant GETS awards, published company-level WorkSafe outcomes, applicable product certificates, self-published projects and permitted independent reviews as *different kinds of evidence*. A contract award is not proof of satisfactory completion; a review or photo is not a verified project reference. [Source map and limitations](research/phase-2-source-verification.md).
- For a project URL, assess whether appropriately licensed [LINZ address, parcel and aerial data](https://www.linz.govt.nz/products-services/data/linz-data-service) adds useful site context. [Homes.co.nz terms](https://homes.co.nz/terms) restrict automated access, so no automated commercial collection is assumed without permission.
- The first design keeps external photos as attributed **source links**, rather than copied assets. Displaying, downloading, AI-processing or storing image/review content requires a source-specific rights decision. Attribution alone is not permission; see [IPONZ guidance](https://www.iponz.govt.nz/get-ip/copyright/getting-permission/).
- Arbitrary input URLs need bounded fetching: validate redirects and resolved hosts against internal/private network access, limit size and time, and record partial or blocked reads rather than silently continuing. This is a proposed implementation guard for R1.

## Pilot evidence and what it demonstrates

The manual [Top View Construction pilot](research/company-background-pilot-top-view.md) provides a concrete acceptance case. A matched Auckland company and residential/multi-unit work support an exploratory balustrade conversation. Its apparent template project page must not be used as proof of completed local work or photo authorship. The pilot suggested asking for two recent references and a small defined scope. It **did not** prove automated search, NZBN API access, photo AI, report storage or a partnership verdict. The [Watchman Pools pilot](research/company-background-pilot-watchman-pools.md) is a second pool-sector example.

## Open decisions for the next session

1. **Staff follow-up evidence in R3:** Should saved company records allow staff to add reference-call findings, meeting notes, a trial-project outcome and a staff decision? The brainstorm recommends yes because public research alone cannot show how the company actually works with Royal Glass. If accepted, define who may edit these records and preserve them separately from immutable public-source snapshots.
2. **Report conclusion:** Is a restrained recommendation such as “Explore”, “Verify first” or “No clear opportunity yet” useful, provided it cites reasons and open checks, or should the report show fit/friction/questions without an overall status? No opaque quality or “headache” score is approved.
3. **Photo presentation:** Are linked source pages sufficient for the first release, or does staff need inline thumbnails and AI photo interpretation? Any inline or processed third-party image needs a rights and processing decision first.
4. **Acceptance set:** Select a real company homepage, project URL with a property, company URL without a property, ambiguous namesake and unavailable or template-image page. Top View covers some, but not all, cases.
5. **Integration choices:** Verify NZBN access; choose permitted search, review, project/photo and LINZ sources; set source budgets and failure states. These are unresolved, not existing integrations.
6. **R3 lifecycle:** Define renewal period and deletion workflow after the 12-month owner/admin review, and review the PostgreSQL migration and account/staff access checks before applying them to any environment.

## Recommended next-session starting point

Continue the **product/design discussion** before changing the tickets. Walk through one company homepage and one project URL using the proposed screen, then decide the first three open questions above. Compare the decisions with [RG-377](https://linear.app/royalglass/issue/RG-377/02-one-url-company-match-and-sourced-background-report), [RG-378](https://linear.app/royalglass/issue/RG-378/03-project-property-photo-evidence-and-collaboration-recommendations) and [RG-379](https://linear.app/royalglass/issue/RG-379/04-save-compare-and-download-dated-report-versions). If the owner changes the scope, update the [PRD](phase-2-prd.md), [delivery plan](phase-2-delivery-plan.md) and relevant Linear issues together. No implementation, database migration, new branch/worktree, commit, push or deployment has been authorised by this handoff.
