import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { activityPart,partSize } from "@/lib/activity-exports";

export const dynamic="force-dynamic";
export default async function Exports({searchParams}:{searchParams:Promise<{workspace?:string;kind?:string;after?:string}>}) {
  const [session,workspace,p]=await Promise.all([getSession(),getActiveWorkspace(),searchParams]);
  if (!session) redirect("/login?next=/exports");
  if (!workspace || (p.workspace && p.workspace!==workspace.id)) return <main className="p-6"><h1>Tracker selection changed</h1><Link href="/?tab=settings">Return to Settings to reopen your export.</Link></main>;
  const kind=p.kind==="transfers"?"transfers":"transactions";
  const cursor=typeof p.after==="string"?p.after:"";
  const part=await activityPart(await getDb(),workspace.id,session.user.id,kind,cursor);
  const query=new URLSearchParams({workspace:workspace.id,kind,after:cursor});
  return <main className="pilot-content mx-auto max-w-xl space-y-4 px-4 py-6"><Link href="/?tab=settings" className="text-brand underline">← Settings</Link>
    <h1 className="text-2xl font-semibold">Download activity in parts</h1><p>{workspace.name} · Up to {partSize} entries per CSV. Parts follow record ID order. For a consistent copy, finish downloading before editing the tracker.</p>
    <nav className="flex gap-5 text-brand underline">{(["transactions","transfers"] as const).map(k=><Link key={k} aria-current={k===kind?"page":undefined} href={"/exports?"+new URLSearchParams({workspace:workspace.id,kind:k})}>{k==="transactions"?"Transactions":"Transfers"}</Link>)}</nav>
    <section className="dashboard-panel space-y-3 p-4"><h2 className="font-semibold">{part.rows.length} {kind} in this part</h2>
    {part.rows.length>0?<a className="inline-block min-h-11 py-2 text-brand underline" href={"/api/export/activity?"+query}>Download this CSV</a>:<p>No entries to download.</p>}
    {part.next && <p><Link className="text-brand underline" href={"/exports?"+new URLSearchParams({workspace:workspace.id,kind,after:part.next})}>Next part →</Link></p>}</section>
    <p className="text-sm">For categories, plans and review history, use the <a className="text-brand underline" href={"/api/export?"+new URLSearchParams({workspace:workspace.id})}>workbook export</a>. For a large household’s complete copy, contact the pilot operator for a verified household-scoped export.</p></main>;
}
