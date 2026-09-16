"use client";
import { Icon } from "@/components/icon";
import { DetailActivity, DetailStat } from "@/components/detail-activity";
import { useFormat } from "@/components/settings-provider";
import type { AccountDTO, CategoryDTO, TransactionDTO } from "@/lib/queries";

export function CategoryDetailView({
  category,
  transactions,
  accounts,
  categories,
  canEdit,
}: {
  category: CategoryDTO;
  transactions: TransactionDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
}) {
  const { money } = useFormat();
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-xl"
          style={{
            backgroundColor: `${category.color}22`,
            color: category.color,
          }}
        >
          <Icon name={category.icon} size={24} />
        </span>
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium text-muted-foreground capitalize">
            {category.kind} category
          </p>
          <h1 className="break-words text-3xl font-semibold tracking-tight">
            {category.name}
          </h1>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-6 rounded-xl border bg-card p-5 sm:grid-cols-3 sm:p-7">
        <DetailStat
          label="Total income · all time"
          value={money(income)}
          tone="text-positive"
        />
        <DetailStat
          label="Total expenses · all time"
          value={money(expense)}
          tone="text-negative"
        />
        <DetailStat label="Transactions" value={String(transactions.length)} />
      </dl>
      <DetailActivity
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        hideCategory
        canEdit={canEdit}
      />
    </div>
  );
}
