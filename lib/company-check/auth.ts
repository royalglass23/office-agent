import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { assistantRateLimit, verifyCompanyCheckSession, type AssistantIdentity } from "@/lib/security/assistant-session";
import { consumeEventHash } from "@/lib/storage/consumed-events";

export const companyCheckCookie = "rg_company_check_session";

export async function companyCheckIdentity() {
  const token = (await cookies()).get(companyCheckCookie)?.value;
  if (!token) return null;
  try {
    const config = getConfig();
    const identity = await verifyCompanyCheckSession(token, config.sessionSigningSecret);
    return identity.accountUUID === config.allowedAccountUUID ? identity : null;
  } catch { return null; }
}

export async function requireCompanyCheck(request?: Request) {
  if (request && request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin !== getConfig().appBaseUrl.origin) return null;
  }
  return companyCheckIdentity();
}

export async function companyCheckRateLimit(identity: AssistantIdentity, action: "companySearch" | "companyResearch") {
  const limit = assistantRateLimit(identity, action);
  for (const hash of limit.hashes) {
    if (await consumeEventHash(hash, limit.expiresAt)) return null;
  }
  return limit.retryAfterSeconds;
}
