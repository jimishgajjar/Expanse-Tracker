"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TransactionRows, TransferRows } from "@/components/transactions-list";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

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
        const hay = `${t.note} ${t.category?.name ?? ""} ${t.account?.name ?? ""} ${t.tags.map((tg) => tg.name).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, tab, accountId, categoryId, search]);

  const filteredTransfers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
    return transfers.filter((t) => {
      if (accountId !== "all" && t.fromAccountId !== accountId && t.toAccountId !== accountId) return false;
      if (q) {
        const hay = `${t.note} ${nameOf(t.fromAccountId)} ${nameOf(t.toAccountId)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transfers, accounts, accountId, search]);

  useEffect(() => setPage(1), [tab, accountId, categoryId, search, pageSize]);

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
  const transferTotal = useMemo(() => filteredTransfers.reduce((s, t) => s + t.amount, 0), [filteredTransfers]);

  const total = isTransfer ? filteredTransfers.length : filteredTx.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, pageCount);
  const start = (curPage - 1) * pageSize;

  const filtersActive = tab !== "all" || accountId !== "all" || categoryId !== "all" || search.trim() !== "";
  function clearFilters() {
    setTab("all");
    setAccountId("all");
    setCategoryId("all");
    setSearch("");
  }

  const accountItems = [{ value: "all", label: "All accounts" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];
  const categoryItems = [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <Card className="gap-0 pt-0">
      {/* What the current view adds up to — the same hairline ledger strip as the
          Overview, so filtering reads as interrogating a number, not paging a table. */}
      <div className={cn("grid divide-x divide-border border-b", isTransfer ? "grid-cols-2" : "grid-cols-3")}>
        {isTransfer ? (
          <>
            <StripCell label="Transfers" value={String(total)} />
            <StripCell label="Total moved" value={money(transferTotal)} />
          </>
        ) : (
          <>
            <StripCell label="In" value={money(totals.inc)} tone="text-positive" />
            <StripCell label="Out" value={money(totals.exp)} tone="text-negative" />
            <StripCell label="Net" value={signedMoney(totals.net)} tone={totals.net < 0 ? "text-negative" : "text-positive"} />
          </>
        )}
      </div>

      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex w-full overflow-x-auto rounded-lg bg-muted p-0.5 sm:w-fit">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                aria-pressed={tab === t.value}
                className={cn(
                  "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:flex-none sm:py-1",
                  tab === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span aria-live="polite" className="hidden shrink-0 text-xs text-muted-foreground sm:block">
            {total} result{total === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search transactions"
              placeholder="Search note, category, tag, account…"
              className="h-10 pr-8 pl-8 sm:h-8"
            />
            {search !== "" && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={accountId} onValueChange={(v) => setAccountId(v as string)} items={accountItems}>
              <SelectTrigger aria-label="Filter by account" className="h-10 flex-1 sm:h-8 sm:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{accountItems.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v as string)} items={categoryItems} disabled={isTransfer}>
              <SelectTrigger aria-label="Filter by category" className="h-10 flex-1 sm:h-8 sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{categoryItems.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filtersActive ? "Nothing matches your filters." : "Nothing logged in this period yet."}
            </p>
            {filtersActive && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="size-3.5" /> Clear filters
              </Button>
            )}
          </div>
        ) : isTransfer ? (
          <TransferRows transfers={filteredTransfers.slice(start, start + pageSize)} accounts={accounts} canEdit={canEdit} />
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

        {total > pageSize && (
          <div className="flex flex-col items-stretch gap-3 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
              <span>Per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))} items={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}>
                <SelectTrigger size="sm" aria-label="Rows per page" className="h-9 w-[4.5rem] sm:h-7"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-muted-foreground">{start + 1}–{Math.min(start + pageSize, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="outline" className="size-9 sm:size-7" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} aria-label="Previous page">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[3.5rem] text-center font-mono text-xs">{curPage} / {pageCount}</span>
                <Button size="icon-sm" variant="outline" className="size-9 sm:size-7" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)} aria-label="Next page">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StripCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-4">
      <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("amount mt-1 truncate text-[0.95rem] font-semibold tracking-tight sm:text-lg", tone)}>{value}</div>
    </div>
  );
}
