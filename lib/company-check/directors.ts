export type DirectorRole = {
  name: string;
  status: "current" | "former";
  appointedOn: string | null;
  ceasedOn: string | null;
};

export type DirectorRegisterResult = {
  status: "verified" | "unavailable";
  sourceUrl: string | null;
  roles: DirectorRole[];
};

const registerHost = "app.companiesoffice.govt.nz";

function recordNumber(url: string | null, expectedCompanyNumber: string | null): string | null {
  if (!url || !expectedCompanyNumber || !/^\d+$/.test(expectedCompanyNumber)) return null;
  const record = new URL(url);
  if (record.hostname !== registerHost) return null;
  const match = record.pathname.match(/^\/(?:co|companies\/app\/ui\/pages\/companies)\/(\d+)\/?$/);
  return match?.[1] === expectedCompanyNumber ? match[1] : null;
}

function plainText(html: string) {
  return html.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex: string, decimal: string) =>
      String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10)))
    .replace(/\s+/g, " ").trim();
}

export function parseDirectorsPage(html: string, companyNumber: string, legalName: string): DirectorRole[] {
  const heading = html.match(/<h1>\s*([^<]+)\s*<span class="entityIdentifier">\((\d+)\)/i);
  if (!heading || heading[2] !== companyNumber || plainText(heading[1]).toLowerCase() !== legalName.trim().toLowerCase()) return [];
  const panel = html.match(/<div[^>]*id="directorsPanel"[^>]*>([\s\S]*?)<script\b/i)?.[1];
  if (!panel) return [];
  const historyStarts = panel.search(/<div class="historic">/i);
  const namePattern = /<div class="row"><label[^>]*for="fullName"[^>]*>[^<]*<\/label>([\s\S]*?)<\/div>/gi;
  const matches = [...panel.matchAll(namePattern)];
  return matches.slice(0, 20).flatMap((match, index) => {
    const name = plainText(match[1]);
    if (!name || name.length > 120) return [];
    const end = index + 1 < matches.length ? matches[index + 1].index : panel.length;
    const block = panel.slice(match.index, end);
    const date = (field: string) => {
      const found = block.match(new RegExp(`<div class="row"><label[^>]*for="${field}"[^>]*>[^<]*<\\/label>([\\s\\S]*?)<\\/div>`, "i"));
      const value = found ? plainText(found[1]) : "";
      return /^\d{1,2} [A-Za-z]{3} \d{4}$/.test(value) ? value : null;
    };
    const former = historyStarts >= 0 && match.index > historyStarts;
    return [{ name, status: former ? "former" as const : "current" as const,
      appointedOn: date("appointmentDate"), ceasedOn: former ? date("ceasedDate") : null }];
  });
}

export async function getDirectors(registerUrl: string | null, companyNumber: string | null, legalName: string | null): Promise<DirectorRegisterResult> {
  const number = recordNumber(registerUrl, companyNumber);
  if (!number || !legalName) return { status: "unavailable", sourceUrl: null, roles: [] };
  const sourceUrl = `https://${registerHost}/companies/app/ui/pages/companies/${number}/directors`;
  try {
    const response = await fetch(sourceUrl, { redirect: "manual", signal: AbortSignal.timeout(7_000), cache: "no-store",
      headers: { "User-Agent": "RoyalGlassCompanyResearchPreview/1.0" } });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html") ||
      Number(response.headers.get("content-length") || "0") > 1_000_000) throw new Error("Director source unavailable");
    const html = (await response.text()).slice(0, 1_000_000);
    const roles = parseDirectorsPage(html, number, legalName);
    return roles.length ? { status: "verified", sourceUrl, roles } : { status: "unavailable", sourceUrl, roles: [] };
  } catch { return { status: "unavailable", sourceUrl, roles: [] }; }
}
