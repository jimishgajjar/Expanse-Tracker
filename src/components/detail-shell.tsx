import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChartNoAxesCombined,
  House,
  Landmark,
  CalendarDays,
  Settings,
  Wallet,
  Download,
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 min-w-60 max-w-60 shrink-0 flex-col overflow-y-auto border-r border-border/80 bg-sidebar px-3 py-4 lg:flex">
        <div className="mb-6 flex items-center justify-between px-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-tr from-brand to-emerald-400 text-white shadow-sm shadow-brand/25">
              <Wallet className="size-4" />
            </span>
            <div>
              <span className="block text-sm font-bold tracking-tight text-foreground group-hover:text-brand transition-colors">
                Expense Tracker
              </span>
              <span className="block text-[10px] font-medium text-muted-foreground">
                Personal Ledger
              </span>
            </div>
          </Link>
        </div>
        <div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Navigation
          </p>
          <nav aria-label="Main navigation" className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  "nav-item",
                  (section === "Accounts"
                    ? link.label === "Accounts"
                    : link.label === "Activity") && "nav-item-active font-semibold",
                )}
              >
                <link.icon className="size-4" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto border-t border-border/60 pt-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
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
                    a.id === accountId && "nav-item-active font-semibold",
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
        <div className="mt-auto shrink-0 space-y-1 border-t border-border/60 pt-4">
          <Link href="/?tab=settings" className="nav-item group">
            <Settings className="size-[18px] text-muted-foreground group-hover:text-foreground transition-colors" />
            <span>Settings</span>
          </Link>
          <a href="/api/export" className="nav-item group">
            <Download className="size-[18px] text-muted-foreground group-hover:text-foreground transition-colors" />
            <span>Export data</span>
          </a>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/70 bg-background/85 backdrop-blur-md px-4 sm:px-6 pt-safe">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={
                section === "Accounts" ? "/?tab=accounts" : "/?tab=transactions"
              }
              aria-label={`Back to ${section === "Accounts" ? "accounts" : "activity"}`}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/70 hover:bg-muted transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <p className="truncate text-sm font-medium">
              <span className="text-muted-foreground">{section} / </span>
              <span className="text-foreground font-semibold">{title}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/?tab=settings"
              className="grid size-9 place-items-center rounded-lg border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="size-4" />
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main
          id="detail-content"
          className="mx-auto max-w-[1600px] px-4 pt-4 pb-28 sm:px-6 sm:pt-5 lg:pb-8"
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
