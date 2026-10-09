import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrationPath = fileURLToPath(new URL("./migrations/0001_security_state.sql", import.meta.url));
const sql = await readFile(migrationPath, "utf8");
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.info("Applied 0001_security_state.sql");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
