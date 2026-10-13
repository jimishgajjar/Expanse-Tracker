"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Plus, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { TransactionDialog } from "@/components/transaction-dialog";
import { AccountDialog } from "@/components/account-dialog";
import { DetailActivity } from "@/components/detail-activity";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type {
  AccountDTO,
  CategoryDTO,
  TransactionDTO,
  TransferDTO,
} from "@/lib/queries";

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
  const transferNet =
    account.balance - account.initialBalance - account.income + account.expense;

  return (
    <div className="space-y-5">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/?tab=accounts"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to accounts</span>
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl shadow-xs"
              style={{
                backgroundColor: `${account.color}15`,
                color: account.color,
              }}
            >
              <Icon name={account.icon} size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {account.name}
                </h1>
                {account.archived && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                {account.type} Account
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <AccountDialog
                account={account}
                trigger={
                  <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-medium gap-1.5 shadow-2xs hover:bg-muted/60">
                    <Pencil className="size-3.5" />
                    Edit account
                  </Button>
                }
              />
              <TransactionDialog
                accounts={accounts}
                categories={categories}
                defaultAccountId={account.id}
                trigger={
                  <Button size="sm" className="h-9 rounded-xl px-3.5 text-xs font-semibold gap-1.5 bg-brand text-brand-foreground shadow-xs hover:bg-brand/90 active:scale-[0.98]">
                    <Plus className="size-3.5" />
                    Add transaction
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>

      {/* Account Balance Hero Card */}
      <div className="dashboard-panel p-4 sm:p-5">
        <p className="text-xs font-semibold  text-muted-foreground">
          Current balance
        </p>
        <p
          className={cn(
            "font-mono tabular-nums text-3xl font-semibold tracking-tight mt-1",
            account.balance < 0 ? "text-negative" : "text-foreground",
          )}
        >
          {balanceMoney(account.balance)}
        </p>

        {/* 4-Metric Grid */}
        <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground">
              Opening balance
            </span>
            <p className="font-mono text-sm sm:text-base font-semibold text-foreground mt-0.5 tabular-nums">
              {money(account.initialBalance)}
            </p>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3 text-positive" />
              Total In
            </span>
            <p className="font-mono text-sm sm:text-base font-semibold text-positive mt-0.5 tabular-nums">
              +{money(account.income)}
            </p>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="size-3 text-negative" />
              Total Out
            </span>
            <p className="font-mono text-sm sm:text-base font-semibold text-negative mt-0.5 tabular-nums">
              -{money(account.expense)}
            </p>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <ArrowRightLeft className="size-3 text-muted-foreground" />
              Net transfers
            </span>
            <p className="font-mono text-sm sm:text-base font-semibold text-foreground mt-0.5 tabular-nums">
              {balanceMoney(transferNet)}
            </p>
          </div>
        </div>
      </div>

      {/* Account Activity Ledger */}
      <DetailActivity
        transactions={transactions}
        transfers={transfers}
        accounts={accounts}
        categories={categories}
        accountId={account.id}
        canEdit={canEdit}
      />
    </div>
  );
}
