import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  return Response.json({ viewKey: session?.viewKey ?? null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
