import { randomBytes } from "node:crypto";
import type { ServiceM8Event, ServiceM8JobEvent } from "./event-schema";
import type { PhaseZeroJobContext } from "./job-context";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function document(body: string, styles = "", script = "", formAction = "'none'") {
  const nonce = randomBytes(18).toString("base64");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src ${formAction}; base-uri 'none'; form-action ${formAction}">
<meta name="referrer" content="no-referrer">
<title>RG Office Assistant</title><style>body{font:15px system-ui,sans-serif;margin:24px;color:#182230}h1{font-size:20px}dt{font-weight:650;margin-top:12px}dd{margin:3px 0 0;overflow-wrap:anywhere}.notice{padding:12px;background:#fff5d8;border-left:4px solid #b7791f}.error{background:#fff0f0;border-color:#b42318}${styles}</style></head>
<body>${body}${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`;
}

export function renderLaunchProof(event: ServiceM8Event) {
  const context = event.eventName === "rg_office_assistant"
    ? `<dl><dt>Account</dt><dd>${escapeHtml(event.auth.accountUUID)}</dd>
<dt>Staff</dt><dd>${escapeHtml(event.auth.staffUUID)}</dd>
<dt>Job</dt><dd>${escapeHtml(event.eventArgs.jobUUID)}</dd></dl>`
    : "<p>Global Add-ons menu launch; no Job context was accepted.</p>";
  return document(`<h1>Signed ServiceM8 launch verified</h1><p class="notice">The callback is authentic, but safe freshness could not be proven from its claims. No ServiceM8 data was requested. Phase 0 must stop here pending clarification.</p>${context}`);
}

export function renderMenuAssistant(staffFirstName: string) {
  const body = `<main class="assistant-shell"><header><div><p class="eyebrow">RG Office Assistant</p><h1>Hi, ${escapeHtml(staffFirstName)}—anything I can help with?</h1></div><p class="leave">Leave: use ServiceM8 navigation</p></header>
<p class="notice"><strong>Entry-point proof.</strong> The greeting uses the signed staff identity and the read-only Staff API. There is no AI, Job Diary access, or message delivery. Conversation content exists only on this page and is lost when you leave or refresh.</p>
<section id="conversation" class="conversation" aria-live="polite"><div class="message assistant">This proves the global assistant surface without reading a Job.</div></section>
<form id="chat-form"><label for="message">Message</label><div class="composer"><textarea id="message" rows="2" maxlength="500" placeholder="Type a test message" required></textarea><button type="submit">Send</button></div><p class="privacy">No message leaves this page.</p></form>
<p class="exit-note">Use the surrounding ServiceM8 navigation to leave this page. Full-page exit behaviour requires a live ServiceM8 UI test.</p></main>`;
  const styles = `.assistant-shell{max-width:760px;margin:0 auto}header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#53657d;margin:0 0 6px}.leave{display:inline-block;padding:10px 14px;border:1px solid #b8c2ce;border-radius:8px;color:#182230;white-space:nowrap;margin:0}.conversation{min-height:260px;padding:18px;margin:20px 0;background:#f4f7fa;border:1px solid #d8e0e8;border-radius:12px}.message{max-width:78%;padding:10px 12px;margin:0 0 12px;border-radius:12px;background:#fff;box-shadow:0 1px 2px #0001}.message.staff{margin-left:auto;background:#dcecff}.composer{display:flex;gap:10px;align-items:end}label{display:block;font-weight:650;margin-bottom:7px}textarea{box-sizing:border-box;flex:1;resize:vertical;border:1px solid #9baaba;border-radius:8px;padding:10px;font:inherit}button{border:0;border-radius:8px;padding:11px 18px;background:#175cd3;color:#fff;font:inherit;font-weight:650;cursor:pointer}.privacy,.exit-note{font-size:13px;color:#53657d}.exit-note{margin-top:20px}@media(max-width:560px){header{display:block}.leave{margin-top:12px}.message{max-width:90%}.composer{align-items:stretch;flex-direction:column}}`;
  const script = `const form=document.getElementById("chat-form");const input=document.getElementById("message");const conversation=document.getElementById("conversation");function addMessage(text,kind){const item=document.createElement("div");item.className="message "+kind;item.textContent=text;conversation.appendChild(item);}form.addEventListener("submit",function(event){event.preventDefault();const text=input.value.trim();if(!text)return;addMessage(text,"staff");addMessage("Thanks — this is only a local interface proof. No AI or ServiceM8 data was used.","assistant");input.value="";input.focus();});`;
  return document(body, styles, script);
}

const proofStyles = `.assistant-shell{max-width:780px;margin:0 auto}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#53657d;margin:0 0 6px}.search{padding:18px;background:#f4f7fa;border:1px solid #d8e0e8;border-radius:12px}.search-row{display:flex;gap:10px;align-items:end}label{display:block;font-weight:650;margin-bottom:7px}.field{flex:1}input[type=text],textarea,select{box-sizing:border-box;width:100%;border:1px solid #9baaba;border-radius:8px;padding:11px;font:inherit}textarea{resize:vertical}button{border:0;border-radius:8px;padding:11px 18px;background:#175cd3;color:#fff;font:inherit;font-weight:650;cursor:pointer}button:disabled{cursor:wait;opacity:.7}.match{display:block;width:100%;margin:10px 0;padding:14px;text-align:left;background:#fff;color:#182230;border:1px solid #b8c2ce}.match strong,.match span{display:block}.summary{font-size:17px;line-height:1.55}.timeline{padding-left:22px}.timeline li{margin:0 0 16px}.sources,.coverage,.privacy{font-size:13px;color:#53657d}.coverage{padding:12px;background:#fff5d8;border-left:4px solid #b7791f}.draft-card{padding:18px;background:#f4f7fa;border:1px solid #d8e0e8;border-radius:12px}.draft-body{white-space:pre-wrap;font:inherit;line-height:1.55;margin:0}@media(max-width:560px){.search-row{align-items:stretch;flex-direction:column}}`;

const proofSubmitOnceScript = `document.addEventListener("submit",async function(event){const form=event.target;if(!(form instanceof HTMLFormElement)||form.method.toLowerCase()!=="post")return;event.preventDefault();if(form.dataset.submitted==="true")return;form.dataset.submitted="true";form.querySelectorAll('button[type="submit"]').forEach(function(button){button.disabled=true;button.textContent=button.dataset.pendingLabel||"Checking…";});try{const response=await fetch(form.action,{method:"POST",body:new URLSearchParams(new FormData(form)),headers:{"Content-Type":"application/x-www-form-urlencoded"},credentials:"omit",cache:"no-store",redirect:"error"});const page=await response.text();const next=new DOMParser().parseFromString(page,"text/html");document.documentElement.innerHTML=next.documentElement.innerHTML;}catch{form.querySelectorAll('button[type="submit"]').forEach(function(button){button.disabled=false;button.textContent="Try again";});form.dataset.submitted="false";let notice=form.querySelector('.submit-error');if(!notice){notice=document.createElement('p');notice.className='notice error submit-error';form.appendChild(notice);}notice.textContent='The request could not be completed. Check your connection and try again.';}});`;

function hiddenSession(sessionToken: string) {
  return `<input type="hidden" name="session" value="${escapeHtml(sessionToken)}">`;
}

function searchForm(actionUrl: URL, sessionToken: string) {
  return `<form class="search" method="post" action="${escapeHtml(actionUrl.toString())}">${hiddenSession(sessionToken)}
<div class="search-row"><div class="field"><label for="query">Job address or Job number</label><input id="query" name="query" type="text" maxlength="200" required placeholder="e.g. R260766 or 10 Queen Street"></div><button type="submit">What happened?</button></div>
<p class="privacy">Read-only proof. Search the connected ServiceM8 account by address or Job number.</p></form>`;
}

function emailDraftForm(jobNumber: string, actionUrl: URL, sessionToken: string) {
  return `<form class="search" method="post" action="${escapeHtml(actionUrl.toString())}">${hiddenSession(sessionToken)}
<input type="hidden" name="jobNumber" value="${escapeHtml(jobNumber)}"><label for="emailRecipient">Who is the email for?</label><select id="emailRecipient" name="emailRecipient" required><option value="customer">Customer</option><option value="builder">Builder</option><option value="supplier">Supplier</option><option value="internal">Internal staff</option></select><label for="emailPurpose">What should the email achieve?</label><textarea id="emailPurpose" name="emailPurpose" rows="3" maxlength="500" required placeholder="e.g. Update the customer and ask whether they have any questions"></textarea><button type="submit" data-pending-label="Drafting…">Draft email</button>
<p class="privacy">Draft only. Review and copy it yourself. Nothing will be sent or saved to ServiceM8.</p></form>`;
}

export function renderProofAssistant(staffFirstName: string, actionUrl: URL, sessionToken: string) {
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1>Hi, ${escapeHtml(staffFirstName)}—what Job should I check?</h1>
<p>Enter an address or Job number. If several Jobs match, you will choose one before any summary is created.</p>
${searchForm(actionUrl, sessionToken)}</main>`, proofStyles, proofSubmitOnceScript, actionUrl.origin);
}

type JobMatch = { jobNumber: string; address: string; status: string };

export function renderJobMatches(matches: readonly JobMatch[], actionUrl: URL, sessionToken: string) {
  const choices = matches.map((match) => `<form method="post" action="${escapeHtml(actionUrl.toString())}">${hiddenSession(sessionToken)}
<input type="hidden" name="jobNumber" value="${escapeHtml(match.jobNumber)}"><button class="match" type="submit"><strong>${escapeHtml(match.jobNumber)}</strong><span>${escapeHtml(match.address || "Address not supplied")}</span><span>${escapeHtml(match.status || "Status not supplied")}</span></button></form>`).join("");
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1>Choose the Job</h1><p>More than one Job matched. Select the intended Job; the assistant will not guess.</p>${choices}<hr>${searchForm(actionUrl, sessionToken)}</main>`, proofStyles, proofSubmitOnceScript, actionUrl.origin);
}

export function renderProofMessage(
  title: string,
  message: string,
  actionUrl?: URL,
  sessionToken?: string,
) {
  const retry = actionUrl && sessionToken ? `<h2>Try another Job</h2>${searchForm(actionUrl, sessionToken)}` : "";
  const formOrigin = actionUrl?.origin ?? "'none'";
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1>${escapeHtml(title)}</h1><p class="notice error">${escapeHtml(message)}</p>${retry}</main>`, proofStyles, proofSubmitOnceScript, formOrigin);
}

type RenderableProofAnswer = {
  job: { jobNumber: string; address: string; status: string; customerName: string };
  summary: { text: string; citations: string[] };
  timeline: { at: string; text: string; citations: string[] }[];
  coverage: {
    included: string[];
    excluded: string[];
    noteCount: number;
    truncated: boolean;
    snapshotAt: string;
  };
};

function citations(values: readonly string[]) {
  return `<span class="sources">Sources: ${values.map(escapeHtml).join(", ")}</span>`;
}

function proofAnswerContent(answer: RenderableProofAnswer) {
  const timeline = answer.timeline.length === 0
    ? "<p>No dated events were found in the included evidence.</p>"
    : `<ol class="timeline">${answer.timeline.map((item) => `<li><time datetime="${escapeHtml(item.at)}">${escapeHtml(item.at.replace("T", " ").replace(".000Z", " UTC"))}</time><p>${escapeHtml(item.text)}</p>${citations(item.citations)}</li>`).join("")}</ol>`;
  const partial = answer.coverage.truncated ? " The included evidence was truncated." : "";
  return `<h2>What happened — ${escapeHtml(answer.job.jobNumber)}</h2>
<dl><dt>Address</dt><dd>${escapeHtml(answer.job.address || "Not supplied")}</dd><dt>Customer</dt><dd>${escapeHtml(answer.job.customerName || "Not supplied")}</dd><dt>Status</dt><dd>${escapeHtml(answer.job.status || "Not supplied")}</dd></dl>
<h3>Summary</h3><p class="summary">${escapeHtml(answer.summary.text)}</p>${citations(answer.summary.citations)}
<h3>Evidence timeline</h3>${timeline}
<p class="coverage"><strong>Coverage:</strong> ${escapeHtml(answer.coverage.included.join(" and "))}. Not checked: ${escapeHtml(answer.coverage.excluded.join(", "))}.${escapeHtml(partial)}</p>`;
}

export function renderProofAnswer(answer: RenderableProofAnswer, actionUrl: URL, sessionToken: string) {
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1>Selected Job result</h1>${proofAnswerContent(answer)}
<h2>Draft an email</h2>${emailDraftForm(answer.job.jobNumber, actionUrl, sessionToken)}
<h2>Check another Job</h2>${searchForm(actionUrl, sessionToken)}</main>`, proofStyles, proofSubmitOnceScript, actionUrl.origin);
}

const conversationStyles = `${proofStyles}.conversation{padding:18px;margin:20px 0;background:#f4f7fa;border:1px solid #d8e0e8;border-radius:12px}.message{max-width:86%;padding:12px 14px;margin:0 0 14px;border-radius:12px;background:#fff;box-shadow:0 1px 2px #0001}.message.staff{margin-left:auto;background:#dcecff}.message.assistant{margin-right:auto}.message h2,.message h3{margin-top:14px}.chat-form{margin-top:18px}.composer{display:flex;gap:10px;align-items:end}@media(max-width:560px){.message{max-width:94%}.composer{align-items:stretch;flex-direction:column}}`;

function conversationForm(actionUrl: URL, sessionToken: string) {
  return `<form class="chat-form" method="post" action="${escapeHtml(actionUrl.toString())}">${hiddenSession(sessionToken)}<label for="message">Message</label><div class="composer"><textarea id="message" name="message" rows="2" maxlength="500" required placeholder="e.g. What happened to R260766?"></textarea><button type="submit" data-pending-label="Checking…">Send</button></div><p class="privacy">Read-only. Nothing is sent or saved to ServiceM8.</p></form><form method="post" action="${escapeHtml(actionUrl.toString())}">${hiddenSession(sessionToken)}<input type="hidden" name="restart" value="1"><button type="submit">Start new conversation</button></form>`;
}

export function renderConversationGuidance(
  staffMessage: string,
  guidance: string,
  actionUrl: URL,
  sessionToken: string,
) {
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1>Conversation</h1><section class="conversation" aria-live="polite"><div class="message staff">${escapeHtml(staffMessage)}</div><div class="message assistant"><p>${escapeHtml(guidance)}</p></div></section>${conversationForm(actionUrl, sessionToken)}</main>`, conversationStyles, proofSubmitOnceScript, actionUrl.origin);
}

export function renderConversationAssistant(
  staffFirstName: string | null,
  actionUrl: URL,
  sessionToken: string,
  greetingSessionToken?: string,
) {
  const greeting = staffFirstName === null ? "Opening RG Office Assistant…" : `Hi, ${escapeHtml(staffFirstName)}—what can I help with?`;
  if (staffFirstName === null && !greetingSessionToken) throw new Error("Greeting session is required");
  const nameScript = staffFirstName === null
    ? `const greeting=document.getElementById("assistant-greeting");if(greeting){fetch(${JSON.stringify(new URL("/assistant/staff", actionUrl).toString())},{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({session:${JSON.stringify(greetingSessionToken)}}),credentials:"omit",cache:"no-store",redirect:"error"}).then(function(response){if(!response.ok)throw new Error("staff lookup failed");return response.json();}).then(function(result){if(typeof result.first!=="string"||result.first.length===0)throw new Error("staff name unavailable");greeting.textContent="Hi, "+result.first+"—what can I help with?";}).catch(function(){greeting.textContent="What can I help with?";});}`
    : "";
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1 id="assistant-greeting" aria-live="polite">${greeting}</h1><section class="conversation" aria-live="polite"><div class="message assistant"><p>I can help with two read-only tasks:</p><ul><li>What happened to an exact Job number?</li><li>Prepare a review-only email draft for an exact Job number.</li></ul><p>For example: <strong>What happened to R260766?</strong></p></div></section>${conversationForm(actionUrl, sessionToken)}<p class="coverage"><strong>Coverage:</strong> core Job/customer fields and Job diary notes. Not checked: email, SMS, forms, attachments, schedule activity.</p></main>`, conversationStyles, `${nameScript}${proofSubmitOnceScript}`, actionUrl.origin);
}

export function renderConversationProofAnswer(
  staffMessage: string,
  answer: RenderableProofAnswer,
  actionUrl: URL,
  sessionToken: string,
) {
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1>Conversation</h1><section class="conversation" aria-live="polite"><div class="message staff">${escapeHtml(staffMessage)}</div><div class="message assistant">${proofAnswerContent(answer)}<h3>Want an email draft?</h3>${emailDraftForm(answer.job.jobNumber, actionUrl, sessionToken)}</div></section>${conversationForm(actionUrl, sessionToken)}</main>`, conversationStyles, proofSubmitOnceScript, actionUrl.origin);
}

export function renderConversationDraftPrompt(
  staffMessage: string,
  jobNumber: string,
  actionUrl: URL,
  sessionToken: string,
  clarification?: string,
) {
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1>Conversation</h1><section class="conversation" aria-live="polite"><div class="message staff">${escapeHtml(staffMessage)}</div><div class="message assistant"><p>${escapeHtml(clarification || `I can prepare a review-only draft for ${jobNumber}.`)}</p>${emailDraftForm(jobNumber, actionUrl, sessionToken)}</div></section>${conversationForm(actionUrl, sessionToken)}</main>`, conversationStyles, proofSubmitOnceScript, actionUrl.origin);
}

type RenderableEmailDraft = {
  job: { jobNumber: string; address: string; customerName: string };
  purpose: string;
  recipient?: string;
  draft: { subject: string; body: string; citations: string[] };
  sources?: { id: string; at: string | null; text: string }[];
  coverage: RenderableProofAnswer["coverage"];
};

export function renderEmailDraft(result: RenderableEmailDraft, actionUrl: URL, sessionToken: string) {
  const partial = result.coverage.truncated ? " The included evidence was truncated." : "";
  return document(`<main class="assistant-shell"><p class="eyebrow">RG Office Assistant</p><h1>Email draft — ${escapeHtml(result.job.jobNumber)}</h1>
<p class="notice"><strong>Draft only — nothing was sent.</strong> Review the wording and facts before copying it into your email.</p>
<dl><dt>Address</dt><dd>${escapeHtml(result.job.address || "Not supplied")}</dd><dt>Customer</dt><dd>${escapeHtml(result.job.customerName || "Not supplied")}</dd><dt>Recipient</dt><dd>${escapeHtml(result.recipient || "Customer")}</dd><dt>Purpose</dt><dd>${escapeHtml(result.purpose)}</dd></dl>
<section class="draft-card"><h2>Review and edit</h2><label for="draftSubject">Subject</label><input id="draftSubject" type="text" maxlength="200" value="${escapeHtml(result.draft.subject)}"><label for="draftBody">Body</label><textarea id="draftBody" rows="12" maxlength="5000">${escapeHtml(result.draft.body)}</textarea><p class="privacy">Edit either field, then select and copy it into your email.</p></section>
<section class="sources"><h2>Supporting records</h2>${result.sources?.length ? `<ul>${result.sources.map((source) => `<li><strong>${escapeHtml(source.id)}</strong>${source.at ? ` (${escapeHtml(source.at)})` : ""}: ${escapeHtml(source.text)}</li>`).join("")}</ul>` : citations(result.draft.citations)}</section>
<p class="coverage"><strong>Coverage:</strong> ${escapeHtml(result.coverage.included.join(" and "))}. Not checked: ${escapeHtml(result.coverage.excluded.join(", "))}.${escapeHtml(partial)}</p>
<h2>Revise this draft</h2><form class="search" method="post" action="${escapeHtml(actionUrl.toString())}">${hiddenSession(sessionToken)}<input type="hidden" name="jobNumber" value="${escapeHtml(result.job.jobNumber)}"><input type="hidden" name="emailPurpose" value="${escapeHtml(result.purpose)}"><input type="hidden" name="emailRecipient" value="${escapeHtml(result.recipient || "customer")}"><label for="emailRevision">What should change?</label><select id="emailRevision" name="emailRevision" required><option value="shorter">Make it shorter</option><option value="warmer">Make it warmer</option><option value="more-formal">Make it more formal</option></select><button type="submit" data-pending-label="Revising…">Revise draft</button><p class="privacy">This creates a new review copy from the same limited Job sources. Edits you made above are local to this page.</p></form>
<h2>Draft another version</h2>${emailDraftForm(result.job.jobNumber, actionUrl, sessionToken)}
<h2>Ask another question</h2>${conversationForm(actionUrl, sessionToken)}</main>`, conversationStyles, proofSubmitOnceScript, actionUrl.origin);
}

export function renderJobContext(event: ServiceM8JobEvent, context: PhaseZeroJobContext) {
  return document(`<h1>RG Office Assistant — Phase 0</h1><p>Read-only staff permission proof completed for this launch.</p><dl>
<dt>Account</dt><dd>${escapeHtml(event.auth.accountUUID)}</dd>
<dt>Staff</dt><dd>${escapeHtml(event.auth.staffUUID)}</dd>
<dt>Job</dt><dd>${escapeHtml(context.jobNumber || context.jobUUID)}</dd>
<dt>Status</dt><dd>${escapeHtml(context.jobStatus || "Not supplied")}</dd>
<dt>Client</dt><dd>${escapeHtml(context.companyName || context.companyUUID)}</dd></dl>`);
}

export function renderError(title: string, message: string) {
  return document(`<h1>${escapeHtml(title)}</h1><p class="notice error">${escapeHtml(message)}</p>`);
}
