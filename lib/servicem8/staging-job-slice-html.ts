import type { JobAgentResult } from "./unified-job-agent";
import type { RestJobContext } from "./rest-job-context";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export type StagingView = {
  actionUrl: URL;
  session: string;
  job?: { jobNumber: string; status: string; address: string };
  context?: RestJobContext;
  result?: JobAgentResult;
  action?: "latest" | "check" | "draft";
  error?: string;
};

export function renderStagingJobSlice(view: StagingView) {
  const jobNumber = view.job?.jobNumber ?? "";
  const hidden = `<input type="hidden" name="session" value="${escape(view.session)}">`;
  const form = (action: string, label: string) => `<form method="post" action="${escape(view.actionUrl.toString())}">${hidden}<input type="hidden" name="jobNumber" value="${escape(jobNumber)}"><input type="hidden" name="action" value="${action}"><button type="submit">${label}</button></form>`;
  const sourceRows = view.context ? Object.entries(view.context.sources).map(([name, source]) =>
    `<li>${escape(name)}: ${escape(source.status)}; ${source.events.length} records; ${source.pages} pages</li>`).join("") : "";
  const refs = view.result?.anchors.map((anchor) => `<li><code>${escape(anchor.id)}</code>: “${escape(anchor.quote)}”</li>`).join("") ?? "";
  const answer = view.result && view.action !== "draft" ? `<section><h2>Review the answer</h2><p>${escape(view.result.answer)}</p></section>` : "";
  const draft = view.result && view.action === "draft" ? `<section><h2>Editable draft</h2><p>Review before copying. Nothing is sent or saved to ServiceM8.</p><label for="subject">Subject</label><input id="subject" value="${escape(view.result.subject)}"><label for="body">Body</label><textarea id="body" rows="12">${escape(view.result.body)}</textarea></section>` : "";
  const details = view.job ? `<section><h2>Current Job</h2><dl><dt>Number</dt><dd>${escape(jobNumber)}</dd><dt>Status</dt><dd>${escape(view.job.status || "Not supplied")}</dd><dt>Address</dt><dd>${escape(view.job.address || "Not supplied")}</dd><dt>Source</dt><dd>Staff-bound ServiceM8 OAuth REST, read for this request</dd></dl></section>` : "";
  const actions = view.job ? `<section><h2>Choose a bounded check</h2>${form("latest", "Latest recorded message and reply")}${form("check", "Suggested next office check")}${form("draft", "Prepare a follow-up email draft")}</section>` : "";
  const sourceStatus = view.context ? `<section><h2>Source coverage</h2><ul>${sourceRows}</ul></section>` : "";
  const gap = view.context ? `<aside><strong>History limits:</strong> The full ServiceM8 Diary is unverified in this add-on. Calls, file contents, status changes and other Diary-only events may affect the answer. REST communication records have not been checked for exact body equality with the ServiceM8 UI. “Latest” means latest in the verified accessible Email, SMS and Note records only.</aside>` : "";
  const citations = view.result ? `<section><h2>Evidence quotes</h2><ul>${refs}</ul>${view.result.gaps.length ? `<p>Additional limits: ${escape(view.result.gaps.join("; "))}</p>` : ""}</section>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action ${escape(view.actionUrl.origin)}; base-uri 'none'"><title>RG Office Assistant staging</title><style>body{font:16px system-ui,sans-serif;line-height:1.5;max-width:760px;margin:2rem auto;padding:0 1rem;color:#182230}section,aside{border:1px solid #d8e0e8;border-radius:8px;padding:1rem;margin:1rem 0}aside{background:#fff5d8}form{display:inline-block;margin:.25rem}button{padding:.7rem;background:#175cd3;color:white;border:0;border-radius:6px;cursor:pointer}input,textarea{display:block;box-sizing:border-box;width:100%;padding:.6rem;margin:.4rem 0 1rem;font:inherit}dt{font-weight:bold}dd{margin:0 0 .5rem;overflow-wrap:anywhere}code{overflow-wrap:anywhere}</style></head><body><main><h1>RG Office Assistant — staging</h1><p>Read-only Job communications and staff-reviewed drafts.</p>${view.error ? `<p role="alert">${escape(view.error)}</p>` : ""}<form method="post" action="${escape(view.actionUrl.toString())}">${hidden}<label for="jobNumber">Exact Job number</label><input id="jobNumber" name="jobNumber" maxlength="7" pattern="[A-Z][0-9]{6}" value="${escape(jobNumber)}" required><input type="hidden" name="action" value="view"><button type="submit">Find Job</button></form>${details}${gap}${actions}${answer}${draft}${citations}${sourceStatus}</main></body></html>`;
}
