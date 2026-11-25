import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { getSession } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { pilotDatabase } from "@/lib/pilot-release";
import { setupProgress } from "@/lib/pilot-setup";
import { OpeningForm,Preferences } from "@/components/pilot-forms";
import { statementReviewsEnabled } from "@/lib/statement-review-feature";
import { fileImportsEnabled } from "@/lib/file-import-model";
import { PageShell } from "@/components/page-shell";
import { shortDay } from "@/lib/dates";

export const dynamic="force-dynamic";
export default async function Setup() {
  const user=await getSession();
  if (!user) redirect("/login?next=/setup");
  const [w,db]=await Promise.all([getActiveWorkspace(),pilotDatabase()]);
  if (!w || !db) notFound();
  const data=await setupProgress(db,{workspace:w.id,actor:user.user.id});
  const accounts=data.accounts;
  const originalAccounts=accounts.filter(a=>!a.reviewed);
  const steps=[
    ["Household preferences",!!data.timezone],["Add an account",accounts.length>0],
    ["Confirm opening statements",accounts.length>0&&accounts.every(a=>a.cutoff || a.reviewed)],["Recurring bills",data.bills||data.bills_skipped],
    ["First reconciliation",data.reconciled],["Partner invitation",data.partner||data.invite_skipped],
  ] as const;
  const done=steps.filter(s=>s[1]).length;
  const panel="dashboard-panel page-section";
  return <PageShell back={{href:"/",label:"Overview"}} eyebrow={w.name} title="Set up your household" description="Return here from Settings to pick up where you left off." touch>
    <section className={panel} aria-labelledby="setup-progress">
      <div className="flex items-center justify-between gap-3"><h2 id="setup-progress" className="text-sm font-semibold">Setup progress</h2>
        <span className="amount text-xs font-medium text-muted-foreground">{done} of {steps.length} done</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-brand transition-[width]" style={{width:`${(done/steps.length)*100}%`}}/></div>
      <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{steps.map(([name,complete])=><li key={name} className="flex items-center gap-2 py-1 text-sm">
        {complete?<CheckCircle2 className="size-4 shrink-0 text-brand" aria-hidden/>:<Circle className="size-4 shrink-0 text-muted-foreground/60" aria-hidden/>}
        <span className={complete?"text-muted-foreground line-through decoration-muted-foreground/40":"text-foreground"}>{name}</span>
        <span className="sr-only">{complete?"complete":"pending"}</span></li>)}</ol>
    </section>
    <section className={panel}><h2>Household preferences</h2>{data.owner?<Preferences workspace={w.id} data={data}/>:<p>Ask the household owner to update setup preferences.</p>}</section>
    <section className={panel}><h2>Accounts and opening statements</h2><p>Add the accounts you track, with their opening balances. Then compare each one with a statement.</p>
      <div><Link className="text-link text-sm" href="/?tab=accounts">Open accounts</Link></div>
      {originalAccounts.length>0 && data.owner && <OpeningForm workspace={w.id} accounts={originalAccounts}/>}
      {accounts.length>0 && <ul className="divide-y divide-border/70 rounded-lg border border-border/70">{accounts.map(a=><li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm" key={a.id}>
        <span className="min-w-0"><span className="font-medium">{a.name}</span>{" "}<span className="text-xs text-muted-foreground">{a.reviewed?"Opening reviewed":a.cutoff?"Confirmed through "+shortDay(a.cutoff):"Opening date pending"}</span></span>
        <span className="flex flex-wrap gap-x-3 text-sm">{a.reviewed && <Link href="/financial-position" className="text-link">Debt &amp; currencies</Link>}
          {statementReviewsEnabled() && <Link className="text-link" href={"/accounts/"+encodeURIComponent(a.id)+"/reconcile"}>Reconcile statement</Link>}</span></li>)}</ul>}
      {fileImportsEnabled() && <div><Link className="text-link text-sm" href="/imports">Review a history file</Link></div>}</section>
    <section className={panel}><h2>Bills and household members</h2><p>Open Subscriptions &amp; bills to schedule a payment. To share your tracker, open Members &amp; sharing and choose a role.</p>
      <div className="flex flex-wrap gap-x-4 text-sm"><Link href="/?tab=planning" className="text-link">Open planning</Link><Link href="/" className="text-link">Open household tools</Link></div></section>
    <Link className="text-link text-sm" href="/feedback">Report a setup problem</Link>
  </PageShell>;
}
