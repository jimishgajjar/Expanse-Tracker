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
  const size = 176,
    stroke = 26,
    r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    cx = size / 2;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="-rotate-90"
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
        const el = (
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
          />
        );
        return el;
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
    <Card className="gap-3">
      <CardHeader className="flex flex-wrap items-center gap-y-2">
        <CardTitle>
          {kind === "expense" ? "Spending by category" : "Income by source"}
        </CardTitle>
        <div className="ml-auto flex gap-0.5 rounded-md bg-muted p-0.5 text-xs">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "min-h-11 rounded px-3 py-2 font-medium capitalize transition-colors",
                kind === k
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="@container">
        {segments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium">
              No {kind === "expense" ? "expenses" : "income"} in this period
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Choose another period to see your category breakdown.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 @[36rem]:flex-row">
            <div className="relative shrink-0">
              <Donut segments={segments} total={total} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  {kind === "expense" ? "Spent" : "Earned"}
                </span>
                <span className="amount max-w-32 break-all text-center text-base font-semibold">
                  {money(total)}
                </span>
              </div>
            </div>
            <div className="min-w-0 w-full flex-1">
              <p className="mb-2 text-xs text-muted-foreground">
                Select a category to open its full history.
              </p>
              <ul className="max-h-80 divide-y overflow-y-auto">
                {segments.map((s) => {
                  const content = (
                    <>
                      <span
                        className="grid size-8 shrink-0 place-items-center rounded-lg"
                        style={{
                          backgroundColor: `${s.color}22`,
                          color: s.color,
                        }}
                      >
                        <Icon name={s.icon} size={15} />
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {s.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((s.value / total) * 100)}%
                      </span>
                      <span className="amount shrink-0 text-right text-sm font-medium">
                        {money(s.value)}
                      </span>
                      {s.id && (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </>
                  );
                  return (
                    <li key={s.id ?? "uncategorized"}>
                      {s.id ? (
                        <Link
                          href={`/categories/${s.id}`}
                          title={`${s.name}: ${money(s.value)} (${Math.round((s.value / total) * 100)}%)`}
                          className="flex min-h-12 items-center gap-2 rounded-lg px-1 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex min-h-12 items-center gap-2 px-1 py-2 text-sm">
                          {content}
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
