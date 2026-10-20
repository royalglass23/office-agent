import { getConfig } from "@/lib/config";

export type CompanyCandidate = {
  legalName: string;
  companyNumber: string;
  nzbn: string | null;
  registerStatus: string;
  registerUrl: string;
};

const apiBase = "https://api.business.govt.nz/gateway/nzbn/v5";
const registerBase = "https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies";

export function exactEntityMatch(input: string, legalName: string) {
  const normalise = (value: string) => value.toUpperCase().replace(/\bLTD\b/g, "LIMITED")
    .replace(/[^A-Z0-9]+/g, " ").replace(/\s+LIMITED$/, "").trim();
  return normalise(input) === normalise(legalName);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function companyNumber(item: Record<string, unknown>) {
  const value = item.sourceRegisterUniqueId ?? record(item.company)?.companyNumber;
  const number = String(value ?? "");
  return /^\d{1,10}$/.test(number) ? number : null;
}
function companyType(item: Record<string, unknown>) {
  const type = record(item.entityType);
  const code = text(item.entityTypeCode || type?.id).toUpperCase();
  const label = text(type?.name).toLowerCase();
  return ["LTD", "ULTD", "COOP", "ASIC", "NON_ASIC"].includes(code) || label.includes("company");
}
function candidate(item: unknown): CompanyCandidate | null {
  const entity = record(item);
  if (!entity || !companyType(entity)) return null;
  const legalName = text(entity.entityName);
  const nzbn = text(entity.nzbn);
  const number = companyNumber(entity);
  if (!legalName || !/^\d{13}$/.test(nzbn) || !number) return null;
  const status = record(entity.entityStatus);
  return { legalName, companyNumber: number, nzbn,
    registerStatus: text(status?.name || entity.entityStatusDescription) || "Status unavailable",
    registerUrl: `${registerBase}/${number}` };
}

export function parseNzbnSearch(payload: unknown): CompanyCandidate[] {
  const items = record(payload)?.items;
  if (!Array.isArray(items)) return [];
  return [...new Map(items.flatMap(item => {
    const parsed = candidate(item);
    return parsed ? [[parsed.companyNumber, parsed] as const] : [];
  })).values()].slice(0, 15);
}

export function parseNzbnDetail(payload: unknown, expected: CompanyCandidate): CompanyCandidate | null {
  const parsed = candidate(payload);
  return parsed && parsed.nzbn === expected.nzbn && parsed.companyNumber === expected.companyNumber &&
    parsed.legalName === expected.legalName ? parsed : null;
}

async function nzbnGet(path: string): Promise<unknown> {
  const config = getConfig().companyCheck;
  if (!config.enabled) throw new Error("Company check is disabled");
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json", "Ocp-Apim-Subscription-Key": config.nzbnApiKey },
    signal: AbortSignal.timeout(7_000), cache: "no-store", redirect: "manual",
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json") ||
    Number(response.headers.get("content-length") || "0") > 1_000_000) {
    throw new Error(`NZBN API request failed (${response.status})`);
  }
  const body = await response.text();
  if (body.length > 1_000_000) throw new Error("NZBN response exceeded size limit");
  return JSON.parse(body);
}

export async function searchOfficialCompanies(query: string): Promise<CompanyCandidate[]> {
  if (!query.trim() || query.length > 100 || /^https?:/i.test(query)) return [];
  const url = new URL(`${apiBase}/entities`);
  url.searchParams.set("search-term", query.trim());
  url.searchParams.set("page-size", "15");
  return parseNzbnSearch(await nzbnGet(`/entities${url.search}`));
}

export async function verifyOfficialCompany(expected: CompanyCandidate): Promise<CompanyCandidate | null> {
  if (!/^\d{13}$/.test(expected.nzbn || "")) return null;
  return parseNzbnDetail(await nzbnGet(`/entities/${expected.nzbn}`), expected);
}
