import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const widths = {
  narrow: "max-w-2xl",
  default: "max-w-3xl",
  wide: "max-w-5xl",
} as const;

/**
 * Shared frame for focused, standalone pages (imports, exports, help, setup…):
 * a slim sticky bar with a way back, then a centred column with one page header.
 */
export function PageShell({
  back,
  eyebrow,
  title,
  description,
  actions,
  width = "default",
  touch = false,
  children,
}: {
  back: { href: string; label: string };
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  width?: keyof typeof widths;
  /** Enforce 44px touch targets (pilot pages used on phones). */
  touch?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app-shell min-h-dvh">
      <a
        href="#page-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <header className="page-shell-header pt-safe">
        <div className={cn("mx-auto flex h-12 items-center justify-between gap-3 px-4 sm:px-6", widths[width])}>
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href="/"
              aria-label="Expense Tracker overview"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-brand hover:bg-muted"
            >
              <BrandMark className="size-6" />
            </Link>
            <span className="text-muted-foreground/40" aria-hidden>/</span>
            <Link
              href={back.href}
              className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{back.label}</span>
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main
        id="page-content"
        className={cn("mx-auto space-y-5 px-4 pt-6 pb-16 sm:px-6 sm:pt-8", widths[width], touch && "pilot-content")}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</p>}
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">{title}</h1>
            {description && <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
