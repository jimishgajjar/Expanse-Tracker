"use client";

import { type ReactElement } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Icon } from "@/components/icon";
import { TransactionRows, TransferRows } from "@/components/transactions-list";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

export function AccountDetailSheet({
  account,
  transactions,
  transfers,
  categories,
  accounts,
  trigger,
}: {
  account: AccountDTO;
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  trigger: ReactElement;
}) {
  const { money, balanceMoney } = useFormat();
  const txns = transactions.filter((t) => t.accountId === account.id);
  const xfers = transfers.filter((t) => t.fromAccountId === account.id || t.toAccountId === account.id);

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${account.color}22`, color: account.color }}>
              <Icon name={account.icon} size={20} />
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate">{account.name}</SheetTitle>
              <SheetDescription className="capitalize">{account.type} account</SheetDescription>
            </div>
            <span className={cn("ml-auto shrink-0 font-mono text-lg font-semibold", account.balance < 0 && "text-negative")}>
              {balanceMoney(account.balance)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Opening" value={money(account.initialBalance)} />
            <Stat label="In (all-time)" value={money(account.income)} tone="text-positive" />
            <Stat label="Out (all-time)" value={money(account.expense)} tone="text-negative" />
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="text-xs font-medium text-muted-foreground">Transactions in this period</div>
          <TransactionRows transactions={txns} accounts={accounts} categories={categories} />
          {xfers.length > 0 && (
            <>
              <div className="pt-2 text-xs font-medium text-muted-foreground">Transfers</div>
              <TransferRows transfers={xfers} accounts={accounts} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("mt-0.5 font-mono text-sm font-semibold", tone)}>{value}</div>
    </div>
  );
}
