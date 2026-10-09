import { createHash } from "node:crypto";
import { decodeProtectedHeader, errors, jwtVerify } from "jose";
import { serviceM8JobEventSchema, type ServiceM8JobEvent } from "./event-schema";

const MAX_EVENT_AGE_SECONDS = 5 * 60;
const CLOCK_SKEW_SECONDS = 30;

export class EventVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventVerificationError";
  }
}

export type VerifiedServiceM8Event = {
  event: ServiceM8JobEvent;
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
    const event = serviceM8JobEventSchema.parse(verified.payload);
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
