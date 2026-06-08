"use client";

import { Icon } from "@/components/icon";
import { TransactionRows, TransferRows } from "@/components/transactions-list";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

export function AccountDetailView({
  account,
  transactions,
  transfers,
  accounts,
  categories,
  canEdit,
}: {
  account: AccountDTO;
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
}) {
  const { money, balanceMoney } = useFormat();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${account.color}22`, color: account.color }}>
            <Icon name={account.icon} size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{account.name}</h1>
            <div className="text-xs text-muted-foreground capitalize">{account.type} account</div>
          </div>
          <span className={cn("amount ml-auto shrink-0 text-2xl font-semibold", account.balance < 0 && "text-negative")}>
            {balanceMoney(account.balance)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Opening" value={money(account.initialBalance)} />
          <Stat label="In (all-time)" value={money(account.income)} tone="text-positive" />
          <Stat label="Out (all-time)" value={money(account.expense)} tone="text-negative" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Transactions</h2>
          <span className="text-xs text-muted-foreground">{transactions.length} total</span>
        </div>
        <TransactionRows transactions={transactions} accounts={accounts} categories={categories} canEdit={canEdit} emptyMessage="No transactions for this account yet." />
      </div>

      {transfers.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Transfers</h2>
          <TransferRows transfers={transfers} accounts={accounts} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("amount mt-0.5 text-sm font-semibold", tone)}>{value}</div>
    </div>
  );
}
