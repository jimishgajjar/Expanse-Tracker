import type { ReactNode } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Shared chrome for every auth screen (login, signup, forgot, reset).
 *
 * A two-panel split: the brand ground on the left carries the same deep emerald
 * and the same ledger motif as the landing hero, so arriving from a CTA feels
 * continuous rather than like a different product. The form sits on paper at
 * the right, where the app's own input vocabulary applies unchanged.
 *
 * Below `lg` the panel collapses to a compact brand bar — a decorative half-screen
 * would just push the form below the fold on a phone.
 */

const PROOF = [
  { name: "Salary", amount: "+₹85,000.00", strong: true },
  { name: "Rent", amount: "−₹28,000.00", strong: false },
  { name: "Groceries", amount: "−₹3,240.00", strong: false },
];

export function AuthShell({
  children,
  headline,
  sub,
}: {
  children: ReactNode;
  /** Brand-panel headline. Varies per screen so the panel isn't dead weight. */
  headline: string;
  sub: string;
}) {
  return (
    // Below lg the panel is a compact bar, so its row must size to content —
    // min-h-svh on a single-column grid would otherwise hand it half the
    // viewport while its pitch is hidden, leaving a dead emerald slab.
    <div className="grid min-h-svh grid-rows-[auto_1fr] lg:grid-cols-[1.1fr_1fr] lg:grid-rows-1">
      {/* ── Brand panel ── */}
      <aside className="relative flex flex-col justify-between bg-brand-deep px-6 py-6 text-brand-deep-foreground sm:px-10 lg:px-14 lg:py-12">
        <Link href="/" className="flex w-fit items-center gap-2.5" aria-label="Expense Tracker home">
          <span className="grid size-8 place-items-center rounded-lg bg-white/15 text-white">
            <Wallet className="size-4" />
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-tight text-white">Expense Tracker</span>
        </Link>

        {/* The pitch + ledger motif is the panel's reason to exist; on phones it
            would only delay the form, so it's desktop-only. */}
        <div className="hidden lg:block">
          <h2 className="max-w-md text-[clamp(1.75rem,2.6vw,2.5rem)] leading-[1.08] font-semibold tracking-[-0.025em] text-white">
            {headline}
          </h2>
          <p className="mt-4 max-w-sm leading-relaxed text-white/75">{sub}</p>

          <div className="mt-10 max-w-sm">
            <div className="flex items-baseline justify-between border-b border-white/20 pb-2">
              <span className="text-xs font-medium text-white/80">August</span>
              <span className="text-xs text-white/80">3 of 24 entries</span>
            </div>
            <ul>
              {PROOF.map((r) => (
                <li key={r.name} className="flex items-center justify-between border-b border-white/12 py-2.5">
                  <span className="text-sm text-white/90">{r.name}</span>
                  <span
                    className={`amount text-sm tabular-nums ${r.strong ? "font-semibold text-white" : "text-white/75"}`}
                  >
                    {r.amount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="hidden text-sm text-white/80 lg:block">
          Free to start · No card required · Web, iOS &amp; Android
        </p>
      </aside>

      {/* ── Form panel ── */}
      <main className="relative flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

/** Consistent heading block above each auth form. */
export function AuthHeading({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
