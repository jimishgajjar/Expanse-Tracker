import { Skeleton } from "@/components/ui/skeleton";

/** Used only for authenticated navigation; matches the sidebar and overview. */
export function DashboardSkeleton() {
  return (
    <div className="app-shell min-h-dvh" aria-busy="true" role="status">
      <span className="sr-only">Loading your tracker…</span>
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 min-w-60 max-w-60 shrink-0 flex-col space-y-4 border-r border-border/80 bg-sidebar px-3 py-4 lg:flex"
      >
        <Skeleton className="mb-6 h-9 w-full" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </aside>
      <div className="min-w-0 lg:pl-60" aria-hidden="true">
        <div className="flex h-16 items-center border-b bg-background px-4 sm:px-7 xl:px-10">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 pt-6 pb-28 sm:px-7 sm:pt-8 xl:px-10">
          <div className="space-y-3">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-5 w-64 max-w-full" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl sm:h-16" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="size-6 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
