import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getAccountsWithBalances, getAllTransactions, getCategories, getSettings, getTags } from "@/lib/queries";
import { SettingsProvider } from "@/components/settings-provider";
import { TagDetailView } from "@/components/tag-detail-view";

export const dynamic = "force-dynamic";

export default async function TagPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [allTx, accounts, categories, settings, tags, ws] = await Promise.all([
    getAllTransactions(),
    getAccountsWithBalances(),
    getCategories(),
    getSettings(),
    getTags(),
    getActiveWorkspace(),
  ]);

  const tag = tags.find((t) => t.id === id);
  if (!tag) notFound();

  const txns = allTx.filter((t) => t.tags.some((x) => x.id === id));

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
        <TagDetailView tag={tag} transactions={txns} accounts={accounts} categories={categories} canEdit={ws?.role !== "viewer"} />
      </div>
    </SettingsProvider>
  );
}
