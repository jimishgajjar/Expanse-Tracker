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
 * - Left side: Centered visual showcase of the Expense Tracker ledger,
 *   live micro-transactions, savings velocity, and privacy architecture.
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
    <div className="relative min-h-svh w-full overflow-x-hidden bg-background text-foreground lg:grid lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      {/* ── LEFT SIDE: Centered Visual Web App Showcase (Desktop) ─────────── */}
      <aside className="relative hidden min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#031d16] via-[#02140f] to-[#010907] p-8 text-white lg:flex xl:p-12 border-r border-emerald-950/80 selection:bg-emerald-500/30">
        {/* Ambient Aurora Orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-32 h-[450px] w-[450px] rounded-full bg-teal-500/15 blur-[110px]"
        />
        {/* Subtle Grid Watermark */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"
        />

        {/* Master Centered Content Container */}
        <div className="relative z-10 w-full max-w-[480px] space-y-6">
          {/* Top Branding & Tagline */}
          <div>
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5 transition-opacity hover:opacity-90"
              aria-label="Expense Tracker home"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-300 text-slate-950 shadow-md shadow-emerald-500/30 transition-transform group-hover:scale-105">
                <Wallet className="size-4.5" />
              </span>
              <span className="text-base font-bold tracking-tight text-white">
                Expense Tracker
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300">
                v2.4 Private Ledger
              </span>
            </Link>

            <div className="mt-5">
              <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl xl:text-[32px] leading-tight">
                {headline}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">
                {sub}
              </p>
            </div>
          </div>

          {/* Center Showcase: Simulated High-Fidelity Ledger Window */}
          <div className="w-full">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 shadow-2xl backdrop-blur-xl">
              <div className="rounded-xl border border-white/10 bg-[#061e17]/90 p-5 shadow-inner">
                {/* Window Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-rose-500/80" />
                    <span className="size-2.5 rounded-full bg-amber-500/80" />
                    <span className="size-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-emerald-200/70">
                      household_ledger.db
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Sync
                  </span>
                </div>

                {/* Metrics Pill Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-200/60">
                      Net Cash Flow
                    </p>
                    <p className="amount mt-0.5 text-lg font-bold text-emerald-400">
                      +$3,420.50
                    </p>
                    <span className="text-[10px] text-emerald-200/70">+18% vs prev</span>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-200/60">
                      Savings Rate
                    </p>
                    <p className="amount mt-0.5 text-lg font-bold text-white">
                      42.8%
                    </p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[42.8%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                    </div>
                  </div>
                </div>

                {/* Live Ledger Activity Rows */}
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/50">
                    Recent Ledger Entries
                  </p>

                  <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 place-items-center rounded-md bg-emerald-500/20 text-emerald-400">
                        <ArrowDownLeft className="size-3.5" />
                      </span>
                      <div>
                        <p className="font-medium text-white/95 leading-tight">
                          Client Retainer
                        </p>
                        <p className="text-[10px] text-emerald-200/60">
                          Freelance Income · Checking
                        </p>
                      </div>
                    </div>
                    <span className="amount font-bold text-emerald-400">
                      +$2,850.00
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 place-items-center rounded-md bg-rose-500/20 text-rose-400">
                        <ArrowUpRight className="size-3.5" />
                      </span>
                      <div>
                        <p className="font-medium text-white/95 leading-tight">
                          Cloud Servers &amp; AI
                        </p>
                        <p className="text-[10px] text-emerald-200/60">
                          Infrastructure · Corporate Card
                        </p>
                      </div>
                    </div>
                    <span className="amount font-bold text-rose-400">
                      -$142.50
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 place-items-center rounded-md bg-amber-500/20 text-amber-400">
                        <Users className="size-3.5" />
                      </span>
                      <div>
                        <p className="font-medium text-white/95 leading-tight">
                          Household Utilities Split
                        </p>
                        <p className="text-[10px] text-emerald-200/60">
                          You paid $210 · Settled with Sam
                        </p>
                      </div>
                    </div>
                    <span className="amount font-semibold text-emerald-300">
                      +$105.00
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust & Architecture Strip */}
          <div className="border-t border-emerald-900/60 pt-4">
            <div className="grid grid-cols-3 gap-3 text-left">
              <div className="flex items-start gap-2">
                <ShieldCheck className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-white">Local-First</p>
                  <p className="text-[10px] text-emerald-200/60">SQLite &amp; Drizzle</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-white">Zero Tracking</p>
                  <p className="text-[10px] text-emerald-200/60">No financial ads</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-white">Realtime</p>
                  <p className="text-[10px] text-emerald-200/60">Sub-10ms queries</p>
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
            className="flex items-center gap-2 lg:hidden"
            aria-label="Expense Tracker home"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-brand text-white shadow-xs">
              <Wallet className="size-4" />
            </span>
            <span className="text-sm font-bold tracking-tight">Expense Tracker</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to website</span>
            </Link>
            <div className="h-4 w-px bg-border/60" />
            <ThemeToggle />
          </div>
        </header>

        {/* Form Container (Clean, Spacious, Beautifully Centered) */}
        <main className="my-auto flex w-full items-center justify-center py-8">
          <div className="w-full max-w-[380px]">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>Free &amp; private</span>
            <span>·</span>
            <span>No credit card required</span>
            <span>·</span>
            <span>Local encryption</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
