"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import { bucketize } from "@/lib/buckets";
import type { RangeType } from "@/lib/dates";
import type { TransactionDTO } from "@/lib/queries";

export function TrendChart({
  transactions,
  rangeType,
  start,
  end,
}: {
  transactions: TransactionDTO[];
  rangeType: RangeType;
  start: string;
  end: string;
}) {
  const data = useMemo(
    () => bucketize(transactions.map((t) => ({ type: t.type, amount: t.amount, date: t.date })), rangeType, start, end),
    [transactions, rangeType, start, end],
  );
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const labelStep = Math.ceil(data.length / 12);
  const { money } = useFormat();

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Income vs expense</CardTitle>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-positive" /> Income</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-negative" /> Expense</span>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No data in this period.</p>
        ) : (
          <div>
            {/* Plot area: hairline gridlines + a solid baseline ground the bars. */}
            <div className="relative">
              <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                <span className="border-t border-border/70" />
                <span className="border-t border-border/50" />
                <span className="border-t border-border/50" />
                <span className="border-t border-border/50" />
                <span />
              </div>
              <span aria-hidden className="pointer-events-none absolute -top-0.5 right-0 rounded bg-card px-1 text-[10px] leading-4 text-muted-foreground">
                {money(max)}
              </span>
              <div className="relative flex h-[200px] items-stretch gap-1">
                {data.map((d) => (
                  <div
                    key={d.key}
                    className="group flex min-w-0 flex-1 items-end justify-center gap-0.5"
                    title={`${d.label} · income ${money(d.income)} · expense ${money(d.expense)}`}
                  >
                    <div
                      className={cn("w-1/2 max-w-[18px] rounded-t-[3px] bg-positive transition-opacity group-hover:opacity-75", d.income > 0 && "min-h-[3px]")}
                      style={{ height: `${(d.income / max) * 100}%` }}
                    />
                    <div
                      className={cn("w-1/2 max-w-[18px] rounded-t-[3px] bg-negative transition-opacity group-hover:opacity-75", d.expense > 0 && "min-h-[3px]")}
                      style={{ height: `${(d.expense / max) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <div aria-hidden className="border-t border-border" />
            </div>
            <div className="mt-1 flex gap-1">
              {data.map((d, i) => (
                <span key={d.key} className="h-3 min-w-0 flex-1 truncate text-center text-[10px] leading-3 text-muted-foreground">
                  {i % labelStep === 0 ? d.label : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
