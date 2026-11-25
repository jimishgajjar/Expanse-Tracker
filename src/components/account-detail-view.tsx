"use client";

import { Guilloche } from "./guilloche";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { TransactionDialog } from "@/components/transaction-dialog";
import { ReconcileAccount } from "./reconcile-account";
import { AccountDialog } from "@/components/account-dialog";
import { DetailActivity } from "@/components/detail-activity";
import { useFormat } from "@/components/settings-provider";
import { Sparkline } from "@/components/summary-cards";
import { useMemo } from "react";
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
  reviewsEnabled = false,
}: {
  account: AccountDTO;
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
  reviewsEnabled?: boolean;
}) {
  const { money, balanceMoney } = useFormat();
  const transferNet =
    account.balance - account.initialBalance - account.income + account.expense;
  // Running balance after each dated movement, oldest first.
  const history = useMemo(() => {
    const moves = [
      ...transactions.filter((t) => t.accountId === account.id).map((t) => ({ date: t.date, delta: t.type === "income" ? t.amount : -t.amount })),
      ...transfers.flatMap((x) => [
        ...(x.toAccountId === account.id ? [{ date: x.date, delta: x.amount }] : []),
        ...(x.fromAccountId === account.id ? [{ date: x.date, delta: -x.amount }] : []),
      ]),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return moves.reduce<number[]>((out, m) => [...out, (out.at(-1) ?? account.initialBalance) + m.delta], []);
  }, [transactions, transfers, account.id, account.initialBalance]);

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

        <div className="flex flex-wrap items-center gap-2">
          <ReconcileAccount account={account} transactions={transactions} transfers={transfers} />
          {reviewsEnabled && <Link href={`/accounts/${account.id}/reconcile`} className="inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Review statement</Link>}
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

      {/* Balance: the one committed colour moment, same as Overview. */}
      <section aria-label="Account balance" className="grid gap-3 lg:grid-cols-[minmax(300px,1fr)_minmax(0,1.6fr)]">
        <div className="relative isolate flex min-w-0 flex-col justify-between overflow-hidden rounded-xl bg-brand-deep p-5 text-brand-deep-foreground pt-12 sm:p-6 sm:pt-14">
          <Guilloche className="absolute inset-x-0 top-0 -z-10 h-11 w-full text-brass opacity-60 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]" />
          <div>
            <p className="text-sm font-medium opacity-85">Current balance</p>
            <p className="display-figure mt-2 break-words text-[clamp(2rem,3.2vw,2.75rem)]">
              {balanceMoney(account.balance)}
            </p>
            <p className="mt-2 text-xs opacity-80">{history.length ? `Running balance over ${history.length} entries` : "No entries yet"}</p>
          </div>
          <div className="mt-5">{history.length > 1 ? <Sparkline values={history} /> : <div className="h-14" />}</div>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {[
            { label: "Opening balance", value: money(account.initialBalance), tone: "text-foreground", icon: null },
            { label: "Total in", value: `+${money(account.income)}`, tone: "text-positive", icon: TrendingUp },
            { label: "Total out", value: `−${money(account.expense)}`, tone: "text-negative", icon: TrendingDown },
            { label: "Net transfers", value: balanceMoney(transferNet), tone: "text-foreground", icon: ArrowRightLeft },
          ].map(({ label, value, tone, icon: TileIcon }) => (
            <div key={label} className="dashboard-panel min-w-0 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {TileIcon && <TileIcon className="size-3.5" aria-hidden />}{label}
              </dt>
              <dd className={cn("amount mt-1.5 break-words text-lg font-bold tracking-tight", tone)}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

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
