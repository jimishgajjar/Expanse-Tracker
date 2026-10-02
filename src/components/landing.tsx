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
  "h-11 rounded-xl px-5 text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all",
);
const quiet = cn(
  buttonVariants({ variant: "outline" }),
  "h-11 rounded-xl px-5 text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all",
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
      className="relative min-h-dvh overflow-x-hidden bg-background text-foreground selection:bg-brand/20 selection:text-brand"
    >
      {/* Subtle ambient lighting pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] overflow-hidden opacity-60 dark:opacity-30"
      >
        <div className="absolute top-[-25%] left-1/2 h-[550px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,var(--brand)_0%,transparent_70%)] opacity-20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(55,53,47,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(55,53,47,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)]" />
      </div>

      <a
        href="#landing-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3 focus:shadow-md"
      >
        Skip to content
      </a>

      {/* Modern Floating Island Navigation Header */}
      <header className="sticky top-3 z-40 mx-auto max-w-6xl px-4 sm:px-6">
        <nav
          aria-label="Main navigation"
          className="flex min-h-14 items-center justify-between rounded-full border border-border/80 bg-background/80 px-4 py-2 shadow-xs backdrop-blur-md transition-colors sm:px-6"
        >
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/" className="flex items-center gap-2.5 font-semibold">
              <span className="grid size-8 place-items-center rounded-xl bg-brand text-brand-foreground shadow-xs">
                <Wallet className="size-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">
                Expense Tracker
              </span>
              <span className="hidden rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand sm:inline-block">
                Household finance
              </span>
            </Link>

            <div className="hidden items-center gap-6 text-xs font-medium text-muted-foreground md:flex">
              <a
                href="#features"
                className="transition-colors hover:text-foreground"
              >
                Capabilities
              </a>
              <a
                href="#comparison"
                className="transition-colors hover:text-foreground"
              >
                Vs Spreadsheets
              </a>
              <a
                href="#architecture"
                className="transition-colors hover:text-foreground"
              >
                Architecture
              </a>
              <a
                href="#security"
                className="transition-colors hover:text-foreground"
              >
                Privacy
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "rounded-full px-3.5 text-xs font-medium",
              )}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "sm" }),
                "rounded-full px-4 text-xs font-semibold shadow-xs",
              )}
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main id="landing-content">
        {/* Cinematic Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-24 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
            <div>
              {/* Product Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1 text-xs font-semibold text-brand">
                <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                <span>The Sovereign Ledger for Personal & Household Wealth</span>
              </div>

              <h1 className="mt-5 text-[clamp(2.4rem,4.8vw,3.75rem)] leading-[1.08] font-bold tracking-[-0.035em] text-balance">
                Financial clarity.
                <br />
                <span className="text-foreground">Engineered for real life,</span>
                <br />
                <span className="bg-gradient-to-r from-brand via-emerald-500 to-teal-400 bg-clip-text text-transparent">
                  not data brokers.
                </span>
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
                Keep accounts, spending, budgets, and household bills in one place.
                Record transactions yourself, track transfers separately, and see where your money goes.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={primary}>
                  Open your private vault <ArrowRight className="ml-1.5 size-4" />
                </Link>
                <a href="#features" className={quiet}>
                  Explore capabilities
                </a>
              </div>

              {/* Trust micro-bullets */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-brand" /> Zero bank credentials stored
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-brand" /> Accounts and transfers in one view
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-brand" /> Excel (.xlsx) export
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

        {/* Product capabilities */}
        <section className="border-y border-border/70 bg-muted/20 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-brand">
                  Search
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Find activity
                </p>
                <p className="text-xs text-muted-foreground">
                  Filter transactions by account, category, and date.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-brand">
                  Manual
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Bank entry
                </p>
                <p className="text-xs text-muted-foreground">
                  Add transactions without connecting your bank account.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-brand">
                  .xlsx
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Data export
                </p>
                <p className="text-xs text-muted-foreground">
                  Download transactions, accounts, and categories in a workbook.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-brand">
                  Shared
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Workspaces
                </p>
                <p className="text-xs text-muted-foreground">
                  Track accounts and manage household spending together.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid Features Section */}
        <section id="features" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand">
                Precision Architecture
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl text-balance">
                Everything in its place. Nothing counted twice.
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Move money between accounts without counting it as spending.
                Keep household splits alongside your everyday activity.
              </p>
            </div>

            {/* Asymmetric Bento Grid */}
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Bento Card 1: Multi-Account Balance Engine (Span 2 cols on lg) */}
              <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Landmark className="size-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Multi-Account Engine
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold tracking-tight">
                    Accounts that always add up without double-counting
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-xl">
                    Checking accounts, high-yield savings vaults, everyday rewards cards, and
                    physical cash. Internal transfers move money between accounts with
                    separate transfer records, so they do not inflate expense charts.
                  </p>
                </div>

                {/* Account Transfer Simulation Illustration */}
                <div className="mt-8 space-y-3">
                  <div className="rounded-xl border border-border/60 bg-muted/25 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand">
                        <ArrowRightLeft className="size-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          Internal Vault Transfer: Checking → High-Yield Savings
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Capital allocation · 0% artificial expense inflation
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-md bg-positive/10 px-2.5 py-1 text-[11px] font-semibold text-positive">
                        Net Expense: $0.00
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Checking Account</span>
                        <CreditCard className="size-3.5 text-brand" />
                      </div>
                      <p className="amount mt-2 text-base font-bold text-foreground">
                        {format(salary * 0.42)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Operating liquidity
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Vault Savings</span>
                        <PiggyBank className="size-3.5 text-brand" />
                      </div>
                      <p className="amount mt-2 text-base font-bold text-foreground">
                        {format(balance)}
                      </p>
                      <p className="mt-1 text-[11px] text-positive font-medium">
                        +4.85% APY compounding
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Rewards Card</span>
                        <Sparkles className="size-3.5 text-brand" />
                      </div>
                      <p className="amount mt-2 text-base font-bold text-foreground">
                        {format(groceries)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Cleared automatically
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Card 2: Recurring Intelligence */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Repeat className="size-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recurring Radar
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold tracking-tight">
                    Subscriptions without surprises
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Keep memberships, recurring cloud bills, and annual charges forecasted.
                    Automated calendar posting prevents missed dues.
                  </p>
                </div>

                <div className="mt-6 space-y-2.5 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="font-semibold text-foreground">Cloud Dev Workspace</span>
                    <span className="amount font-bold text-foreground">
                      {format(20)}/mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-border/40">
                    <span className="font-semibold text-foreground">Fiber Gigabit Internet</span>
                    <span className="amount font-bold text-foreground">
                      {format(utilities)}/mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-brand font-semibold">
                    <span>Due in 3 days</span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-positive" /> Auto-reconciled
                    </span>
                  </div>
                </div>
              </div>

              {/* Bento Card 3: Shared Workspaces */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Users className="size-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Shared Workspaces
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold tracking-tight">
                    Fair splits, zero friction
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Invite household members or travel companions. Record joint grocery runs
                    or dining tabs and settle who owes whom in a single tap.
                  </p>
                </div>

                <div className="mt-6 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">Shared Apartment Run</span>
                    <span className="amount font-bold text-foreground">
                      {format(groceries)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Equal 50 / 50 Split</span>
                    <span className="rounded bg-brand/10 px-2 py-0.5 font-semibold text-brand">
                      Alex owes you {format(groceries / 2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bento Card 4: Envelope Pacing (Span 2 cols on lg) */}
              <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                      <CalendarCheck className="size-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Envelope Velocity
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold tracking-tight">
                    Paced envelope budgeting for the real world
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-xl">
                    Set monthly limits on groceries, dining out, and leisure. Our velocity
                    gauge tells you if you are spending faster than the calendar pace, giving
                    you room to adjust before month-end surprises.
                  </p>
                </div>

                {/* Progress bars */}
                <div className="mt-6 space-y-3.5">
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
                      label: "Significant buffer preserved",
                      tone: "bg-brand",
                    },
                    {
                      name: "Household Utilities",
                      spent: 85,
                      label: "Approaching planned limit",
                      tone: "bg-amber-500",
                    },
                  ].map((cat) => (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-foreground">{cat.name}</span>
                        <span className="amount text-muted-foreground">
                          {cat.spent}% used · {cat.label}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", cat.tone)}
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

        {/* High-Conviction "Spreadsheet Paradox" Comparison Section */}
        <section id="comparison" className="scroll-mt-16 border-t border-border/70 bg-muted/15 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand">
                Why Us
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl text-balance">
                Built to solve the spreadsheet paradox
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Spreadsheets corrupt on phones. Mainstream bank apps break connections and sell your data.
                Here is how Expense Tracker re-establishes sanity.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {/* Legacy / Mainstream Column */}
              <div className="rounded-2xl border border-destructive/20 bg-card p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                    <X className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Fragile Aggregators & Excel</h3>
                    <p className="text-xs text-muted-foreground">The status quo that burns you out</p>
                  </div>
                </div>

                <ul className="space-y-3.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Bank connections can fail and leave gaps in your records</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Some apps place financial product offers beside your spending</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Transfers may be confused with spending when records are not separated</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Clunky spreadsheet formulas break when adding a row on a phone</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="size-4 shrink-0 text-destructive mt-0.5" />
                    <span>Sharing a spreadsheet across a household takes coordination</span>
                  </li>
                </ul>
              </div>

              {/* Expense Tracker Sovereign Column */}
              <div className="relative rounded-2xl border border-brand/40 bg-gradient-to-b from-brand/5 via-card to-card p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="absolute top-4 right-4">
                  <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[10px] font-bold text-brand uppercase tracking-wider">
                     Expense Tracker
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Check className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Expense Tracker Ledger</h3>
                    <p className="text-xs text-muted-foreground">Accounts, activity, and planning together</p>
                  </div>
                </div>

                <ul className="space-y-3.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">Manually recorded activity stays in your workspace</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">No bank login or account aggregation required</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">Transfers tracked separately from income and expenses</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">Add transactions from your phone or desktop</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 shrink-0 text-brand mt-0.5" />
                    <span className="text-foreground font-medium">Export transactions, accounts, and categories to Excel (.xlsx)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Account security and export */}
        <section id="security" className="scroll-mt-16 border-t border-border/70 bg-card/40 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-brand">
                  Security & Architecture
                </span>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl text-balance">
                  Your records, in one accessible place.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  You can track your finances without sharing banking passwords.
                  Your workspace requires an account, and you can download your
                  transactions, accounts, and categories as an Excel workbook.
                </p>

                <div className="mt-6 space-y-4 text-sm">
                  {[
                    {
                      title: "Account sign-in",
                      desc: "Passwords are hashed, and sign-in uses HTTP-only session cookies.",
                    },
                    {
                      title: "No bank password needed",
                      desc: "Record your activity without connecting a bank account.",
                    },
                    {
                      title: "Excel (.xlsx) export",
                      desc: "Download a workbook with transactions, accounts, and categories.",
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

              {/* Data sovereignty guarantee card */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Your data export</h3>
                    <p className="text-xs text-muted-foreground">Transactions · Accounts · Categories</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      <FileSpreadsheet className="size-4 text-brand" /> Excel workbook (.xlsx)
                    </span>
                    <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                      Export Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                     Download transactions, accounts, and categories in separate sheets.
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
                  <span className="flex items-center gap-1.5">
                     <ShieldCheck className="size-3.5 text-brand" /> Export available in Settings
                  </span>
                  <Link
                    href="/signup"
                    className="font-semibold text-brand hover:underline"
                  >
                    Start private ledger →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* High-Converting Bottom CTA Banner */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-gradient-to-br from-brand/15 via-card to-background p-8 sm:p-12 md:p-16 shadow-lg">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-brand/20 blur-3xl"
            />
            <div className="relative z-10 max-w-xl space-y-4">
              <span className="inline-block rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand">
                 Start with your first account
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-balance text-foreground">
                Take back your financial agency.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                 Set up an account, add your transactions, and invite household members
                 when you are ready to share a workspace.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className={cn(primary, "h-12 px-6 text-sm font-semibold")}
                >
                  Create your free account <ArrowRight className="ml-1.5 size-4" />
                </Link>
                <Link
                  href="/login"
                  className={cn(quiet, "h-12 px-6 text-sm")}
                >
                  Sign in
                </Link>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                No credit card required · Free personal workspace included
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-border/70 bg-card/40 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-lg bg-brand text-brand-foreground">
                  <Wallet className="size-3.5" />
                </span>
                <span className="font-semibold text-sm text-foreground">
                  Expense Tracker
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                Quiet clarity for your everyday money. Multi-account tracking,
                household envelope budgeting, and split settlements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs">
              <a href="#features" className="hover:text-foreground transition-colors">
                Capabilities
              </a>
              <a href="#comparison" className="hover:text-foreground transition-colors">
                Vs Spreadsheets
              </a>
              <a href="#security" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <Link href="/login" className="hover:text-foreground transition-colors">
                Log in
              </Link>
              <Link href="/signup" className="hover:text-foreground transition-colors">
                Register
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-positive" />
              <span>Accounts, activity, and planning together</span>
            </div>
            <p>© 2026 Expense Tracker. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
