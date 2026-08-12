import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Marketing page shown to logged-out visitors at `/`.
 *
 * Design stance: the page IS a ledger. The product's fingerprint — hairline
 * rules, tabular numerals, signed amounts in an aligned column — is the visual
 * language, rather than the floating-dashboard-screenshot template every
 * finance landing page ships. The hero is drenched in a deep emerald so the
 * brand carries the fold; the app's One Emerald Rule still governs the ledger
 * UI itself, where emerald has to stay semantic.
 */

const ctaLight = cn(
  buttonVariants(),
  "h-11 gap-2 rounded-md bg-white px-5 text-[0.9375rem] font-semibold text-[var(--brand-deep)] hover:bg-white/90",
);
const ctaGhostLight =
  "inline-flex h-11 items-center rounded-md border border-white/25 px-5 text-[0.9375rem] font-medium text-white transition-colors hover:bg-white/10";

/** A believable month, and the figures reconcile — on a money product, a hero
 *  whose numbers don't add up is a credibility bug. 85000−28000−3240−1890. */
const LEDGER = [
  { name: "Salary", meta: "1 Aug · HDFC", amount: 85000, kind: "in" as const },
  { name: "Rent", meta: "2 Aug · Housing", amount: -28000, kind: "out" as const },
  { name: "Groceries", meta: "4 Aug · Cards", amount: -3240, kind: "out" as const },
  { name: "Electricity", meta: "5 Aug · Utilities", amount: -1890, kind: "out" as const },
];
const NET = LEDGER.reduce((s, r) => s + r.amount, 0);

const inr = (n: number) =>
  `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))}`;
const signed = (n: number) => `${n < 0 ? "−" : "+"}${inr(n)}`;

export function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ── Hero: the one drenched surface. Nav lives inside it so the fold is
             a single uninterrupted brand statement. ── */}
      <header className="bg-brand-deep text-brand-deep-foreground">
        <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Expense Tracker home">
            <span className="grid size-8 place-items-center rounded-lg bg-white/15 text-white">
              <Wallet className="size-4" />
            </span>
            <span className="text-[0.9375rem] font-semibold tracking-tight text-white">Expense Tracker</span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="[&>button:hover]:bg-white/10 [&>button:hover]:text-white [&>button]:text-white/75">
              <ThemeToggle />
            </span>
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white max-sm:hidden"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-[var(--brand-deep)] transition-colors hover:bg-white/90"
            >
              Get started
            </Link>
          </div>
        </nav>

        <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7 lg:pt-6">
            {/* Clamp is bounded by the column, not the viewport: at 3.5rem the
                second line measures ~560px against a ~620px column, so the
                deliberate two-line break survives instead of re-wrapping. */}
            <h1 className="animate-in fade-in slide-in-from-bottom-3 text-[clamp(2rem,5.5vw,3.5rem)] leading-[1.03] font-semibold tracking-[-0.03em] text-white duration-700">
              Every rupee,
              <br />
              clearly accounted for.
            </h1>
            <p className="animate-in fade-in slide-in-from-bottom-3 mt-6 max-w-md text-lg leading-relaxed text-white/80 duration-700 [animation-delay:80ms]">
              A shared ledger for household money. Track accounts, budgets, subscriptions and goals — and split
              what you owe each other, without a spreadsheet.
            </p>
            <div className="animate-in fade-in slide-in-from-bottom-3 mt-8 flex flex-wrap items-center gap-3 duration-700 [animation-delay:160ms]">
              <Link href="/signup" className={ctaLight}>
                Get started free <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className={ctaGhostLight}>
                Sign in
              </Link>
            </div>
            <p className="animate-in fade-in mt-6 text-sm text-white/80 duration-1000 [animation-delay:240ms]">
              Free to start · No card required · Web, iOS &amp; Android
            </p>
          </div>

          {/* The product's signature row, rendered straight onto the brand
              ground — not a screenshot floating in a drop-shadowed card. */}
          <div className="lg:col-span-5 lg:pl-8">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 [animation-delay:200ms]">
              <div className="flex items-baseline justify-between border-b border-white/20 pb-2.5">
                <span className="text-sm font-medium text-white">August</span>
                <span className="text-xs text-white/80">4 entries</span>
              </div>
              <ul>
                {LEDGER.map((row, i) => (
                  <li
                    key={row.name}
                    className="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-4 border-b border-white/12 py-3.5 duration-700"
                    style={{ animationDelay: `${320 + i * 90}ms` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.9375rem] text-white">{row.name}</div>
                      <div className="truncate text-xs text-white/80">{row.meta}</div>
                    </div>
                    <span
                      className={cn(
                        "amount shrink-0 text-[0.9375rem] tabular-nums",
                        row.kind === "in" ? "font-semibold text-white" : "text-white/75",
                      )}
                    >
                      {signed(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="animate-in fade-in mt-5 flex items-end justify-between duration-1000 [animation-delay:700ms]">
                <span className="text-sm text-white/80">Net this month</span>
                <span className="amount text-[clamp(1.75rem,4vw,2.5rem)] leading-none font-semibold tracking-tight text-white tabular-nums">
                  {signed(NET)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Capabilities as a statement, not a card grid ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
                One ledger for everything money does.
              </h2>
              <p className="mt-4 max-w-sm leading-relaxed text-muted-foreground">
                Built for a household, not a finance team. Fast to log, honest about the numbers, and shared with
                whoever needs to see them.
              </p>
            </div>

            <ul className="divide-y divide-border border-y border-border lg:col-span-8">
              {[
                ["Accounts & transfers", "Cash, bank, cards and wallets in one balance — with transfers that don't double-count."],
                ["Budgets that project", "Set a monthly limit and see where the month is heading at today's pace, not just what's left."],
                ["Subscriptions & bills", "Recurring charges post themselves on schedule, with reminders and a log of every price rise."],
                ["Savings goals", "Put money aside toward something specific and watch the gap close."],
                ["Split with people", "Track who owes whom across shared costs, then settle up in one move."],
                ["Shared trackers", "Invite a partner or housemates as editors or viewers. Everyone reads the same numbers."],
                ["Any currency", "Track in the currency you actually live in."],
              ].map(([title, body]) => (
                <li key={title} className="grid gap-1 py-5 sm:grid-cols-12 sm:gap-6">
                  <h3 className="text-[0.9375rem] font-semibold sm:col-span-4">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:col-span-8">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── The product's actual output, at three different scales ── */}
        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
                Then it tells you what actually happened.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Not a wall of charts — the few readings that change a decision: whether the month is running a
                surplus, whether a budget will hold, and which days money leaves.
              </p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              <Panel className="lg:col-span-2" title="Monthly rhythm" caption="Net position, last 12 months">
                <RhythmChart />
              </Panel>
              <Panel title="Budget pace" caption="Projected against limit">
                <BudgetPace />
              </Panel>
              <Panel title="Spending calendar" caption="Every day of the year">
                <Heatmap />
              </Panel>
              <Panel className="lg:col-span-2" title="Where it goes" caption="Share of spend by category">
                <MixBars />
              </Panel>
            </div>
          </div>
        </section>

        {/* ── Cross-device ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] leading-[1.12] font-semibold tracking-[-0.02em]">
                Log it on the phone. Review it on the desk.
              </h2>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                One account, one database, everywhere. Capture a coffee in four taps on the bus; sit down at the end
                of the month and see the whole picture.
              </p>
            </div>
            <dl className="divide-y divide-border border-y border-border lg:col-span-5">
              {[
                ["Web", "Any browser, nothing to install"],
                ["iOS & Android", "Native apps, same account"],
                ["Home Screen", "Install as a PWA, always a tap away"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-4 py-3">
                  <dt className="w-32 shrink-0 text-sm font-semibold">{k}</dt>
                  <dd className="text-sm text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Closing bookend: back to the brand ground ── */}
        <section className="bg-brand-deep text-brand-deep-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="max-w-lg text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.025em] text-white">
                Start tracking in under a minute.
              </h2>
              <p className="mt-3 max-w-md text-white/75">
                Create a free account and add your first transaction. No card, no setup wizard.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/signup" className={ctaLight}>
                Get started free <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className={ctaGhostLight}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

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

function Panel({
  title,
  caption,
  children,
  className,
}: {
  title: string;
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{caption}</span>
      </figcaption>
      <div className="mt-5">{children}</div>
    </figure>
  );
}

/* ── Product artefacts, drawn in markup. Values are fixed (never random) so the
      server and client render identically. ── */

const MONTHS = ["S", "O", "N", "D", "J", "F", "M", "A", "M", "J", "J", "A"];
const NETS = [18, 42, -12, 30, 55, 24, -8, 38, 62, 20, 48, 71];

function RhythmChart() {
  const peak = Math.max(...NETS.map(Math.abs));
  return (
    <div>
      <div className="flex h-[132px] items-stretch gap-1.5">
        {NETS.map((n, i) => {
          const h = (Math.abs(n) / peak) * 100;
          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-1 items-end">
                {n >= 0 && <div className="w-full rounded-t-[3px] bg-positive" style={{ height: `${h}%` }} />}
              </div>
              <div aria-hidden className="border-t border-border" />
              <div className="flex flex-1 items-start">
                {n < 0 && <div className="w-full rounded-b-[3px] bg-negative" style={{ height: `${h}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {MONTHS.map((m, i) => (
          <span key={i} className="min-w-0 flex-1 text-center text-[10px] text-muted-foreground">{m}</span>
        ))}
      </div>
    </div>
  );
}

function BudgetPace() {
  const rows = [
    { name: "Groceries", pct: 62, color: "var(--chart-1)", over: false },
    { name: "Eating out", pct: 104, color: "var(--chart-3)", over: true },
    { name: "Transport", pct: 38, color: "var(--chart-2)", over: false },
  ];
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span>{r.name}</span>
            <span className={cn("amount text-xs tabular-nums", r.over ? "font-medium text-negative" : "text-muted-foreground")}>
              {r.pct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, r.pct)}%`, backgroundColor: r.over ? "var(--negative)" : r.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 18 weeks × 7 days of fixed intensity steps (0–4). */
const HEAT =
  "0120100230100012301030021001230010023100120030102301001200310021003001230010021003100230012001300210031002";

function Heatmap() {
  const cells = HEAT.slice(0, 126).split("").map(Number); // 18 columns × 7 rows
  const alpha = [0, 0.16, 0.34, 0.58, 0.85];
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
        {cells.map((v, i) => (
          <span
            key={i}
            className={cn("h-[10px] rounded-[2px]", v === 0 && "bg-muted")}
            style={
              v === 0
                ? undefined
                : { backgroundColor: `color-mix(in srgb, var(--negative) ${alpha[v] * 100}%, transparent)` }
            }
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        {alpha.map((a, i) => (
          <span
            key={i}
            className={cn("size-[10px] rounded-[2px]", i === 0 && "bg-muted")}
            style={i === 0 ? undefined : { backgroundColor: `color-mix(in srgb, var(--negative) ${a * 100}%, transparent)` }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function MixBars() {
  const cats = [
    { name: "Housing", pct: 38, color: "var(--chart-1)" },
    { name: "Groceries", pct: 22, color: "var(--chart-2)" },
    { name: "Transport", pct: 14, color: "var(--chart-3)" },
    { name: "Eating out", pct: 11, color: "var(--chart-4)" },
    { name: "Utilities", pct: 8, color: "var(--chart-5)" },
    { name: "Other", pct: 7, color: "#9b9a97" },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {cats.map((c) => (
          <div key={c.name} style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {cats.map((c) => (
          <li key={c.name} className="flex items-baseline gap-2 text-sm">
            <span className="size-2 shrink-0 translate-y-px rounded-full" style={{ backgroundColor: c.color }} />
            <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
            <span className="amount text-xs tabular-nums">{c.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
