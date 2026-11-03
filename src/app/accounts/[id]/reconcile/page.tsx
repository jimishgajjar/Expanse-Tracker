import { notFound, redirect } from "next/navigation";
import { DetailShell } from "@/components/detail-shell";
import { StatementReviewPanel } from "@/components/statement-review-panel";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getAccountsWithBalances } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { listStatementReviews } from "@/lib/statement-review-store";
import { statementReviewsEnabled, statementCorrectionsEnabled } from "@/lib/statement-review-feature";

export const dynamic = "force-dynamic";
export default async function StatementPage({params}:{params:Promise<{id:string}>}) {
  if (!statementReviewsEnabled()) notFound();
  const [user,workspace,{id}] = await Promise.all([getCurrentUser(),getActiveWorkspace(),params]);
  if (!user || !workspace) redirect("/login");
  const accounts = await getAccountsWithBalances();
  const account = accounts.find(account=>account.id===id);
  if (!account) notFound();
  const reviews = await listStatementReviews(await getDb(),workspace.id,user.id,id);
  return <DetailShell accounts={accounts} accountId={id} section="Accounts" title={`${account.name} / Statements`}>
    <StatementReviewPanel accountId={id} accountName={account.name} canEdit={workspace.role!=="viewer"} correctionsEnabled={statementCorrectionsEnabled()} initialReviews={reviews}/>
  </DetailShell>;
}
