import { cn } from "@/lib/utils";

/**
 * Banknote-style engraving: interleaved sine bands like the security border on a cheque.
 * Deterministic and server-rendered, so it costs no client JavaScript. Purely decorative.
 */
const W = 600;
const H = 160;

function band(lines: number, amp: number, wave: number, mid: number) {
  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const phase = (i / lines) * Math.PI * 2;
    let d = "";
    for (let x = 0; x <= W; x += 6) {
      const t = (x / wave) * Math.PI * 2;
      const y = mid + amp * Math.sin(t + phase) + amp * 0.35 * Math.sin(t * 2.5 - phase * 2);
      d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`;
    }
    paths.push(d);
  }
  return paths;
}

const PATHS = [...band(14, 34, 220, 80), ...band(8, 14, 90, 80)];

export function Guilloche({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("pointer-events-none", className)} aria-hidden focusable="false">
      {PATHS.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={i < 14 ? 0.7 : 0.5} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
