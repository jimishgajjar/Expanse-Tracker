"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level recovery for the dashboard.
 *
 * Without this, a failed query (a dropped Neon connection, a bad range) drops
 * the viewer on Next's default error screen with no way back. For a money app
 * the wording matters: a render failure is not a data failure, and saying so
 * is the difference between "retry" and "did I just lose my ledger?".
 *
 * Next 16 passes `unstable_retry` here — the older `reset` prop is gone.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render failed:", error);
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <span className="grid size-11 place-items-center rounded-xl bg-negative/10 text-negative">
          <TriangleAlert className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">That didn&apos;t load</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Something went wrong rendering your tracker. Nothing was changed and no data was lost — this is a display
          problem, not a problem with your ledger.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => unstable_retry()} className="h-10 gap-2 font-semibold">
            <RotateCw className="size-4" /> Try again
          </Button>
          <Button variant="outline" className="h-10" onClick={() => window.location.assign("/")}>
            Reload the dashboard
          </Button>
        </div>

        {error.digest && (
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            Reference <code className="font-mono text-foreground">{error.digest}</code> — quote this if you need to
            trace it in the server logs.
          </p>
        )}
      </div>
    </main>
  );
}
