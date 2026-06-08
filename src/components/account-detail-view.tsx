"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@/components/icon";
import { TransactionRows, TransferRows } from "@/components/transactions-list";
import { TransactionDialog } from "@/components/transaction-dialog";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

const PAGE_SIZES = [10, 25, 50, 100];

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
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [pageSize]);

  const total = transactions.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, pageCount);
  const start = (curPage - 1) * pageSize;
  const pageItems = useMemo(() => transactions.slice(start, start + pageSize), [transactions, start, pageSize]);

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
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Transactions <span className="font-normal text-muted-foreground">· {total}</span>
          </h2>
          {canEdit && (
            <TransactionDialog
              accounts={accounts}
              categories={categories}
              defaultAccountId={account.id}
              trigger={<Button size="sm"><Plus className="size-4" /> Add transaction</Button>}
            />
          )}
        </div>

        <TransactionRows transactions={pageItems} accounts={accounts} categories={categories} canEdit={canEdit} emptyMessage="No transactions for this account yet." />

        {total > pageSize && (
          <div className="mt-4 flex flex-col items-stretch gap-3 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))} items={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}>
                <SelectTrigger size="sm" className="w-[4.5rem]"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-muted-foreground">{start + 1}–{Math.min(start + pageSize, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="outline" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} aria-label="Previous page">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[3.5rem] text-center font-mono text-xs">{curPage} / {pageCount}</span>
                <Button size="icon-sm" variant="outline" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)} aria-label="Next page">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
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
