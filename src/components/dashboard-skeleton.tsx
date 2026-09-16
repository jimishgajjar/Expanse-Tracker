import { Skeleton } from "@/components/ui/skeleton";

/** Used only for authenticated navigation; matches the sidebar and overview. */
export function DashboardSkeleton() {
  return (
    <div className="app-shell min-h-dvh" aria-busy="true" role="status">
      <span className="sr-only">Loading your tracker…</span>
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 hidden w-60 space-y-4 border-r bg-sidebar p-7 lg:block"
      >
        <Skeleton className="mb-10 h-9 w-full" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </aside>
      <div className="lg:pl-60" aria-hidden="true">
        <div className="flex h-16 items-center border-b bg-background px-4 sm:px-7 xl:px-10">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 pt-6 pb-28 sm:px-7 sm:pt-8 xl:px-10">
          <div className="space-y-3">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-5 w-64 max-w-full" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl sm:h-16" />
          <div className="rounded-2xl border bg-card p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-12 w-64 max-w-full" />
            <Skeleton className="mt-4 h-4 w-52 max-w-full" />
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
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
