import { z } from "zod";
import { getOAuthConnection, refreshOAuthConnection, type OAuthConnection } from "@/lib/storage/oauth-connections";
import { exchangeRefreshToken } from "./oauth";
import { uuidSchema } from "./event-schema";

const API_BASE_URL = "https://api.servicem8.com/api_1.0/";
const EXPIRY_BUFFER_MS = 30_000;

const vendorSchema = z.object({ uuid: uuidSchema }).passthrough();
const staffSchema = z.object({
  uuid: uuidSchema,
  first: z.string().trim().min(1).max(30),
  last: z.string().trim().max(30).optional(),
}).passthrough();

export class ServiceM8ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable = false,
    readonly diagnosticCode?: "vendor_http_error" | "vendor_invalid_response",
  ) {
    super(message);
    this.name = "ServiceM8ApiError";
  }
}

type ClientDependencies = {
  fetcher?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  getConnection?: typeof getOAuthConnection;
  refreshConnection?: typeof refreshOAuthConnection;
};

function retryDelay(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter === null) return 250;
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, 2_000) : 250;
}

export class ServiceM8Client {
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly getConnection: typeof getOAuthConnection;
  private readonly refreshConnection: typeof refreshOAuthConnection;

  constructor(
    private readonly accountUUID: string,
    private readonly staffUUID: string,
    dependencies: ClientDependencies = {},
  ) {
    uuidSchema.parse(accountUUID);
    uuidSchema.parse(staffUUID);
    this.fetcher = dependencies.fetcher ?? fetch;
    this.now = dependencies.now ?? (() => new Date());
    this.sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.getConnection = dependencies.getConnection ?? getOAuthConnection;
    this.refreshConnection = dependencies.refreshConnection ?? refreshOAuthConnection;
  }

  private async connection(forceRefresh = false, rejectedAccessToken?: string) {
    const current = await this.getConnection(this.accountUUID);
    if (!current) throw new ServiceM8ApiError("ServiceM8 account is not connected", 401);
    if (!forceRefresh && current.expiresAt.getTime() > this.now().getTime() + EXPIRY_BUFFER_MS) return current;

    try {
      return await this.refreshConnection(this.accountUUID, async (locked) => {
        // Another request may have rotated the token while this caller waited for the DB lock.
        if (forceRefresh && rejectedAccessToken && locked.accessToken !== rejectedAccessToken) return locked;
        if (!forceRefresh && locked.expiresAt.getTime() > this.now().getTime() + EXPIRY_BUFFER_MS) return locked;
        return exchangeRefreshToken(locked.refreshToken, this.fetcher, this.now());
      });
    } catch {
      throw new ServiceM8ApiError("ServiceM8 account must be reconnected", 401);
    }
  }

  private async request(path: string) {
    let connection = await this.connection();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(new URL(path, API_BASE_URL), {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${connection.accessToken}`,
            "x-impersonate-uuid": this.staffUUID,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        if (attempt === 0) {
          await this.sleep(250);
          continue;
        }
        throw new ServiceM8ApiError("ServiceM8 request timed out", 503, true);
      }

      if (response.ok) return response;
      if (response.status === 401 && attempt === 0) {
        connection = await this.connection(true, connection.accessToken);
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await this.sleep(retryDelay(response));
        continue;
      }
      throw new ServiceM8ApiError(
        response.status === 401 || response.status === 403 || response.status === 404
          ? "ServiceM8 denied this request"
          : "ServiceM8 request failed",
        response.status,
        response.status === 429 || response.status >= 500,
      );
    }
    throw new ServiceM8ApiError("ServiceM8 request failed", 503, true);
  }

  private async get(path: string) {
    return (await this.request(path)).json() as Promise<unknown>;
  }

  getVendor() {
    return this.get("vendor.json");
  }

  getJob(jobUUID: string) {
    uuidSchema.parse(jobUUID);
    return this.get(`job/${jobUUID}.json`);
  }

  listJob(jobUUID: string) {
    uuidSchema.parse(jobUUID);
    const query = new URLSearchParams({ $filter: `uuid eq '${jobUUID}'` });
    return this.get(`job.json?${query}`);
  }

  async listJobsByNumber(jobNumbers: readonly string[]) {
    const records: unknown[] = [];
    for (const jobNumber of jobNumbers) {
      if (!/^[A-Z]\d{6}$/.test(jobNumber)) throw new Error("Invalid ServiceM8 Job number");
      const query = new URLSearchParams({
        $filter: `generated_job_id eq '${jobNumber}'`,
        cursor: "-1",
      });
      const page = await this.get(`job.json?${query}`);
      if (!Array.isArray(page)) throw new ServiceM8ApiError("ServiceM8 returned an invalid Job list", 502);
      records.push(...page);
    }
    return records;
  }

  async listJobsPage(cursor: string | null) {
    if (cursor !== null) uuidSchema.parse(cursor);
    const query = new URLSearchParams({ cursor: cursor ?? "-1" });
    const response = await this.request(`job.json?${query}`);
    const records = await response.json() as unknown;
    if (!Array.isArray(records)) throw new ServiceM8ApiError("ServiceM8 returned an invalid Job list", 502);
    const nextCursor = response.headers.get("x-next-cursor");
    if (nextCursor !== null) uuidSchema.parse(nextCursor);
    return { records, nextCursor };
  }

  async listJobNotesPage(jobUUID: string, cursor: string | null) {
    uuidSchema.parse(jobUUID);
    if (cursor !== null) uuidSchema.parse(cursor);
    const query = new URLSearchParams({
      $filter: `related_object eq 'job' and related_object_uuid eq '${jobUUID}'`,
      cursor: cursor ?? "-1",
    });
    const response = await this.request(`note.json?${query}`);
    const records = await response.json() as unknown;
    if (!Array.isArray(records)) throw new ServiceM8ApiError("ServiceM8 returned an invalid Note list", 502);
    const nextCursor = response.headers.get("x-next-cursor");
    if (nextCursor !== null) uuidSchema.parse(nextCursor);
    return { records, nextCursor };
  }

  private async listAuditPage(resource: "email" | "jobactivity" | "attachment" | "sms" | "jobpayment", jobUUID: string, cursor: string | null) {
    uuidSchema.parse(jobUUID);
    if (cursor !== null) uuidSchema.parse(cursor);
    const filter = resource === "jobactivity" || resource === "jobpayment"
      ? `job_uuid eq '${jobUUID}'`
      : `related_object eq 'job' and related_object_uuid eq '${jobUUID}'`;
    const query = new URLSearchParams({ $filter: filter, cursor: cursor ?? "-1" });
    const response = await this.request(`${resource}.json?${query}`);
    const records = await response.json() as unknown;
    if (!Array.isArray(records)) throw new ServiceM8ApiError("ServiceM8 returned an invalid audit list", 502);
    const nextCursor = response.headers.get("x-next-cursor");
    if (nextCursor !== null) uuidSchema.parse(nextCursor);
    return { records, nextCursor };
  }

  listJobEmailsPage(jobUUID: string, cursor: string | null) {
    return this.listAuditPage("email", jobUUID, cursor);
  }

  listJobActivitiesPage(jobUUID: string, cursor: string | null) {
    return this.listAuditPage("jobactivity", jobUUID, cursor);
  }

  listJobAttachmentsPage(jobUUID: string, cursor: string | null) {
    return this.listAuditPage("attachment", jobUUID, cursor);
  }

  listJobSmsPage(jobUUID: string, cursor: string | null) {
    return this.listAuditPage("sms", jobUUID, cursor);
  }

  listJobPaymentsPage(jobUUID: string, cursor: string | null) {
    return this.listAuditPage("jobpayment", jobUUID, cursor);
  }

  getCompany(companyUUID: string) {
    uuidSchema.parse(companyUUID);
    return this.get(`company/${companyUUID}.json`);
  }

  async getStaff(staffUUID: string) {
    uuidSchema.parse(staffUUID);
    const staff = staffSchema.safeParse(await this.get(`staff/${staffUUID}.json`));
    if (!staff.success) throw new ServiceM8ApiError("ServiceM8 returned an invalid Staff record", 502);
    if (staff.data.uuid !== staffUUID) throw new ServiceM8ApiError("ServiceM8 Staff identity mismatch", 403);
    return staff.data;
  }
}

export async function fetchVendorAccountUUID(accessToken: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(new URL("vendor.json", API_BASE_URL), {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new ServiceM8ApiError("Unable to bind the ServiceM8 account", response.status, false, "vendor_http_error");
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ServiceM8ApiError(
      "ServiceM8 returned an invalid Vendor identity",
      response.status,
      false,
      "vendor_invalid_response",
    );
  }
  const vendors = z.array(vendorSchema).safeParse(payload);
  if (!vendors.success || vendors.data.length !== 1) {
    throw new ServiceM8ApiError(
      "ServiceM8 returned an invalid Vendor identity",
      response.status,
      false,
      "vendor_invalid_response",
    );
  }
  return vendors.data[0].uuid;
}

export async function requireVendorAccount(client: ServiceM8Client, expectedAccountUUID: string) {
  const vendors = z.array(vendorSchema).safeParse(await client.getVendor());
  if (!vendors.success || vendors.data.length !== 1 || vendors.data[0].uuid !== expectedAccountUUID) {
    throw new ServiceM8ApiError("ServiceM8 account identity mismatch", 403);
  }
}

export type { OAuthConnection };
