import type { ReactNode } from "react";

/**
 * Auth form error. A bare red sentence is easy to miss on submit-failure, so
 * this gives it a tinted block and announces it to screen readers.
 */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-negative/25 bg-negative/[0.07] px-3 py-2 text-sm text-negative"
    >
      {children}
    </p>
  );
}
