import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireCompanyCheck } from "@/lib/company-check/auth";
import { getConfig } from "@/lib/config";
import { readReport, savePropertySnapshot, readPropertyCache, savePropertyCache, takePropertyLookupSlot, type StoredProject } from "@/lib/company-check/report-store";
import { readPublicHtml } from "@/lib/company-check/public-html";

export const runtime = "nodejs";
export const maxDuration = 35;

const HOMES_API = "https://gateway.homes.co.nz";

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
function canonical(value: unknown) {
  return String(value || "").toLowerCase().replace(/\b(?:new zealand|nz)\b/g, "")
    .replace(/\b\d{4}\b/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function searchQuery(address: string) {
  return address.split(/[,\r\n]+/)[0].replace(/\b\d{4}\b/g, "").replace(/\s+/g, " ").trim();
}
async function addressOnProjectPage(address: string, projectUrl: unknown) {
  if (typeof projectUrl !== "string") return false;
  try {
    const html = await readPublicHtml(projectUrl);
    return Boolean(html && canonical(html.replace(/<[^>]+>/g, " ")).includes(canonical(address)));
  } catch { return false; }
}
async function homesRequest(path: string) {
  const reply = await fetch(`${HOMES_API}${path}`, {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!reply.ok) throw new Error(`Homes.co.nz lookup returned ${reply.status}.`);
  return reply.json();
}
type SearchResult = { Type?: number; PropertyID?: string | number; StreetNumber?: string; StreetAlpha?: string; Street?: string; StreetName?: string; Suburb?: string; City?: string; Title?: string };
type TimelineEvent = { key?: string; date?: string; source_id?: string; data?: Record<string, unknown> };

export async function POST(request: Request) {
  if (!getConfig().companyCheck.enabled) return response({ error: "Company check is not enabled." }, 503);
  const identity = await requireCompanyCheck(request);
  if (!identity) return response({ error: "Open Office Agent from ServiceM8 to start a staff session." }, 401);
  const staffIdentity = identity;
  if (Number(request.headers.get("content-length") || 0) > 4_096) return response({ error: "Request is too large." }, 413);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return response({ error: "Enter a complete property address." }, 400); }
  if (!body || typeof body !== "object") return response({ error: "Invalid property request." }, 400);
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (address.length < 10 || address.length > 180 || !/^\d+[a-z]?\s+\S.+,\s*\S+/i.test(address)) {
    return response({ error: "A street number, street name and locality are needed for a property check." }, 400);
  }
  if (typeof body.reportId !== "string" || typeof body.projectName !== "string") {
    return response({ error: "A saved report and project are required." }, 400);
  }
  let project: StoredProject | undefined;
  try {
    const report = await readReport(staffIdentity, body.reportId);
    project = report?.projects.find(item => item.name === body.projectName &&
      item.projectUrl === body.projectUrl && canonical(item.address) === canonical(address));
  } catch {
    return response({ error: "The saved report could not be checked." }, 503);
  }
  if (!project) return response({ error: "The project address is not in this saved report." }, 400);
  async function finish(result: Record<string, unknown>) {
    try { await savePropertySnapshot(staffIdentity, body.reportId as string, project!, result); }
    catch { return response({ error: "The property result could not be saved in this report." }, 503); }
    return response(result);
  }
  if (!await addressOnProjectPage(address, project.projectUrl)) {
    return finish({ status: "address_unverified", address,
      message: "The exact address could not be confirmed on the linked project page. No property lookup was made." });
  }
  const normalizedAddress = canonical(address);
  const key = createHash("sha256").update(normalizedAddress).digest("hex");
  try {
    const hit = await readPropertyCache(key);
    if (hit) return finish({ ...hit as object, fromCache: true });
    const waitMs = await takePropertyLookupSlot();
    if (waitMs > 0) {
      const retryAfterSeconds = Math.ceil(waitMs / 1000);
      return response({ error: "Lookup spacing is active.", retryAfterSeconds }, 429,
        { "Retry-After": String(retryAfterSeconds) });
    }
  } catch {
    return response({ error: "Property lookup spacing is unavailable; no Homes request was made." }, 503);
  }

  try {
    const query = searchQuery(address);
    const search = await homesRequest(`/address/search?Address=${encodeURIComponent(query)}`);
    const candidates: SearchResult[] = Array.isArray(search.Results)
      ? search.Results.filter((item: SearchResult) => Number(item.Type) === 4 && item.PropertyID) : [];
    const match = query.match(/^(\d+\s*[a-z]?)\s+(.+)$/i);
    const expectedNumber = canonical(match?.[1]);
    const expectedStreet = canonical(match?.[2]);
    const streetMatches = candidates.filter(item => canonical(`${item.StreetNumber || ""}${item.StreetAlpha || ""}`) === expectedNumber &&
      canonical(item.Street || item.StreetName) === expectedStreet);
    const localityMatches = streetMatches.filter(item =>
      Boolean((item.Suburb && normalizedAddress.includes(canonical(item.Suburb))) || (item.City && normalizedAddress.includes(canonical(item.City)))));
    const confirmed = localityMatches.length ? localityMatches : streetMatches.length === 1 ? streetMatches : [];
    if (confirmed.length !== 1) return finish({
      status: "uncertain_match", address, candidates: candidates.slice(0, 5).map(item => item.Title || "Unnamed property"),
      message: "No single exact address match was confirmed. No property facts were attached.",
    });
    const propertyId = confirmed[0].PropertyID!;
    const [properties, timeline] = await Promise.all([
      homesRequest(`/properties?property_ids=${encodeURIComponent(propertyId)}`),
      homesRequest(`/property/${encodeURIComponent(propertyId)}/timeline`),
    ]);
    const cards = Array.isArray(properties.cards) ? properties.cards : [];
    const card = cards.find((item: { property_id?: string; id?: string }) =>
      String(item.property_id || item.id) === String(propertyId)) || cards[0];
    if (!card?.property_details) return response({ error: "The address matched, but property details were unavailable." }, 502);
    const d = card.property_details;
    const events: TimelineEvent[] = Array.isArray(timeline.events) ? timeline.events : [];
    const valuations = events.filter(item => String(item.key).toLowerCase() === "valuation").slice(0, 5).map(item => ({
      date: item.date || "", capitalValue: item.data?.capital_value ?? null,
      improvementValue: item.data?.improvement_value ?? null, landValue: item.data?.land_value ?? null,
    }));
    const sales = events.filter(item => ["sale", "sold", "property_sale"].includes(String(item.key).toLowerCase())).slice(0, 5).map(item => ({
      date: item.date || "", price: item.data?.sale_price ?? item.data?.price ?? item.data?.amount ?? null,
    }));
    const consents = events.filter(item => String(item.key).toLowerCase() === "consent").slice(0, 10).map(item => ({
      date: item.data?.occured_on || item.date || "",
      number: item.data?.consent_id || item.data?.consent_number || item.data?.bc_number ||
        item.data?.application_number || item.source_id || "",
      action: item.data?.action || item.data?.type || "",
      value: item.data?.value ?? null,
      description: item.data?.description || item.data?.consent_description || "",
    }));
    const homesPath = typeof card.url === "string" && card.url.startsWith("/") && !card.url.startsWith("//") ? card.url : "";
    const result = {
      status: "matched", address, fetchedAt: new Date().toISOString(),
      matchedAddress: d.display_address || d.address || confirmed[0].Title || address,
      certificateOfTitle: d.certificate_of_title || null, legalDescription: d.legal_description || null,
      ownershipType: d.ownership_type || null, bedrooms: d.num_bedrooms ?? null,
      bathrooms: d.num_bathrooms ?? null, carSpaces: d.num_car_spaces ?? null,
      offStreetParking: d.off_street_parking ?? null, garageParking: d.garage_parking ?? null,
      landArea: d.land_area ?? null, floorArea: d.floor_area ?? null, yearBuilt: d.decade_built || null,
      constructionCode: d.building_construction || null, hasDeck: d.has_deck ?? null,
      siteCoverage: d.building_site_coverage ?? null, contourCode: d.contour || null,
      valuations, sales, consents, sourceUrl: homesPath ? `https://homes.co.nz${homesPath}` : "https://homes.co.nz/",
      fromCache: false,
    };
    try { await savePropertyCache(key, result); } catch {
      return response({ error: "Property data was found, but the cache was unavailable. No result was released." }, 503);
    }
    return finish(result);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "The property lookup failed." }, 502);
  }
}
