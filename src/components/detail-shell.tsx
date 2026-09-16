import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChartNoAxesCombined,
  House,
  Landmark,
  CalendarDays,
  Wallet,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import type { AccountDTO } from "@/lib/queries";

const links = [
  { label: "Overview", href: "/", icon: House },
  { label: "Activity", href: "/?tab=transactions", icon: ArrowLeftRight },
  { label: "Accounts", href: "/?tab=accounts", icon: Landmark },
  { label: "Planning", href: "/?tab=planning", icon: CalendarDays },
  { label: "Insights", href: "/?tab=analytics", icon: ChartNoAxesCombined },
];

export function DetailShell({
  children,
  accounts,
  accountId,
  section,
  title,
}: {
  children: ReactNode;
  accounts: AccountDTO[];
  accountId?: string;
  section: "Accounts" | "Categories" | "Tags";
  title: string;
}) {
  return (
    <div className="app-shell min-h-dvh">
      <a
        href="#detail-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card p-5 lg:flex">
        <Link
          href="/"
          className="mb-8 flex min-h-11 items-center gap-3 font-semibold"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground">
            <Wallet className="size-5" />
          </span>
          Expense Tracker
        </Link>
        <nav aria-label="Main navigation" className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "nav-item",
                (section === "Accounts"
                  ? link.label === "Accounts"
                  : link.label === "Activity") && "nav-item-active",
              )}
            >
              <link.icon className="size-4" />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-3 px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Your accounts
          </p>
          <nav aria-label="Your accounts" className="space-y-1">
            {accounts
              .filter((a) => !a.archived || a.id === accountId)
              .map((a) => (
                <Link
                  key={a.id}
                  href={`/accounts/${a.id}`}
                  aria-current={a.id === accountId ? "page" : undefined}
                  className={cn(
                    "nav-item",
                    a.id === accountId && "nav-item-active",
                  )}
                >
                  <span style={{ color: a.color }}>
                    <Icon name={a.icon} size={16} />
                  </span>
                  <span className="truncate">{a.name}</span>
                </Link>
              ))}
          </nav>
        </div>
        <p className="mt-5 px-3 text-xs text-muted-foreground">
          A clearer view of your money.
        </p>
      </aside>
      <div className="lg:pl-60">
        <header className="flex h-18 items-center justify-between gap-3 border-b bg-card px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={
                section === "Accounts" ? "/?tab=accounts" : "/?tab=transactions"
              }
              aria-label={`Back to ${section === "Accounts" ? "accounts" : "activity"}`}
              className="grid size-11 shrink-0 place-items-center rounded-lg border hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <p className="truncate text-sm">
              <span className="text-muted-foreground">{section} / </span>
              {title}
            </p>
          </div>
          <ThemeToggle />
        </header>
        <main
          id="detail-content"
          className="mx-auto max-w-7xl px-4 pt-7 pb-28 sm:px-8 sm:pt-9 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-brand"
          >
            <link.icon className="size-5" />
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
