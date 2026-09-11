import type { ReactNode } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Shared chrome for every auth screen (login, signup, forgot, reset).
 *
 * Notion's login is almost nothing: a small wordmark top-left, one narrow
 * centred column, and a quiet footer. No side panel, no pitch — the person
 * here has already decided. `headline` / `sub` are accepted so the four pages
 * keep their signatures, but this register has nowhere honest to put them.
 */
export function AuthShell({
  children,
}: {
  children: ReactNode;
  headline: string;
  sub: string;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex h-16 items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Expense Tracker home">
          <span className="grid size-6 place-items-center rounded-sm bg-foreground text-background">
            <Wallet className="size-3.5" />
          </span>
          <span className="text-sm font-semibold">Expense Tracker</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pt-10 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[340px]">{children}</div>
      </main>

      <footer className="px-5 pb-6 text-center text-xs text-muted-foreground">
        Free to start · No card required · Web, iOS &amp; Android
      </footer>
    </div>
  );
}
