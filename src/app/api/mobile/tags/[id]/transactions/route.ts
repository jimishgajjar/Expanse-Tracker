import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllTransactions } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Every transaction (all-time) carrying a given tag. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const all = await getAllTransactions();
  const transactions = all.filter((t) => t.tags.some((tag) => tag.id === id));
  return NextResponse.json({ transactions });
}
