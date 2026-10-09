import { createHash, randomUUID } from "node:crypto";

type SafeFields = Record<string, string | number | boolean | null | undefined>;

export function correlationId() {
  return randomUUID();
}

export function redactIdentifier(identifier: string) {
  return createHash("sha256").update(identifier).digest("hex").slice(0, 12);
}

export function safeLog(level: "info" | "warn" | "error", message: string, fields: SafeFields = {}) {
  const entry = { level, message, ...fields };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}
