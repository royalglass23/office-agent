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

function document(body: string, styles = "", script = "") {
  const nonce = randomBytes(18).toString("base64");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'">
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
