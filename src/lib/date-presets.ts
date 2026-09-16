import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
export type DatePreset = "today" | "last7" | "month" | "lastMonth";
export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
];
/** Local calendar dates, inclusive at both ends (no UTC conversion). */
export function presetDates(
  preset: DatePreset,
  today: string,
): { from: string; to: string } {
  const date = parseISO(today);
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  if (preset === "today") return { from: today, to: today };
  if (preset === "last7") return { from: iso(addDays(date, -6)), to: today };
  const month = preset === "lastMonth" ? addMonths(date, -1) : date;
  return { from: iso(startOfMonth(month)), to: iso(endOfMonth(month)) };
}
