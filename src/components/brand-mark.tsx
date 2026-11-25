import { cn } from "@/lib/utils";

/**
 * The mark: a seal with the double rule a bookkeeper draws under a final total.
 * Inherits colour from `currentColor`.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden focusable="false">
      <circle cx="16" cy="16" r="14.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="1.2 1.6" opacity="0.7" />
      <path d="M9.5 13.5h13M9.5 17.5h13M9.5 20h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
