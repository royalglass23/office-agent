export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok", service: "rg-office-agent", phase: 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
