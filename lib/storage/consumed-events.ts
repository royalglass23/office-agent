import { database } from "./database";

export async function consumeEventHash(eventHash: string, expiresAt: Date) {
  await database().query("DELETE FROM consumed_events WHERE expires_at <= now()");
  const result = await database().query(
    `INSERT INTO consumed_events (event_hash, expires_at)
     VALUES ($1, $2)
     ON CONFLICT (event_hash) DO NOTHING
     RETURNING event_hash`,
    [eventHash, expiresAt],
  );
  return result.rowCount === 1;
}
