import { describe, expect, it, vi } from "vitest";
import { fetchVendorAccountUUID, ServiceM8Client } from "@/lib/servicem8/client";
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
  it("retrieves the signed staff member and validates its identity", async () => {
    const fetcher = vi.fn(async () => Response.json({ uuid: staffUUID, first: " May ", last: "Yang" })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });
    await expect(client.getStaff(staffUUID)).resolves.toMatchObject({ uuid: staffUUID, first: "May" });
    expect(String((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0])).toBe(
      `https://api.servicem8.com/api_1.0/staff/${staffUUID}.json`,
    );
  });

  it("rejects a Staff response for a different identity", async () => {
    const fetcher = vi.fn(async () => Response.json({
      uuid: "123e4567-cb72-4d94-8a1e-d454131257eb",
      first: "Wrong",
    })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });
    await expect(client.getStaff(staffUUID)).rejects.toMatchObject({ status: 403 });
  });

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

  it("reads Email and Note detail only by validated IDs under staff impersonation", async () => {
    const fetcher = vi.fn(async () => Response.json({ uuid: jobUUID })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });
    await client.getJobEmail(jobUUID);
    await client.getJobNote(jobUUID);
    const calls = (fetcher as ReturnType<typeof vi.fn>).mock.calls as [URL, RequestInit][];
    expect(calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      `/api_1.0/email/${jobUUID}.json`, `/api_1.0/dbonote/${jobUUID}.json`,
    ]);
    expect(calls.every(([, init]) => init.method === "GET" && new Headers(init.headers).get("x-impersonate-uuid") === staffUUID)).toBe(true);
    expect(() => client.getJobEmail("invalid-id")).toThrow();
    expect(calls).toHaveLength(2);
  });

  it("looks up only the explicitly supplied Job numbers with exact filters", async () => {
    const fetcher = vi.fn(async (url: URL) => Response.json([{
      uuid: jobUUID,
      generated_job_id: url.toString().includes("R260766") ? "R260766" : "R260680",
    }])) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });

    await expect(client.listJobsByNumber(["R260766", "R260680"])).resolves.toHaveLength(2);
    const urls = (fetcher as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => new URL(String(url)));
    expect(urls.map((url) => url.searchParams.get("$filter"))).toEqual([
      "generated_job_id eq 'R260766'",
      "generated_job_id eq 'R260680'",
    ]);
    expect(urls.every((url) => url.searchParams.get("cursor") === "-1")).toBe(true);
  });

  it("reads one staff-scoped Job page and preserves the server cursor", async () => {
    const nextCursor = "123e4567-cb72-4d94-8a1e-d454131257eb";
    const fetcher = vi.fn(async () => Response.json([{ uuid: jobUUID }], {
      headers: { "x-next-cursor": nextCursor },
    })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });

    await expect(client.listJobsPage(null)).resolves.toEqual({
      records: [{ uuid: jobUUID }],
      nextCursor,
    });
    const [url, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api_1.0/job.json");
    expect(url.searchParams.get("cursor")).toBe("-1");
    expect(new Headers(init.headers).get("x-impersonate-uuid")).toBe(staffUUID);
  });

  it("reads one filtered Job-note page and returns only the server cursor", async () => {
    const nextCursor = "123e4567-cb72-4d94-8a1e-d454131257eb";
    const fetcher = vi.fn(async () => Response.json([{ uuid: jobUUID }], {
      headers: { "x-next-cursor": nextCursor },
    })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });

    await expect(client.listJobNotesPage(jobUUID, null)).resolves.toEqual({
      records: [{ uuid: jobUUID }],
      nextCursor,
    });
    const url = new URL(String((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(url.pathname).toBe("/api_1.0/note.json");
    expect(url.searchParams.get("$filter")).toBe(`related_object eq 'job' and related_object_uuid eq '${jobUUID}'`);
    expect(url.searchParams.get("cursor")).toBe("-1");
  });

  it.each([
    ["listJobEmailsPage", "email.json", `related_object eq 'job' and related_object_uuid eq '${jobUUID}'`],
    ["listJobActivitiesPage", "jobactivity.json", `job_uuid eq '${jobUUID}'`],
    ["listJobAttachmentsPage", "attachment.json", `related_object eq 'job' and related_object_uuid eq '${jobUUID}'`],
    ["listJobSmsPage", "sms.json", `related_object eq 'job' and related_object_uuid eq '${jobUUID}'`],
    ["listJobPaymentsPage", "jobpayment.json", `job_uuid eq '${jobUUID}'`],
  ] as const)("reads %s with exact Job filter and staff impersonation", async (method, resource, filter) => {
    const nextCursor = "123e4567-cb72-4d94-8a1e-d454131257eb";
    const fetcher = vi.fn(async () => Response.json([{ uuid: jobUUID }], {
      headers: { "x-next-cursor": nextCursor },
    })) as unknown as typeof fetch;
    const client = new ServiceM8Client(accountUUID, staffUUID, {
      fetcher,
      now: () => new Date("2030-01-01T00:00:00Z"),
      getConnection: vi.fn(async () => validConnection),
    });
    await expect(client[method](jobUUID, null)).resolves.toEqual({
      records: [{ uuid: jobUUID }], nextCursor,
    });
    const [url, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe(`/api_1.0/${resource}`);
    expect(url.searchParams.get("$filter")).toBe(filter);
    expect(url.searchParams.get("cursor")).toBe("-1");
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

describe("ServiceM8 Vendor binding diagnostics", () => {
  it("classifies a denied Vendor request without retaining its response body", async () => {
    const fetcher = vi.fn(async () => new Response("private denial body", { status: 403 })) as unknown as typeof fetch;

    await expect(fetchVendorAccountUUID("private-token", fetcher)).rejects.toMatchObject({
      diagnosticCode: "vendor_http_error",
      status: 403,
    });
  });

  it.each([
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    Response.json([]),
    Response.json([{ uuid: "not-a-uuid" }]),
    Response.json([{ uuid: accountUUID }, { uuid: staffUUID }]),
  ])("classifies an unusable successful Vendor response", async (response) => {
    const fetcher = vi.fn(async () => response) as unknown as typeof fetch;

    await expect(fetchVendorAccountUUID("private-token", fetcher)).rejects.toMatchObject({
      diagnosticCode: "vendor_invalid_response",
      status: 200,
    });
  });

  it("returns the single valid Vendor UUID", async () => {
    const fetcher = vi.fn(async () => Response.json([{ uuid: accountUUID }])) as unknown as typeof fetch;

    await expect(fetchVendorAccountUUID("private-token", fetcher)).resolves.toBe(accountUUID);
  });
});
