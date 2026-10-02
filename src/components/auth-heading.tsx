import type { ReactNode } from "react";

/**
 * Clean, modern heading block above each auth form.
 */
export function AuthHeading({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      <div className="text-sm text-muted-foreground leading-relaxed">{sub}</div>
    </div>
  );
}
