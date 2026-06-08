import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getAccountsWithBalances, getCategories, getSettings, getTransactionsInRange, getTransfersInRange } from "@/lib/queries";
import { SettingsProvider } from "@/components/settings-provider";
import { AccountDetailView } from "@/components/account-detail-view";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [accounts, allTx, allXfer, categories, settings, ws] = await Promise.all([
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
  const xfers = allXfer.filter((t) => t.fromAccountId === id || t.toAccountId === id);

  return (
    <SettingsProvider currency={settings.currency} locale={settings.locale}>
      <div className="mx-auto max-w-3xl space-y-4 px-3 py-5 sm:px-6 sm:py-6">
        <header className="flex items-center gap-2.5">
          <Link href="/" aria-label="Back to dashboard" className="inline-flex size-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted">
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground"><Wallet className="size-4" /></span>
            Expense Tracker
          </Link>
        </header>
        <AccountDetailView account={account} transactions={txns} transfers={xfers} accounts={accounts} categories={categories} canEdit={ws?.role !== "viewer"} />
      </div>
    </SettingsProvider>
  );
}
