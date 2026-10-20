import { companyCheckRateLimit, requireCompanyCheck } from "@/lib/company-check/auth";
import { getConfig } from "@/lib/config";
import { exactEntityMatch, searchOfficialCompanies } from "@/lib/company-check/company-register";

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
  try { body = await request.json(); } catch { return reply({ error: "Enter a company name." }, 400); }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 3 || name.length > 100 || /^https?:\/\//i.test(name)) {
    return reply({ error: "Enter a company name (3–100 characters)." }, 400);
  }
  const wait = await companyCheckRateLimit(identity, "companySearch");
  if (wait) return reply({ error: `Search limit reached. Try again in ${wait} seconds.` }, 429);
  try {
    const candidates = await searchOfficialCompanies(name);
    const exact = candidates.length === 1 && exactEntityMatch(name, candidates[0].legalName);
    return reply({ query: name, candidates, autoSelectCompanyNumber: exact ? candidates[0].companyNumber : null });
  } catch {
    return reply({ error: "The NZBN register is unavailable. Please try again later." }, 502);
  }
}
