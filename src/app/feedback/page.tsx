import { notFound,redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { pilotDatabase } from "@/lib/pilot-release";
import { FeedbackForm } from "@/components/pilot-forms";
import { PageShell } from "@/components/page-shell";
export const dynamic="force-dynamic";
export default async function Feedback() {
  const session=await getSession();
  if (!session) redirect("/login?next=/feedback");
  const [workspace,db]=await Promise.all([getActiveWorkspaceId(),pilotDatabase()]);
  if (!workspace || !db) notFound();
  const {rows}=await db.query<{id:string;severity:string;status:string}>(`SELECT id,severity,status FROM pilot_feedback
    WHERE workspace_id=$1 AND actor=$2 AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role IN ('owner','member','viewer')) ORDER BY created_at DESC LIMIT 10`,[workspace,session.user.id]);
  return <PageShell back={{href:"/?tab=settings",label:"Settings"}} title="Pilot feedback" description="Tell us what got in your way. Each report gets a reference you can follow up on." width="narrow" touch>
    <section className="dashboard-panel page-section"><FeedbackForm workspace={workspace}/></section>
    <section className="dashboard-panel page-section"><h2>Your recent reports</h2>
      {!rows.length && <p>Your references and review status will appear here.</p>}
      {rows.length>0 && <ul className="divide-y divide-border/70">{rows.map(r=><li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" key={r.id}>
        <span className="min-w-0 break-all font-mono text-xs text-muted-foreground">{r.id}</span>
        <span className="flex gap-1.5 text-xs"><span className="rounded-md bg-muted px-2 py-0.5 capitalize">{r.severity}</span><span className="rounded-md bg-muted px-2 py-0.5 capitalize">{r.status}</span></span>
      </li>)}</ul>}
    </section>
  </PageShell>;
}
