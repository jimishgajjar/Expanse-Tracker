import {
  startOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  startOfYear,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  format,
  parseISO,
} from "date-fns";

export type RangeType = "day" | "week" | "month" | "year" | "years" | "all";

export const RANGE_TYPES: RangeType[] = ["day", "week", "month", "year", "years", "all"];
export const RANGE_LABELS: Record<RangeType, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  years: "Multi-year",
  all: "All time",
};

const YEARS_SPAN = 5;
const WEEK = { weekStartsOn: 1 } as const; // Monday-start weeks
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

/** Resolve a granularity + anchor date into a [start, end) range and a label. */
export function getRange(type: RangeType, anchor: string): { start: string; end: string; label: string } {
  const a = parseISO(anchor);
  switch (type) {
    case "day": {
      const s = startOfDay(a);
      return { start: iso(s), end: iso(addDays(s, 1)), label: format(a, "EEE, d MMM yyyy") };
    }
    case "week": {
      const s = startOfWeek(a, WEEK);
      const e = endOfWeek(a, WEEK);
      return { start: iso(s), end: iso(addDays(e, 1)), label: `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}` };
    }
    case "month": {
      const s = startOfMonth(a);
      return { start: iso(s), end: iso(addMonths(s, 1)), label: format(a, "MMMM yyyy") };
    }
    case "year": {
      const s = startOfYear(a);
      return { start: iso(s), end: iso(addYears(s, 1)), label: format(a, "yyyy") };
    }
    case "years": {
      const endY = startOfYear(a);
      const startY = addYears(endY, -(YEARS_SPAN - 1));
      return { start: iso(startY), end: iso(addYears(endY, 1)), label: `${format(startY, "yyyy")} – ${format(endY, "yyyy")}` };
    }
    case "all":
    default:
      return { start: "0001-01-01", end: "9999-12-31", label: "All time" };
  }
}

/** Move the anchor one period forward (1) or back (-1). No-op for "all". */
export function shiftAnchor(type: RangeType, anchor: string, dir: 1 | -1): string {
  const a = parseISO(anchor);
  switch (type) {
    case "day":
      return iso(addDays(a, dir));
    case "week":
      return iso(addWeeks(a, dir));
    case "month":
      return iso(addMonths(a, dir));
    case "year":
      return iso(addYears(a, dir));
    case "years":
      return iso(addYears(a, dir * YEARS_SPAN));
    default:
      return anchor;
  }
}

export const canNavigate = (type: RangeType) => type !== "all";
