"use client";

import { useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { ActivityRows } from "./transactions-list";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useRemoteData } from "./use-remote-data";
import { useFormat } from "./settings-provider";
import { mergeActivity } from "@/lib/activity";
import { cn } from "@/lib/utils";
import type { ActivityPage } from "@/lib/activity-query";
import type { AccountDTO, CategoryDTO } from "@/lib/queries";

export function PagedActivity({
  start,
  end,
  workspace,
  accounts,
  categories,
  canEdit,
}: {
  start: string;
  end: string;
  workspace: string;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
}) {
  const sp = useSearchParams();
  const [type, setType] = useState(sp.get("type") ?? "all");
  const [account, setAccount] = useState(sp.get("account") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { money, signedMoney } = useFormat();

  const params = new URLSearchParams({
    start,
    end,
    type,
    account,
    category,
    search: query,
    page: String(page),
    pageSize: String(pageSize),
    workspace,
  });

  const { data, error, retry } = useRemoteData<ActivityPage>(
    `/api/activity?${params}`,
    accounts,
  );

  const reset = (update: () => void) => {
    update();
    setPage(1);
  };

  const hasActiveFilters =
    type !== "all" || account !== "" || category !== "" || search !== "";

  const clearAllFilters = () => {
    reset(() => {
      setType("all");
      setAccount("");
      setCategory("");
      setSearch("");
    });
  };

  const types = [
    { value: "all", label: "All activity" },
    { value: "expense", label: "Expenses" },
    { value: "income", label: "Income" },
    { value: "transfer", label: "Transfers" },
  ] as const;

  return (
    <section className="space-y-4" aria-label="Transaction ledger">
      {/* 1. Command Filter Bar */}
      <div className="space-y-3">
        {/* Segmented Type Picker */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="inline-flex gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
            {types.map(({ value, label }) => {
              const isActive = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    reset(() => {
                      setType(value);
                      if (value === "transfer") setCategory("");
                    })
                  }
                  aria-pressed={isActive}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.98] disabled:opacity-50",
                    isActive
                      ? value === "income"
                        ? "bg-card text-positive shadow-xs border border-positive/25 font-bold"
                        : value === "expense"
                          ? "bg-card text-negative shadow-xs border border-negative/25 font-bold"
                          : "bg-card text-foreground shadow-xs border border-border font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 gap-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              <span>Reset filters</span>
            </Button>
          )}
        </div>

        {/* Search & Dropdown Filters Grid */}
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
          {/* Search Input with Prefix & Clear */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground/70" />
            <Input
              aria-label="Search activity"
              placeholder="Search notes, accounts, categories, tags…"
              value={search}
              onChange={(e) => reset(() => setSearch(e.target.value))}
              className="h-10 rounded-xl border-border/80 bg-background pl-9 pr-8 text-xs font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => reset(() => setSearch(""))}
                aria-label="Clear search query"
                className="absolute right-2.5 grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Account Filter */}
          <div className="relative">
            <select
              aria-label="Filter account"
              className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer"
              value={account}
              onChange={(e) => reset(() => setAccount(e.target.value))}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              aria-label="Filter category"
              disabled={type === "transfer"}
              className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
              value={category}
              onChange={(e) => reset(() => setCategory(e.target.value))}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Loading, Error, or Active Ledger View */}
      {error ? (
        <div
          role="alert"
          className="dashboard-panel flex flex-col items-center justify-center p-8 text-center"
        >
          <p className="text-sm font-semibold text-negative">{error}</p>
          <Button variant="outline" size="sm" onClick={retry} className="mt-3 rounded-lg">
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div role="status" className="dashboard-panel space-y-3 p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Loading ledger entries…</span>
          </div>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-12 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : (
        <>
          {/* Executive Ledger Summary Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-2.5 text-xs shadow-2xs">
            <span className="font-semibold text-foreground">
              {data.total} {data.total === 1 ? "entry" : "entries"} recorded
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ArrowDownLeft className="size-3.5 text-positive" />
                <span>Inflow:</span>
                <strong className="amount font-bold text-positive">
                  {money(data.income)}
                </strong>
              </span>
              <span className="flex items-center gap-1.5">
                <ArrowUpRight className="size-3.5 text-negative" />
                <span>Outflow:</span>
                <strong className="amount font-bold text-negative">
                  {money(data.expense)}
                </strong>
              </span>
              <span className="flex items-center gap-1.5 border-l border-border/80 pl-3">
                <span>Net:</span>
                <strong
                  className={cn(
                    "amount font-bold",
                    data.income - data.expense >= 0 ? "text-positive" : "text-negative",
                  )}
                >
                  {signedMoney(data.income - data.expense)}
                </strong>
              </span>
              {type === "transfer" && (
                <span className="flex items-center gap-1.5">
                  <ArrowRightLeft className="size-3.5 text-brand" />
                  <span>Transferred:</span>
                  <strong className="amount font-bold text-foreground">
                    {money(data.transferred)}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {/* Activity Rows or Empty State */}
          {data.total ? (
            <ActivityRows
              entries={mergeActivity(data.transactions, data.transfers)}
              accounts={accounts}
              categories={categories}
              canEdit={canEdit}
              showAuthors
            />
          ) : (
            <div className="dashboard-panel flex flex-col items-center justify-center p-12 text-center">
              <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Receipt className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No matching ledger activity
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                No transactions or transfers match your current filter criteria.
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="mt-4 rounded-lg text-xs font-semibold"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          )}

          {/* Pagination Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                aria-label="Rows per page"
                className="h-8 rounded-lg border border-border/80 bg-background px-2 text-xs font-semibold text-foreground focus:border-brand focus:outline-none cursor-pointer"
                value={pageSize}
                onChange={(e) => reset(() => setPageSize(Number(e.target.value)))}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Page <strong className="text-foreground">{data.page}</strong> of{" "}
                <strong className="text-foreground">{data.pages || 1}</strong>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
                  disabled={data.page >= data.pages}
                  onClick={() => setPage(data.page + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
