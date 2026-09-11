import type { ReactNode } from "react";

/**
 * Consistent heading block above each auth form.
 *
 * Lives apart from auth-shell.tsx on purpose: the forms are Client Components
 * and import this, so keeping it here stops the shell — and the server-only
 * request APIs it now uses to resolve the visitor's currency — from being
 * dragged into the client bundle.
 */
export function AuthHeading({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
