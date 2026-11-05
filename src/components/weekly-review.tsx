"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarClock, Check, RefreshCw, RotateCcw } from "lucide-react";
import { completeWeeklyReview, readWeeklyReview, saveWeeklyReviewChoice } from "@/lib/weekly-review-actions";
import type { WeeklyReviewData, WeeklyReviewItem } from "@/lib/weekly-review-model";
import type { GoalDTO, RecurringDTO, SplitData } from "@/lib/queries";
import { useTrackerReady } from "./tracker-boundary";
import { useSettings } from "./settings-provider";
import { Button } from "./ui/button";

const linkStyle = "inline-flex min-h-11 items-center gap-1 rounded text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2";

export function WeeklyReview({ workspace, sources, fallback }: {
  workspace: string;
  sources: { bills: RecurringDTO[]; goals: GoalDTO[]; splits: SplitData };
  fallback: ReactNode;
}) {
  const ready = useTrackerReady();
  const { locale } = useSettings();
  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);
  const request = useRef<{ id: string; version: number; digest: string } | null>(null);
  const generation = useRef(0);
  const saving = useRef(false);
  const status = useRef<HTMLParagraphElement>(null);
  const [savedReceipt, setSavedReceipt] = useState<{ id: string; digest: string } | null>(null);
  useEffect(() => {
    const reload = () => { if (!document.hidden && !saving.current) refresh(value => value + 1); };
    window.addEventListener("focus", reload);
    window.addEventListener("ledger-changed", reload);
    window.addEventListener("forecast-changed", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("ledger-changed", reload);
      window.removeEventListener("forecast-changed", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, []);
  useEffect(() => {
    if (!ready || saving.current) return;
    let active = true;
    const current = ++generation.current;
    readWeeklyReview(workspace).then(result => {
      if (!active || current !== generation.current) return;
      if (!result.ok) { setError(result.error); setData(null); return; }
      setAvailable(!!result.value); setData(result.value); setError(""); setNotice("");
    }).catch(() => { if (active && current === generation.current) { setError("Couldn't load your review. Try refreshing."); setData(null); } });
    return () => { active = false; };
  }, [workspace, ready, revision, sources.bills, sources.goals, sources.splits]);

  async function save(item?: WeeklyReviewItem, choice: "reviewed" | "deferred" | "pending" = "reviewed") {
    if (!data || !ready || saving.current) return;
    saving.current = true; setBusy(true); setError(""); setNotice("");
    const current = ++generation.current;
    try {
      if (!item && (!request.current || request.current.version !== data.version || request.current.digest !== data.digest)) {
        request.current = { id: crypto.randomUUID(), version: data.version, digest: data.digest };
      }
      const result = item
        ? await saveWeeklyReviewChoice(workspace, { version: data.version, key: item.key, revision: item.revision, choice })
        : await completeWeeklyReview(workspace, request.current);
      if (generation.current !== current) return;
      if (!result.ok) { setError(result.error); return; }
      setData(result.value); setAvailable(!!result.value);
      if (!item && request.current) setSavedReceipt({ id: request.current.id, digest: request.current.digest });
      setNotice(item ? choice === "reviewed" ? "Reviewed. Your choice is saved." : choice === "deferred" ? "Saved for next week." : "Returned to your review."
        : "Review finished. Your receipt is saved below.");
      if (item) { request.current = null; setSavedReceipt(null); }
      window.dispatchEvent(new Event("weekly-review-changed"));
      requestAnimationFrame(() => status.current?.focus());
    } catch { setError("Couldn't confirm the save. Refresh to check your choices before trying again."); }
    finally { saving.current = false; setBusy(false); }
  }

  if (!ready) return <p role="status" className="dashboard-panel p-4 text-sm">Checking your household…</p>;
  if (!available) return fallback;
  const date = (value: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.length === 10 ? value + "T12:00:00" : value));
  const pending = data?.items.filter(item => item.status === "pending") ?? [];
  const handled = data?.items.filter(item => item.status !== "pending") ?? [];
  const latest = data?.receipts[0];
  function row(item: WeeklyReviewItem) {
    return <li key={item.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 py-2.5">
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-medium">{item.title}</span>
          {item.changed && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Changed</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
        <a href={item.href} className={linkStyle}>Open {item.kind === "bill" ? "bill" : item.kind === "goal" ? "goal" : "shared expenses"}<ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
      </div>
      <span className="text-sm font-semibold tabular-nums">{new Intl.NumberFormat(locale, { style: "currency", currency: item.currency, currencyDisplay: "code" }).format(Number(item.amount))}</span>
      {item.status === "pending" ? <div className="flex w-full gap-2 sm:w-auto">
        <Button variant="outline" className="min-h-11 text-xs" disabled={busy || !data?.canEdit} onClick={() => void save(item)}>
          <Check className="size-3.5" aria-hidden="true" />Reviewed<span className="sr-only"> {item.title}</span>
        </Button>
        <Button variant="ghost" className="min-h-11 text-xs" disabled={busy || !data?.canEdit} onClick={() => void save(item, "deferred")}>
          <CalendarClock className="size-3.5" aria-hidden="true" />Next week<span className="sr-only"> {item.title}</span>
        </Button>
      </div> : <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{item.status === "reviewed" ? "Reviewed" : "Back " + date(item.until!)}</span>
        <Button variant="ghost" size="icon-sm" aria-label={"Undo review choice for " + item.title} disabled={busy || !data?.canEdit} onClick={() => void save(item, "pending")}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </Button>
      </div>}
    </li>;
  }
  return <section id="weekly-check-in" aria-labelledby="weekly-review-title" aria-busy={busy} className="dashboard-panel scroll-mt-4 overflow-hidden">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-brand">Aim for five minutes together</p>
        <h2 id="weekly-review-title" className="text-base font-semibold">Weekly household review</h2>
        <p className="mt-1 text-xs text-muted-foreground">{latest ? "Your last review · " + date(latest.at) : "Your first review"} · Your choices are saved for you.</p>
      </div>
      <Button variant="ghost" className="min-h-11 text-xs" disabled={busy} onClick={() => refresh(value => value + 1)}>
        <RefreshCw className="size-3.5" aria-hidden="true" />Refresh review
      </Button>
    </header>
    <div className="px-4 py-3">
      <p ref={status} tabIndex={-1} role="status" className="text-xs text-brand focus:outline-none">{notice || (data ? pending.length + " to consider · " + handled.length + (handled.length === 1 ? " choice saved" : " choices saved") : "Loading your review…")}</p>
      {error && <p role="alert" className="mt-2 text-sm text-negative">{error}</p>}
      {data && <>
        <p className="my-2 text-xs text-muted-foreground">Review what changed and choose the next step. Payment and savings actions are available in each item’s source.</p>
        {!data.canEdit && <p className="mb-2 text-xs text-muted-foreground">You have viewing access. A household owner can update your role.</p>}
        {pending.length ? <><ul>{pending.slice(0, 5).map(row)}</ul>
          {pending.length > 5 && <details><summary className="min-h-11 cursor-pointer py-3 text-xs font-medium">Show {pending.length - 5} more items</summary><ul>{pending.slice(5).map(row)}</ul></details>}
        </> : <div className="flex items-center gap-3 border-t py-5">
          <Check className="size-5 text-brand" aria-hidden="true" /><p className="text-sm">You’re caught up. Finish to keep a receipt of this review.</p>
        </div>}
        {handled.length > 0 && <details className="border-t">
          <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium">Reviewed and next week · {handled.length}</summary>
          <ul>{handled.map(row)}</ul>
        </details>}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">{pending.length ? pending.length + (pending.length === 1 ? " item will stay open." : " items will stay open.") : "Every current item has a choice."}</p>
          <Button className="min-h-11 text-xs" disabled={busy || !data.canEdit || (latest?.id === savedReceipt?.id && data.digest === savedReceipt?.digest)} onClick={() => void save()}>
            {busy ? "Saving…" : "Finish review"}
          </Button>
        </div>
        {latest && <section aria-label="Latest review receipt" className="mt-4 rounded-lg border border-brand/20 bg-brand/5 px-3 py-3">
          <h3 className="text-sm font-semibold">Review receipt · {date(latest.at)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {latest.items.filter(i => i.choice === "reviewed").length} reviewed · {latest.items.filter(i => i.choice === "deferred").length} deferred · {latest.items.filter(i => i.choice === "pending").length} left open
          </p>
          <details className="mt-1">
            <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium">What you reviewed</summary>
            <ul className="divide-y divide-border/60">{latest.items.map(item => <li key={item.key} className="flex flex-wrap justify-between gap-x-3 py-2 text-xs">
              <a className="min-h-11 content-center font-medium text-brand hover:underline" href={item.href}>{item.title}</a>
              <span className="content-center text-muted-foreground">{item.changed ? "Changed since this receipt" : item.choice === "pending" ? "Left open" : item.choice === "deferred" ? "Deferred" : "Reviewed"}</span>
            </li>)}</ul>
            {!latest.items.length && <p className="text-xs text-muted-foreground">No current items to display in this receipt.</p>}
          </details>
        </section>}
      </>}
    </div>
  </section>;
}
