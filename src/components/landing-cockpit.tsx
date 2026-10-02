"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Gauge,
  Landmark,
  PiggyBank,
  Receipt,
  Sparkles,
  Split,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LandingCockpitProps {
  currencyCode: string;
  formattedBalance: string;
  formattedSalary: string;
  formattedRent: string;
  formattedGroceries: string;
  formattedUtilities: string;
  formattedInflow: string;
  formattedOutflow: string;
  savingsRate: number;
}

export function LandingCockpit({
  currencyCode,
  formattedBalance,
  formattedSalary,
  formattedRent,
  formattedGroceries,
  formattedUtilities,
  formattedInflow,
  formattedOutflow,
  savingsRate,
}: LandingCockpitProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "envelopes" | "splits">("overview");

  return (
    <div className="relative">
      {/* Ambient glow behind cockpit */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-to-tr from-brand/25 via-brand/5 to-emerald-500/20 blur-2xl opacity-60 dark:opacity-40"
      />

      {/* Floating accent badge - desktop only */}
      <div className="hidden lg:flex items-center gap-2 absolute -top-4 -right-4 z-20 rounded-full border border-border/80 bg-background/95 px-3 py-1 text-[11px] font-semibold text-foreground shadow-md backdrop-blur-md">
        <span className="size-2 rounded-full bg-positive animate-pulse" />
        <span>Illustrative preview</span>
      </div>

      <figure className="relative min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_12px_40px_rgb(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgb(0,0,0,0.45)]">
        {/* Window Chrome Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-2 font-mono text-[11px] font-medium text-muted-foreground">
              private-vault://{currencyCode.toLowerCase()}
            </span>
          </div>

          {/* Interactive Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border/60 bg-background/80 p-0.5 text-[11px] font-medium backdrop-blur-xs">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all cursor-pointer",
                activeTab === "overview"
                  ? "bg-brand text-brand-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Wallet className="size-3" />
              <span>Accounts</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("envelopes")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all cursor-pointer",
                activeTab === "envelopes"
                  ? "bg-brand text-brand-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Gauge className="size-3" />
              <span>Envelope Pace</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("splits")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all cursor-pointer",
                activeTab === "splits"
                  ? "bg-brand text-brand-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Split className="size-3" />
              <span>Bill Splits</span>
            </button>
          </div>
        </div>

        {/* Cockpit Content Panels */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* TAB 1: ACCOUNTS & VAULT OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              {/* Primary Balance Summary Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-border/60 bg-muted/20 p-3.5 relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-brand" />
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Liquid Net Worth
                  </p>
                  <p className="amount mt-1 text-2xl font-bold tracking-tight text-foreground">
                    {formattedBalance}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-positive">
                    <ArrowDownLeft className="size-3" /> +{savingsRate}% saved rate
                  </span>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-positive" />
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <ArrowDownLeft className="size-3 text-positive" /> Scheduled Inflow
                  </p>
                  <p className="amount mt-1 text-base sm:text-lg font-semibold text-positive">
                    +{formattedInflow}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Cleared on 1st
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-negative" />
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="size-3 text-negative" /> Safe Outflow
                  </p>
                  <p className="amount mt-1 text-base sm:text-lg font-semibold text-negative">
                    −{formattedOutflow}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    All recurring covered
                  </p>
                </div>
              </div>

              {/* Account Multi-Ledger Row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs">
                <div className="rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:border-brand/40">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-[11px]">Checking</span>
                    <Landmark className="size-3 text-brand" />
                  </div>
                  <p className="amount mt-1.5 font-bold text-foreground">
                    {formattedSalary}
                  </p>
                  <span className="text-[10px] text-muted-foreground">Operating</span>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:border-brand/40">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-[11px]">High Yield</span>
                    <PiggyBank className="size-3 text-brand" />
                  </div>
                  <p className="amount mt-1.5 font-bold text-foreground">
                    {formattedBalance}
                  </p>
                  <span className="text-[10px] text-positive font-medium">4.85% APY</span>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:border-brand/40">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-[11px]">Everyday Card</span>
                    <CreditCard className="size-3 text-brand" />
                  </div>
                  <p className="amount mt-1.5 font-bold text-foreground">
                    {formattedGroceries}
                  </p>
                  <span className="text-[10px] text-muted-foreground">Auto-cleared</span>
                </div>
              </div>

              {/* Transactions stream */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ledger Stream
                  </h4>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Example transactions
                  </span>
                </div>
                <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background/60 overflow-hidden text-xs">
                  <div className="flex items-center justify-between p-3 transition-colors hover:bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-positive/10 text-positive">
                        <ArrowDownLeft className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          Direct Payroll Deposit
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Employer Wire · Main Checking
                        </p>
                      </div>
                    </div>
                    <span className="amount font-bold text-positive shrink-0">
                      +{formattedSalary}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 transition-colors hover:bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <ArrowUpRight className="size-3.5 text-negative" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          Apartment Lease & Building Fee
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Fixed Housing · Auto-debited
                        </p>
                      </div>
                    </div>
                    <span className="amount font-bold text-negative shrink-0">
                      −{formattedRent}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 transition-colors hover:bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                        <Sparkles className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          Weekly Organic Market
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Groceries Envelope · Rewards Card
                        </p>
                      </div>
                    </div>
                    <span className="amount font-bold text-negative shrink-0">
                      −{formattedGroceries}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ENVELOPE PACING */}
          {activeTab === "envelopes" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="size-4 text-brand" />
                    <span className="text-xs font-semibold text-foreground">
                      Monthly Spending Velocity
                    </span>
                  </div>
                  <span className="rounded bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                    Paced Safely
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  You are 18 days into the month. Total discretionary spending is{" "}
                  <strong className="text-positive font-semibold">14% below</strong> average velocity.
                </p>
              </div>

              {/* Progress bars */}
              <div className="space-y-3.5 pt-1">
                <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Groceries & Market</span>
                    <span className="text-muted-foreground">{formattedGroceries} of {formattedSalary} cap</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: "42%" }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="text-positive font-medium">✓ 58% envelope remaining</span>
                    <span>13 days left</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Dining Out & Coffee</span>
                    <span className="text-muted-foreground">{formattedUtilities} of {formattedGroceries} cap</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: "35%" }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="text-positive font-medium">✓ Plenty of room</span>
                    <span>13 days left</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Fiber & Household Utilities</span>
                    <span className="text-muted-foreground">{formattedUtilities} of {formattedUtilities} cap</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: "88%" }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="text-amber-500 font-medium">Fixed monthly charge paid</span>
                    <span>Complete</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SPLIT SETTLEMENT */}
          {activeTab === "splits" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-brand" />
                    <span className="text-xs font-semibold text-foreground">
                      Household Flatmate Ledger
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    3 Active Members
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Record shared utility bills or groceries and settle who owes whom with zero awkward math.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-xs">
                      A
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Alex M.</p>
                      <p className="text-[10px] text-muted-foreground">Shared Groceries (50/50)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="amount block font-bold text-positive">
                      Owes you {formattedUtilities}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                      <Receipt className="size-2.5" /> Pending
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-muted text-muted-foreground grid place-items-center font-bold text-xs">
                      S
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Sarah K.</p>
                      <p className="text-[10px] text-muted-foreground">Fiber Broadband Bill</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="amount block font-bold text-muted-foreground line-through">
                      {formattedUtilities}
                    </span>
                    <span className="text-[10px] text-positive font-medium flex items-center justify-end gap-1">
                      <CheckCircle2 className="size-2.5" /> Settled yesterday
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Net household settlement balance:</span>
                <span className="amount font-bold text-brand">+{formattedUtilities} receivable</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer strip of the mockup */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-positive" />
            <span>Accounts and transfers preview</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            Illustrative data
          </span>
        </div>
      </figure>
    </div>
  );
}
