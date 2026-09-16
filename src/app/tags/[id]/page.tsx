import { notFound, redirect } from "next/navigation";
import { DetailShell } from "@/components/detail-shell";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import {
  getAccountsWithBalances,
  getAllTransactions,
  getCategories,
  getSettings,
  getTags,
} from "@/lib/queries";
import { SettingsProvider } from "@/components/settings-provider";
import { TagDetailView } from "@/components/tag-detail-view";

export const dynamic = "force-dynamic";

export default async function TagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      <DetailShell accounts={accounts} section="Tags" title={tag.name}>
        <TagDetailView
          key={tag.id}
          tag={tag}
          transactions={txns}
          accounts={accounts}
          categories={categories}
          canEdit={ws?.role !== "viewer"}
        />
      </DetailShell>
    </SettingsProvider>
  );
}
