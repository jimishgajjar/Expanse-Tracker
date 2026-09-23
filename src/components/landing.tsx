import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, CircleDollarSign, Landmark, Repeat, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVisitorMoney } from "@/lib/visitor-currency";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const primary = cn(buttonVariants(), "h-11 rounded-lg px-5 text-sm");
const quiet = cn(buttonVariants({ variant: "outline" }), "h-11 rounded-lg px-5 text-sm");

/** Server-rendered product demonstration: no chart library or animation runtime. */
export async function Landing() {
  const { format, sample } = await getVisitorMoney();
  const [salary, rent, groceries] = sample;
  const balance = salary - rent - groceries;
  const rows = [
    { title: "Salary", detail: "Income · Bank account", amount: salary, icon: ArrowDownLeft },
    { title: "Rent", detail: "Housing · Bank account", amount: -rent, icon: ArrowUpRight },
    { title: "Groceries", detail: "Everyday spending · Card", amount: -groceries, icon: ArrowUpRight },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#landing-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">Skip to content</a>
      <header className="border-b bg-card">
        <nav aria-label="Main navigation" className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="grid size-8 place-items-center rounded-xl bg-brand text-brand-foreground"><Wallet className="size-4" /></span>
            <span className="text-sm max-[360px]:text-xs">Expense Tracker</span>
          </Link>
          <a href="#features" className="ml-8 hidden text-sm text-muted-foreground hover:text-foreground md:block">Features</a>
          <a href="#planning" className="hidden text-sm text-muted-foreground hover:text-foreground md:block">Plan ahead</a>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-2")}>Log in</Link>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>Get started</Link>
          </div>
        </nav>
      </header>

      <main id="landing-content">
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-8 sm:py-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12 lg:py-16">
          <div>
            <h1 className="max-w-lg text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.12] font-semibold tracking-[-0.035em] text-balance">Your money.<br />A little clearer,<br /><span className="text-brand">every day.</span></h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">See what came in, where it went, and what’s coming next. One shared place for your accounts, everyday spending, and household plans.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className={primary}>Get started free <ArrowRight className="size-4" /></Link>
              <a href="#features" className={quiet}>Explore features</a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">No card required. Start with your first account.</p>
          </div>

          <figure className="min-w-0 overflow-hidden rounded-2xl border bg-card">
            <figcaption className="flex items-center justify-between gap-3 border-b px-4 py-3 text-xs sm:px-5">
              <span className="flex items-center gap-2 font-medium"><Wallet className="size-4 text-brand" /> Household overview</span>
              <span className="text-muted-foreground">Sample data</span>
            </figcaption>
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs text-muted-foreground">Available across your accounts</p><p className="amount mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{format(balance)}</p></div>
                <span className="rounded-md bg-brand/10 px-2 py-1 text-xs text-brand">This month</span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-y py-3">
                <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowDownLeft className="size-3" /> Income</dt><dd className="amount mt-1 text-sm font-semibold text-positive">{format(salary)}</dd></div>
                <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowUpRight className="size-3" /> Expenses</dt><dd className="amount mt-1 text-sm font-semibold text-negative">{format(rent + groceries)}</dd></div>
              </dl>
              <div className="mt-4 flex items-center justify-between"><h2 className="text-xs font-semibold">Recent activity</h2><span className="text-xs text-muted-foreground">Income & expenses</span></div>
              <ul className="mt-1 divide-y">
                {rows.map(({ title, detail, amount, icon: RowIcon }) => (
                  <li key={title} className="flex items-center gap-3 py-3">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", amount > 0 ? "bg-positive/10 text-positive" : "bg-muted text-muted-foreground")}><RowIcon className="size-4" /></span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div>
                    <span className={cn("amount shrink-0 text-sm font-medium", amount > 0 ? "text-positive" : "text-negative")}>{format(amount, { signed: true })}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3 text-xs text-muted-foreground sm:px-5"><Users className="size-4 shrink-0 text-brand" /> A shared view for you and your household.</div>
          </figure>
        </section>

        <section id="features" className="scroll-mt-6 border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-9 sm:px-8 sm:py-12">
            <div className="grid gap-3 md:grid-cols-2 md:gap-12">
              <h2 className="max-w-sm text-2xl leading-tight font-semibold tracking-tight">Everything has a place.<br />Nothing gets counted twice.</h2>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground">Follow spending across accounts, keep transfers separate from expenses, and share a tracker with the people you plan with.</p>
            </div>
            <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-3">
              {[
                { icon: Landmark, title: "Accounts that add up", text: "Cash, bank accounts, cards and wallets in one view. Open any account to search and filter its activity." },
                { icon: Repeat, title: "Bills without the guesswork", text: "Keep subscriptions, installments and recurring income together, with reminders, price history and reusable tags." },
                { icon: Users, title: "Shared money, shared clarity", text: "Invite editors or viewers to your tracker. Record shared expenses and see who owes whom." },
              ].map(({ icon: FeatureIcon, title, text }) => (
                <div key={title} className="border-t pt-4">
                  <FeatureIcon className="size-5 text-brand" />
                  <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="planning" className="mx-auto grid max-w-6xl scroll-mt-6 gap-8 px-4 py-10 sm:px-8 sm:py-12 md:grid-cols-2 md:items-center md:gap-16">
          <div className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">A plan for the month</h3><span className="text-xs text-muted-foreground">Illustration</span></div>
            <div className="mt-5 space-y-5">
              {[{ name: "Groceries", used: 62, text: "Within budget" }, { name: "Transport", used: 38, text: "Room to spare" }, { name: "Eating out", used: 90, text: "Approaching the limit" }].map(({ name, used, text }) => (
                <div key={name}>
                  <div className="mb-2 flex justify-between gap-3 text-sm"><span>{name}</span><span className="amount text-xs text-muted-foreground">{used}% used</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", used >= 90 ? "bg-amber-600" : "bg-brand")} style={{ width: `${used}%` }} /></div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl leading-tight font-semibold tracking-tight">Make room for what’s next.</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">A clear record is just the beginning. Give your money a plan, and see how the month is taking shape.</p>
            <ul className="mt-5 space-y-3 text-sm">
              {["Set monthly budgets and follow your spending pace.", "Save toward goals with a target and a deadline.", "Review trends and spending by category in Insights."].map((text) => <li key={text} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand" />{text}</li>)}
            </ul>
          </div>
        </section>

        <section className="border-y bg-brand/5">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-4 py-8 sm:flex-row sm:items-center sm:px-8">
            <div><h2 className="text-xl font-semibold tracking-tight">Start with one account. Build a clearer picture.</h2><p className="mt-2 text-sm text-muted-foreground">Add your first transaction and take it from there.</p></div>
            <Link href="/signup" className={cn(primary, "shrink-0")}>Create your account <ArrowRight className="size-4" /></Link>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-8">
        <span className="flex items-center gap-2"><CircleDollarSign className="size-4 text-brand" /> Expense Tracker · Your money, clearly accounted for.</span>
        <div className="flex items-center gap-5"><Link href="/login" className="hover:text-foreground">Log in</Link><Link href="/signup" className="hover:text-foreground">Get started</Link></div>
      </footer>
    </div>
  );
}
