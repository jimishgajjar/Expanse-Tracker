"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { useFormat } from "@/components/settings-provider";
import { colorFor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { TransactionDTO } from "@/lib/queries";

type Seg = {
  id: string | null;
  name: string;
  value: number;
  color: string;
  icon: string;
};

function Donut({ segments, total }: { segments: Seg[]; total: number }) {
  const size = 180,
    stroke = 24,
    r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    cx = size / 2;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="-rotate-90 transition-transform duration-500 ease-out-expo"
      aria-hidden="true"
    >
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={stroke}
      />
      {segments.map((s, index) => {
        const offset = total
          ? (segments
              .slice(0, index)
              .reduce((sum, part) => sum + part.value, 0) /
              total) *
            c
          : 0;
        const dash = total ? (s.value / total) * c : 0;
        return (
          <circle
            key={s.id ?? "uncategorized"}
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            className="transition-all duration-300 hover:opacity-85"
          />
        );
      })}
    </svg>
  );
}

export function CategoryDonut({
  transactions,
}: {
  transactions: TransactionDTO[];
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense");

  const segments = useMemo<Seg[]>(() => {
    const map = new Map<string, Seg>();
    for (const t of transactions) {
      if (t.type !== kind) continue;
      const name = t.category?.name ?? "Uncategorised";
      const key = t.categoryId ?? "uncategorized";
      const seg = map.get(key) ?? {
        id: t.categoryId,
        name,
        value: 0,
        color: t.category?.color ?? colorFor(name),
        icon: t.category?.icon ?? "circle-help",
      };
      seg.value += t.amount;
      map.set(key, seg);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [transactions, kind]);

  const total = segments.reduce((s, x) => s + x.value, 0);
  const { money } = useFormat();

  return (
    <Card className="gap-3 rounded-2xl border border-border/80 bg-card shadow-xs">
      <CardHeader className="flex flex-wrap items-center justify-between gap-y-2 border-b border-border/60 pb-3">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            {kind === "expense" ? "Spending by Category" : "Income by Source"}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Distribution across categories
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1 text-xs">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "min-h-7 rounded-md px-3 py-1 text-xs font-medium capitalize transition-all",
                kind === k
                  ? k === "expense"
                    ? "bg-background text-negative font-bold shadow-xs"
                    : "bg-background text-positive font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="@container pt-1">
        {segments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              No {kind === "expense" ? "expenses" : "income"} in this period
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose another period to see your category breakdown.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 @[36rem]:flex-row">
            {/* Donut representation */}
            <div className="relative shrink-0 my-2">
              <Donut segments={segments} total={total} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  {kind === "expense" ? "Total Spent" : "Total Earned"}
                </span>
                <span className="amount max-w-32 break-all text-center text-lg font-bold text-foreground">
                  {money(total)}
                </span>
              </div>
            </div>

            {/* Category breakdown rows with visual share bars */}
            <div className="min-w-0 w-full flex-1">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                Ranked by volume · Click category for history
              </p>

              <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto pr-1">
                {segments.map((s) => {
                  const percent = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  const itemContent = (
                    <div className="w-full space-y-1.5 py-1">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="grid size-7 shrink-0 place-items-center rounded-md"
                          style={{
                            backgroundColor: `${s.color}18`,
                            color: s.color,
                          }}
                        >
                          <Icon name={s.icon} size={14} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                          {s.name}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                          {percent}%
                        </span>
                        <span className="amount shrink-0 text-right text-xs font-bold text-foreground">
                          {money(s.value)}
                        </span>
                        {s.id && (
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </div>

                      {/* Percentage share track */}
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted/80">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      </div>
                    </div>
                  );

                  return (
                    <li key={s.id ?? "uncategorized"}>
                      {s.id ? (
                        <Link
                          href={`/categories/${s.id}`}
                          title={`${s.name}: ${money(s.value)} (${percent}%)`}
                          className="flex min-h-11 items-center rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/40"
                        >
                          {itemContent}
                        </Link>
                      ) : (
                        <div className="flex min-h-11 items-center px-1.5 py-1">
                          {itemContent}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
