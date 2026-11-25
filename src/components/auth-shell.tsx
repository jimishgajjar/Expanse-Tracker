/* Auth shell
 * Intaglio: engraving-green panel on the left, the form on paper to the right. */

import { BrandMark } from "@/components/brand-mark";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Guilloche } from "@/components/guilloche";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Side-by-Side Auth Shell:
 * - Left side: Restrained Hallmark showcase of the Expense Tracker ledger.
 * - Right side: Clean, unboxed modern auth container with theme toggle.
 */
export function AuthShell({
  children,
  headline = "Pick up where your money book left off",
  sub = "Balances, budgets and shared entries, as you left them, on every device.",
}: {
  children: ReactNode;
  headline?: string;
  sub?: string;
}) {
  return (
    <div className="relative min-h-svh w-full overflow-x-clip bg-background text-foreground lg:grid lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      {/* Left: the engraving-green ground from the landing page, quiet and wordless but for the promise. */}
      <aside className="relative isolate hidden min-h-svh flex-col justify-between overflow-hidden bg-brand-deep p-10 text-brand-deep-foreground lg:flex xl:p-14">
        <Guilloche className="absolute inset-x-0 bottom-0 -z-10 h-40 w-full text-brass opacity-40 [mask-image:linear-gradient(to_bottom,transparent,black_60%)]" />
        <Link href="/" className="inline-flex w-fit items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand-deep-foreground" aria-label="Expense Tracker home">
          <BrandMark className="size-8" />
          <span className="font-display text-lg font-semibold">Expense Tracker</span>
        </Link>
        <div className="max-w-md pb-40">
          <h2 className="font-display text-[clamp(2.2rem,3.4vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance">{headline}</h2>
          <p className="mt-5 text-lg leading-relaxed opacity-85">{sub}</p>
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
            <BrandMark className="size-7 text-brand" />
            <span className="font-display text-base font-semibold">Expense Tracker</span>
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
          <Link href="/help" className="underline-offset-4 hover:text-foreground hover:underline">Privacy and support</Link>
        </footer>
      </div>
    </div>
  );
}
