import { notFound, redirect } from "next/navigation";
import { financeDatabase,financeRelease } from "@/lib/finance-release";
import { financeReport } from "@/lib/finance-position";
import { getSession } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { FinanceWorkspace } from "@/components/finance-workspace";
import { PositionSummary } from "@/components/position-summary";
import { trackerExportHref } from "@/lib/household-access";
import { PageShell } from "@/components/page-shell";

export const dynamic="force-dynamic";
export default async function FinancialPosition() {
  const session=await getSession();
  if (!session) redirect("/login?next=/financial-position");
  const [workspace,db]=await Promise.all([getActiveWorkspace(),financeDatabase()]);
  if (!workspace || !db) notFound();
  const data=await financeReport(db,{workspace:workspace.id,actor:session.user.id},true);
  return <PageShell back={{href:"/?tab=accounts",label:"Accounts"}} eyebrow={workspace.name} title="Debt & currencies" width="wide"
    description="Review balances, book a payment, or check a statement against your records.">
    <PositionSummary data={data} exportHref={trackerExportHref(workspace.id)}/>
    <FinanceWorkspace workspace={workspace.id} data={data} debtOnly={financeRelease()==="debt"}/>
  </PageShell>;
}
