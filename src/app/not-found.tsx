import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 404 for any route that doesn't exist. Previously these fell through to
 *  Next's unstyled default, which reads as a broken deploy rather than a typo. */
export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <span className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand">
          <Compass className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">No page here</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          That address doesn&apos;t match anything in the app. It may have moved, or the link may be mistyped.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className={cn(buttonVariants(), "h-10 font-semibold")}>
            Back to your tracker
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
