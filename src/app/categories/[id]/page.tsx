import { notFound, redirect } from "next/navigation";
import { DetailShell } from "@/components/detail-shell";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import {
  getAccountsWithBalances,
  getAllTransactions,
  getCategories,
  getSettings,
  getBudgetProgress,
  getTags,
} from "@/lib/queries";
import { SettingsProvider } from "@/components/settings-provider";
import { CategoryDetailView } from "@/components/category-detail-view";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [allTx, accounts, categories, settings, ws, budgets, tags] =
    await Promise.all([
      getAllTransactions(),
      getAccountsWithBalances(),
      getCategories(),
      getSettings(),
      getActiveWorkspace(),
      getBudgetProgress(),
      getTags(),
    ]);

  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  const txns = allTx.filter((t) => t.categoryId === id);
  const categoryBudget = budgets.find((b) => b.categoryId === id) ?? null;

  return (
    <SettingsProvider currency={settings.currency} locale={settings.locale}>
      <DetailShell
        accounts={accounts}
        section="Categories"
        title={category.name}
      >
        <CategoryDetailView
          key={category.id}
          category={category}
          transactions={txns}
          allTransactions={allTx}
          accounts={accounts}
          categories={categories}
          categoryBudget={categoryBudget}
          tags={tags}
          canEdit={ws?.role !== "viewer"}
        />
      </DetailShell>
    </SettingsProvider>
  );
}
