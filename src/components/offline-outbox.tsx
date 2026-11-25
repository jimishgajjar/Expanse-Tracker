"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createTransaction } from "@/lib/actions";
import { readOutbox, subscribeOutbox, updateOutbox, type OutboxItem } from "@/lib/offline-outbox";
import { useFormat } from "./settings-provider";
import { Button } from "./ui/button";
import { shortDay } from "@/lib/dates";

const EMPTY: OutboxItem[] = [];

/**
 * Entries saved on this device while offline. They sync automatically when the
 * connection returns; any the server refuses stay here with the reason.
 */
export function OfflineOutbox({ workspace, actor }: { workspace: string; actor: string }) {
  const router = useRouter();
  const { money } = useFormat();
  const items = useSyncExternalStore(subscribeOutbox, () => readOutbox(workspace, actor), () => EMPTY);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    const pending = readOutbox(workspace, actor);
    if (!pending.length) return;
    busy.current = true;
    setSyncing(true);
    let sent = 0;
    try {
      for (const item of pending) {
        try {
          const res = await createTransaction({ ...item.payload, requestId: item.requestId });
          if (res.ok) { updateOutbox(workspace, actor, item.requestId, null); sent++; }
          else updateOutbox(workspace, actor, item.requestId, { error: res.error });
        } catch {
          break; // Connection dropped again: keep the rest for the next attempt.
        }
      }
    } finally {
      busy.current = false;
      setSyncing(false);
    }
    if (sent) {
      toast.success(`${sent} offline ${sent === 1 ? "entry" : "entries"} synced`);
      window.dispatchEvent(new Event("ledger-changed"));
      router.refresh();
    }
  }, [workspace, actor, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void sync(), 1000);
    window.addEventListener("online", sync);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", sync); };
  }, [sync]);

  if (!items.length) return null;
  return (
    <section aria-label="Entries waiting to sync" className="dashboard-panel space-y-2 border-dashed p-4">
      <div className="flex flex-wrap items-center gap-3">
        <CloudOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <strong className="font-medium">{items.length} {items.length === 1 ? "entry" : "entries"} saved on this device</strong>
          <span className="block text-xs text-muted-foreground">They sync automatically when you’re back online and aren’t in your balances yet.</span>
        </p>
        <Button size="sm" variant="outline" disabled={syncing} onClick={() => void sync()} className="gap-1.5">
          <RefreshCw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} /> {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>
      <ul className="divide-y divide-border/70 text-sm">
        {items.map((item) => (
          <li key={item.requestId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{item.payload.note || (item.payload.type === "income" ? "Income" : "Expense")}</span>{" "}
              <span className="text-xs text-muted-foreground">{shortDay(item.payload.date)}</span>
              {item.error && <span className="block text-xs text-negative">{item.error}</span>}
            </span>
            <span className={item.payload.type === "income" ? "amount text-positive" : "amount"}>
              {item.payload.type === "income" ? "+" : "−"}{money(item.payload.amount)}
            </span>
            {item.error && (
              <Button size="icon-sm" variant="ghost" aria-label="Discard this entry" onClick={() => updateOutbox(workspace, actor, item.requestId, null)}>
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
