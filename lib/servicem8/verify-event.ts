import { createHash } from "node:crypto";
import { decodeProtectedHeader, errors, jwtVerify } from "jose";
import type { z } from "zod";
import { serviceM8EventSchema, type ServiceM8Event } from "./event-schema";

const MAX_EVENT_AGE_SECONDS = 5 * 60;
const CLOCK_SKEW_SECONDS = 30;

export class EventVerificationError extends Error {
  constructor(
    message: string,
    readonly category: "signature" | "schema" = "signature",
    readonly diagnostics?: EventSchemaDiagnostics,
  ) {
    super(message);
    this.name = "EventVerificationError";
  }
}

export type EventSchemaDiagnostics = {
  category: "schema";
  payloadKeys: string[];
  authType: string;
  authKeys: string[];
  eventArgsType: string;
  eventArgsKeys: string[];
  issueCodes: string[];
  issuePaths: string[];
};

function valueType(value: unknown) {
  if (value === undefined) return "absent";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function safeKey(value: PropertyKey) {
  const key = String(value);
  return /^[A-Za-z0-9_]{1,64}$/.test(key) ? key : "<nonstandard>";
}

function keysOf(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).slice(0, 32).map(safeKey).sort();
}

function schemaDiagnostics(payload: unknown, issues: z.core.$ZodIssue[]): EventSchemaDiagnostics {
  const record = payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  return {
    category: "schema",
    payloadKeys: keysOf(payload),
    authType: valueType(record.auth),
    authKeys: keysOf(record.auth),
    eventArgsType: valueType(record.eventArgs),
    eventArgsKeys: keysOf(record.eventArgs),
    issueCodes: [...new Set(issues.map((issue) => issue.code))].sort(),
    issuePaths: [...new Set(issues.map((issue) => (
      issue.path.length === 0 ? "$" : issue.path.map(safeKey).join(".")
    )))].sort(),
  };
}

export type VerifiedServiceM8Event = {
  event: ServiceM8Event;
  eventHash: string;
  freshness: "verified" | "unavailable";
};

export async function verifyServiceM8Event(
  token: string,
  appSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedServiceM8Event> {
  if (token.length === 0 || token.length > 16_384 || token.split(".").length !== 3) {
    throw new EventVerificationError("Malformed event token");
  }

  try {
    const protectedHeader = decodeProtectedHeader(token);
    if (protectedHeader.alg !== "HS256") throw new EventVerificationError("Unexpected JWT algorithm");
    if (protectedHeader.typ !== undefined && protectedHeader.typ !== "JWT") {
      throw new EventVerificationError("Unexpected JWT type");
    }

    const verified = await jwtVerify(token, new TextEncoder().encode(appSecret), {
      algorithms: ["HS256"],
      clockTolerance: CLOCK_SKEW_SECONDS,
      currentDate: new Date(nowSeconds * 1000),
    });
    const parsedEvent = serviceM8EventSchema.safeParse(verified.payload);
    if (!parsedEvent.success) {
      throw new EventVerificationError(
        "Event schema is invalid",
        "schema",
        schemaDiagnostics(verified.payload, parsedEvent.error.issues),
      );
    }
    const event = parsedEvent.data;
    let freshness: VerifiedServiceM8Event["freshness"] = "unavailable";

    if (event.iat !== undefined && event.exp !== undefined) {
      if (event.iat > nowSeconds + CLOCK_SKEW_SECONDS) throw new EventVerificationError("Event issued in the future");
      if (event.exp <= nowSeconds - CLOCK_SKEW_SECONDS) throw new EventVerificationError("Event expired");
      if (event.exp <= event.iat || event.exp - event.iat > MAX_EVENT_AGE_SECONDS) {
        throw new EventVerificationError("Event freshness window is unsafe");
      }
      freshness = "verified";
    }

    return {
      event,
      eventHash: createHash("sha256").update(token).digest("hex"),
      freshness,
    };
  } catch (error) {
    if (error instanceof EventVerificationError) throw error;
    if (error instanceof errors.JOSEError || error instanceof Error) {
      throw new EventVerificationError("Event signature or claims are invalid");
    }
    throw error;
  }
}
