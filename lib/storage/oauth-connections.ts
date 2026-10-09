import type { PoolClient } from "pg";
import { getConfig } from "@/lib/config";
import { decryptToken, encryptToken } from "@/lib/security/encryption";
import { database } from "./database";

export type OAuthTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
};

export type OAuthConnection = OAuthTokenSet & { accountUUID: string };

type ConnectionRow = {
  account_uuid: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  access_token_expires_at: Date;
  scopes: string;
};

function fromRow(row: ConnectionRow): OAuthConnection {
  const key = getConfig().tokenEncryptionKey;
  return {
    accountUUID: row.account_uuid,
    accessToken: decryptToken(row.encrypted_access_token, key),
    refreshToken: decryptToken(row.encrypted_refresh_token, key),
    expiresAt: new Date(row.access_token_expires_at),
    scopes: row.scopes,
  };
}

async function upsertWithClient(client: PoolClient, accountUUID: string, tokens: OAuthTokenSet) {
  const key = getConfig().tokenEncryptionKey;
  await client.query(
    `INSERT INTO oauth_connections (
       account_uuid, encrypted_access_token, encrypted_refresh_token,
       access_token_expires_at, scopes
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (account_uuid) DO UPDATE SET
       encrypted_access_token = EXCLUDED.encrypted_access_token,
       encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
       access_token_expires_at = EXCLUDED.access_token_expires_at,
       scopes = EXCLUDED.scopes,
       updated_at = now()`,
    [
      accountUUID,
      encryptToken(tokens.accessToken, key),
      encryptToken(tokens.refreshToken, key),
      tokens.expiresAt,
      tokens.scopes,
    ],
  );
}

export async function saveOAuthConnection(accountUUID: string, tokens: OAuthTokenSet) {
  const client = await database().connect();
  try {
    await upsertWithClient(client, accountUUID, tokens);
  } finally {
    client.release();
  }
}

export async function getOAuthConnection(accountUUID: string): Promise<OAuthConnection | null> {
  const result = await database().query<ConnectionRow>(
    `SELECT account_uuid, encrypted_access_token, encrypted_refresh_token,
            access_token_expires_at, scopes
     FROM oauth_connections WHERE account_uuid = $1`,
    [accountUUID],
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function deleteOAuthConnection(accountUUID: string) {
  const result = await database().query("DELETE FROM oauth_connections WHERE account_uuid = $1", [accountUUID]);
  return result.rowCount === 1;
}

export async function refreshOAuthConnection(
  accountUUID: string,
  refresh: (current: OAuthConnection) => Promise<OAuthTokenSet>,
) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [accountUUID]);
    const result = await client.query<ConnectionRow>(
      `SELECT account_uuid, encrypted_access_token, encrypted_refresh_token,
              access_token_expires_at, scopes
       FROM oauth_connections WHERE account_uuid = $1 FOR UPDATE`,
      [accountUUID],
    );
    if (!result.rows[0]) throw new Error("OAuth connection not found");
    const current = fromRow(result.rows[0]);
    const refreshed = await refresh(current);
    await upsertWithClient(client, accountUUID, refreshed);
    await client.query("COMMIT");
    return { accountUUID, ...refreshed };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
