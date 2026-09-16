"use client";
import { useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChartNoAxesCombined } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useFormat } from "./settings-provider";
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
  const { money } = useFormat();
  const id = useId();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const data = useMemo(
    () =>
      bucketize(
        transactions.map((t) => ({
          type: t.type,
          amount: t.amount,
          date: t.date,
        })),
        rangeType,
        start,
        end,
      ),
    [transactions, rangeType, start, end],
  );
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const hasActivity = data.some((d) => d.income > 0 || d.expense > 0);
  const index = data.findIndex((d) => d.key === selectedKey);
  const selected = data[index] ?? null;
  const move = (direction: number) =>
    setSelectedKey(
      data[Math.min(data.length - 1, Math.max(0, index + direction))]?.key ??
        null,
    );
  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-wrap items-center gap-y-2">
        <CardTitle>Income vs expense</CardTitle>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-positive" />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-negative" />
            Expense
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {!hasActivity ? (
          <div className="grid min-h-52 place-content-center text-center">
            <ChartNoAxesCombined className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              No income or expenses in this period
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose another period or add your first transaction.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Hover, tap a date, or use the arrow buttons to compare totals.
            </p>
            <div className="flex gap-2">
              <div
                aria-hidden
                className="flex h-44 min-w-12 shrink-0 flex-col justify-between text-right text-[10px] text-muted-foreground"
              >
                <span>{money(max)}</span>
                <span>{money(max / 2)}</span>
                <span>{money(0)}</span>
              </div>
              <div className="min-w-0 flex-1 overflow-x-auto pb-2">
                <div
                  className="relative flex gap-1"
                  style={{ minWidth: `${data.length * 16}px` }}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between"
                  >
                    <span className="border-t border-dashed" />
                    <span className="border-t border-dashed" />
                    <span className="border-t" />
                  </div>
                  {data.map((d, i) => (
                    <button
                      key={d.key}
                      type="button"
                      aria-label={`${d.label}: income ${money(d.income)}, expense ${money(d.expense)}`}
                      aria-pressed={selectedKey === d.key}
                      aria-describedby={`${id}-detail`}
                      onMouseEnter={() => setSelectedKey(d.key)}
                      onFocus={() => setSelectedKey(d.key)}
                      onClick={() => setSelectedKey(d.key)}
                      className={cn(
                        "group relative min-w-0 flex-1 rounded-sm focus-visible:outline-offset-0",
                        selectedKey === d.key && "bg-brand/5",
                      )}
                    >
                      <span className="flex h-44 items-end justify-center gap-0.5 px-0.5">
                        <span
                          className={cn(
                            "w-1/2 max-w-4 rounded-t-sm bg-positive",
                            d.income > 0 && "min-h-0.5",
                          )}
                          style={{ height: `${(d.income / max) * 100}%` }}
                        />
                        <span
                          className={cn(
                            "w-1/2 max-w-4 rounded-t-sm bg-negative",
                            d.expense > 0 && "min-h-0.5",
                          )}
                          style={{ height: `${(d.expense / max) * 100}%` }}
                        />
                      </span>
                      <span className="mt-2 block h-8 text-[10px] leading-4 text-muted-foreground">
                        {i % Math.max(1, Math.ceil(data.length / 10)) === 0 ||
                        selectedKey === d.key
                          ? d.label
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div
              id={`${id}-detail`}
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3"
            >
              <div aria-live="polite" className="text-xs">
                <p className="font-medium">
                  {selected?.label ?? "Explore a date"}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  {selected ? (
                    <>
                      <span>
                        Income{" "}
                        <strong className="amount text-positive">
                          {money(selected.income)}
                        </strong>
                      </span>
                      <span>
                        Expenses{" "}
                        <strong className="amount text-negative">
                          {money(selected.expense)}
                        </strong>
                      </span>
                    </>
                  ) : (
                    "Exact amounts appear here."
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label="Previous chart date"
                  disabled={index <= 0}
                  onClick={() => move(-1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label="Next chart date"
                  disabled={index === data.length - 1}
                  onClick={() => move(1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
