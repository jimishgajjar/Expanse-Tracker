import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { pilotDatabase } from "@/lib/pilot-release";
import { setupProgress } from "@/lib/pilot-setup";
import { OpeningForm,Preferences } from "@/components/pilot-forms";
import { statementReviewsEnabled } from "@/lib/statement-review-feature";
import { fileImportsEnabled } from "@/lib/file-import-model";

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
  const panel="dashboard-panel space-y-3 p-4";
  return <main className="pilot-content mx-auto max-w-3xl space-y-4 px-4 py-6">
    <Link className="text-sm text-brand underline" href="/">← Overview</Link><header><p className="text-sm text-muted-foreground">{w.name}</p><h1 className="text-2xl font-semibold">Set up your household</h1>
    <p className="text-sm">Return here from Settings to pick up where you left off.</p></header>
    <section className={panel}><h2 className="font-semibold">Setup progress · {steps.filter(s=>s[1]).length} of {steps.length}</h2><ol className="grid gap-1 text-sm sm:grid-cols-2">{steps.map(([name,done])=><li key={name}>{done?"✓ Complete":"○ Pending"} · {name}</li>)}</ol></section>
    <section className={panel}><h2 className="font-semibold">Household preferences</h2>{data.owner?<Preferences workspace={w.id} data={data}/>:<p>Ask the household owner to update setup preferences.</p>}</section>
    <section className={panel}><h2 className="font-semibold">Accounts and opening statements</h2><p className="text-sm">Add the accounts you track, with their opening balances. Then compare each one with a statement.</p>
    <Link className="text-brand underline" href="/?tab=accounts">Open accounts</Link>
    {originalAccounts.length>0 && data.owner && <OpeningForm workspace={w.id} accounts={originalAccounts}/>}
    {accounts.map(a=><p className="text-sm" key={a.id}>{a.name} · {a.reviewed?<Link href="/financial-position" className="text-brand underline">Reviewed opening in Debt &amp; currencies</Link>:a.cutoff?"Confirmed through "+a.cutoff:"Opening date pending"} {statementReviewsEnabled() && <Link className="text-brand underline" href={"/accounts/"+encodeURIComponent(a.id)+"/reconcile"}>Reconcile statement</Link>}</p>)}
    {fileImportsEnabled() && <Link className="text-brand underline" href="/imports">Review a history file</Link>}</section>
    <section className={panel}><h2 className="font-semibold">Bills and household members</h2><p className="text-sm">Open Subscriptions &amp; bills to schedule a payment. To share your tracker, open Members &amp; sharing and choose a role.</p>
    <Link href="/?tab=planning" className="text-brand underline">Open planning</Link> · <Link href="/" className="text-brand underline">Open household tools</Link></section>
    <Link className="text-sm text-brand underline" href="/feedback">Report a setup problem</Link></main>;
}
