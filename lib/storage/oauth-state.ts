import { createHash } from "node:crypto";
import { database } from "./database";

function stateHash(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export async function saveOAuthState(state: string, expiresAt: Date) {
  await database().query("DELETE FROM oauth_states WHERE expires_at <= now()");
  await database().query(
    `INSERT INTO oauth_states (state_hash, expires_at)
     VALUES ($1, $2)
     ON CONFLICT (state_hash) DO NOTHING`,
    [stateHash(state), expiresAt],
  );
}

export async function consumeOAuthState(state: string, now = new Date()) {
  const result = await database().query(
    `DELETE FROM oauth_states
     WHERE state_hash = $1 AND expires_at > $2
     RETURNING state_hash`,
    [stateHash(state), now],
  );
  return result.rowCount === 1;
}
