"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./prototype.module.css";

type Variant = "A" | "B" | "C";
type CaseKey = "watchman" | "topview" | "ambiguous" | "outside" | "notInDemo";
type Stage = "start" | "match" | "report";
type Report = { id: number; company: string; input: string; checked: string; caseKey: CaseKey };

const cases: Record<CaseKey, { company: string; trade: string; fit: string; friction: string; question: string; sources: { label: string; url: string }[] }> = {
  watchman: {
    company: "Watchman Developments Limited", trade: "Pool construction", fit: "Custom pools and published glass-window services could create pool glazing and fencing work.",
    friction: "The public portfolio does not establish who supplied its glass, current capacity, or recent delivery outcomes.",
    question: "How do you currently source glass design, supply and installation, and would a defined trial scope be useful?",
    sources: [{ label: "Company website", url: "https://watchmanpools.co.nz/" }, { label: "Company register", url: "https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/1929465" }],
  },
  topview: {
    company: "Top View Construction Limited", trade: "Residential construction", fit: "Residential and multi-unit work could create a balustrade coordination opportunity.",
    friction: "The website's apparent template project tiles cannot establish completed Auckland work or photo authorship.",
    question: "Can you provide two recent Auckland project references and identify one small balustrade scope to discuss?",
    sources: [{ label: "Company website", url: "https://topviewcon.co.nz/" }, { label: "Company register", url: "https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/8175843" }],
  },
  ambiguous: {
    company: "Top View Construction Limited", trade: "Residential construction", fit: "A possible balustrade lead after staff confirm the intended legal company.",
    friction: "Several similarly named companies may appear in search results; names alone do not prove identity.",
    question: "Is this the Auckland company connected to topviewcon.co.nz?",
    sources: [{ label: "Company website", url: "https://topviewcon.co.nz/" }],
  },
  outside: {
    company: "Outside report scope", trade: "Not established as construction related", fit: "No construction-company report generated.",
    friction: "The supplied example does not identify a construction-related business.",
    question: "Provide a builder, developer, architect, pool company, construction trade or supplier name or URL.", sources: [],
  },
  notInDemo: {
    company: "Company not in this demo", trade: "Research has not been run", fit: "No finding is available for this input.",
    friction: "This prototype recognises only its prepared examples; it cannot determine whether another company is construction related.",
    question: "Try a sample company to review the proposed flow. The real feature would research the supplied name or URL.", sources: [],
  },
};

const examples = [
  { label: "Pool company", value: "https://watchmanpools.co.nz/" },
  { label: "Builder name", value: "Top View Construction" },
  { label: "Ambiguous name", value: "Top View" },
  { label: "Outside scope", value: "Example cafe" },
];

function classify(value: string): CaseKey {
  const v = value.toLowerCase();
  if (v.includes("watchman")) return "watchman";
  if (v.trim() === "top view") return "ambiguous";
  if (v.includes("topview") || v.includes("top view")) return "topview";
  if (v.includes("cafe")) return "outside";
  return "notInDemo";
}

function Stamp({ children }: { children: React.ReactNode }) { return <span className={styles.stamp}>{children}</span>; }

function SourceList({ caseKey }: { caseKey: CaseKey }) {
  return <div className={styles.sources}><h3>Evidence links</h3>{cases[caseKey].sources.length ? cases[caseKey].sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>) : <p>No verified construction-company source.</p>}<small>Demo findings adapted from manual pilots. This prototype does not search the internet or recheck these pages.</small></div>;
}

export default function CompanyCheckPrototype() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("variant");
  const variant: Variant = selected === "B" || selected === "C" ? selected : "A";
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("start");
  const [caseKey, setCaseKey] = useState<CaseKey>("watchman");
  const [saved, setSaved] = useState<Report[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [view, setView] = useState<"new" | "library">("new");

  const changeVariant = useCallback((direction: number) => {
    const keys: Variant[] = ["A", "B", "C"];
    const next = keys[(keys.indexOf(variant) + direction + keys.length) % keys.length];
    router.replace(`/prototype/company-check?variant=${next}`, { scroll: false });
  }, [router, variant]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (event.key === "ArrowLeft") changeVariant(-1);
      if (event.key === "ArrowRight") changeVariant(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changeVariant]);

  function start(value = input) {
    if (!value.trim()) return;
    setInput(value);
    const found = classify(value);
    setCaseKey(found);
    setActiveId(null);
    setView("new");
    setStage(found === "ambiguous" ? "match" : "report");
  }

  function save() {
    const id = Date.now();
    setSaved(current => [{ id, company: cases[caseKey].company, input, checked: new Date().toLocaleString("en-NZ"), caseKey }, ...current]);
    setActiveId(id);
  }

  const active = saved.find(report => report.id === activeId);
  const reportCase = active?.caseKey ?? caseKey;
  const details = cases[reportCase];
  const reportable = reportCase !== "outside" && reportCase !== "notInDemo";
  const canSave = stage === "report" && reportable && !active;

  const inputForm = <form className={styles.inputForm} onSubmit={event => { event.preventDefault(); start(); }}><label htmlFor="company-input">Company name or website URL</label><div className={styles.inputRow}><input id="company-input" value={input} onChange={event => setInput(event.target.value)} placeholder="e.g. Watchman Pools or https://..." /><button type="submit">Check company →</button></div><p>Construction-related companies only · staff confirm uncertain matches</p><div className={styles.examples}>{examples.map(example => <button type="button" key={example.label} onClick={() => start(example.value)}>{example.label}</button>)}</div></form>;

  const match = stage === "match" && !active ? <section className={styles.match}><Stamp>Match needs confirmation</Stamp><h2>Which company did you mean?</h2><p>“Top View” alone is not enough to attach official company facts.</p><button onClick={() => { setCaseKey("topview"); setStage("report"); }}>Top View Construction Limited · Auckland · topviewcon.co.nz</button><button onClick={() => setStage("start")}>None of these — refine search</button></section> : null;

  const report = (stage === "report" || active) ? <article className={styles.report} id="prototype-report"><div className={styles.reportTop}><div><Stamp>{active ? "Saved demo version" : reportCase === "outside" ? "Outside scope" : reportCase === "notInDemo" ? "Demo limit" : "Draft · demo evidence"}</Stamp><h2>{details.company}</h2><p>{details.trade} · Input: {active?.input ?? input}{active ? ` · Saved ${active.checked}` : ""}</p></div><div className={styles.reportActions}>{canSave && <button onClick={save}>Save report</button>}{reportable && <button className={styles.secondary} onClick={() => window.print()}>Print / save PDF</button>}</div></div><div className={styles.findings}><section><span>01 / Opportunity</span><h3>Potential fit</h3><p>{details.fit}</p></section><section><span>02 / Check</span><h3>Potential friction or gap</h3><p>{details.friction}</p></section><section><span>03 / Next step</span><h3>Question for staff</h3><p>{details.question}</p></section></div>{reportable && <><SourceList caseKey={reportCase} /><div className={styles.coverage}><strong>Coverage</strong><p>Company and opportunity examples only. No live web search, official-register check, project or property lookup, photo analysis, or external database write occurred in this prototype.</p></div></>}</article> : null;

  const library = <section className={styles.library}><div className={styles.sectionTitle}><div><Stamp>Demo library</Stamp><h2>Saved reports</h2></div><small>In this browser session only · clears on refresh</small></div>{saved.length ? saved.map(item => <button key={item.id} onClick={() => { setActiveId(item.id); setView("new"); setStage("report"); }}><strong>{item.company}</strong><span>{item.checked} →</span></button>) : <p>Save a report to see it here.</p>}</section>;

  const content = view === "library" ? library : <>{inputForm}{match}{report}</>;
  const tabs = <nav className={styles.tabs}><button className={view === "new" ? styles.active : ""} onClick={() => setView("new")}>New check</button><button className={view === "library" ? styles.active : ""} onClick={() => setView("library")}>Saved reports <span>{saved.length}</span></button></nav>;

  return <main className={`${styles.page} ${styles[`variant${variant}`]}`}><div className={styles.prototypeNotice}>PROTOTYPE · Example data · No live research or database</div>{variant === "A" && <div className={styles.shellA}><aside><div className={styles.brand}>RG<span> / Office Agent</span></div><p>Research desk</p>{tabs}<div className={styles.sideNote}>One company at a time.<br />Evidence before conclusions.</div></aside><div className={styles.mainA}><header><Stamp>Company intelligence</Stamp><h1>Background check</h1><p>Start with a company name or website. Review the match, evidence and possible Royal Glass work.</p></header>{content}</div></div>}{variant === "B" && <div className={styles.shellB}><header><div className={styles.brand}>RG<span> / Office Agent</span></div><Stamp>Guided check</Stamp></header><div className={styles.heroB}><span>01 — FIND THE COMPANY</span><h1>Is this construction company worth a conversation?</h1><p>Give Office Agent a name or a website. It will identify the company, gather sources and prepare a report for staff review.</p>{tabs}</div><div className={styles.contentB}>{content}</div></div>}{variant === "C" && <div className={styles.shellC}><header><div className={styles.brand}>RG<span> / Office Agent</span></div><p>Company checks / Workspace</p></header><div className={styles.contentC}><div className={styles.leftC}><Stamp>Research queue</Stamp><h1>Company checks</h1><p>Search a construction-related business, confirm the legal entity, then keep a dated report.</p>{tabs}{inputForm}<div className={styles.savedMini}><h3>Recent reports</h3>{saved.length ? saved.slice(0, 3).map(item => <button key={item.id} onClick={() => { setActiveId(item.id); setView("new"); setStage("report"); }}>{item.company}<span>↗</span></button>) : <small>Reports saved during this demo appear here.</small>}</div></div><div className={styles.rightC}>{view === "library" ? library : <>{match}{report || (stage === "match" ? null : <div className={styles.empty}><span>↗</span><h2>Your report will appear here</h2><p>Try one of the examples or enter a company name or URL.</p></div>)}</>}</div></div></div>}<div className={styles.switcher}><button aria-label="Previous prototype layout" onClick={() => changeVariant(-1)}>←</button><span>{variant} — {variant === "A" ? "Research desk" : variant === "B" ? "Guided flow" : "Split workspace"}</span><button aria-label="Next prototype layout" onClick={() => changeVariant(1)}>→</button></div></main>;
}
