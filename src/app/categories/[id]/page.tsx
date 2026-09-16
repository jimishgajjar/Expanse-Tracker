import { notFound, redirect } from "next/navigation";
import { DetailShell } from "@/components/detail-shell";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import {
  getAccountsWithBalances,
  getAllTransactions,
  getCategories,
  getSettings,
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
      <DetailShell
        accounts={accounts}
        section="Categories"
        title={category.name}
      >
        <CategoryDetailView
          key={category.id}
          category={category}
          transactions={txns}
          accounts={accounts}
          categories={categories}
          canEdit={ws?.role !== "viewer"}
        />
      </DetailShell>
    </SettingsProvider>
  );
}
