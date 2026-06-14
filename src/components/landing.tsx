import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  ChartColumnBig,
  Globe,
  Repeat,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const cta = cn(buttonVariants(), "h-11 gap-2 px-5 text-[0.95rem] font-semibold");
const ctaGhost = cn(buttonVariants({ variant: "outline" }), "h-11 px-5 text-[0.95rem]");

/** Marketing page shown to logged-out visitors at `/`. */
export function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Expense Tracker home">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground shadow-sm shadow-brand/25">
              <Wallet className="size-4" />
            </span>
            <span className="text-[0.95rem] font-semibold tracking-tight">Expense Tracker</span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-sm:hidden")}>
              Sign in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "px-3")}>
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-brand/10 blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5 text-brand" /> Personal &amp; shared finance
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
                Every dollar, clearly accounted for.
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                Track income, expenses and transfers across all your accounts. Set budgets, reach savings goals,
                split costs with people, and share a tracker with your household — on web, iOS and Android.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={cta}>
                  Get started free <ArrowRight className="size-4" />
                </Link>
                <Link href="/login" className={ctaGhost}>
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Free to start · No card required · Your data stays yours</p>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 lg:pl-6">
              <HeroMock />
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Everything you need to stay on top of money
            </h2>
            <p className="mt-3 text-muted-foreground">
              From a quick coffee to a shared rent split — one clear ledger for all of it.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureTile className="lg:col-span-2" icon={ChartColumnBig} title="See the whole picture">
              Net worth over time, spending by category, and period-over-period comparisons — so you always know
              whether you&apos;re pulling ahead.
            </FeatureTile>
            <FeatureTile icon={Target} title="Budgets &amp; goals">
              Set a monthly limit per category and save toward goals you actually reach.
            </FeatureTile>
            <FeatureTile icon={Repeat} title="Recurring &amp; bills">
              Subscriptions and bills post themselves on schedule, so nothing slips through.
            </FeatureTile>
            <FeatureTile className="lg:col-span-2" icon={Users} title="Share a tracker with your people">
              Invite a partner, family or roommates as editors or viewers, split expenses, and settle up —
              everyone sees the same numbers in real time.
            </FeatureTile>
            <FeatureTile icon={Globe} title="Any currency">Track in whatever currency you live in.</FeatureTile>
            <FeatureTile icon={Bell} title="Stay in the loop">Budget alerts and reminders by email and push.</FeatureTile>
            <FeatureTile icon={ShieldCheck} title="Private &amp; secure">
              Your own account with per-tracker access control. Nothing is shared until you say so.
            </FeatureTile>
          </div>
        </section>

        {/* ── Cross-device ── */}
        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 py-14 sm:px-6 lg:flex-row lg:justify-between">
            <div className="max-w-md text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-brand">
                <Smartphone className="size-5" />
                <span className="text-sm font-medium">Works on every device</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Your money, everywhere you are
              </h2>
              <p className="mt-3 text-muted-foreground">
                Use it in any browser, install it to your Home Screen, or grab the native iOS and Android apps.
                Same account, same data, always in sync.
              </p>
            </div>
            <div className="flex items-end gap-4 sm:gap-6">
              <DeviceChip icon={Globe} label="Web" />
              <DeviceChip icon={Smartphone} label="iOS" big />
              <DeviceChip icon={Smartphone} label="Android" />
            </div>
          </div>
        </section>

        {/* ── Closing CTA ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-brand/5 px-6 py-14 text-center sm:px-12">
            <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 size-64 -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/30">
              <Wallet className="size-6" />
            </span>
            <h2 className="mx-auto mt-5 max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start tracking in under a minute
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Create a free account and add your first transaction. No card, no setup wizard.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className={cta}>
                Get started free <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className={ctaGhost}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground">
              <Wallet className="size-4" />
            </span>
            <div className="text-sm">
              <div className="font-medium">Expense Tracker</div>
              <div className="text-xs text-muted-foreground">Your money, clearly accounted for.</div>
            </div>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/login" className="transition-colors hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="transition-colors hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Faux product card — a believable mini-dashboard built entirely in markup. */
function HeroMock() {
  const bars = [46, 70, 40, 78, 54, 88, 62];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-foreground/10 ring-1 ring-foreground/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground">
            <Wallet className="size-4" />
          </span>
          <span className="text-sm font-medium">Overview</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">This month</span>
      </div>

      <div className="mt-4 rounded-xl bg-muted/50 p-4">
        <div className="text-xs text-muted-foreground">Total balance</div>
        <div className="amount mt-1 text-3xl font-semibold tracking-tight">$12,480.50</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="size-3.5 text-positive" /> Income
          </div>
          <div className="amount mt-1 text-lg font-semibold text-positive">$4,200</div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingDown className="size-3.5 text-negative" /> Expenses
          </div>
          <div className="amount mt-1 text-lg font-semibold text-negative">$2,840</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Income vs expense</span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-positive" /> in</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-negative" /> out</span>
          </span>
        </div>
        <div className="flex h-20 items-end gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="flex flex-1 items-end justify-center gap-0.5">
              <div className="w-1/2 max-w-[10px] rounded-t-sm bg-positive" style={{ height: `${h}%` }} />
              <div className="w-1/2 max-w-[10px] rounded-t-sm bg-negative" style={{ height: `${Math.max(18, h - 22)}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureTile({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("group rounded-2xl border border-border bg-card p-5 ring-1 ring-foreground/5 transition-transform duration-200 ease-out-quart hover:-translate-y-0.5", className)}>
      <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function DeviceChip({ icon: Icon, label, big }: { icon: LucideIcon; label: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("grid place-items-center rounded-2xl border border-border bg-card shadow-sm ring-1 ring-foreground/5", big ? "size-20" : "size-16")}>
        <Icon className={cn("text-foreground/70", big ? "size-9 text-brand" : "size-7")} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
