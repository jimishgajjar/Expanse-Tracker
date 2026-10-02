"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  todayISO,
  canNavigate,
  RANGE_LABELS,
  RANGE_TYPES,
  shiftAnchor,
  type RangeType,
} from "@/lib/dates";

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
    <div className="flex min-w-0 flex-col-reverse gap-3 rounded-2xl border border-border/80 bg-card p-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between shadow-xs">
      {/* Segmented Range Switcher */}
      <div className="grid min-w-0 grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:flex sm:gap-1">
        {RANGE_TYPES.map((rt) => {
          const isActive = rangeType === rt;
          return (
            <button
              key={rt}
              type="button"
              onClick={() => push({ range: rt })}
              aria-pressed={isActive}
              className={cn(
                "min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all sm:flex-none",
                isActive
                  ? "bg-background text-foreground font-semibold shadow-xs ring-1 ring-border/50"
                  : "text-muted-foreground hover:bg-background/40 hover:text-foreground",
              )}
            >
              {RANGE_LABELS[rt]}
            </button>
          );
        })}
      </div>

      {/* Date Navigation & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-1 sm:justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg hover:bg-muted"
                aria-label="Choose a date preset"
              />
            }
          >
            <CalendarDays className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-44 [&_[role=menuitem]]:min-h-10"
          >
            <DropdownMenuItem
              onClick={() => push({ range: "day", date: todayISO() })}
            >
              Today
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => push({ range: "week", date: todayISO() })}
            >
              This week
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => push({ range: "month", date: todayISO() })}
            >
              This month
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                push({
                  range: "month",
                  date: shiftAnchor("month", todayISO(), -1),
                })
              }
            >
              Last month
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => push({ range: "year", date: todayISO() })}
            >
              This year
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => push({ range: "all", date: todayISO() })}
            >
              All time
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="icon-sm"
          variant="ghost"
          className="size-9 rounded-lg hover:bg-muted"
          disabled={!canNavigate(rangeType)}
          onClick={() => push({ date: shiftAnchor(rangeType, anchor, -1) })}
          aria-label="Previous period"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <span className="min-w-0 flex-1 text-center sm:min-w-[10rem] px-2 text-sm font-semibold tracking-tight text-foreground">
          {rangeLabel}
        </span>

        <Button
          size="icon-sm"
          variant="ghost"
          className="size-9 rounded-lg hover:bg-muted"
          disabled={!canNavigate(rangeType)}
          onClick={() => push({ date: shiftAnchor(rangeType, anchor, 1) })}
          aria-label="Next period"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
