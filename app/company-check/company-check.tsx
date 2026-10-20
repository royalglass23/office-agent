"use client";

import { useEffect, useState } from "react";
import styles from "./company-check.module.css";

type Project = { name: string; location: string | null; address: string | null; details: string; projectUrl: string; imageUrl: string | null; imageCredit: string | null };
type PropertyCheck = {
  status: "matched" | "uncertain_match" | "address_unverified"; address: string; matchedAddress?: string; fetchedAt?: string; fromCache?: boolean;
  message?: string; candidates?: string[]; certificateOfTitle?: string | null; legalDescription?: string | null;
  ownershipType?: string | null; bedrooms?: number | null; bathrooms?: number | null; carSpaces?: number | null;
  offStreetParking?: number | null; garageParking?: number | null; landArea?: number | null;
  floorArea?: number | null; yearBuilt?: string | null; constructionCode?: string | null; hasDeck?: boolean | null;
  siteCoverage?: number | null; contourCode?: string | null; sourceUrl?: string;
  valuations?: { date: string; capitalValue: number | null; landValue: number | null; improvementValue: number | null }[];
  sales?: { date: string; price: number | null }[];
  consents?: { date: string; number: string; action: string; value: number | null; description: string }[];
};
type ResearchReport = {
  reportId: string; savedAt: string; reviewDueAt: string;
  input: string; checkedAt: string; constructionRelated: boolean; companyName: string; websiteUrl: string | null;
  trade: string; matchNote: string; legalName: string | null; nzbn: string | null; companyNumber: string | null;
  registerStatus: string | null; registerUrl: string | null; location: string | null; summary: string;
  summaryUrl: string | null; projects: Project[]; opportunity: string; gaps: string[];
  galleryUrl: string | null; galleryNote: string | null;
  galleryPhotos: { url: string; alt: string; sourceUrl: string }[];
  sources: { url: string; title: string }[];
  propertyChecks?: Record<string, PropertyCheck>;
  directorRegister?: { status: "verified" | "unavailable"; sourceUrl: string | null;
    roles: { name: string; status: "current" | "former"; appointedOn: string | null; ceasedOn: string | null }[] };
  decisionMakers?: { name: string; role: string; sourceUrl: string }[];
  registryCandidates?: { legalName: string; companyNumber: string; nzbn: string | null;
    registerStatus: string; registerUrl: string }[];
};
type ReportSummary = Pick<ResearchReport, "reportId" | "companyName" | "companyNumber" | "input" | "checkedAt" | "savedAt" | "reviewDueAt"> & { projectCount: number };
type CompanyCandidate = { legalName: string; companyNumber: string; nzbn: string | null;
  registerStatus: string; registerUrl: string };

function SourceLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? <a href={href} target="_blank" rel="noreferrer">{children} ↗</a> : null;
}
function officialPersonSearch(name: string, roleType: "DIR" | "DDIR") {
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/individual/search?roleType=${roleType}&q=${encodeURIComponent(name)}`;
}
function projectKey(project: Project) { return `${project.projectUrl}|${project.name}`; }
function photoLabel(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function projectPhoto(project: Project, photos: ResearchReport["galleryPhotos"]) {
  if (project.imageUrl) return { url: project.imageUrl, alt: `Photo published with ${project.name}`,
    credit: project.imageCredit || new URL(project.projectUrl).hostname };
  const name = photoLabel(project.name);
  const address = photoLabel(project.address || "");
  const match = photos.find(photo => {
    if (photo.sourceUrl !== project.projectUrl) return false;
    const label = photoLabel(photo.alt);
    return (address.length >= 18 && label.includes(address)) ||
      (name.length >= 14 && name.split(" ").length >= 2 && label.includes(name));
  });
  return match ? { url: match.url, alt: `Company portfolio image labelled ${match.alt}`,
    credit: new URL(match.sourceUrl).hostname } : null;
}
function ProjectPhoto({ project, photo }: { project: Project; photo: ReturnType<typeof projectPhoto> }) {
  if (!photo) return <div className={styles.noPhoto}>No attributable project photo found</div>;
  return <a className={styles.projectPhoto} href={project.projectUrl} target="_blank" rel="noreferrer">
    <span>Project photo on publisher page ↗</span>
  </a>;
}
function PropertyResult({ result }: { result: PropertyCheck }) {
  if (result.status !== "matched") return <div className={styles.propertyStatus}><strong>{result.status === "address_unverified" ? "Project address not confirmed" : "Address match uncertain"}</strong><p>{result.message}</p></div>;
  const value = (item: unknown) => item === null || item === undefined || item === "" ? "Not returned" : String(item);
  const money = (item: number | null) => item === null ? "Not returned" : new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 }).format(item);
  return <details className={styles.propertyResult}><summary>Property check: {result.matchedAddress} <span>View details</span></summary>
    <p>Homes.co.nz property and timeline data · checked {result.fetchedAt ? new Date(result.fetchedAt).toLocaleString("en-NZ") : "now"}{result.fromCache ? " · cached" : ""}</p>
    <dl>
      <div><dt>Certificate of Title</dt><dd>{value(result.certificateOfTitle)}</dd></div>
      <div><dt>Legal description</dt><dd>{value(result.legalDescription)}</dd></div>
      <div><dt>Ownership type</dt><dd>{value(result.ownershipType)}</dd></div>
      <div><dt>Bedrooms / bathrooms</dt><dd>{value(result.bedrooms)} / {value(result.bathrooms)}</dd></div>
      <div><dt>Car spaces / garage / off street</dt><dd>{value(result.carSpaces)} / {value(result.garageParking)} / {value(result.offStreetParking)}</dd></div>
      <div><dt>Land / floor area</dt><dd>{value(result.landArea)} m² / {value(result.floorArea)} m²</dd></div>
      <div><dt>Year built / construction</dt><dd>{value(result.yearBuilt)} / {value(result.constructionCode)}</dd></div>
      <div><dt>Deck / site coverage / contour</dt><dd>{value(result.hasDeck)} / {value(result.siteCoverage)} / {value(result.contourCode)}</dd></div>
    </dl>
    <h5>Valuation history</h5>{result.valuations?.length ? result.valuations.map((item, i) => <p key={i}>{item.date}: capital {money(item.capitalValue)}, land {money(item.landValue)}, improvements {money(item.improvementValue)}</p>) : <p>No valuation events returned.</p>}
    <h5>Sales history</h5>{result.sales?.length ? result.sales.map((item, i) => <p key={i}>{item.date}: {money(item.price)}</p>) : <p>No recorded sales returned.</p>}
    <h5>Building consent events</h5>{result.consents?.length ? result.consents.map((item, i) => <p key={i}>{item.number || "Consent number not returned"} · {item.date || "Date not returned"} · {item.action || "Action not returned"}{item.description ? ` · ${item.description}` : ""}</p>) : <p>No consent events returned. This does not establish that no consent exists.</p>}
    <SourceLink href={result.sourceUrl || null}>Open property source</SourceLink>
    <p>Address matching does not prove this company performed work at this property. Confirm the project link and records before use.</p>
  </details>;
}

export default function CompanyCheck() {
  const [input, setInput] = useState("");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [active, setActive] = useState<ResearchReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [companyChoices, setCompanyChoices] = useState<{ query: string; candidates: CompanyCandidate[] } | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"new" | "saved">("new");
  const [propertyChecks, setPropertyChecks] = useState<Record<string, { state: "checking" | "done" | "error"; result?: PropertyCheck; error?: string }>>({});
  const [comparison, setComparison] = useState<{ earlier: ResearchReport } | { message: string } | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);
  function printReport() {
    const closed = [...document.querySelectorAll<HTMLDetailsElement>("#company-report details:not([open])")];
    closed.forEach(element => { element.open = true; });
    window.addEventListener("afterprint", () => closed.forEach(element => { element.open = false; }), { once: true });
    window.print();
  }

  useEffect(() => {
    if (!active) return;
    const reportId = active.reportId;
    const saved = active.propertyChecks || {};
    const projects = active.projects.filter(project => project.address && !saved[projectKey(project)]);
    setPropertyChecks({
      ...Object.fromEntries(Object.entries(saved).map(([key, result]) => [key, { state: "done" as const, result }])),
      ...Object.fromEntries(projects.map(project => [projectKey(project), { state: "checking" as const }])),
    });
    let cancelled = false;
    const controller = new AbortController();
    async function run() {
      for (let index = 0; index < projects.length && !cancelled; index++) {
        const project = projects[index];
        let done = false;
        while (!done && !cancelled) {
          try {
            const response = await fetch("/api/company-check/property", { method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: project.address, projectUrl: project.projectUrl,
                projectName: project.name, reportId }), signal: controller.signal });
            const data = await response.json();
            if (response.status === 429) {
              await new Promise(resolve => setTimeout(resolve, Math.max(1000, (data.retryAfterSeconds || 13) * 1000)));
              continue;
            }
            if (!response.ok) throw new Error(data.error || "Property lookup failed.");
            if (!cancelled) setPropertyChecks(current => ({ ...current, [projectKey(project)]: { state: "done", result: data as PropertyCheck } }));
          } catch (cause) {
            if (!cancelled) setPropertyChecks(current => ({ ...current, [projectKey(project)]: { state: "error", error: cause instanceof Error ? cause.message : "Property lookup failed." } }));
          }
          done = true;
        }
        if (index < projects.length - 1 && !cancelled) await new Promise(resolve => setTimeout(resolve, 13_000));
      }
    }
    void run();
    return () => { cancelled = true; controller.abort(); };
  }, [active]);

  async function loadReports() {
    if (loadingReports) return;
    setLoadingReports(true);
    setError("");
    setView("saved");
    try {
      const response = await fetch("/api/company-check/reports", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Saved reports could not be loaded.");
      setReports(data.reports as ReportSummary[]);
      setView("saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Saved reports could not be loaded."); }
    finally { setLoadingReports(false); }
  }

  async function openReport(reportId: string) {
    setError("");
    try {
      const response = await fetch("/api/company-check/reports", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", reportId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The saved report could not be opened.");
      setActive(data as ResearchReport);
      setComparison(null);
      setCompanyChoices(null);
      setView("new");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The saved report could not be opened."); }
  }

  async function checkCompany(value = input, selectedCompanyNumber?: string) {
    const clean = value.trim();
    if (!clean || busy) return;
    setInput(clean);
    setBusy(true);
    setError("");
    setView("new");
    setActive(null);
    setComparison(null);
    setCompanyChoices(null);
    try {
      const response = await fetch("/api/company-check/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: clean, selectedCompanyNumber, requestKey: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The research request failed.");
      const report = result as ResearchReport;
      setActive(report);
      setReports(current => [{ reportId: report.reportId, companyName: report.companyName, companyNumber: report.companyNumber, input: report.input,
        checkedAt: report.checkedAt, savedAt: report.savedAt, reviewDueAt: report.reviewDueAt,
        projectCount: report.projects.length }, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The research request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function compareEarlier() {
    if (!active || compareBusy) return;
    setCompareBusy(true);
    setComparison(null);
    try {
      const listResponse = await fetch("/api/company-check/reports", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) });
      const listed = await listResponse.json();
      if (!listResponse.ok) throw new Error(listed.error || "Saved reports could not be loaded.");
      const earlier = (listed.reports as ReportSummary[]).find(item => item.reportId !== active.reportId &&
        item.savedAt < active.savedAt && (active.companyNumber
          ? item.companyNumber === active.companyNumber
          : item.companyName.toLowerCase() === active.companyName.toLowerCase()));
      if (!earlier) { setComparison({ message: "No earlier version for this company was found in the 100 most recent reports." }); return; }
      const response = await fetch("/api/company-check/reports", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get", reportId: earlier.reportId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Earlier report could not be loaded.");
      setComparison({ earlier: result as ResearchReport });
    } catch (cause) { setComparison({ message: cause instanceof Error ? cause.message : "Comparison unavailable." }); }
    finally { setCompareBusy(false); }
  }

  async function findCompany() {
    const clean = input.trim();
    if (!clean || lookupBusy || busy) return;
    if (/^https?:\/\//i.test(clean) || /^www\./i.test(clean)) { await checkCompany(clean); return; }
    setLookupBusy(true);
    setError("");
    setView("new");
    setActive(null);
    setCompanyChoices(null);
    try {
      const response = await fetch("/api/company-check/search", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Company search failed.");
      if (result.autoSelectCompanyNumber) { await checkCompany(clean, result.autoSelectCompanyNumber); return; }
      setCompanyChoices({ query: clean, candidates: result.candidates as CompanyCandidate[] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Company search failed."); }
    finally { setLookupBusy(false); }
  }

  return <main className={styles.page}>
    <div className={styles.prototypeNotice}>OFFICE AGENT COMPANY CHECK · Staff review required · Saved report snapshots</div>
    <div className={styles.shellC}>
      <header><div className={styles.brand}>RG<span> / Office Agent</span></div><p>Company checks</p></header>
      <div className={styles.contentC}>
        <div className={styles.leftC}>
          <span className={styles.stamp}>Research queue</span>
          <h1>Company checks</h1>
           <p>Find a construction company by name, choose its NZBN record when names overlap, then review directors, leadership, projects and photos.</p>
          <nav className={styles.tabs} aria-label="Report views">
            <button className={view === "new" ? styles.active : ""} onClick={() => setView("new")}>New check</button>
            <button className={view === "saved" ? styles.active : ""} onClick={() => { void loadReports(); }}>Saved reports <span>{reports.length}</span></button>
          </nav>
           <form className={styles.inputForm} onSubmit={event => { event.preventDefault(); void findCompany(); }}>
             <label htmlFor="company-input">1. Enter company name</label>
             <div className={styles.inputRow}><input id="company-input" value={input} maxLength={220} onChange={event => { setInput(event.target.value); setCompanyChoices(null); }} placeholder="e.g. Calder Stewart" required /><button type="submit" disabled={busy || lookupBusy}>{lookupBusy ? "Finding matches…" : busy ? "Researching…" : "Find company →"}</button></div>
             <p>We search the official Companies Register, which includes each company’s NZBN. A website URL can still start a direct research check.</p>
          </form>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.savedMini}><h3>Recent checks</h3>{reports.length ? reports.slice(0, 5).map(report => <button key={report.reportId} onClick={() => { void openReport(report.reportId); }}>{report.companyName}<span>↗</span></button>) : <small>Open Saved reports to load previous checks.</small>}</div>
        </div>
        <div className={styles.rightC}>
           {view === "saved" ? <section className={styles.library}><span className={styles.stamp}>Report history</span><h2>Saved reports</h2><p>Each new check creates a dated version. Authorised Office Agent staff can reopen the latest 100 reports.</p>{loadingReports ? <p>Loading saved reports…</p> : reports.length ? reports.map(report => <button key={report.reportId} onClick={() => { void openReport(report.reportId); }}><strong>{report.companyName}</strong><span>{new Date(report.checkedAt).toLocaleString("en-NZ")} →</span></button>) : <p>No saved reports yet.</p>}</section> : companyChoices ? <section className={styles.library}>
             <span className={styles.stamp}>Step 2 · Select legal company</span><h2>Which {companyChoices.query}?</h2>
             {companyChoices.candidates.length ? <><p>The official Companies Register returned {companyChoices.candidates.length} possible {companyChoices.candidates.length === 1 ? "company" : "companies"}. Select the NZBN for the company you mean. Its directors will then be researched against that exact record.</p>
               <div className={styles.companyChoiceList}>{companyChoices.candidates.map(candidate => <div className={styles.companyChoice} key={candidate.companyNumber}>
                 <div><strong>{candidate.legalName}</strong><span>NZBN {candidate.nzbn || "not returned"} · Company {candidate.companyNumber} · {candidate.registerStatus}</span><SourceLink href={candidate.registerUrl}>View official record</SourceLink></div>
                 <button type="button" onClick={() => { void checkCompany(companyChoices.query, candidate.companyNumber); }} disabled={busy}>Select and research →</button>
               </div>)}</div>{companyChoices.candidates.length === 15 && <p>Showing the first 15 results. Add more of the legal name to narrow the search.</p>}</>
               : <div className={styles.coverage}><strong>No register match returned</strong><p>Check the spelling or search with more of the legal name. You can continue without an NZBN match, but directors will remain unassigned.</p><button type="button" onClick={() => { void checkCompany(companyChoices.query); }}>Research without a match →</button></div>}
           </section> : active ? <article className={styles.report} id="company-report">
            <div className={styles.reportTop}><div><span className={styles.stamp}>Live web research · saved review draft</span><h2>{active.companyName}</h2><p>Checked {new Date(active.checkedAt).toLocaleString("en-NZ")} · Search: {active.input}</p><p>Saved {new Date(active.savedAt).toLocaleString("en-NZ")} · Keep or delete review due {new Date(active.reviewDueAt).toLocaleDateString("en-NZ")}</p></div><div className={styles.reportActions}><button className={styles.secondary} onClick={() => { void compareEarlier(); }} disabled={compareBusy}>{compareBusy ? "Comparing…" : "Compare previous"}</button><button className={styles.secondary} onClick={printReport} disabled={Object.values(propertyChecks).some(item => item.state === "checking")}>Print / save PDF</button></div></div>
            {comparison && <section className={styles.coverage}><strong>Previous version comparison</strong>{"message" in comparison ? <p>{comparison.message}</p> : <>
              <p>Earlier check: {new Date(comparison.earlier.checkedAt).toLocaleString("en-NZ")}. Open both source sets before treating a difference as a real-world change.</p>
              <p>Register status: {comparison.earlier.registerStatus || "not verified"} → {active.registerStatus || "not verified"}.</p>
              <p>Earlier listed projects: {comparison.earlier.projects.map(project => project.name).join(", ") || "none confirmed"}. Current listed projects: {active.projects.map(project => project.name).join(", ") || "none confirmed"}. A missing listing may reflect source coverage.</p>
              <p>Earlier director check: {comparison.earlier.directorRegister?.status || "unavailable"}; current: {active.directorRegister?.status || "unavailable"}. {comparison.earlier.directorRegister?.status === "verified" && active.directorRegister?.status === "verified"
                ? `Earlier roles: ${comparison.earlier.directorRegister.roles.map(role => role.name).join(", ") || "none returned"}. Current roles: ${active.directorRegister.roles.map(role => role.name).join(", ") || "none returned"}.`
                : "A director list difference cannot be established when either check is unavailable."}</p>
            </>}</section>}
            {!active.constructionRelated ? <div className={styles.coverage}><strong>Outside the construction scope</strong><p>{active.matchNote}</p></div> : <>
              <div className={styles.profileLead}><p>{active.summary}</p><SourceLink href={active.summaryUrl}>Company source</SourceLink></div>
              <section className={styles.reportSection}><div className={styles.sectionTitle}><h3>Company details</h3><span>Public sources</span></div>
                <dl className={styles.companyFacts}>
                  <div><dt>Legal entity</dt><dd>{active.legalName || "Not verified"}</dd></div>
                  <div><dt>NZBN</dt><dd>{active.nzbn || "Not verified"}</dd></div>
                  <div><dt>Company number</dt><dd>{active.companyNumber || "Not verified"}</dd></div>
                  <div><dt>Register status</dt><dd>{active.registerStatus || "Not verified"}</dd></div>
                  <div><dt>Location</dt><dd>{active.location || "Not verified"}</dd></div>
                  <div><dt>Trade</dt><dd>{active.trade || "Not verified"}</dd></div>
                </dl>
                <p className={styles.matchNote}>{active.matchNote}</p>
                {!active.legalName && Boolean(active.registryCandidates?.length) && <div className={styles.decisionPrompt}>
                  <strong>Possible legal companies</strong>
                  <p>The official register returned these names. The report has not linked any one of them to the operating website, so their directors are not assigned to this company yet. If you know the contracting company, research its exact legal name.</p>
                  <div className={styles.leadershipList}>{active.registryCandidates?.map(candidate => <div className={styles.leadershipRow} key={candidate.companyNumber}>
                    <strong>{candidate.legalName}</strong><span>Company {candidate.companyNumber} · NZBN {candidate.nzbn || "not returned"} · {candidate.registerStatus}</span>
                    <div className={styles.candidateActions}><SourceLink href={candidate.registerUrl}>Official record</SourceLink>
                    <button type="button" className={styles.secondary} onClick={() => { void checkCompany(candidate.legalName, candidate.companyNumber); }} disabled={busy}>Research this legal company</button></div>
                  </div>)}</div>
                </div>}
                <div className={styles.sourceActions}><SourceLink href={active.registerUrl}>Open official company record</SourceLink><SourceLink href={active.websiteUrl}>Company website</SourceLink></div>
              </section>
              <section className={styles.reportSection}><div className={styles.sectionTitle}><h3>People to approach</h3><span>Automatically researched</span></div>
                <p>The report searches the company’s own public pages for named leaders and checks the matched legal company’s register for directors. A published role is a starting point for contact, not proof of budget or signing authority.</p>
                {active.decisionMakers?.length ? <div className={styles.leadershipList}>{active.decisionMakers.map(person => <div className={styles.leadershipRow} key={`${person.name}|${person.sourceUrl}`}>
                  <strong>{person.name}</strong><span>{person.role} · company-published</span><SourceLink href={person.sourceUrl}>View role source</SourceLink>
                </div>)}</div> : <div className={styles.decisionPrompt}><strong>No decision maker identified in this search</strong><p>No named operational leader with a source-confirmed role was found on the company website. Start through the company’s published business contact channel and ask who handles new supplier or project decisions.</p><SourceLink href={active.websiteUrl}>Open company website</SourceLink></div>}
                <p>{active.directorRegister?.status === "verified" && active.directorRegister.roles.some(role => role.status === "current")
                  ? `The register lists ${active.directorRegister.roles.filter(role => role.status === "current").length} current directors. It does not say which one approves suppliers or projects; appointment dates are not a contact ranking.`
                  : "A current director could not be confirmed for this report."}</p>
                <div className={styles.decisionPrompt}><strong>Confirm the decision path</strong><p>Ask who selects suppliers, who approves the budget and scope, and who signs the contract or purchase order. Record the answer with the opportunity before treating anyone as the decision maker.</p></div>
              </section>
              <section className={styles.reportSection}><div className={styles.sectionTitle}><h3>Company directors and role history</h3><span>Companies Register</span></div>
                {active.directorRegister?.status === "verified" ? <>
                  <p>Current and former directorships of this legal company, as shown on its official register page when this report was saved. This is a governance record, not a list of operational decision makers.</p>
                  <div className={styles.directorList}>{active.directorRegister.roles.map((role, index) => <div key={`${role.name}-${index}`} className={styles.directorRow}>
                    <strong>{role.name}</strong><span>{role.status === "current" ? "Current director" : "Former director"}</span>
                    <small>Appointed {role.appointedOn || "date not returned"}{role.ceasedOn ? ` · Ceased ${role.ceasedOn}` : ""}</small>
                    <div className={styles.directorLinks}><SourceLink href={officialPersonSearch(role.name, "DIR")}>Search other company roles</SourceLink><SourceLink href={officialPersonSearch(role.name, "DDIR")}>Search disqualifications</SourceLink></div>
                  </div>)}</div>
                  <SourceLink href={active.directorRegister.sourceUrl}>Open official director record</SourceLink>
                </> : <p>Director roles could not be verified from the official company record for this saved report. <SourceLink href={active.registerUrl}>Check the company record</SourceLink></p>}
                <div className={styles.enforcementNote}><strong>Public enforcement history</strong><p>The links above search the official register by each director’s name. Staff must confirm any result belongs to the same person before using it. Automated disqualified-director results are not connected. No result here means no check was completed; it is not a clearance.</p>
                  <SourceLink href="https://app.companiesoffice.govt.nz/companies/app/ui/pages/individual/search?roleType=DDIR">Search banned directors on the official register</SourceLink></div>
              </section>
              <section className={styles.reportSection}><div className={styles.sectionTitle}><h3>Public projects</h3><span>{active.projects.length} found</span></div>
                {active.projects.length ? <div className={styles.projectGrid}>{active.projects.map((project, index) => {
                  const propertyCheck = propertyChecks[projectKey(project)];
                  const photo = projectPhoto(project, active.galleryPhotos);
                  return <div className={styles.projectCard} key={project.projectUrl + index}>
                  <ProjectPhoto project={project} photo={photo} />
                  <div className={styles.projectBody}><h4>{project.name}</h4>{project.location && <span>{project.location}</span>}<p>{project.details}</p><SourceLink href={project.projectUrl}>View original project</SourceLink>{photo && <small>Image published by {photo.credit}. Open the source page to view it.</small>}
                    <div className={styles.propertyCheck}>{project.address ? <><strong>Published address: {project.address}</strong>{propertyCheck?.state === "checking" && <p>Checking this address…</p>}{propertyCheck?.state === "error" && <p>Property check unavailable: {propertyCheck.error}</p>}{propertyCheck?.result && <PropertyResult result={propertyCheck.result} />}</> : <p>No complete project address published. Property lookup skipped.</p>}</div>
                  </div>
                </div>;
                })}</div> : <p className={styles.emptyProjects}>No attributable public project was found in this search. Ask the company for a verified portfolio.</p>}
              </section>
              {active.galleryUrl && <section className={styles.reportSection}><div className={styles.sectionTitle}><h3>Public gallery</h3><span>Company-published images</span></div>
                <p>{active.galleryNote || "These photos are published in the company gallery. Individual projects, dates and scopes are not established by the images alone."}</p>
                {active.galleryPhotos.length ? <div className={styles.galleryGrid}>{active.galleryPhotos.map(photo => <a key={photo.url} href={photo.sourceUrl} target="_blank" rel="noreferrer"><span>{photo.alt} · View on publisher page ↗</span></a>)}</div> : <p>Individual photos could not be confirmed from this public gallery. <SourceLink href={active.galleryUrl}>Open gallery</SourceLink></p>}
                <p className={styles.galleryCaution}>View photos at the original page. Their project attribution and reuse rights need confirmation.</p>
                <SourceLink href={active.galleryUrl}>Open company gallery</SourceLink>
              </section>}
              <section className={styles.reportSection}><h3>Possible Royal Glass opportunity</h3><p>{active.opportunity}</p></section>
              <section className={styles.reportSection}><h3>Gaps to check</h3><ul>{active.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul></section>
            </>}
            <div className={styles.sources}><h3>Sources found</h3>{active.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>
            <div className={styles.coverage}><strong>Research limits</strong><p>This dated version records a source snapshot, not current facts or a due diligence clearance. Open original project pages and the official register before relying on identity or photo attribution. Photos remain linked to their publishers; this report does not grant reuse rights.</p></div>
           </article> : <div className={styles.empty}><span>↗</span><h2>{lookupBusy ? "Finding registered companies…" : busy ? "Searching the public web…" : "Your company check starts here"}</h2><p>{lookupBusy ? "Checking official company names and NZBNs." : busy ? "This may take up to a minute. Keep this tab open." : "Enter a company name. If several companies match, choose the correct NZBN before research."}</p></div>}
        </div>
      </div>
    </div>
  </main>;
}
