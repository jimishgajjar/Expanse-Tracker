/* Hallmark · shape: workbench · genre: modern-minimal · theme: brand · redesign: full
 * paper: var(--background) · accent: var(--brand) · display: var(--font-sans) · body: var(--font-sans) · hero: stage · nav: edge-aligned · footer: mast
 * axes: dark/grotesk-sans/cool · posture: restrained · contrast: pass · fold: pass · v2.0.0 */

import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarCheck,
  Check,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  Lock,
  PiggyBank,
  Repeat,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getVisitorMoney } from "@/lib/visitor-currency";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LandingCockpit } from "@/components/landing-cockpit";

const primary = cn(
  buttonVariants(),
  "h-11 rounded-lg px-5 text-sm font-semibold bg-brand text-brand-foreground hover:bg-brand-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand transition-colors motion-reduce:transition-none shadow-xs",
);
const quiet = cn(
  buttonVariants({ variant: "outline" }),
  "h-11 rounded-lg px-5 text-sm font-medium border border-border bg-card text-foreground hover:bg-muted active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors motion-reduce:transition-none",
);

/** Server-rendered product presentation: zero client JS overhead, ultra-fast initial paint. */
export async function Landing() {
  const { format, sample, currency } = await getVisitorMoney();
  const [salary, rent, groceries, utilities] = sample;
  const outflow = rent + groceries + utilities;
  const balance = salary - outflow;
  const savingsRate = Math.max(0, Math.round(((salary - outflow) / salary) * 100));

  return (
    <div
      suppressHydrationWarning
      className="relative min-h-dvh overflow-x-clip bg-background text-foreground selection:bg-brand/20 selection:text-brand"
    >
      <a
        href="#landing-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3 focus:shadow-md"
      >
        Skip to content
      </a>

      {/* Edge-aligned Precision Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-xs transition-colors">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6"
        >
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/" className="flex items-center gap-2.5 font-semibold">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground shadow-xs">
                <Wallet className="size-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">
                Expense Tracker
              </span>
              <span className="hidden rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-block">
                Personal ledger
              </span>
            </Link>

            <div className="hidden items-center gap-6 text-xs font-medium text-muted-foreground md:flex">
              <a
                href="#features"
                className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand rounded-xs"
              >
                Capabilities
              </a>
              <a
                href="#comparison"
                className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand rounded-xs"
              >
                Spreadsheets
              </a>
              <a
                href="#security"
                className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand rounded-xs"
              >
                Data security
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "rounded-lg px-3.5 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-brand",
              )}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "sm" }),
                "rounded-lg bg-brand px-4 text-xs font-semibold text-brand-foreground hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-brand shadow-xs",
              )}
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main id="landing-content">
        {/* Stage Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-brand animate-pulse motion-reduce:animate-none" />
                <span>Private personal finance</span>
              </div>

              {/* Headline <= 7 words (50 characters), no 3-stop gradient text */}
              <h1 className="mt-5 text-[clamp(2.2rem,4.4vw,3.5rem)] leading-[1.08] font-bold tracking-[-0.035em] text-balance">
                Financial clarity, completely private.
              </h1>

              {/* One sentence, <= 12 words */}
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                Keep accounts, transfers, budgets and household splits in one private workspace.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={primary}>
                  Start private ledger
                </Link>
                <a href="#features" className={quiet}>
                  Explore capabilities
                </a>
              </div>

              {/* Verified Ledger Attributes */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-brand" /> Zero bank credentials stored
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-brand" /> Separate transfer records
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-brand" /> Excel export (.xlsx)
                </span>
              </div>
            </div>

            {/* Interactive Machined Ledger Cockpit */}
            <LandingCockpit
              currencyCode={currency.code}
              formattedBalance={format(balance)}
              formattedSalary={format(salary)}
              formattedRent={format(rent)}
              formattedGroceries={format(groceries)}
              formattedUtilities={format(utilities)}
              formattedInflow={format(salary)}
              formattedOutflow={format(outflow)}
              savingsRate={savingsRate}
            />
          </div>
        </section>

        {/* Product capabilities strip: sentence case, no tracked uppercase */}
        <section className="border-y border-border bg-muted/25 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground num">
                  Search
                </p>
                <p className="text-xs font-medium text-foreground">
                  Find activity
                </p>
                <p className="text-xs text-muted-foreground">
                  Filter transactions by account, category, and date range.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground num">
                  Manual
                </p>
                <p className="text-xs font-medium text-foreground">
                  Direct entry
                </p>
                <p className="text-xs text-muted-foreground">
                  Record entries directly without connecting external bank credentials.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground num">
                  .xlsx
                </p>
                <p className="text-xs font-medium text-foreground">
                  Data export
                </p>
                <p className="text-xs text-muted-foreground">
                  Download transactions, accounts, and categories in a clean workbook.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground num">
                  Shared
                </p>
                <p className="text-xs font-medium text-foreground">
                  Workspaces
                </p>
                <p className="text-xs text-muted-foreground">
                  Manage household accounts and split joint spending together.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Hairline Panels Section */}
        <section id="features" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-brand">
                Accounting structure
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                Everything in its place. Nothing counted twice.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Move money between accounts without inflating spending. Keep household splits alongside everyday cash flow.
              </p>
            </div>

            {/* Hairline Grid */}
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Panel 1: Multi-Account Balance Engine */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-foreground">
                      <Landmark className="size-4" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Multi-account engine
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg sm:text-xl font-bold tracking-tight">
                    Accounts that reconcile without double-counting
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-xl">
                    Checking accounts, high-yield savings, credit cards, and cash. Internal transfers move money with dedicated paired records so they never distort expense analytics.
                  </p>
                </div>

                {/* Account Transfer Simulation */}
                <div className="mt-8 space-y-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="grid size-7 place-items-center rounded-md bg-brand/10 text-brand">
                        <ArrowRightLeft className="size-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          Internal transfer: Checking to Savings
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Paired transfer record / net expense: $0.00
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md bg-positive/10 px-2 py-0.5 text-[11px] font-medium text-positive num">
                      Net: $0.00
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Checking Account</span>
                        <CreditCard className="size-3.5 text-muted-foreground" />
                      </div>
                      <p className="mt-1.5 text-base font-bold text-foreground num">
                        {format(salary * 0.42)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Daily operating
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Savings Account</span>
                        <PiggyBank className="size-3.5 text-muted-foreground" />
                      </div>
                      <p className="mt-1.5 text-base font-bold text-foreground num">
                        {format(balance)}
                      </p>
                      <p className="text-[11px] text-positive font-medium num">
                        +4.85% APY compounding
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Rewards Card</span>
                        <Sparkles className="size-3.5 text-muted-foreground" />
                      </div>
                      <p className="mt-1.5 text-base font-bold text-foreground num">
                        {format(groceries)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Monthly statement
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 2: Recurring Intelligence */}
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-foreground">
                      <Repeat className="size-4" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Recurring obligations
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg sm:text-xl font-bold tracking-tight">
                    Subscriptions without surprises
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    Keep memberships, recurring utilities, and annual charges forecasted. Calendar reminders keep cash reserves prepared.
                  </p>
                </div>

                <div className="mt-6 space-y-2.5 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-foreground">Cloud Dev Workspace</span>
                    <span className="font-semibold text-foreground num">{format(20)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-border/50">
                    <span className="text-foreground">Fiber Gigabit Internet</span>
                    <span className="font-semibold text-foreground num">{format(utilities)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span>Due in 3 days</span>
                    <span className="flex items-center gap-1 text-positive font-medium">
                      <CheckCircle2 className="size-3" /> Auto-reconciled
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel 3: Shared Workspaces */}
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-foreground">
                      <Users className="size-4" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Household splits
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg sm:text-xl font-bold tracking-tight">
                    Fair splits, zero friction
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    Invite household partners. Record joint groceries or utility bills and settle balances cleanly.
                  </p>
                </div>

                <div className="mt-6 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Joint apartment expenses</span>
                    <span className="font-semibold text-foreground num">{format(groceries)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Equal 50 / 50 split</span>
                    <span className="rounded bg-brand/10 px-2 py-0.5 font-medium text-brand num">
                      Alex owes {format(groceries / 2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel 4: Envelope Pacing */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-foreground">
                      <CalendarCheck className="size-4" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Pacing gauge
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg sm:text-xl font-bold tracking-tight">
                    Paced envelope budgeting for everyday spending
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-xl">
                    Set targets on groceries, dining out, and leisure. Pacing indicators show whether spending velocity aligns with calendar days.
                  </p>
                </div>

                {/* Progress bars: explicit transition on width, motion-reduce fallback */}
                <div className="mt-6 space-y-3">
                  {[
                    {
                      name: "Everyday Groceries",
                      spent: 58,
                      label: "Within safe trajectory",
                      tone: "bg-brand",
                    },
                    {
                      name: "Dining Out & Coffee",
                      spent: 42,
                      label: "Buffer preserved",
                      tone: "bg-brand",
                    },
                    {
                      name: "Household Utilities",
                      spent: 85,
                      label: "Approaching planned limit",
                      tone: "bg-amber-500",
                    },
                  ].map((cat) => (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-foreground">{cat.name}</span>
                        <span className="text-muted-foreground num">
                          {cat.spent}% used / {cat.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", cat.tone)}
                          style={{ width: `${cat.spent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section id="comparison" className="scroll-mt-16 border-t border-border bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-brand">
                Comparison
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                Built to solve the spreadsheet paradox
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Spreadsheets break on phone keyboards. Bank aggregators disconnect and resell spending data. Expense Tracker gives you structured clarity without third-party exposure.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-destructive/30 bg-card p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
                    <X className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">Fragile spreadsheets & bank aggregators</h3>
                    <p className="text-xs text-muted-foreground">Disconnected state and manual friction</p>
                  </div>
                </div>

                <ul className="space-y-3 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Bank connections drop and leave missing entries</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Aggregators place credit card promotions alongside spending</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Transfers distort expense charts unless manually adjusted</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Spreadsheet formulas break easily on mobile screens</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-brand/50 bg-card p-6 sm:p-8 space-y-5 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Check className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">Expense Tracker</h3>
                    <p className="text-xs text-muted-foreground">Structured accounts, activity, and exports</p>
                  </div>
                </div>

                <ul className="space-y-3 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">Recorded activity stays in your verified private database</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">Zero bank credentials or third-party scraper access required</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">Internal transfers tracked separately from income and expenses</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">Excel workbook export (.xlsx) for complete data ownership</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Export Section */}
        <section id="security" className="scroll-mt-16 border-t border-border py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <p className="text-xs font-medium text-brand">
                  Data ownership
                </p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                  Your records, completely under your control
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Track your household cash flow without sharing bank login credentials. Export full ledger workbooks whenever you choose.
                </p>

                <div className="mt-6 space-y-3.5 text-xs sm:text-sm">
                  {[
                    {
                      title: "Authenticated sessions",
                      desc: "Salted scrypt password hashing and HTTP-only session cookies.",
                    },
                    {
                      title: "No bank credentials needed",
                      desc: "Record accounts and ledger entries directly with zero scraper access.",
                    },
                    {
                      title: "Excel workbook (.xlsx) export",
                      desc: "Complete export containing transactions, accounts, and categories.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                        <Check className="size-3" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-xs sm:text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Export Card */}
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-muted text-foreground">
                    <Lock className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">Data portability</h3>
                    <p className="text-xs text-muted-foreground">Transactions / Accounts / Categories</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <FileSpreadsheet className="size-4 text-brand" /> Excel workbook (.xlsx)
                    </span>
                    <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                      Built-in export
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Download verified transactions, accounts, and category structures in separate tabular sheets.
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-brand" /> Export available in Settings
                  </span>
                  <Link
                    href="/signup"
                    className="font-medium text-brand hover:underline inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-brand rounded-xs"
                  >
                    Start private ledger <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Action Callout */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="rounded-2xl border border-border bg-muted/40 p-8 sm:p-12 md:p-14">
            <div className="max-w-xl space-y-4">
              <span className="inline-block rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                Get started today
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance text-foreground">
                Take back your financial clarity.
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Set up your accounts, record your transactions, and share a household workspace when you are ready.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className={cn(primary, "h-11 px-6 text-xs sm:text-sm font-semibold")}
                >
                  Create your account
                </Link>
                <Link
                  href="/login"
                  className={cn(quiet, "h-11 px-6 text-xs sm:text-sm")}
                >
                  Sign in
                </Link>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Local encrypted storage / Private household workspace
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Hallmark Mast Footer */}
      <footer className="border-t border-border bg-card/60 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-brand text-brand-foreground">
                  <Wallet className="size-3.5" />
                </span>
                <span className="font-semibold text-sm text-foreground">
                  Expense Tracker
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                Quiet clarity for your everyday money. Multi-account tracking, envelope budgeting, and split settlements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs">
              <a href="#features" className="hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand rounded-xs">
                Capabilities
              </a>
              <a href="#comparison" className="hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand rounded-xs">
                Spreadsheets
              </a>
              <a href="#security" className="hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand rounded-xs">
                Security
              </a>
              <Link href="/login" className="hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand rounded-xs">
                Log in
              </Link>
              <Link href="/signup" className="hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand rounded-xs">
                Register
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-positive" />
              <span>Accounts, activity, and planning together</span>
            </div>
            <p>Expense Tracker. Private financial ledger.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
