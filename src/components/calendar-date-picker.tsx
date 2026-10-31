"use client";

import { useId, useState } from "react";
import {
  format,
  parseISO,
  isValid,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  subDays,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarDatePickerProps {
  id?: string;
  value: string; // ISO format "yyyy-MM-dd"
  onChange: (date: string) => void;
  className?: string;
}

export function CalendarDatePicker({
  id,
  value,
  onChange,
  className,
}: CalendarDatePickerProps) {
  const popoverId = useId();
  const [open, setOpen] = useState(false);

  // Parse current value or fallback to today
  const selectedDate = (() => {
    try {
      const d = parseISO(value);
      return isValid(d) ? d : new Date();
    } catch {
      return new Date();
    }
  })();

  // Month being viewed in the calendar
  const [viewMonth, setViewMonth] = useState<Date>(selectedDate);

  // Friendly display for the trigger button
  const displayInfo = (() => {
    try {
      const today = startOfDay(new Date());
      const target = startOfDay(selectedDate);
      const diffDays = Math.round(
        (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) {
        return { label: "Today", detail: format(selectedDate, "MMM d, yyyy") };
      }
      if (diffDays === -1) {
        return { label: "Yesterday", detail: format(selectedDate, "MMM d, yyyy") };
      }
      if (diffDays === 1) {
        return { label: "Tomorrow", detail: format(selectedDate, "MMM d, yyyy") };
      }
      return {
        label: format(selectedDate, "EEE, MMM d"),
        detail: format(selectedDate, "yyyy"),
      };
    } catch {
      return { label: value, detail: "" };
    }
  })();

  // Quick preset handlers
  function applyPreset(offsetDays: number) {
    const target = subDays(new Date(), offsetDays);
    const iso = format(target, "yyyy-MM-dd");
    onChange(iso);
    setViewMonth(target);
    setOpen(false);
  }

  function handleSelectDay(day: Date) {
    const iso = format(day, "yyyy-MM-dd");
    onChange(iso);
    setOpen(false);
  }

  // Generate calendar days grid
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const weekDayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setViewMonth(selectedDate);
        }
      }}
    >
      <PopoverTrigger
        render={<button type="button" id={id || popoverId} />}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg bg-transparent px-0 text-left transition-colors hover:opacity-90 focus-visible:outline-none cursor-pointer",
          className,
        )}
        aria-label={`Select date, currently ${displayInfo.label} ${displayInfo.detail}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <CalendarIcon className="size-4 shrink-0 text-brand" />
          <div className="min-w-0 truncate">
            <span className="text-sm font-semibold text-foreground">
              {displayInfo.label}
            </span>
            {displayInfo.detail && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                {displayInfo.detail}
              </span>
            )}
          </div>
        </div>
        <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
          Change
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[304px] p-3 shadow-md rounded-xl border border-border bg-popover text-popover-foreground space-y-3 z-50"
      >
        {/* Quick Date Presets */}
        <div className="grid grid-cols-4 gap-1 border-b border-border/60 pb-2.5">
          <button
            type="button"
            onClick={() => applyPreset(0)}
            className={cn(
              "rounded-md py-1 text-[11px] font-medium text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98] disabled:opacity-50",
              isToday(selectedDate)
                ? "bg-brand/15 text-brand font-semibold"
                : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyPreset(1)}
            className="rounded-md bg-muted/40 hover:bg-muted py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98] disabled:opacity-50"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => applyPreset(2)}
            className="rounded-md bg-muted/40 hover:bg-muted py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98] disabled:opacity-50"
          >
            2d ago
          </button>
          <button
            type="button"
            onClick={() => applyPreset(7)}
            className="rounded-md bg-muted/40 hover:bg-muted py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98] disabled:opacity-50"
          >
            1w ago
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between px-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98] disabled:opacity-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs font-semibold text-foreground">
            {format(viewMonth, "MMMM yyyy")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98] disabled:opacity-50"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Week Day Labels */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDayLabels.map((dayLabel) => (
            <span
              key={dayLabel}
              className="text-xs font-medium text-muted-foreground"
            >
              {dayLabel}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const inCurrentMonth = isSameMonth(day, viewMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isDayToday = isToday(day);

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={cn(
                  "grid size-8 place-items-center rounded-lg text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand active:scale-95 disabled:opacity-50",
                  isSelected
                    ? "bg-brand text-brand-foreground font-bold shadow-xs"
                    : inCurrentMonth
                      ? "text-foreground hover:bg-muted/70"
                      : "text-muted-foreground/35 hover:bg-muted/40",
                  isDayToday && !isSelected && "border border-brand/50 font-semibold text-brand",
                )}
                aria-label={format(day, "PPP")}
                aria-pressed={isSelected}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
