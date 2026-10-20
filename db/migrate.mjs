import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrations = ["0001_security_state.sql", "0002_company_check.sql"];
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("BEGIN");
  for (const filename of migrations) {
    const migrationPath = fileURLToPath(new URL(`./migrations/${filename}`, import.meta.url));
    await client.query(await readFile(migrationPath, "utf8"));
  }
  await client.query("COMMIT");
  console.info(`Applied ${migrations.join(", ")}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
