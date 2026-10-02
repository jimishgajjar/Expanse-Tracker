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
  const { money, signedMoney } = useFormat();
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

  const selectedNet = selected ? selected.income - selected.expense : 0;

  return (
    <Card className="gap-4 rounded-2xl border border-border/80 bg-card shadow-xs">
      <CardHeader className="flex flex-wrap items-center justify-between gap-y-2 border-b border-border/60 pb-3">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            Income vs Expense
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Activity curve over selected period
          </p>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-positive" />
            Income
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-negative" />
            Expense
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {!hasActivity ? (
          <div className="grid min-h-52 place-content-center text-center">
            <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <ChartNoAxesCombined className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              No income or expenses in this period
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose another period or record your first transaction.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Hover, tap a bar, or use arrow keys to inspect exact date totals.
            </p>

            <div className="flex gap-2">
              {/* Y-axis markers */}
              <div
                aria-hidden
                className="flex h-44 min-w-12 shrink-0 flex-col justify-between text-right text-[10px] font-medium text-muted-foreground tabular-nums"
              >
                <span>{money(max)}</span>
                <span>{money(max / 2)}</span>
                <span>{money(0)}</span>
              </div>

              {/* Chart bars area */}
              <div className="min-w-0 flex-1 overflow-x-auto pb-2">
                <div
                  className="relative flex gap-1 pt-1"
                  style={{ minWidth: `${data.length * 16}px` }}
                >
                  {/* Subtle horizontal grid lines */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-1 flex h-44 flex-col justify-between"
                  >
                    <span className="border-t border-dashed border-border/50" />
                    <span className="border-t border-dashed border-border/50" />
                    <span className="border-t border-border/70" />
                  </div>

                  {data.map((d, i) => {
                    const isSelected = selectedKey === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        aria-label={`${d.label}: income ${money(d.income)}, expense ${money(d.expense)}`}
                        aria-pressed={isSelected}
                        aria-describedby={`${id}-detail`}
                        onMouseEnter={() => setSelectedKey(d.key)}
                        onFocus={() => setSelectedKey(d.key)}
                        onClick={() => setSelectedKey(d.key)}
                        className={cn(
                          "group relative min-w-0 flex-1 rounded-md transition-colors focus-visible:outline-offset-0",
                          isSelected ? "bg-brand/10" : "hover:bg-muted/40",
                        )}
                      >
                        <span className="flex h-44 items-end justify-center gap-0.5 px-0.5">
                          <span
                            className={cn(
                              "w-1/2 max-w-3.5 rounded-t-md bg-positive shadow-2xs transition-all",
                              d.income > 0 && "min-h-0.5",
                              "group-hover:brightness-110",
                            )}
                            style={{ height: `${(d.income / max) * 100}%` }}
                          />
                          <span
                            className={cn(
                              "w-1/2 max-w-3.5 rounded-t-md bg-negative shadow-2xs transition-all",
                              d.expense > 0 && "min-h-0.5",
                              "group-hover:brightness-110",
                            )}
                            style={{ height: `${(d.expense / max) * 100}%` }}
                          />
                        </span>

                        <span className="mt-2 block h-6 text-[10px] font-medium leading-4 text-muted-foreground">
                          {i % Math.max(1, Math.ceil(data.length / 10)) === 0 ||
                          isSelected
                            ? d.label
                            : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Key Details Bar */}
            <div
              id={`${id}-detail`}
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3"
            >
              <div aria-live="polite" className="text-xs">
                <p className="font-semibold text-foreground">
                  {selected?.label ?? "Select a date bar to inspect"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                  {selected ? (
                    <>
                      <span>
                        Income:{" "}
                        <strong className="amount font-bold text-positive">
                          {money(selected.income)}
                        </strong>
                      </span>
                      <span>
                        Expense:{" "}
                        <strong className="amount font-bold text-negative">
                          {money(selected.expense)}
                        </strong>
                      </span>
                      <span
                        className={cn(
                          "amount rounded px-1.5 py-0.2 text-[11px] font-semibold",
                          selectedNet >= 0
                            ? "bg-positive/10 text-positive"
                            : "bg-negative/10 text-negative",
                        )}
                      >
                        Net: {signedMoney(selectedNet)}
                      </span>
                    </>
                  ) : (
                    <span>Exact date amounts will appear here.</span>
                  )}
                </div>
              </div>

              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
                  aria-label="Previous chart date"
                  disabled={index <= 0}
                  onClick={() => move(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
                  aria-label="Next chart date"
                  disabled={index === data.length - 1}
                  onClick={() => move(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
