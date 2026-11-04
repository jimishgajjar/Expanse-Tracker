import {addMonths,addWeeks,addYears,format,parseISO} from "date-fns";

export function advanceRecurringDate(dateStr: string, freq: string): string {
  const d = parseISO(dateStr);
  const next = freq === "weekly" ? addWeeks(d, 1) : freq === "yearly" ? addYears(d, 1) : addMonths(d, 1);
  return format(next, "yyyy-MM-dd");
}
