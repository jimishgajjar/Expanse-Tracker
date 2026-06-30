import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getAccountsWithBalances, getAllTransactions, getCategories, getSettings } from "@/lib/queries";
import { SettingsProvider } from "@/components/settings-provider";
import { CategoryDetailView } from "@/components/category-detail-view";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [allTx, accounts, categories, settings, ws] = await Promise.all([
    getAllTransactions(),
    getAccountsWithBalances(),
    getCategories(),
    getSettings(),
    getActiveWorkspace(),
  ]);

  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  const txns = allTx.filter((t) => t.categoryId === id);

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
        <CategoryDetailView category={category} transactions={txns} accounts={accounts} categories={categories} canEdit={ws?.role !== "viewer"} />
      </div>
    </SettingsProvider>
  );
}
