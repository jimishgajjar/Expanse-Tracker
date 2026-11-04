import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedAccountInbox } from "@/components/shared-account-inbox";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { isPersonalLedger } from "@/lib/household-access";
import { householdFeaturesEnabled } from "@/lib/household-features";

export default async function Page() {
  const workspace = await getActiveWorkspaceId();
  if (!householdFeaturesEnabled() || !workspace || isPersonalLedger(workspace)) notFound();
  return <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
    <Link href="/?tab=accounts" className="text-sm text-brand">← Accounts</Link>
    <SharedAccountInbox/>
  </main>;
}
