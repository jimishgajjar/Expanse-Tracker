"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormat } from "@/components/settings-provider";
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
          <div className="flex h-[200px] items-stretch gap-1">
            {data.map((d, i) => (
              <div key={d.key} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="flex w-full grow items-end justify-center gap-0.5"
                  title={`${d.label} · income ${money(d.income)} · expense ${money(d.expense)}`}
                >
                  <div className="w-1/2 max-w-[14px] rounded-t-sm bg-positive transition-opacity group-hover:opacity-80" style={{ height: `${(d.income / max) * 100}%` }} />
                  <div className="w-1/2 max-w-[14px] rounded-t-sm bg-negative transition-opacity group-hover:opacity-80" style={{ height: `${(d.expense / max) * 100}%` }} />
                </div>
                <span className="h-3 w-full truncate text-center text-[9px] leading-3 text-muted-foreground">
                  {i % labelStep === 0 ? d.label : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
