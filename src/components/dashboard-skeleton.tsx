import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant shell for the signed-in dashboard.
 *
 * `/` fans out to ~15 DB queries plus the recurring materialisation, so without
 * this every period change left the viewer on a blank page until all of it
 * resolved. It mirrors the real layout — header, period bar, hero balance,
 * ledger strip, accounts, charts — so the swap-in lands on the same geometry
 * instead of reflowing.
 *
 * Deliberately NOT `app/loading.tsx`: that boundary wraps the whole root
 * segment, which also serves the logged-out marketing page, so a first-time
 * visitor got a flash of fake dashboard before the landing hero. It lives
 * behind a Suspense boundary in page.tsx that only the signed-in branch
 * renders.
 */
export function DashboardSkeleton() {
  return (
    <div className="min-h-svh" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your tracker…</span>

      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-6">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-36" />
          <div className="ml-auto flex items-center gap-1.5">
            <Skeleton className="hidden h-8 w-24 rounded-md sm:block" />
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-3 pt-4 pb-28 sm:space-y-5 sm:px-6 sm:pt-5 sm:pb-6">
        {/* Period bar */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="ml-auto h-8 w-56 rounded-md max-sm:hidden" />
        </div>

        {/* Tab list (desktop) */}
        <Skeleton className="h-9 w-72 rounded-lg max-sm:hidden" />

        {/* Hero balance + ledger strip */}
        <div className="rounded-xl border border-border p-4 sm:p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2.5 h-9 w-56" />
          <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-background p-3">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="mt-2 h-5 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Accounts */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="mt-3 h-6 w-28" />
              </div>
            ))}
          </div>
        </div>

        {/* Donut + trend */}
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-5 h-[200px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
