import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  const base = getConfig().appBaseUrl;
  const name = base.hostname.toLowerCase().includes("staging") ? "RG Company Check Staging" : "RG Company Check";
  return Response.json({
    $schema: "https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json",
    name,
    version: "0.1.0",
    oauth: { scope: "vendor" },
    actions: [],
    menuItems: [{
      name, type: "addon", iconURL: new URL("/company-check-icon.png", base).toString(), event: "rg_company_check_menu",
    }],
  });
}
