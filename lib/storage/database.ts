import { Pool } from "pg";
import { getConfig } from "@/lib/config";

const globalDatabase = globalThis as typeof globalThis & { rgOfficeAgentPool?: Pool };

export function database() {
  if (!globalDatabase.rgOfficeAgentPool) {
    globalDatabase.rgOfficeAgentPool = new Pool({
      connectionString: getConfig().databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalDatabase.rgOfficeAgentPool;
}
