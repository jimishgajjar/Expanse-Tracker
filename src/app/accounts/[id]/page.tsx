import { notFound, redirect } from "next/navigation";
import { DetailShell } from "@/components/detail-shell";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import {
  getAccountsWithBalances,
  getCategories,
  getSettings,
  getTransactionsInRange,
  getTransfersInRange,
} from "@/lib/queries";
import { SettingsProvider } from "@/components/settings-provider";
import { AccountDetailView } from "@/components/account-detail-view";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [accounts, allTx, allXfer, categories, settings, ws] =
    await Promise.all([
      getAccountsWithBalances(),
      getTransactionsInRange("1900-01-01", "2999-12-31"),
      getTransfersInRange("1900-01-01", "2999-12-31"),
      getCategories(),
      getSettings(),
      getActiveWorkspace(),
    ]);

  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  const txns = allTx.filter((t) => t.accountId === id);
  const xfers = allXfer.filter(
    (t) => t.fromAccountId === id || t.toAccountId === id,
  );

  return (
    <SettingsProvider currency={settings.currency} locale={settings.locale}>
      <DetailShell
        accounts={accounts}
        section="Accounts"
        title={account.name}
        accountId={account.id}
      >
        <AccountDetailView
          key={account.id}
          account={account}
          transactions={txns}
          transfers={xfers}
          accounts={accounts}
          categories={categories}
          canEdit={ws?.role !== "viewer"}
        />
      </DetailShell>
    </SettingsProvider>
  );
}
