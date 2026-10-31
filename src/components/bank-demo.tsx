"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Check,
  FlaskConical,
  Landmark,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { cn } from "@/lib/utils";
import {
  bankNames,
  banks,
  blockedReason,
  candidates,
  categories,
  demoAccounts,
  ledgerBalance,
  transferCandidates,
  type Bank,
  type Command,
  type DemoState,
  type FeedRow,
} from "@/lib/bank-demo/model";

const money = (cents: number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
    cents / 100,
  );
const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
type Run = (command: Command) => Promise<void>;
const filters = [
  "Needs review",
  "Pending",
  "Linked",
  "Ignored",
  "Changes",
] as const;
type Filter = (typeof filters)[number];
function inFilter(row: FeedRow, filter: Filter) {
  if (filter === "Changes") return row.review === "changed";
  if (filter === "Linked") return row.review === "handled";
  if (filter === "Ignored") return row.review === "ignored";
  if (filter === "Pending")
    return row.status === "pending" && row.review === "review";
  return row.review === "review" && row.status !== "pending";
}

export function BankDemo() {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const reviewPanel = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState<Filter>("Needs review");
  const [query, setQuery] = useState("");
  const [bankFilter, setBankFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [confirmBatch, setConfirmBatch] = useState(false);

  function load(signal?: AbortSignal) {
    return fetch("/api/bank-demo", { cache: "no-store", signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Could not load the demo. Check that the isolated preview is running and you are signed in as its owner.",
          );
        const result: DemoState = await response.json();
        if (!signal?.aborted) {
          setState(result);
          setError("");
        }
      })
      .catch((error) => {
        if (!signal?.aborted)
          setError(
            error instanceof Error ? error.message : "Could not load the demo.",
          );
      });
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (selected && window.innerWidth < 1280) {
      reviewPanel.current?.focus({ preventScroll: true });
      reviewPanel.current?.scrollIntoView({ block: "start" });
    }
  }, [selected]);

  async function run(command: Command) {
    if (!state || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/bank-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: state.version, command }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Demo action failed.");
      setState(result);
      setChecked([]);
      setConfirmBatch(false);
      setMessage(
        command.type === "reset"
          ? "Demo reset. Your application data was not changed."
          : (result.events[0]?.message ?? "Demo updated."),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Demo action failed. Refresh before retrying.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const visible =
    state?.feed.filter(
      (row) =>
        inFilter(row, filter) &&
        (bankFilter === "all" || row.bank === bankFilter) &&
        `${row.description} ${row.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  const selection = state?.feed.find((row) => row.id === selected);
  const batch = state?.feed.filter((row) => checked.includes(row.id)) ?? [];
  const connected = state
    ? banks.filter((bank) => state.connections[bank].status === "connected")
        .length
    : 0;

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8" aria-busy={busy}>
      <Link
        href="/?tab=accounts"
        className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to accounts
      </Link>
      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-brand">
            <FlaskConical className="size-4" /> LOCAL DEMO · SYNTHETIC DATA
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your banks. One clear picture.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a sample account, then decide what belongs in your ledger.
          </p>
        </div>
        {state && (
          <ConfirmDialog
            title="Reset the bank demo?"
            description="This clears only sample bank decisions and restores the two sample ledger entries. Your application accounts and transactions stay untouched."
            confirmLabel="Reset demo"
            onConfirm={() => run({ type: "reset" })}
            trigger={
              <Button variant="outline" disabled={busy}>
                Reset demo
              </Button>
            }
          />
        )}
      </header>
      <div className="my-5 flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
        <p>
          <strong>No real bank is connected.</strong> This CAD-only demo has its
          own sample accounts and database. Importing here never changes your
          application ledger. Sample dates are fixed in October 2026.
        </p>
      </div>
      <div role="status" aria-live="polite" className="text-sm text-brand">
        {busy ? "Saving demo action…" : message}
      </div>
      {error && (
        <div
          role="alert"
          className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-negative/20 bg-negative/5 p-3 text-sm"
        >
          <span>{error}</span>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setChecked([]);
              setConfirmBatch(false);
              void load();
            }}
          >
            Refresh demo
          </Button>
        </div>
      )}
      {!state ? (
        <p className="py-10 text-sm text-muted-foreground">
          {error
            ? "The demo is unavailable."
            : "Loading your sample bank workspace…"}
        </p>
      ) : (
        <fieldset disabled={busy} className="mt-4 min-w-0 space-y-5">
          <legend className="sr-only">Bank demo controls</legend>
          <div className="grid gap-4 lg:grid-cols-2">
            {banks.map((bank) => (
              <ConnectionCard
                key={`${bank}:${state.connections[bank].status}`}
                bank={bank}
                state={state}
                run={run}
              />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section
              className="min-w-0 overflow-hidden rounded-xl border bg-card"
              aria-labelledby="feed-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                <div>
                  <h2 id="feed-heading" className="font-semibold">
                    Review inbox
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bank downloads stay here until you approve or match them.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {connected} of 2 samples connected
                </span>
              </div>
              <div
                className="flex flex-wrap gap-1 border-b p-2"
                aria-label="Filter bank feed"
              >
                {filters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={filter === item}
                    onClick={() => {
                      setFilter(item);
                      setChecked([]);
                      setConfirmBatch(false);
                    }}
                    className={cn(
                      "min-h-10 rounded-lg px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring",
                      filter === item
                        ? "bg-brand/10 text-brand"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {item}{" "}
                    <span className="ml-1 tabular-nums">
                      {state.feed.filter((row) => inFilter(row, item)).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 p-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <input
                    aria-label="Search sample transactions"
                    placeholder="Search merchant or category"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setChecked([]);
                      setConfirmBatch(false);
                    }}
                    className={cn(inputClass, "pl-9")}
                  />
                </div>
                <select
                  aria-label="Filter by bank"
                  className={cn(inputClass, "sm:w-36")}
                  value={bankFilter}
                  onChange={(event) => {
                    setBankFilter(event.target.value);
                    setChecked([]);
                    setConfirmBatch(false);
                  }}
                >
                  <option value="all">All banks</option>
                  {banks.map((bank) => (
                    <option value={bank} key={bank}>
                      {bankNames[bank]}
                    </option>
                  ))}
                </select>
              </div>
              {checked.length > 0 && (
                <div className="border-y bg-brand/5 p-3 text-sm">
                  {confirmBatch ? (
                    <div className="space-y-2">
                      <p>
                        Import {batch.length} new sample entries:{" "}
                        {money(
                          batch
                            .filter((row) => row.cents < 0)
                            .reduce((sum, row) => sum - row.cents, 0),
                        )}{" "}
                        income,{" "}
                        {money(
                          batch
                            .filter((row) => row.cents > 0)
                            .reduce((sum, row) => sum + row.cents, 0),
                        )}{" "}
                        spending.
                      </p>
                      <ul className="list-inside list-disc text-xs text-muted-foreground">
                        {batch.map((row) => (
                          <li key={row.id}>
                            {row.description} · {row.category}
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            void run({ type: "batch", ids: checked })
                          }
                        >
                          Confirm sample imports
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmBatch(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => setConfirmBatch(true)}>
                      Review selected ({checked.length})
                    </Button>
                  )}
                </div>
              )}
              <div className="divide-y">
                {visible.map((row) => {
                  const reason = blockedReason(state, row);
                  const duplicate = candidates(state, row).length > 0;
                  const selectable =
                    !reason && row.kind === "payment" && !duplicate;
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "flex items-center gap-2 px-3",
                        selected === row.id && "bg-muted/60",
                      )}
                    >
                      {filter === "Needs review" && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.description} for bulk import`}
                          checked={checked.includes(row.id)}
                          disabled={!selectable}
                          title={
                            reason ??
                            (duplicate
                              ? "Review possible duplicate individually"
                              : row.kind === "transfer"
                                ? "Review as a transfer"
                                : "Select for bulk review")
                          }
                          onChange={(event) => {
                            setChecked((ids) =>
                              event.target.checked
                                ? [...ids, row.id]
                                : ids.filter((id) => id !== row.id),
                            );
                            setConfirmBatch(false);
                          }}
                          className="size-4 shrink-0 accent-emerald-600"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(row.id)}
                        aria-pressed={selected === row.id}
                        className="flex min-h-[76px] min-w-0 flex-1 items-center justify-between gap-3 rounded-md py-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {row.description}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {bankNames[row.bank]} · {shortDate(row.date)} ·{" "}
                            {row.category}
                          </span>
                          <span
                            className={cn(
                              "mt-1 block text-[11px]",
                              row.review === "changed"
                                ? "text-negative"
                                : "text-muted-foreground",
                            )}
                          >
                            {row.review === "changed"
                              ? "Bank changed this entry — ledger retained"
                              : row.targetId
                                ? "Linked to demo ledger"
                                : duplicate
                                  ? "Possible match · already in your ledger"
                                  : row.status === "removed"
                                    ? "Removed by sample bank"
                                    : row.status === "pending"
                                      ? "Pending · awaiting posting"
                                      : row.currency !== "CAD"
                                        ? `${row.currency} · unsupported currency`
                                        : row.kind === "transfer"
                                          ? "Transfer · pair both sides"
                                          : row.kind === "refund"
                                            ? "Refund · manual review needed"
                                            : reason
                                              ? "Outside import period"
                                              : "Ready to review"}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              row.cents < 0 && "text-brand",
                            )}
                          >
                            {row.cents < 0 ? "+" : "−"}
                            {money(Math.abs(row.cents), row.currency)}
                          </span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {!visible.length && (
                <div className="px-5 py-12 text-center">
                  <Landmark className="mx-auto mb-3 size-7 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {state.feed.length
                      ? "No entries in this view"
                      : "Start with a sample bank"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {state.feed.length
                      ? "Try another filter or search."
                      : "Connect RBC or TD above, then choose Check sample feed."}
                  </p>
                </div>
              )}
            </section>
            <aside
              ref={reviewPanel}
              tabIndex={-1}
              className="min-w-0 scroll-mt-4 self-start rounded-xl border bg-card p-4 focus-visible:outline-2 focus-visible:outline-ring xl:sticky xl:top-5"
              aria-label="Transaction review"
            >
              {selection ? (
                <ReviewCard
                  key={`${selection.id}:${selection.revision}:${selection.review}`}
                  row={selection}
                  state={state}
                  run={run}
                />
              ) : (
                <>
                  <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Check className="size-5" />
                  </div>
                  <h2 className="text-sm font-semibold">
                    A decision for every entry
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Select a payment to compare it with your sample ledger,
                    choose a category and review the result.
                  </p>
                  <ol className="mt-4 space-y-3 text-xs text-muted-foreground">
                    <li>1. Match entries you already recorded.</li>
                    <li>2. Import new posted payments.</li>
                    <li>3. Pair transfers so they don’t count as spending.</li>
                  </ol>
                </>
              )}
            </aside>
          </div>
          <DemoLedger state={state} />
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Decision history{" "}
              <span className="font-normal text-muted-foreground">
                · last {state.events.length} demo actions
              </span>
            </summary>
            <ol className="mt-3 divide-y">
              {state.events.map((event) => (
                <li key={event.id} className="py-2 text-xs">
                  <span className="mr-3 text-muted-foreground">
                    {new Date(event.at).toLocaleTimeString("en-CA")}
                  </span>
                  {event.message}
                </li>
              ))}
              {!state.events.length && (
                <li className="text-xs text-muted-foreground">
                  Your demo actions will appear here.
                </li>
              )}
            </ol>
          </details>
        </fieldset>
      )}
    </main>
  );
}

function ConnectionCard({
  bank,
  state,
  run,
}: {
  bank: Bank;
  state: DemoState;
  run: Run;
}) {
  const connection = state.connections[bank];
  const [account, setAccount] = useState(
    connection.account || (bank === "rbc" ? "chequing" : "savings"),
  );
  const [cutoff, setCutoff] = useState(connection.cutoff);
  const [confirmCad, setConfirmCad] = useState(false);
  const linked = state.feed.some((row) => row.bank === bank && row.targetId);
  return (
    <section
      className="rounded-xl border bg-card p-4"
      aria-label={`${bankNames[bank]} sample connection`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-xs font-bold">
            {bankNames[bank]}
          </span>
          <div>
            <h2 className="text-sm font-semibold">
              {bankNames[bank]} sample account
            </h2>
            <p className="text-xs text-muted-foreground">
              CAD ·{" "}
              {bank === "rbc" ? "Chequing · •• 1001" : "Savings · •• 2002"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium",
            connection.status === "connected"
              ? "bg-brand/10 text-brand"
              : "bg-muted text-muted-foreground",
          )}
        >
          {connection.status === "reconnect"
            ? "Reconnect needed"
            : connection.status === "connected"
              ? "Demo connected"
              : "Not connected"}
        </span>
      </div>
      {connection.status === "disconnected" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run({
              type: "connect",
              bank,
              account: account as "chequing" | "savings",
              cutoff,
              confirmCad: true,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Map to sample ledger account</span>
              <select
                required
                disabled={linked}
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className={inputClass}
              >
                {demoAccounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Import from</span>
              <input
                required
                disabled={linked}
                type="date"
                value={cutoff}
                onChange={(event) => setCutoff(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex min-h-10 items-center gap-2 text-xs">
            <input
              type="checkbox"
              required
              checked={confirmCad}
              onChange={(event) => setConfirmCad(event.target.checked)}
              className="size-4 accent-emerald-600"
            />{" "}
            I understand this is a separate CAD sample ledger.
          </label>
          <Button type="submit" size="sm" disabled={!confirmCad}>
            Connect {bankNames[bank]} demo <ArrowRight className="size-3.5" />
          </Button>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Mapped to{" "}
            <strong className="font-medium text-foreground">
              {demoAccounts.find((a) => a.id === connection.account)?.name}
            </strong>{" "}
            · from {shortDate(connection.cutoff)}
            <br />
            Last sample sync:{" "}
            {connection.lastSync
              ? new Date(connection.lastSync).toLocaleString("en-CA")
              : "Not yet checked"}
          </p>
          <div className="flex flex-wrap gap-2">
            {connection.status === "reconnect" ? (
              <Button
                size="sm"
                onClick={() => void run({ type: "reconnect", bank })}
              >
                Reconnect demo
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => void run({ type: "sync", bank })}
              >
                <RefreshCw className="size-3.5" /> Check sample feed
              </Button>
            )}
            <ConfirmDialog
              title={`Disconnect ${bankNames[bank]} demo?`}
              description="The sample feed stops updating. Imported entries, matches and transfers remain in the demo ledger."
              confirmLabel="Disconnect demo"
              onConfirm={() => run({ type: "disconnect", bank })}
              trigger={
                <Button variant="ghost" size="sm">
                  Disconnect
                </Button>
              }
            />
          </div>
          <details className="border-t pt-2">
            <summary className="cursor-pointer py-1 text-xs text-muted-foreground">
              Test bank changes
            </summary>
            <p className="my-2 text-xs text-muted-foreground">
              {bank === "rbc"
                ? "Step 1 posts the pending payment. Step 2 corrects groceries and removes payroll from the feed. Imported amounts stay unchanged."
                : "Simulate an expired connection; reconnecting preserves your history."}
            </p>
            <div className="flex flex-wrap gap-2">
              {bank === "rbc" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    connection.status !== "connected" || connection.stage >= 2
                  }
                  onClick={() => void run({ type: "advance", bank })}
                >
                  Run step {Math.min(connection.stage + 1, 2)}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={connection.status !== "connected"}
                onClick={() => void run({ type: "expire", bank })}
              >
                Simulate expired login
              </Button>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function ReviewCard({
  row,
  state,
  run,
}: {
  row: FeedRow;
  state: DemoState;
  run: Run;
}) {
  const [category, setCategory] = useState(row.category);
  const [distinct, setDistinct] = useState(false);
  const reason = blockedReason(state, row);
  const matches = candidates(state, row);
  const pairs = transferCandidates(state, row);
  const existing = state.ledger.find((item) => item.id === row.targetId);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          {bankNames[row.bank]} · {shortDate(row.date)} · {row.status}
        </p>
        <h2 className="mt-1 text-base font-semibold">{row.description}</h2>
        <p className="mt-2 font-mono text-2xl tabular-nums">
          {row.cents < 0 ? "+" : "−"}
          {money(Math.abs(row.cents), row.currency)}
        </p>
      </div>
      {row.review === "changed" ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-negative/5 p-3 text-sm">
            {row.status === "removed"
              ? "The sample bank removed this payment."
              : "The sample bank changed this payment."}{" "}
            Your approved ledger entry has not been changed.
          </p>
          {existing && (
            <p className="text-sm">
              Ledger amount: <strong>{money(Math.abs(existing.cents))}</strong>
              <br />
              Ledger category: {existing.category}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            This demo lets you keep the ledger as-is. Replacement and reversal
            corrections require a later, explicit reconciliation flow.
          </p>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => void run({ type: "keep-ledger", id: row.id })}
          >
            Keep existing ledger entry
          </Button>
        </div>
      ) : row.review === "handled" ? (
        <div className="rounded-lg bg-brand/5 p-3 text-sm">
          <Check className="mb-2 size-5 text-brand" />
          {row.targetId?.startsWith("transfer:")
            ? "Both sides are linked to one transfer."
            : "Linked to the demo ledger. Refreshing the feed will not import it again."}
        </div>
      ) : row.review === "ignored" ? (
        <>
          <p className="text-sm text-muted-foreground">
            Excluded from the demo ledger.
            {row.status === "removed" &&
              " This entry was removed or replaced by a posted payment."}
          </p>
          {row.status !== "removed" && (
            <Button
              variant="outline"
              onClick={() => void run({ type: "restore", id: row.id })}
            >
              Return to review
            </Button>
          )}
        </>
      ) : (
        <>
          {reason ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {reason}
            </p>
          ) : row.kind === "transfer" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pair the outgoing and incoming entries to record one transfer.
              </p>
              {pairs.map((other) => (
                <Button
                  key={other.id}
                  className="h-auto min-h-10 w-full whitespace-normal py-2"
                  variant="outline"
                  onClick={() =>
                    void run({
                      type: "transfer",
                      id: row.id,
                      otherId: other.id,
                    })
                  }
                >
                  <ArrowRightLeft className="size-4 shrink-0" /> Pair with{" "}
                  {bankNames[other.bank]} · {money(Math.abs(other.cents))}
                </Button>
              ))}
              {!pairs.length && (
                <p className="rounded-lg bg-muted p-3 text-xs">
                  No matching opposite side yet. Connect and check the other
                  sample bank.
                </p>
              )}
            </div>
          ) : (
            <>
              {!!matches.length && (
                <div className="space-y-2 rounded-lg border border-brand/20 bg-brand/5 p-3">
                  <h3 className="text-sm font-semibold">Already recorded?</h3>
                  <p className="text-xs text-muted-foreground">
                    Same account and amount, within 3 days. Matching keeps one
                    ledger entry.
                  </p>
                  {matches.map((match) => (
                    <div key={match.id} className="space-y-2 border-t pt-2">
                      <p className="text-xs">
                        {match.description}
                        <br />
                        {shortDate(match.date)} · {money(Math.abs(match.cents))}{" "}
                        · {match.source}
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          void run({
                            type: "match",
                            id: row.id,
                            targetId: match.id,
                          })
                        }
                      >
                        Match existing entry
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <label className="block space-y-1 text-xs text-muted-foreground">
                <span>Category for new entry</span>
                <select
                  className={inputClass}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              {!!matches.length && (
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0"
                    checked={distinct}
                    onChange={(event) => setDistinct(event.target.checked)}
                  />{" "}
                  This is a different payment. Add a separate entry despite the
                  suggested match.
                </label>
              )}
              <Button
                className="w-full"
                disabled={!!matches.length && !distinct}
                onClick={() =>
                  void run({ type: "approve", id: row.id, category, distinct })
                }
              >
                Import into demo ledger
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => void run({ type: "ignore", id: row.id })}
          >
            Ignore this entry
          </Button>
        </>
      )}
      <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Every action on this page applies to sample data only. Your application
        accounts and balances are separate.
      </p>
    </div>
  );
}

function DemoLedger({ state }: { state: DemoState }) {
  return (
    <section
      className="overflow-hidden rounded-xl border bg-card"
      aria-labelledby="ledger-heading"
    >
      <div className="border-b p-4">
        <h2 id="ledger-heading" className="text-sm font-semibold">
          Demo ledger
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Two seeded entries plus your approved imports. Transfers change
          account balances, not income or spending.
        </p>
      </div>
      <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {demoAccounts.map((account) => (
          <div key={account.id} className="p-4">
            <p className="text-xs text-muted-foreground">{account.name}</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
              {money(ledgerBalance(state, account.id))}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sample opening balance {money(account.openingCents)} · never
              overwritten by sync
            </p>
          </div>
        ))}
      </div>
      <details className="border-t p-4">
        <summary className="cursor-pointer text-xs font-medium">
          View {state.ledger.length} transactions and {state.transfers.length}{" "}
          {state.transfers.length === 1 ? "transfer" : "transfers"}
        </summary>
        <ul className="mt-3 divide-y">
          {state.ledger.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 py-3 text-xs"
            >
              <span>
                {row.description}
                <span className="mt-1 block text-muted-foreground">
                  {row.source} · {row.category} ·{" "}
                  {
                    demoAccounts.find((account) => account.id === row.account)
                      ?.name
                  }
                </span>
              </span>
              <span className="shrink-0 font-mono">
                {row.cents < 0 ? "+" : "−"}
                {money(Math.abs(row.cents))}
              </span>
            </li>
          ))}
          {state.transfers.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 py-3 text-xs"
            >
              <span>
                Transfer · {row.from} → {row.to}
              </span>
              <span className="font-mono">{money(row.cents)}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
