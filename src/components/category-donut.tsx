"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { useFormat } from "@/components/settings-provider";
import { colorFor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { TransactionDTO } from "@/lib/queries";

type Seg = { name: string; value: number; color: string; icon: string };

function Donut({ segments, total }: { segments: Seg[]; total: number }) {
  const size = 176, stroke = 26, r = (size - stroke) / 2, c = 2 * Math.PI * r, cx = size / 2;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
      {segments.map((s) => {
        const dash = total ? (s.value / total) * c : 0;
        const el = (
          <circle
            key={s.name}
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
        offset += dash;
        return el;
      })}
    </svg>
  );
}

export function CategoryDonut({ transactions }: { transactions: TransactionDTO[] }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");

  const segments = useMemo<Seg[]>(() => {
    const map = new Map<string, Seg>();
    for (const t of transactions) {
      if (t.type !== kind) continue;
      const name = t.category?.name ?? "Uncategorised";
      const seg = map.get(name) ?? {
        name,
        value: 0,
        color: t.category?.color ?? colorFor(name),
        icon: t.category?.icon ?? "circle-help",
      };
      seg.value += t.amount;
      map.set(name, seg);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [transactions, kind]);

  const total = segments.reduce((s, x) => s + x.value, 0);
  const { money } = useFormat();

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{kind === "expense" ? "Spending by category" : "Income by source"}</CardTitle>
        <div className="ml-auto flex gap-0.5 rounded-md bg-muted p-0.5 text-xs">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded px-2 py-1 font-medium capitalize transition-colors",
                kind === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {segments.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No {kind} in this period.</p>
        ) : (
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative shrink-0">
              <Donut segments={segments} total={total} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                  {kind === "expense" ? "Spent" : "Earned"}
                </span>
                <span className="font-mono text-lg font-semibold">{money(total)}</span>
              </div>
            </div>
            <ul className="w-full flex-1 space-y-1.5">
              {segments.slice(0, 7).map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded" style={{ backgroundColor: `${s.color}22`, color: s.color }}>
                    <Icon name={s.icon} size={12} />
                  </span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>
                  <span className="w-20 text-right font-mono text-xs">{money(s.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
