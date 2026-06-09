import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTags } from "@/lib/queries";
import { createTag } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ tags: await getTags() });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await createTag(await req.json().catch(() => null));
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't create tag." }, { status: 400 });
  return NextResponse.json({ tag: res.data });
}
