export const ADDON_VERSION = "0.2.0";

export function addonName(baseUrl: URL) {
  return baseUrl.hostname.toLowerCase().includes("staging")
    ? "RG Office Assistant Staging"
    : "RG Office Assistant";
}
