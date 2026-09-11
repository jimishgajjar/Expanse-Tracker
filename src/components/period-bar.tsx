"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { canNavigate, RANGE_LABELS, RANGE_TYPES, shiftAnchor, type RangeType } from "@/lib/dates";

export function PeriodBar({
  rangeType,
  anchor,
  rangeLabel,
}: {
  rangeType: RangeType;
  anchor: string;
  rangeLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function push(updates: Record<string, string>) {
    const p = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(updates)) p.set(k, v);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    // Mobile reads top-down: the period you're looking at first (arrows at the
    // screen edges for thumb reach), then the range switcher. Desktop is one row.
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      {/* Notion's filter-bar controls: ghost chips, the active one on a soft
          wash — no sunken segmented pill. */}
      <div className="flex gap-0.5 overflow-x-auto">
        {RANGE_TYPES.map((rt) => (
          <button
            key={rt}
            type="button"
            onClick={() => push({ range: rt })}
            aria-pressed={rangeType === rt}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:flex-none sm:py-1",
              rangeType === rt ? "bg-hover text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            {RANGE_LABELS[rt]}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-0.5 sm:justify-center">
        <Button size="icon-sm" variant="ghost" className="hover:bg-hover" disabled={!canNavigate(rangeType)} onClick={() => push({ date: shiftAnchor(rangeType, anchor, -1) })} aria-label="Previous period">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-[9.5rem] text-center text-sm font-medium">{rangeLabel}</span>
        <Button size="icon-sm" variant="ghost" className="hover:bg-hover" disabled={!canNavigate(rangeType)} onClick={() => push({ date: shiftAnchor(rangeType, anchor, 1) })} aria-label="Next period">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
