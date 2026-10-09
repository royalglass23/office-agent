import { describe, expect, it, vi } from "vitest";
import { ServiceM8Client } from "@/lib/servicem8/client";
import type { OAuthConnection, OAuthTokenSet } from "@/lib/storage/oauth-connections";

const accountUUID = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";
const staffUUID = "9d914a06-221e-4013-8b4d-2735272710eb";
const jobUUID = "0686ce69-4a5d-4f73-ad56-827ffaaced2b";
const validConnection = {
  accountUUID,
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: new Date("2030-01-01T01:00:00Z"),
  scopes: "vendor read_jobs read_customers",
};

describe("ServiceM8Client", () => {
  it("sends the verified staff impersonation header on every read", async () => {
    const fetcher = vi.fn(async () => Response.json({ uuid: jobUUID })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });
    await client.getJob(jobUUID);
    const init = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer access-token");
    expect(new Headers(init.headers).get("x-impersonate-uuid")).toBe(staffUUID);
  });

  it("fails closed when the account has no OAuth connection", async () => {
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      getConnection: vi.fn(async () => null),
    });
    await expect(client.getJob(jobUUID)).rejects.toMatchObject({ status: 401 });
  });

  it("never returns a denied direct Job response body", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ uuid: jobUUID, secret: "leak" }), { status: 403 })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });
    await expect(client.getJob(jobUUID)).rejects.toMatchObject({ status: 403 });
  });

  it("reuses a token another caller refreshed while waiting for the account lock", async () => {
    const rejected = { ...validConnection, accessToken: "rejected-token" };
    const rotated = { ...validConnection, accessToken: "already-rotated-token" };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ uuid: jobUUID })) as unknown as typeof fetch;
    const refreshConnection = vi.fn(async (
      _account: string,
      refresh: (value: OAuthConnection) => Promise<OAuthTokenSet>,
    ) => ({ accountUUID, ...(await refresh(rotated)) }));
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => rejected),
      refreshConnection,
    });

    await client.getJob(jobUUID);
    expect(refreshConnection).toHaveBeenCalledOnce();
    const secondHeaders = new Headers(((fetcher as ReturnType<typeof vi.fn>).mock.calls[1][1] as RequestInit).headers);
    expect(secondHeaders.get("authorization")).toBe("Bearer already-rotated-token");
  });

  it("uses one bounded fallback retry when Retry-After is absent", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ uuid: jobUUID })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      sleep,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });
    await client.getJob(jobUUID);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("converts a revoked refresh grant into reconnect guidance", async () => {
    const expired = { ...validConnection, expiresAt: new Date("2029-01-01T00:00:00Z") };
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => expired),
      refreshConnection: vi.fn(async () => { throw new Error("invalid_grant"); }),
    });
    await expect(client.getJob(jobUUID)).rejects.toMatchObject({ status: 401 });
  });

  it("retries one timeout and then fails with a retryable 503", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetcher = vi.fn(async () => { throw new DOMException("timed out", "TimeoutError"); }) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      sleep,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });
    await expect(client.getJob(jobUUID)).rejects.toMatchObject({ status: 503, retryable: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });
});
