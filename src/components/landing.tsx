import type { ReactNode, SVGProps } from "react";
import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVisitorMoney } from "@/lib/visitor-currency";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Marketing page shown to logged-out visitors at `/`.
 *
 * Register: notion.com. Measured live — white page, Inter, a centred 64px
 * headline at -0.043em with one word lifted into a soft pill, a row of
 * character badges above it, a screenshot of the product below, transparent
 * sections with generous air, and a closing "Get started today." The one
 * deliberate departure is the accent: notion.com's blue would clash with the
 * emerald the product wears everywhere, so emerald carries the CTA and the
 * pill instead. The illustrations are Notion's monoline ink doodles, drawn
 * here as inline SVG.
 */

const ROWS = [
  { name: "Salary", meta: "Bank", kind: "in" as const },
  { name: "Rent", meta: "Housing", kind: "out" as const },
  { name: "Groceries", meta: "Cards", kind: "out" as const },
];

const ctaPrimary = cn(buttonVariants(), "h-10 gap-1.5 rounded-lg px-4 text-[0.9375rem] font-medium");
const ctaQuiet = cn(buttonVariants({ variant: "outline" }), "h-10 rounded-lg px-4 text-[0.9375rem] font-medium");

export async function Landing() {
  const { format, sample, noun } = await getVisitorMoney();
  const [salary, rent, groceries] = sample;
  const amounts = [salary, -rent, -groceries];
  const signed = (n: number) => format(n, { signed: true });
  const net = amounts.reduce((s, n) => s + n, 0);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ── Nav: 64px, no border, the product name and two quiet actions ── */}
      <header>
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="Expense Tracker home">
            <span className="grid size-6 place-items-center rounded-sm bg-foreground text-background">
              <Wallet className="size-3.5" />
            </span>
            <span className="text-sm font-semibold">Expense Tracker</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hover:bg-hover max-sm:hidden")}>
              Log in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "rounded-md px-3")}>
              Get started free
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-4xl px-5 pt-10 pb-16 text-center sm:px-8 sm:pt-16">
          <div className="flex justify-center gap-2" aria-hidden>
            <Badge tone="var(--chart-4)"><Doodle kind="receipt" /></Badge>
            <Badge tone="var(--chart-2)"><Doodle kind="wallet" /></Badge>
            <Badge tone="var(--chart-3)"><Doodle kind="coins" /></Badge>
            <Badge tone="var(--chart-1)"><Doodle kind="house" /></Badge>
            <Badge tone="var(--chart-5)"><Doodle kind="chart" /></Badge>
          </div>

          <h1 className="mx-auto mt-8 max-w-3xl text-[clamp(2.5rem,6.5vw,4rem)] leading-[1.08] font-semibold tracking-[-0.04em] text-balance">
            Every {noun},{" "}
            <span className="inline-flex items-center gap-2 rounded-2xl bg-brand/10 px-3 align-baseline text-brand">
              <span aria-hidden className="size-2.5 rounded-full bg-brand" />
              clearly
            </span>{" "}
            accounted for.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A shared ledger for household money. Accounts, budgets, subscriptions and goals in one place — and
            split what you owe each other, without a spreadsheet.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className={ctaPrimary}>
              Get started free <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className={ctaQuiet}>
              Log in
            </Link>
          </div>

          {/* The product, as it actually looks: a Notion-register page with
              properties and a few rows. The one floating surface on the page. */}
          <div className="mx-auto mt-14 max-w-3xl overflow-hidden rounded-lg border border-border bg-card text-left shadow-md">
            <div className="flex h-9 items-center gap-1.5 border-b border-border px-3 text-xs text-muted-foreground">
              <span className="grid size-4 place-items-center rounded-[3px] bg-brand text-brand-foreground">
                <Wallet className="size-2.5" />
              </span>
              <span className="font-medium text-foreground">Household</span>
              <span>/</span>
              <span>Overview</span>
            </div>
            <div className="px-6 pt-6 pb-5 sm:px-10">
              <span className="grid size-8 place-items-center rounded-md bg-brand/10 text-brand">
                <Wallet className="size-4" />
              </span>
              <div className="mt-2 text-2xl font-bold tracking-[-0.02em]">Household</div>
              <dl className="mt-4 border-y border-border text-sm">
                {[
                  ["Income", signed(salary), "text-positive"],
                  ["Expenses", signed(-(rent + groceries)), "text-negative"],
                  ["Net", signed(net), net < 0 ? "text-negative" : "text-positive"],
                ].map(([k, v, tone]) => (
                  <div key={k} className="flex h-8 items-center gap-3">
                    <dt className="w-24 text-muted-foreground">{k}</dt>
                    <dd className={cn("amount font-medium tabular-nums", tone)}>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 divide-y divide-border">
                {ROWS.map((r, i) => (
                  <div key={r.name} className="flex h-9 items-center gap-3 text-sm">
                    <span className="size-5 rounded-[3px] bg-muted" aria-hidden />
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">{r.meta}</span>
                    <span className={cn("amount w-28 text-right tabular-nums", r.kind === "in" ? "text-positive" : "text-negative")}>
                      {signed(amounts[i])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">Free to start · No card required · Web, iOS &amp; Android</p>
        </section>

        {/* ── Features: doodle + title + text, three across ── */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="mx-auto max-w-2xl text-center text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
            One ledger for everything money does.
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            <Feature kind="wallet" title="Accounts & transfers">
              Cash, bank, cards and wallets in one balance — with transfers that never double-count.
            </Feature>
            <Feature kind="chart" title="Budgets that project">
              Set a monthly limit and see where the month is heading at today&apos;s pace, not just what&apos;s left.
            </Feature>
            <Feature kind="receipt" title="Subscriptions & bills">
              Recurring charges post themselves on schedule, with reminders and a log of every price rise.
            </Feature>
            <Feature kind="coins" title="Savings goals">
              Put money aside toward something specific and watch the gap close.
            </Feature>
            <Feature kind="house" title="Shared trackers">
              Invite a partner or housemates as editors or viewers. Everyone reads the same numbers.
            </Feature>
            <Feature kind="split" title="Split with people">
              Track who owes whom across shared costs, then settle up in one move.
            </Feature>
          </div>
        </section>

        {/* ── The product's actual output ── */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
              Then it tells you what actually happened.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Not a wall of charts — the few readings that change a decision.
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
        </section>

        {/* ── Closing ── */}
        <section className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 sm:py-28">
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">
            Get started today.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
            Create a free account and add your first transaction. No card, no setup wizard.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className={ctaPrimary}>
              Get started free <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className={ctaQuiet}>
              Log in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="grid size-5 place-items-center rounded-sm bg-foreground text-background">
              <Wallet className="size-3" />
            </span>
            <span className="font-medium">Expense Tracker</span>
            <span className="text-muted-foreground">· Your money, clearly accounted for.</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/login" className="transition-colors hover:text-foreground">Log in</Link>
            <Link href="/signup" className="transition-colors hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Notion's character badges: a soft tinted circle with an ink doodle ── */
function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className="grid size-11 place-items-center rounded-full border border-border text-foreground"
      style={{ backgroundColor: `color-mix(in srgb, ${tone} 14%, var(--card))` }}
    >
      {children}
    </span>
  );
}

function Feature({ kind, title, children }: { kind: DoodleKind; title: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-foreground" aria-hidden>
        <Doodle kind={kind} size={40} />
      </span>
      <h3 className="mt-4 text-[0.9375rem] font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/* ── Monoline ink doodles — 1.5px stroke, round joins, drawn on a 24-grid ── */
type DoodleKind = "wallet" | "receipt" | "coins" | "house" | "chart" | "split";

function Doodle({ kind, size = 22, ...rest }: { kind: DoodleKind; size?: number } & SVGProps<SVGSVGElement>) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
  switch (kind) {
    case "wallet":
      return (
        <svg {...common}>
          <path d="M3.5 7.5c0-1 .8-1.8 1.8-1.8h12.4" />
          <path d="M3.5 7.5v9.2c0 1 .8 1.8 1.8 1.8h13.4c1 0 1.8-.8 1.8-1.8v-6.4c0-1-.8-1.8-1.8-1.8H5.3c-1 0-1.8-.8-1.8-1.8z" />
          <path d="M15.5 13.5h4.2" />
          <circle cx="15.7" cy="13.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
          <path d="M9 8h6M9 11.5h6M9 15h3.5" />
        </svg>
      );
    case "coins":
      return (
        <svg {...common}>
          <ellipse cx="10" cy="7" rx="5.5" ry="2.4" />
          <path d="M4.5 7v3.4c0 1.3 2.5 2.4 5.5 2.4s5.5-1.1 5.5-2.4V7" />
          <path d="M4.5 10.4v3.4c0 1.3 2.5 2.4 5.5 2.4" />
          <ellipse cx="15" cy="15.2" rx="5" ry="2.2" />
          <path d="M10 15.2v2.6c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-2.6" />
        </svg>
      );
    case "house":
      return (
        <svg {...common}>
          <path d="M4 11.5 12 5l8 6.5" />
          <path d="M6 10v9h12v-9" />
          <path d="M10 19v-5h4v5" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19.5h16" />
          <path d="M6.5 16v-4M11 16V8.5M15.5 16v-6M20 16V6" />
        </svg>
      );
    case "split":
      return (
        <svg {...common}>
          <circle cx="7.5" cy="8" r="2.5" />
          <circle cx="16.5" cy="8" r="2.5" />
          <path d="M3.5 18c0-2.5 1.8-4.2 4-4.2s4 1.7 4 4.2M12.5 18c0-2.5 1.8-4.2 4-4.2s4 1.7 4 4.2" />
          <path d="M9.5 12.5h5" />
        </svg>
      );
  }
}

function Panel({ title, caption, children, className }: { title: string; caption: string; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("rounded-md border border-border bg-card p-5", className)}>
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
            <span className={cn("amount text-xs tabular-nums", r.over ? "font-medium text-negative" : "text-muted-foreground")}>{r.pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pct)}%`, backgroundColor: r.over ? "var(--negative)" : r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 18 weeks × 7 days of fixed intensity steps (0–4). */
const HEAT = "0120100230100012301030021001230010023100120030102301001200310021003001230010021003100230012001300210031002";

function Heatmap() {
  const cells = HEAT.slice(0, 126).split("").map(Number);
  const alpha = [0, 0.16, 0.34, 0.58, 0.85];
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
        {cells.map((v, i) => (
          <span
            key={i}
            className={cn("h-[10px] rounded-[2px]", v === 0 && "bg-muted")}
            style={v === 0 ? undefined : { backgroundColor: `color-mix(in srgb, var(--negative) ${alpha[v] * 100}%, transparent)` }}
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
    { name: "Other", pct: 7, color: "var(--muted-foreground)" },
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
