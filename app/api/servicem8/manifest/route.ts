import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  const base = getConfig().appBaseUrl;
  return Response.json({
    $schema: "https://api.servicem8.com/api_1.0/addonsdk/manifest-schema/v1.json",
    name: "RG Office Assistant",
    version: "0.1.0",
    oauth: { scope: getConfig().oauthScopes },
    actions: [
      {
        name: "RG Office Assistant",
        type: "online",
        entity: "job",
        event: "rg_office_assistant",
        location: "modal",
        iconURL: new URL("/icon.svg", base).toString(),
      },
    ],
  });
}
