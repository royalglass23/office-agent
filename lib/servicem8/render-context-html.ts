import type { ServiceM8JobEvent } from "./event-schema";
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

function document(body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<title>RG Office Assistant</title><style>body{font:15px system-ui,sans-serif;margin:24px;color:#182230}h1{font-size:20px}dt{font-weight:650;margin-top:12px}dd{margin:3px 0 0;overflow-wrap:anywhere}.notice{padding:12px;background:#fff5d8;border-left:4px solid #b7791f}.error{background:#fff0f0;border-color:#b42318}</style></head>
<body>${body}</body></html>`;
}

export function renderLaunchProof(event: ServiceM8JobEvent) {
  return document(`<h1>Signed ServiceM8 launch verified</h1><p class="notice">The callback is authentic, but safe freshness could not be proven from its claims. No ServiceM8 data was requested. Phase 0 must stop here pending clarification.</p><dl>
<dt>Account</dt><dd>${escapeHtml(event.auth.accountUUID)}</dd>
<dt>Staff</dt><dd>${escapeHtml(event.auth.staffUUID)}</dd>
<dt>Job</dt><dd>${escapeHtml(event.eventArgs.jobUUID)}</dd></dl>`);
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
