import { requireCompanyCheck } from "@/lib/company-check/auth";
import { getConfig } from "@/lib/config";
import { listReports, readPropertySnapshots, readReport } from "@/lib/company-check/report-store";

export const runtime = "nodejs";

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!getConfig().companyCheck.enabled) return reply({ error: "Company check is not enabled." }, 503);
  const identity = await requireCompanyCheck(request);
  if (!identity) return reply({ error: "Staff session expired. Reopen Office Agent from ServiceM8." }, 401);
  if (Number(request.headers.get("content-length") || 0) > 1_024) return reply({ error: "Request is too large." }, 413);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return reply({ error: "Invalid request." }, 400); }
  try {
    if (body.action === "list") return reply({ reports: await listReports(identity) });
    if (body.action === "get" && typeof body.reportId === "string") {
      const report = await readReport(identity, body.reportId);
      if (!report) return reply({ error: "Saved report not found." }, 404);
      return reply({ ...report, propertyChecks: await readPropertySnapshots(identity, report) });
    }
    return reply({ error: "Invalid report action." }, 400);
  } catch {
    return reply({ error: "Saved reports are unavailable. Please retry." }, 503);
  }
}
