import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  const base = getConfig().appBaseUrl;
  return Response.json({
    $schema: "https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json",
    name: "RG Office Assistant",
    version: "0.2.0",
    oauth: { scope: getConfig().oauthScopes },
    actions: [],
    menuItems: [
      {
        name: "RG Office Assistant",
        type: "addon",
        iconURL: new URL("/icon.png", base).toString(),
        event: "rg_office_assistant_menu",
      },
    ],
  });
}
