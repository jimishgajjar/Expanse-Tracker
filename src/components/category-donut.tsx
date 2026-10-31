"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function Donut({
  segments,
  total,
  hoveredId,
  onHover,
}: {
  segments: Seg[];
  total: number;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const size = 160;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;

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
        const segId = s.id ?? "uncategorized";
        const isHovered = hoveredId === segId;
        const hasHover = hoveredId !== null;

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
            key={segId}
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={isHovered ? stroke + 4 : stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            className="cursor-pointer transition-opacity duration-200 motion-reduce:transition-none"
            style={{
              opacity: hasHover ? (isHovered ? 1 : 0.4) : 1,
            }}
            onMouseEnter={() => onHover(segId)}
            onMouseLeave={() => onHover(null)}
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  const activeSegment = hoveredId
    ? segments.find((s) => (s.id ?? "uncategorized") === hoveredId)
    : null;

  return (
    <Card className="dashboard-panel min-w-0 flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-none">
      <CardHeader className="flex flex-wrap items-center justify-between gap-y-2 border-b border-border/60 pb-3 p-0">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {kind === "expense" ? "Spending by category" : "Income by category"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kind === "expense" ? "Where your money goes" : "Sources of your revenue"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/40 p-1 text-xs">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setHoveredId(null);
              }}
              aria-pressed={kind === k}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors duration-150 cursor-pointer motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98]",
                kind === k
                  ? k === "expense"
                    ? "bg-card text-negative shadow-xs border border-negative/25 font-bold"
                    : "bg-card text-positive shadow-xs border border-positive/25 font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-center p-0 pt-4">
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
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            {/* Interactive SVG Donut */}
            <div className="relative shrink-0 my-1">
              <Donut
                segments={segments}
                total={total}
                hoveredId={hoveredId}
                onHover={setHoveredId}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[100px]">
                  {activeSegment ? activeSegment.name : kind === "expense" ? "Total spent" : "Total earned"}
                </span>
                <span className="amount mt-0.5 max-w-[120px] break-words text-center text-sm sm:text-base font-bold text-foreground">
                  {money(activeSegment ? activeSegment.value : total)}
                </span>
                {activeSegment && total > 0 && (
                  <span className="mt-0.5 rounded-full bg-brand/10 px-1.5 py-0.2 text-[10px] font-semibold text-brand">
                    {Math.round((activeSegment.value / total) * 100)}%
                  </span>
                )}
              </div>
            </div>

            {/* Category rows with bidirectional hover sync */}
            <div className="min-w-0 w-full flex-1">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                Hover or select a category to inspect its share
              </p>

              <ul className="max-h-60 divide-y divide-border/60 overflow-y-auto pr-1">
                {segments.map((s) => {
                  const segId = s.id ?? "uncategorized";
                  const isHovered = hoveredId === segId;
                  const percent = total > 0 ? Math.round((s.value / total) * 100) : 0;

                  const itemContent = (
                    <div
                      className={cn(
                        "w-full space-y-1.5 rounded-lg px-2 py-1.5 transition-colors duration-150 cursor-pointer motion-reduce:transition-none",
                        isHovered ? "bg-muted/60" : "hover:bg-muted/30",
                      )}
                      onMouseEnter={() => setHoveredId(segId)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
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

                      {/* Percentage share bar */}
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted/80">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      </div>
                    </div>
                  );

                  return (
                    <li key={segId}>
                      {s.id ? (
                        <Link
                          href={`/categories/${s.id}`}
                          className="block focus-visible:outline-2 focus-visible:outline-brand rounded-lg"
                        >
                          {itemContent}
                        </Link>
                      ) : (
                        itemContent
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
