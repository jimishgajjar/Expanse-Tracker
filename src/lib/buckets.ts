import { eachDayOfInterval, eachMonthOfInterval, eachYearOfInterval, format, parseISO, subDays } from "date-fns";
import type { RangeType } from "./dates";

export type Bucket = { key: string; label: string; income: number; expense: number };
type Tx = { type: "income" | "expense"; amount: number; date: string };

const keyOf = (date: string, gran: "day" | "month" | "year") =>
  gran === "day" ? date : gran === "month" ? date.slice(0, 7) : date.slice(0, 4);

/** Group transactions into time buckets sized to the active range, for the trend chart. */
export function bucketize(txns: Tx[], rangeType: RangeType, start: string, end: string): Bucket[] {
  const gran: "day" | "month" | "year" =
    rangeType === "day" || rangeType === "week" || rangeType === "month" ? "day"
      : rangeType === "year" ? "month" : "year";

  let from: Date, to: Date;
  if (rangeType === "all") {
    const dates = txns.map((t) => t.date).sort();
    if (!dates.length) return [];
    from = parseISO(dates[0]);
    to = parseISO(dates[dates.length - 1]);
  } else {
    from = parseISO(start);
    to = subDays(parseISO(end), 1); // end is exclusive
  }
  if (to < from) to = from;

  const points =
    gran === "day" ? eachDayOfInterval({ start: from, end: to })
      : gran === "month" ? eachMonthOfInterval({ start: from, end: to })
        : eachYearOfInterval({ start: from, end: to });

  const fmt = gran === "day" ? "d MMM" : gran === "month" ? "MMM" : "yyyy";
  const buckets: Bucket[] = points.map((d) => ({
    key: keyOf(format(d, "yyyy-MM-dd"), gran),
    label: format(d, fmt),
    income: 0,
    expense: 0,
  }));

  const index: Record<string, Bucket> = {};
  for (const b of buckets) index[b.key] = b;
  for (const t of txns) {
    const b = index[keyOf(t.date, gran)];
    if (b) b[t.type] += t.amount;
  }
  return buckets;
}
