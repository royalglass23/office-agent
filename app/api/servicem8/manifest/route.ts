import { getConfig } from "@/lib/config";
import { ADDON_VERSION, addonName } from "@/lib/servicem8/addon-metadata";

export const dynamic = "force-dynamic";

export function GET() {
  const base = getConfig().appBaseUrl;
  const name = addonName(base);
  return Response.json({
    $schema: "https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json",
    name,
    version: ADDON_VERSION,
    oauth: { scope: getConfig().oauthScopes },
    actions: [],
    menuItems: [
      {
        name,
        type: "addon",
        iconURL: new URL("/icon.png", base).toString(),
        event: "rg_office_assistant_menu",
      },
    ],
  });
}
