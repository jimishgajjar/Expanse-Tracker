"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TransactionRows, TransferRows } from "@/components/transactions-list";
import type { AccountDTO, CategoryDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

const PAGE_SIZES = [10, 25, 50, 100];
type Tab = "all" | "expense" | "income" | "transfer";

export function TransactionsTab({
  transactions,
  transfers,
  accounts,
  categories,
}: {
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
}) {
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
        const hay = `${t.note} ${t.category?.name ?? ""} ${t.account?.name ?? ""}`.toLowerCase();
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

  const total = isTransfer ? filteredTransfers.length : filteredTx.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, pageCount);
  const start = (curPage - 1) * pageSize;

  const accountItems = [{ value: "all", label: "All accounts" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];
  const categoryItems = [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <Card className="gap-3">
      <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="expense">Expenses</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="transfer">Transfers</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
          </div>
          <div className="flex gap-2">
            <Select value={accountId} onValueChange={(v) => setAccountId(v as string)} items={accountItems}>
              <SelectTrigger className="flex-1 sm:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{accountItems.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v as string)} items={categoryItems} disabled={isTransfer}>
              <SelectTrigger className="flex-1 sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{categoryItems.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {isTransfer ? (
          <TransferRows transfers={filteredTransfers.slice(start, start + pageSize)} accounts={accounts} />
        ) : (
          <TransactionRows transactions={filteredTx.slice(start, start + pageSize)} accounts={accounts} categories={categories} />
        )}

        {total > 0 && (
          <div className="flex flex-col items-stretch gap-3 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))} items={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}>
                <SelectTrigger size="sm" className="w-[4.5rem]"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-muted-foreground">{start + 1}–{Math.min(start + pageSize, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="outline" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} aria-label="Previous page">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[3.5rem] text-center font-mono text-xs">{curPage} / {pageCount}</span>
                <Button size="icon-sm" variant="outline" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)} aria-label="Next page">
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
