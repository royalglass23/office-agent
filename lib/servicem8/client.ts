import { z } from "zod";
import { getOAuthConnection, refreshOAuthConnection, type OAuthConnection } from "@/lib/storage/oauth-connections";
import { exchangeRefreshToken } from "./oauth";
import { uuidSchema } from "./event-schema";

const API_BASE_URL = "https://api.servicem8.com/api_1.0/";
const EXPIRY_BUFFER_MS = 30_000;

const vendorSchema = z.object({ uuid: uuidSchema }).passthrough();

export class ServiceM8ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable = false,
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

  private async get(path: string) {
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

      if (response.ok) return response.json() as Promise<unknown>;
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

  getCompany(companyUUID: string) {
    uuidSchema.parse(companyUUID);
    return this.get(`company/${companyUUID}.json`);
  }
}

export async function fetchVendorAccountUUID(accessToken: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(new URL("vendor.json", API_BASE_URL), {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ServiceM8ApiError("Unable to bind the ServiceM8 account", response.status);
  const vendors = z.array(vendorSchema).safeParse(await response.json());
  if (!vendors.success || vendors.data.length !== 1) {
    throw new ServiceM8ApiError("ServiceM8 returned an invalid Vendor identity", 502);
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
