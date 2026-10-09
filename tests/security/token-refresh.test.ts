import { describe, expect, it, vi } from "vitest";
import { encryptToken } from "@/lib/security/encryption";

const { query, release, connect } = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  return { query, release, connect: vi.fn(async () => ({ query, release })) };
});

const encryptionKey = Buffer.alloc(32, 7).toString("base64");
vi.mock("@/lib/config", () => ({
  getConfig: () => ({ tokenEncryptionKey: encryptionKey }),
}));
vi.mock("@/lib/storage/database", () => ({
  database: () => ({ connect }),
}));

import { refreshOAuthConnection } from "@/lib/storage/oauth-connections";

const accountUUID = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";

describe("atomic token refresh storage", () => {
  it("locks the account and commits both rotated tokens in one transaction", async () => {
    query.mockReset();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM oauth_connections")) {
        return {
          rows: [{
            account_uuid: accountUUID,
            encrypted_access_token: encryptToken("old-access", encryptionKey),
            encrypted_refresh_token: encryptToken("old-refresh", encryptionKey),
            access_token_expires_at: new Date(0),
            scopes: "vendor read_jobs read_customers",
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const rotated = await refreshOAuthConnection(accountUUID, async (current) => {
      expect(current.refreshToken).toBe("old-refresh");
      return {
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresAt: new Date("2030-01-01T01:00:00Z"),
        scopes: current.scopes,
      };
    });

    expect(rotated.refreshToken).toBe("new-refresh");
    const statements = query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, " ").trim());
    expect(statements[0]).toBe("BEGIN");
    expect(statements[1]).toContain("pg_advisory_xact_lock");
    expect(statements[2]).toContain("FOR UPDATE");
    expect(statements[3]).toContain("ON CONFLICT (account_uuid) DO UPDATE");
    expect(statements[4]).toBe("COMMIT");
    const updateParameters = query.mock.calls[3][1] as unknown[];
    expect(updateParameters).not.toContain("new-access");
    expect(updateParameters).not.toContain("new-refresh");
    expect(release).toHaveBeenCalled();
  });

  it("rolls back and preserves the stored token when rotation fails", async () => {
    query.mockReset();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM oauth_connections")) {
        return {
          rows: [{
            account_uuid: accountUUID,
            encrypted_access_token: encryptToken("old-access", encryptionKey),
            encrypted_refresh_token: encryptToken("old-refresh", encryptionKey),
            access_token_expires_at: new Date(0),
            scopes: "vendor read_jobs read_customers",
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    await expect(refreshOAuthConnection(accountUUID, async () => { throw new Error("invalid_grant"); })).rejects.toThrow("invalid_grant");
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });
});
