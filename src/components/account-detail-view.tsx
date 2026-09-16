"use client";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { TransactionDialog } from "@/components/transaction-dialog";
import { AccountDialog } from "@/components/account-dialog";
import { DetailActivity, DetailStat } from "@/components/detail-activity";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-xl"
            style={{
              backgroundColor: `${account.color}22`,
              color: account.color,
            }}
          >
            <Icon name={account.icon} size={24} />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-muted-foreground capitalize">
              {account.type} account{account.archived ? " · Archived" : ""}
            </p>
            <h1 className="break-words text-3xl font-semibold tracking-tight">
              {account.name}
            </h1>
          </div>
        </div>
        {canEdit && (
          <AccountDialog
            account={account}
            trigger={
              <Button variant="outline" className="min-h-11">
                <Pencil className="size-4" />
                Edit account
              </Button>
            }
          />
        )}
      </div>
      <section
        aria-label="Account balance"
        className="rounded-xl border bg-card p-5 sm:p-7"
      >
        <p className="text-sm text-muted-foreground">Current balance</p>
        <p
          className={cn(
            "amount mt-2 break-all text-4xl font-semibold tracking-tight sm:text-5xl",
            account.balance < 0 && "text-negative",
          )}
        >
          {balanceMoney(account.balance)}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          All-time balance, including transfers. Activity filters apply below.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 border-t pt-5 xl:grid-cols-4">
          <DetailStat
            label="Opening balance"
            value={money(account.initialBalance)}
          />
          <DetailStat
            label="Total income"
            value={money(account.income)}
            tone="text-positive"
          />
          <DetailStat
            label="Total expenses"
            value={money(account.expense)}
            tone="text-negative"
          />
          <DetailStat label="Net transfers" value={balanceMoney(transferNet)} />
        </dl>
      </section>
      <DetailActivity
        transactions={transactions}
        transfers={transfers}
        accounts={accounts}
        categories={categories}
        accountId={account.id}
        canEdit={canEdit}
        action={
          canEdit && (
            <TransactionDialog
              accounts={accounts}
              categories={categories}
              defaultAccountId={account.id}
              trigger={
                <Button className="min-h-11">
                  <Plus className="size-4" />
                  Add transaction
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
}
