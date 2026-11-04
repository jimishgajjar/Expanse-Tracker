import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { financeDatabase,financeRelease } from "@/lib/finance-release";
import { financeReport } from "@/lib/finance-position";
import { getSession } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { FinanceWorkspace } from "@/components/finance-workspace";
import { PositionSummary } from "@/components/position-summary";
import { trackerExportHref } from "@/lib/household-access";

export const dynamic="force-dynamic";
export default async function FinancialPosition() {
  const session=await getSession();
  if (!session) redirect("/login?next=/financial-position");
  const [workspace,db]=await Promise.all([getActiveWorkspace(),financeDatabase()]);
  if (!workspace || !db) notFound();
  const data=await financeReport(db,{workspace:workspace.id,actor:session.user.id},true);
  return <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
    <Link href="/?tab=accounts" className="text-sm text-brand">← {workspace.name} / Accounts</Link>
    <header><h1 className="text-2xl font-semibold">Debt & currencies</h1>
      <p className="text-sm text-muted-foreground">Review balances, book a payment, or check a statement against your records.</p></header>
    <PositionSummary data={data} exportHref={trackerExportHref(workspace.id)}/>
    <FinanceWorkspace workspace={workspace.id} data={data} debtOnly={financeRelease()==="debt"}/>
  </main>;
}
