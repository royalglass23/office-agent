import { createHash, randomUUID } from "node:crypto";
import { database } from "@/lib/storage/database";
import type { AssistantIdentity } from "@/lib/security/assistant-session";

export type StoredProject = { name: string; address: string | null; projectUrl: string };
export type StoredReport = {
  reportId: string; checkedAt: string; savedAt: string; reviewDueAt: string;
  companyName: string; companyNumber?: string | null; input: string; projects: StoredProject[];
  [key: string]: unknown;
};
type ReportContent = {
  checkedAt: string; companyName: string; companyNumber?: string | null;
  input: string; projects: StoredProject[]; [key: string]: unknown;
};

export function projectKey(project: StoredProject) { return `${project.projectUrl}|${project.name}`; }

export async function beginResearchRequest(identity: AssistantIdentity, requestKey: string) {
  const prior = await database().query<{ report: StoredReport }>(
    "SELECT report FROM company_check_reports WHERE account_uuid=$1 AND request_key=$2",
    [identity.accountUUID, requestKey],
  );
  if (prior.rows[0]) return { status: "completed" as const, report: prior.rows[0].report };
  const claim = await database().query(
    `INSERT INTO company_check_research_requests (account_uuid, request_key) VALUES ($1,$2)
     ON CONFLICT (account_uuid, request_key) DO UPDATE SET started_at=now()
       WHERE company_check_research_requests.started_at < now() - interval '2 minutes'
     RETURNING request_key`,
    [identity.accountUUID, requestKey],
  );
  return claim.rowCount ? { status: "started" as const } : { status: "running" as const };
}

export async function finishResearchRequest(identity: AssistantIdentity, requestKey: string) {
  await database().query(
    "DELETE FROM company_check_research_requests WHERE account_uuid=$1 AND request_key=$2",
    [identity.accountUUID, requestKey],
  );
}

export async function saveReport(identity: AssistantIdentity, requestKey: string, report: ReportContent) {
  const reportId = randomUUID();
  const savedAt = new Date().toISOString();
  const reviewDueAt = new Date(savedAt);
  reviewDueAt.setUTCFullYear(reviewDueAt.getUTCFullYear() + 1);
  const saved: StoredReport = { ...report, reportId, savedAt, reviewDueAt: reviewDueAt.toISOString() };
  const result = await database().query<{ report: StoredReport }>(
    `INSERT INTO company_check_reports
      (report_id, account_uuid, created_by_staff_uuid, request_key, company_number, checked_at, saved_at, review_due_at, report)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (account_uuid, request_key) DO UPDATE SET request_key = EXCLUDED.request_key
     RETURNING report`,
    [reportId, identity.accountUUID, identity.staffUUID, requestKey, report.companyNumber ?? null,
      report.checkedAt, savedAt, reviewDueAt, JSON.stringify(saved)],
  );
  return result.rows[0].report;
}

export async function readReport(identity: AssistantIdentity, reportId: string): Promise<StoredReport | null> {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(reportId)) return null;
  const result = await database().query<{ report: StoredReport }>(
    "SELECT report FROM company_check_reports WHERE account_uuid=$1 AND report_id=$2",
    [identity.accountUUID, reportId],
  );
  return result.rows[0]?.report ?? null;
}

export async function listReports(identity: AssistantIdentity) {
  const result = await database().query<{ report: StoredReport }>(
    "SELECT report FROM company_check_reports WHERE account_uuid=$1 ORDER BY saved_at DESC LIMIT 100",
    [identity.accountUUID],
  );
  return result.rows.map(({ report }) => ({
    reportId: report.reportId, companyName: report.companyName, companyNumber: report.companyNumber ?? null, input: report.input,
    checkedAt: report.checkedAt, savedAt: report.savedAt, reviewDueAt: report.reviewDueAt,
    projectCount: report.projects.length,
  }));
}

export async function savePropertySnapshot(identity: AssistantIdentity, reportId: string, project: StoredProject, result: unknown) {
  const key = createHash("sha256").update(projectKey(project)).digest("hex");
  await database().query(
    `INSERT INTO company_check_property_results (report_id, project_key, result)
     SELECT report_id, $3, $4::jsonb FROM company_check_reports WHERE account_uuid=$1 AND report_id=$2
     ON CONFLICT (report_id, project_key) DO UPDATE SET result=EXCLUDED.result, checked_at=now()`,
    [identity.accountUUID, reportId, key, JSON.stringify(result)],
  );
}

export async function readPropertySnapshots(identity: AssistantIdentity, report: StoredReport) {
  const result = await database().query<{ project_key: string; result: unknown }>(
    `SELECT p.project_key, p.result FROM company_check_property_results p
     JOIN company_check_reports r ON r.report_id=p.report_id
     WHERE r.account_uuid=$1 AND r.report_id=$2`,
    [identity.accountUUID, report.reportId],
  );
  const byHash = new Map(result.rows.map(row => [row.project_key, row.result]));
  return Object.fromEntries(report.projects.flatMap(project => {
    const hash = createHash("sha256").update(projectKey(project)).digest("hex");
    return byHash.has(hash) ? [[projectKey(project), byHash.get(hash)]] : [];
  }));
}

export async function readPropertyCache(addressHash: string) {
  const result = await database().query<{ result: unknown }>(
    "SELECT result FROM company_check_property_cache WHERE address_hash=$1 AND fetched_at > now() - interval '30 days'",
    [addressHash],
  );
  return result.rows[0]?.result ?? null;
}

export async function savePropertyCache(addressHash: string, result: unknown) {
  await database().query(
    `INSERT INTO company_check_property_cache (address_hash, result, fetched_at) VALUES ($1,$2::jsonb,now())
     ON CONFLICT (address_hash) DO UPDATE SET result=EXCLUDED.result, fetched_at=now()`,
    [addressHash, JSON.stringify(result)],
  );
}

export async function takePropertyLookupSlot() {
  const result = await database().query<{ wait_ms: number }>(
    `INSERT INTO company_check_lookup_spacing (name, next_lookup_at)
     VALUES ('homes', now() + interval '12.5 seconds')
     ON CONFLICT (name) DO UPDATE SET next_lookup_at=now() + interval '12.5 seconds'
       WHERE company_check_lookup_spacing.next_lookup_at <= now()
     RETURNING 0::integer AS wait_ms`,
  );
  if (result.rowCount) return 0;
  const wait = await database().query<{ wait_ms: number }>(
    "SELECT GREATEST(1000, EXTRACT(EPOCH FROM (next_lookup_at-now())) * 1000)::integer AS wait_ms FROM company_check_lookup_spacing WHERE name='homes'",
  );
  return wait.rows[0]?.wait_ms ?? 12_500;
}
