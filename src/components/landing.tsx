/* Landing · "Intaglio": the household money book. One dark engraving-green hero with a
 * ruled ledger page; everything after it is quiet paper and type. */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getVisitorMoney } from "@/lib/visitor-currency";
import { ThemeToggle } from "@/components/theme-toggle";
import { Guilloche } from "@/components/guilloche";
import { BrandMark } from "@/components/brand-mark";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring";

/** Server-rendered marketing page: no client JavaScript beyond the theme toggle. */
export async function Landing() {
  const { format, sample } = await getVisitorMoney();
  const [salary, rent, groceries, utilities] = sample;
  const saved = Math.round(salary * 0.15);
  const spent = rent + groceries + utilities;
  const kept = salary - spent;
  const minus = (n: number) => `−${format(n)}`;

  const rows: { day: string; entry: string; who: string; amount: string; kind: "in" | "out" | "move" }[] = [
    { day: "Nov 1", entry: "Pay", who: "Sam", amount: `+${format(salary)}`, kind: "in" },
    { day: "Nov 1", entry: "Rent", who: "Shared", amount: minus(rent), kind: "out" },
    { day: "Nov 3", entry: "To savings", who: "Sam", amount: format(saved), kind: "move" },
    { day: "Nov 6", entry: "Groceries", who: "Priya", amount: minus(groceries), kind: "out" },
    { day: "Nov 12", entry: "Hydro and internet", who: "Shared", amount: minus(utilities), kind: "out" },
  ];

  const points = [
    {
      title: "Moving money isn't spending",
      body: "Put money into savings or pay a card from chequing and it shows as a transfer. Both balances update. Your spending and income don't.",
      example: <>Chequing to Savings <span className="text-foreground">{format(saved)}</span>, spending unchanged</>,
    },
    {
      title: "Shared, and private when you want",
      body: "Keep one tracker for the household and invite your partner. Each of you can also keep a private tracker that only you can open.",
      example: <>Household tracker for two, plus one private tracker each</>,
    },
    {
      title: "See the month before it happens",
      body: "Budgets warn you before a category runs over. Bills and subscriptions show up with their due dates, and goals show what is left to save.",
      example: <>Groceries <span className="text-foreground">{format(groceries)}</span> of {format(Math.round(groceries * 1.25))} with 9 days to go</>,
    },
    {
      title: "Take your records with you",
      body: "Export every entry, account and category to an Excel workbook whenever you like. Import a bank statement file to fill in a month quickly.",
      example: <>Excel export and statement import, both in Settings</>,
    },
  ];

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <a href="#landing-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">
        Skip to content
      </a>

      <div className="relative isolate bg-brand-deep text-brand-deep-foreground">
        <Guilloche className="absolute inset-x-0 bottom-0 -z-10 h-40 w-full text-brass opacity-40 [mask-image:linear-gradient(to_bottom,transparent,black_55%)] sm:h-56" />

        <header>
          <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className={cn("flex items-center gap-2.5 rounded-sm", focus)}>
              <BrandMark className="size-8 text-brand-deep-foreground" />
              <span className="font-display text-lg font-semibold">Expense Tracker</span>
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <a href="#how" className={cn("hidden rounded-md px-3 py-2 text-sm opacity-85 hover:opacity-100 md:inline-block", focus)}>How it works</a>
              <a href="#privacy" className={cn("hidden rounded-md px-3 py-2 text-sm opacity-85 hover:opacity-100 md:inline-block", focus)}>Privacy</a>
              <ThemeToggle />
              <Link href="/login" className={cn("rounded-md px-3 py-2 text-sm font-medium hover:bg-white/10", focus)}>Sign in</Link>
            </div>
          </nav>
        </header>

        <main id="landing-content">
          <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 sm:pt-16 sm:pb-28 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-16">
            <div className="max-w-xl">
              <h1 className="font-display text-[clamp(2.6rem,6vw,4.4rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-balance">
                One money book for the whole household
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed opacity-85">
                Write down what comes in and goes out, move money between your accounts, and see where the month stands. No bank logins.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/signup" className={cn("inline-flex h-12 items-center rounded-lg bg-brand-deep-foreground px-6 text-[15px] font-semibold text-brand-deep transition-colors hover:bg-white", focus)}>
                  Create a free account
                </Link>
                <Link href="/login" className={cn("inline-flex h-12 items-center rounded-lg border border-white/25 px-6 text-[15px] font-medium transition-colors hover:bg-white/10", focus)}>
                  Sign in
                </Link>
              </div>
            </div>

            {/* A page from the book: ruled lines, a red margin rule, a running total at the foot. */}
            <figure className="relative min-w-0 rounded-lg bg-card text-card-foreground shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)]">
              <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 pt-5 pb-3 sm:px-6">
                <p className="font-display text-xl font-semibold">November</p>
                <p className="text-sm text-muted-foreground">Sam and Priya</p>
              </div>
              <table className="w-full text-sm">
                <caption className="sr-only">Sample month of household entries</caption>
                <thead className="sr-only"><tr><th>Date</th><th>Entry</th><th>Who</th><th>Amount</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.entry} className="border-b border-border/70 last:border-b-0">
                      <td className="w-[4.75rem] py-3 pl-5 align-top whitespace-nowrap text-muted-foreground sm:pl-6">{r.day}</td>
                      <td className="border-l-2 border-negative/35 py-3 pl-3 align-top">
                        <span className={cn("block font-medium", r.kind === "move" && "text-muted-foreground")}>{r.entry}</span>
                        <span className="block text-xs text-muted-foreground">{r.kind === "move" ? "Transfer, not counted as spending" : r.who}</span>
                      </td>
                      <td className={cn("amount py-3 pr-5 text-right align-top font-medium whitespace-nowrap sm:pr-6",
                        r.kind === "in" ? "text-positive" : r.kind === "out" ? "text-foreground" : "text-muted-foreground")}>
                        {r.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <figcaption className="grid grid-cols-2 gap-4 rounded-b-lg border-t-2 border-double border-border bg-muted/50 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs text-muted-foreground">Spent</p>
                  <p className="display-figure mt-1 text-2xl">{format(spent)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Kept</p>
                  <p className="display-figure mt-1 text-2xl text-positive">{format(kept)}</p>
                </div>
              </figcaption>
            </figure>
          </section>
        </main>
      </div>

      <section id="how" aria-labelledby="how-title" className="scroll-mt-4 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <h2 id="how-title" className="font-display max-w-2xl text-[clamp(1.9rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
          Built around how a household actually handles money
        </h2>
        <div className="mt-14 grid gap-x-16 gap-y-12 md:grid-cols-2">
          {points.map((p) => (
            <article key={p.title} className="border-t border-foreground/15 pt-6">
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 max-w-[60ch] leading-relaxed text-muted-foreground">{p.body}</p>
              <p className="amount mt-4 text-sm text-muted-foreground">{p.example}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-4 border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <h2 id="privacy-title" className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
            You type it in, or import a statement file you chose. We never ask for your bank login.
          </h2>
          <ul className="grid content-start gap-5 text-[15px] leading-relaxed text-muted-foreground">
            <li><strong className="font-semibold text-foreground">Nothing connects to your bank.</strong> There are no bank passwords to store and no connection to break.</li>
            <li><strong className="font-semibold text-foreground">Only the people you invite.</strong> Shared trackers are open to the members you add, and private trackers only to you.</li>
            <li><strong className="font-semibold text-foreground">Yours to keep.</strong> Export everything to Excel at any time, or delete your account and its data.</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="start-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h2 id="start-title" className="font-display text-[clamp(1.9rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-[-0.02em]">
              Start this month&apos;s page
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Add your accounts with the balance in each, then write down the next thing you spend.
            </p>
          </div>
          <Link href="/signup" className={cn("inline-flex h-12 shrink-0 items-center rounded-lg bg-brand px-6 text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-deep", focus)}>
            Create a free account
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-foreground">
            <BrandMark className="size-6 text-brand" />
            <span className="font-display font-semibold">Expense Tracker</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/help" className={cn("rounded-sm hover:text-foreground", focus)}>Privacy and support</Link>
            <Link href="/login" className={cn("rounded-sm hover:text-foreground", focus)}>Sign in</Link>
            <Link href="/signup" className={cn("rounded-sm hover:text-foreground", focus)}>Create an account</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
