"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useFormat } from "./settings-provider";
import { cn } from "@/lib/utils";

export function SummaryCards({
  totalBalance,
  income,
  expense,
  net,
  rangeLabel,
  accountsCount,
  comparison,
}: {
  totalBalance: number;
  income: number;
  expense: number;
  net: number;
  rangeLabel: string;
  accountsCount: number;
  comparison?: { prevIncome: number; prevExpense: number } | null;
}) {
  const { money, signedMoney, balanceMoney } = useFormat();

  const delta = (v: number, p?: number) =>
    p ? Math.round(((v - p) / Math.abs(p)) * 100) : null;

  const incomeDelta = delta(income, comparison?.prevIncome);
  const expenseDelta = delta(expense, comparison?.prevExpense);
  const savingsRate =
    income > 0 ? Math.round((net / income) * 100) : null;

  return (
    <section
      aria-label="Balance and cash flow summary"
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* 1. Total Balance Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-brand/[0.04] via-card to-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-md hover:shadow-brand/5">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-brand via-emerald-400 to-transparent"
        />
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/80">
            Total Balance
          </span>
          <span className="grid size-8 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20 shadow-2xs">
            <Wallet className="size-4" />
          </span>
        </div>
        <p
          className={cn(
            "amount mt-2.5 break-all text-2xl font-bold tracking-tight text-foreground sm:text-3xl",
            totalBalance < 0 && "text-negative",
          )}
        >
          {balanceMoney(totalBalance)}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
          <span>
            {accountsCount} active {accountsCount === 1 ? "account" : "accounts"}
          </span>
          <span
            className={cn(
              "amount font-semibold",
              net >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {signedMoney(net)}
          </span>
        </div>
      </div>

      {/* 2. Income Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-positive/[0.04] via-card to-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-positive/40 hover:shadow-md hover:shadow-positive/5">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-positive via-emerald-400 to-transparent"
        />
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/80">
            Income
          </span>
          <span className="grid size-8 place-items-center rounded-xl bg-positive/10 text-positive ring-1 ring-positive/20 shadow-2xs">
            <ArrowDownLeft className="size-4" />
          </span>
        </div>
        <p className="amount mt-2.5 break-all text-2xl font-bold tracking-tight text-positive sm:text-3xl">
          {money(income)}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
          <span className="truncate">Inflow · {rangeLabel}</span>
          {incomeDelta !== null ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                incomeDelta >= 0
                  ? "bg-positive/15 text-positive ring-positive/25"
                  : "bg-muted text-muted-foreground ring-border",
              )}
            >
              {incomeDelta >= 0 ? "+" : ""}
              {incomeDelta}%
              <span className="sr-only sm:not-sr-only"> vs prev</span>
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">—</span>
          )}
        </div>
      </div>

      {/* 3. Spending Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-negative/[0.04] via-card to-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-negative/40 hover:shadow-md hover:shadow-negative/5">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-negative via-rose-400 to-transparent"
        />
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/80">
            Spending
          </span>
          <span className="grid size-8 place-items-center rounded-xl bg-negative/10 text-negative ring-1 ring-negative/20 shadow-2xs">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
        <p className="amount mt-2.5 break-all text-2xl font-bold tracking-tight text-negative sm:text-3xl">
          {money(expense)}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
          <span className="truncate">Outflow · {rangeLabel}</span>
          {expenseDelta !== null ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                expenseDelta <= 0
                  ? "bg-positive/15 text-positive ring-positive/25"
                  : "bg-negative/15 text-negative ring-negative/25",
              )}
            >
              {expenseDelta > 0 ? "+" : ""}
              {expenseDelta}%
              <span className="sr-only sm:not-sr-only"> vs prev</span>
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">—</span>
          )}
        </div>
      </div>

      {/* 4. Net Cash Flow Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-brand/[0.04] via-card to-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-md hover:shadow-brand/5">
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r to-transparent",
            net >= 0
              ? "from-positive via-emerald-400"
              : "from-negative via-rose-400",
          )}
        />
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/80">
            Net Cash Flow
          </span>
          <span
            className={cn(
              "grid size-8 place-items-center rounded-xl ring-1 shadow-2xs",
              net >= 0
                ? "bg-positive/10 text-positive ring-positive/20"
                : "bg-negative/10 text-negative ring-negative/20",
            )}
          >
            <ArrowRightLeft className="size-4" />
          </span>
        </div>
        <p
          className={cn(
            "amount mt-2.5 break-all text-2xl font-bold tracking-tight sm:text-3xl",
            net >= 0 ? "text-positive" : "text-negative",
          )}
        >
          {signedMoney(net)}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
          <span>Savings Rate</span>
          {savingsRate !== null ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1",
                savingsRate >= 0
                  ? "bg-positive/15 text-positive ring-positive/25"
                  : "bg-negative/15 text-negative ring-negative/25",
              )}
            >
              {savingsRate >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {savingsRate}%
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">—</span>
          )}
        </div>
      </div>
    </section>
  );
}
