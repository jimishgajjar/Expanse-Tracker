/* Hallmark · shape: workbench · genre: modern-minimal · theme: brand · redesign: full
 * paper: var(--background) · accent: var(--brand) · display: var(--font-sans) · body: var(--font-sans) · v2.0.0 */

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Lock,
  ShieldCheck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Side-by-Side Auth Shell:
 * - Left side: Restrained Hallmark showcase of the Expense Tracker ledger.
 * - Right side: Clean, unboxed modern auth container with theme toggle.
 */
export function AuthShell({
  children,
  headline = "Pick up where your ledger left off.",
  sub = "Balances, budgets and shared splits — exactly as you left them, on every device.",
}: {
  children: ReactNode;
  headline?: string;
  sub?: string;
}) {
  return (
    <div className="relative min-h-svh w-full overflow-x-clip bg-background text-foreground lg:grid lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      {/* ── LEFT SIDE: Precision Showcase (Desktop) ─────────── */}
      <aside className="relative hidden min-h-svh items-center justify-center border-r border-border bg-muted/20 p-8 text-foreground lg:flex xl:p-12 selection:bg-brand/20">
        <div className="relative z-10 w-full max-w-[480px] space-y-6">
          {/* Top Branding & Tagline */}
          <div>
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand rounded-xs"
              aria-label="Expense Tracker home"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground shadow-xs">
                <Wallet className="size-4" />
              </span>
              <span className="text-base font-bold tracking-tight text-foreground">
                Expense Tracker
              </span>
              <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Private ledger
              </span>
            </Link>

            <div className="mt-5">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl leading-tight">
                {headline}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {sub}
              </p>
            </div>
          </div>

          {/* Center Showcase: Simulated High-Fidelity Ledger Window */}
          <div className="w-full">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-brand" />
                  <span className="font-mono text-xs text-muted-foreground">
                    household_ledger.db
                  </span>
                </div>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Local encrypted
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Net cash flow
                  </p>
                  <p className="mt-1 text-lg font-bold text-positive num">
                    +$3,420.50
                  </p>
                  <span className="text-[11px] text-muted-foreground num">+18% vs prev period</span>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Savings rate
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground num">
                    42.8%
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[42.8%] rounded-full bg-brand" />
                  </div>
                </div>
              </div>

              {/* Live Ledger Activity Rows */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Recent ledger entries
                </p>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-6 place-items-center rounded-md bg-positive/10 text-positive">
                      <ArrowDownLeft className="size-3.5" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground leading-tight">
                        Client Retainer
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Freelance Income / Checking
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-positive num">
                    +$2,850.00
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-6 place-items-center rounded-md bg-destructive/10 text-destructive">
                      <ArrowUpRight className="size-3.5" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground leading-tight">
                        Cloud Hosting
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Infrastructure / Card
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-foreground num">
                    -$142.50
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-6 place-items-center rounded-md bg-muted text-muted-foreground">
                      <Users className="size-3.5" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground leading-tight">
                        Household Utilities Split
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Paid $210 / Settled with Alex
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-positive num">
                    +$105.00
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust & Architecture Strip */}
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-3 gap-3 text-left">
              <div className="flex items-start gap-2">
                <ShieldCheck className="size-4 shrink-0 text-brand mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Local first</p>
                  <p className="text-[11px] text-muted-foreground">Embedded Postgres</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="size-4 shrink-0 text-brand mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Zero tracking</p>
                  <p className="text-[11px] text-muted-foreground">No financial ads</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="size-4 shrink-0 text-brand mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Fast search</p>
                  <p className="text-[11px] text-muted-foreground">Sub-10ms queries</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── RIGHT SIDE: Clean, Unboxed Auth Container ─────────────────────── */}
      <div className="relative flex min-h-svh flex-col justify-between bg-background px-5 py-6 sm:px-10 lg:px-14 selection:bg-brand/20">
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 lg:hidden focus-visible:outline-2 focus-visible:outline-brand rounded-xs"
            aria-label="Expense Tracker home"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground shadow-xs">
              <Wallet className="size-4" />
            </span>
            <span className="text-sm font-bold tracking-tight">Expense Tracker</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand rounded-xs"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to home</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <ThemeToggle />
          </div>
        </header>

        {/* Form Container */}
        <main className="my-auto flex w-full items-center justify-center py-8">
          <div className="w-full max-w-[380px]">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>Private household ledger</span>
            <span>/</span>
            <span>Local encryption</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
