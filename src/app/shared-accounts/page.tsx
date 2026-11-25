import { notFound } from "next/navigation";
import { SharedAccountInbox } from "@/components/shared-account-inbox";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { isPersonalLedger } from "@/lib/household-access";
import { householdFeaturesEnabled } from "@/lib/household-features";
import { PageShell } from "@/components/page-shell";

export default async function Page() {
  const workspace = await getActiveWorkspaceId();
  if (!householdFeaturesEnabled() || !workspace || isPersonalLedger(workspace)) notFound();
  return <PageShell back={{href:"/?tab=accounts",label:"Accounts"}} title="Accounts shared with me" description="These copies show the activity their owners approved. Household balances count only accounts in the household tracker.">
    <SharedAccountInbox/>
  </PageShell>;
}
