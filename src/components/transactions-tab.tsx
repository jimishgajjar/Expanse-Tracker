"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterChips, type FilterChip } from "./filter-chips";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { mergeActivity } from "@/lib/activity";
import {
  ActivityRows,
  TransactionRows,
  TransferRows,
} from "@/components/transactions-list";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type {
  AccountDTO,
  CategoryDTO,
  TransactionDTO,
  TransferDTO,
} from "@/lib/queries";

const PAGE_SIZES = [10, 25, 50, 100];
type Tab = "all" | "expense" | "income" | "transfer";
const TYPE_TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfers" },
];

export function TransactionsTab({
  transactions,
  transfers,
  accounts,
  categories,
  canEdit = true,
  showAuthors = false,
}: {
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit?: boolean;
  showAuthors?: boolean;
}) {
  const { money, signedMoney } = useFormat();
  const [tab, setTab] = useState<Tab>("all");
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const isTransfer = tab === "transfer";

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (tab !== "all" && t.type !== tab) return false;
      if (accountId !== "all" && t.accountId !== accountId) return false;
      if (categoryId !== "all" && t.categoryId !== categoryId) return false;
      if (q) {
        const hay =
          `${t.note} ${t.category?.name ?? ""} ${t.account?.name ?? ""} ${t.tags.map((tg) => tg.name).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, tab, accountId, categoryId, search]);

  const filteredTransfers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nameOf = (id: string) =>
      accounts.find((a) => a.id === id)?.name ?? "";
    return transfers.filter((t) => {
      if (
        accountId !== "all" &&
        t.fromAccountId !== accountId &&
        t.toAccountId !== accountId
      )
        return false;
      if (q) {
        const hay =
          `${t.note} ${nameOf(t.fromAccountId)} ${nameOf(t.toAccountId)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transfers, accounts, accountId, search]);

  // Any filter change starts the list over on page 1. Done in the setters
  // rather than an effect, so React never paints a stale page first.
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const pickTab = withReset(setTab);
  const pickAccount = withReset(setAccountId);
  const pickCategory = withReset(setCategoryId);
  const pickSearch = withReset(setSearch);
  const pickPageSize = withReset(setPageSize);

  // What the current filter set adds up to — this screen's ledger strip.
  const totals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of filteredTx) {
      if (t.type === "income") inc += t.amount;
      else exp += t.amount;
    }
    return { inc, exp, net: inc - exp };
  }, [filteredTx]);
  const transferTotal = useMemo(
    () => filteredTransfers.reduce((s, t) => s + t.amount, 0),
    [filteredTransfers],
  );

  const activity = mergeActivity(
    filteredTx,
    categoryId === "all" ? filteredTransfers : [],
  );
  const total =
    tab === "all"
      ? activity.length
      : isTransfer
        ? filteredTransfers.length
        : filteredTx.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, pageCount);
  const start = (curPage - 1) * pageSize;

  const filtersActive =
    tab !== "all" ||
    accountId !== "all" ||
    categoryId !== "all" ||
    search.trim() !== "";
  function clearFilters() {
    pickTab("all");
    pickAccount("all");
    pickCategory("all");
    pickSearch("");
  }

  const accountItems = [
    { value: "all", label: "All accounts" },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];
  const categoryItems = [
    { value: "all", label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const chips: FilterChip[] = [];
  if (tab !== "all")
    chips.push({
      key: "type",
      label: TYPE_TABS.find((t) => t.value === tab)!.label,
      onRemove: () => pickTab("all"),
    });
  if (accountId !== "all")
    chips.push({
      key: "account",
      label: accounts.find((a) => a.id === accountId)?.name ?? "Account",
      onRemove: () => pickAccount("all"),
    });
  if (categoryId !== "all")
    chips.push({
      key: "category",
      label: categories.find((c) => c.id === categoryId)?.name ?? "Category",
      onRemove: () => pickCategory("all"),
    });
  if (search.trim())
    chips.push({
      key: "search",
      label: `Search: ${search.trim()}`,
      onRemove: () => pickSearch(""),
    });
  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div
        className={cn(
          "grid gap-3.5",
          isTransfer ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {isTransfer ? (
          <>
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Transfers Count
                </span>
                <p className="font-mono text-2xl font-bold text-foreground mt-0.5 tabular-nums">
                  {total}
                </p>
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Transfers
              </span>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Transferred
                </span>
                <p className="font-mono text-2xl font-bold text-foreground mt-0.5 tabular-nums">
                  {money(transferTotal)}
                </p>
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Total
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Income
                </span>
                <p className="font-mono text-2xl font-bold text-positive mt-0.5 tabular-nums">
                  {money(totals.inc)}
                </p>
              </div>
              <span className="rounded-md bg-positive/10 text-positive px-2 py-0.5 text-xs font-semibold">
                Inflow
              </span>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Expenses
                </span>
                <p className="font-mono text-2xl font-bold text-negative mt-0.5 tabular-nums">
                  {money(totals.exp)}
                </p>
              </div>
              <span className="rounded-md bg-negative/10 text-negative px-2 py-0.5 text-xs font-semibold">
                Outflow
              </span>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Net Balance
                </span>
                <p
                  className={cn(
                    "font-mono text-2xl font-bold mt-0.5 tabular-nums",
                    totals.net >= 0 ? "text-positive" : "text-negative",
                  )}
                >
                  {signedMoney(totals.net)}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold",
                  totals.net >= 0 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
                )}
              >
                {totals.net >= 0 ? "Net Surplus" : "Net Deficit"}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        {/* Segmented Glass Pillbox */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-muted/70 p-1 border border-border/60 gap-1 shadow-2xs">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  pickTab(t.value);
                  if (t.value === "transfer") pickCategory("all");
                }}
                aria-pressed={tab === t.value}
                className={cn(
                  "min-h-8 rounded-lg px-3.5 py-1 text-xs font-semibold transition-all duration-200 active:scale-[0.98]",
                  tab === t.value
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span
            aria-live="polite"
            className="text-xs font-semibold text-muted-foreground"
          >
            {total} record{total === 1 ? "" : "s"} found
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => pickSearch(e.target.value)}
              aria-label="Search transactions"
              placeholder="Search note, category, tag, account…"
              className="min-h-11 pr-11 pl-9"
            />
            {search !== "" && (
              <button
                type="button"
                onClick={() => pickSearch("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select
              value={accountId}
              onValueChange={(v) => pickAccount(v as string)}
              items={accountItems}
            >
              <SelectTrigger
                aria-label="Filter by account"
                className="min-h-11 flex-1 sm:w-[150px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accountItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryId}
              onValueChange={(v) => pickCategory(v as string)}
              items={categoryItems}
              disabled={isTransfer}
            >
              <SelectTrigger
                aria-label="Filter by category"
                className="min-h-11 flex-1 sm:w-[160px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <FilterChips chips={chips} onClear={clearFilters} />
        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filtersActive
                ? "Nothing matches your filters."
                : "Nothing logged in this period yet."}
            </p>
            {filtersActive && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="size-3.5" /> Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-xs">
            {tab === "all" ? (
              <ActivityRows
                entries={activity.slice(start, start + pageSize)}
                accounts={accounts}
                categories={categories}
                canEdit={canEdit}
                showAuthors={showAuthors}
              />
            ) : isTransfer ? (
              <TransferRows
                transfers={filteredTransfers.slice(start, start + pageSize)}
                accounts={accounts}
                canEdit={canEdit}
              />
            ) : (
              <TransactionRows
                transactions={filteredTx.slice(start, start + pageSize)}
                allTransactions={filteredTx}
                accounts={accounts}
                categories={categories}
                canEdit={canEdit}
                showAuthors={showAuthors}
              />
            )}
          </div>
        )}

        {total > pageSize && (
          <div className="flex flex-col items-stretch gap-3 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
              <span>Per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => pickPageSize(Number(v))}
                items={PAGE_SIZES.map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Rows per page"
                  className="h-9 w-[4.5rem] sm:h-7"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-muted-foreground">
                {start + 1}–{Math.min(start + pageSize, total)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-9 sm:size-7"
                  disabled={curPage <= 1}
                  onClick={() => setPage(curPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[3.5rem] text-center font-mono text-xs">
                  {curPage} / {pageCount}
                </span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-9 sm:size-7"
                  disabled={curPage >= pageCount}
                  onClick={() => setPage(curPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
