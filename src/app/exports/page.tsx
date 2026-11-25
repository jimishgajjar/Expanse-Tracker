import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { getSession } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { activityPart,partSize } from "@/lib/activity-exports";
import { PageShell } from "@/components/page-shell";

export const dynamic="force-dynamic";
export default async function Exports({searchParams}:{searchParams:Promise<{workspace?:string;kind?:string;after?:string}>}) {
  const [session,workspace,p]=await Promise.all([getSession(),getActiveWorkspace(),searchParams]);
  if (!session) redirect("/login?next=/exports");
  const back={href:"/?tab=settings",label:"Settings"};
  if (!workspace || (p.workspace && p.workspace!==workspace.id)) return <PageShell back={back} title="Tracker selection changed" width="narrow" touch>
    <p className="dashboard-panel page-section">Your selected tracker changed since this export started. <Link className="text-link" href="/?tab=settings">Return to Settings to reopen your export.</Link></p>
  </PageShell>;
  const kind=p.kind==="transfers"?"transfers":"transactions";
  const cursor=typeof p.after==="string"?p.after:"";
  const part=await activityPart(await getDb(),workspace.id,session.user.id,kind,cursor);
  const query=new URLSearchParams({workspace:workspace.id,kind,after:cursor});
  return <PageShell back={back} eyebrow={workspace.name} title="Download activity in parts" width="narrow" touch
    description={<>Up to {partSize} entries per CSV. Parts follow record ID order. For a consistent copy, finish downloading before editing the tracker.</>}>
    <nav aria-label="Activity type" className="segmented">{(["transactions","transfers"] as const).map(k=><Link key={k} aria-current={k===kind?"page":undefined} href={"/exports?"+new URLSearchParams({workspace:workspace.id,kind:k})}>{k==="transactions"?"Transactions":"Transfers"}</Link>)}</nav>
    <section className="dashboard-panel page-section">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><FileSpreadsheet className="size-4" aria-hidden/></span>
        <div className="min-w-0"><h2 className="text-sm font-semibold">{part.rows.length} {kind} in this part</h2>
          <p className="text-xs text-muted-foreground">{cursor?"Continues from the previous part.":"First part."}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {part.rows.length>0?<a className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90" href={"/api/export/activity?"+query}><Download className="size-4" aria-hidden/>Download this CSV</a>:<p className="text-sm text-muted-foreground">No entries to download.</p>}
        {part.next && <Link className="text-link text-sm" href={"/exports?"+new URLSearchParams({workspace:workspace.id,kind,after:part.next})}>Next part →</Link>}
      </div>
    </section>
    <p className="text-sm text-muted-foreground">For categories, plans and review history, use the <a className="text-link" href={"/api/export?"+new URLSearchParams({workspace:workspace.id})}>workbook export</a>. For a large household’s complete copy, contact the pilot operator for a verified household-scoped export.</p>
  </PageShell>;
}
