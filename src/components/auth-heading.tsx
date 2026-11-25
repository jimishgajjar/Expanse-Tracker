import type { ReactNode } from "react";

/**
 * Clean, modern heading block above each auth form.
 */
export function AuthHeading({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="font-display text-[1.875rem] font-semibold leading-tight text-foreground sm:text-[2.25rem]">
        {title}
      </h1>
      <div className="text-sm text-muted-foreground leading-relaxed">{sub}</div>
    </div>
  );
}
