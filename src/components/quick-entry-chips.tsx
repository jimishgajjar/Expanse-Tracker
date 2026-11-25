"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { quickEntries, type QuickEntry } from "@/lib/quick-entries";
import { useFormat } from "./settings-provider";
import type { AccountDTO, CategoryDTO } from "@/lib/queries";
import { cn } from "@/lib/utils";

// Shared across every Add button on the page; refreshed after five minutes or a save.
const cache = new Map<string, { at: number; rows: QuickEntry[] }>();
if (typeof window !== "undefined") window.addEventListener("ledger-changed", () => cache.clear());
function freshRows(workspace: string) {
  const hit = cache.get(workspace);
  return hit && Date.now() - hit.at < 300_000 ? hit.rows : null;
}

/** One-tap shortcuts for repeat entries. Picking one fills the form; nothing saves until Save. */
export function QuickEntryChips({
  workspace, accounts, categories, onPick,
}: {
  workspace: string;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  onPick: (entry: QuickEntry) => void;
}) {
  const { money } = useFormat();
  const [rows, setRows] = useState<QuickEntry[] | null>(() => freshRows(workspace));
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    if (rows) return;
    let live = true;
    quickEntries()
      .then((data) => { cache.set(workspace, { at: Date.now(), rows: data }); if (live) setRows(data); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [rows, workspace]);

  const usable = (rows ?? []).filter((r) => accounts.some((a) => a.id === r.accountId));
  if (!usable.length) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Zap className="size-3" aria-hidden /> Quick add
      </p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {usable.map((r, i) => {
          const category = categories.find((c) => c.id === r.categoryId);
          return (
            <button
              key={`${r.type}:${r.note}:${r.accountId}:${r.categoryId}`}
              type="button"
              aria-pressed={picked === i}
              onClick={() => { setPicked(i); onPick(r); }}
              title={`${r.note} · used ${r.uses} times recently`}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1 text-left text-xs transition-colors",
                picked === i ? "border-brand/50 bg-brand/10" : "border-border hover:border-brand/40 hover:bg-muted/50",
              )}
            >
              {category && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />}
              <span className="max-w-36 truncate font-medium">{r.note}</span>
              <span className={cn("amount", r.type === "income" ? "text-positive" : "text-muted-foreground")}>{money(r.amount)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
