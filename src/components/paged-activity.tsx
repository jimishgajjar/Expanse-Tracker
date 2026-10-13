"use client";

import { useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { ActivityRows } from "./transactions-list";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useRemoteData } from "./use-remote-data";
import { useFormat } from "./settings-provider";
import { mergeActivity } from "@/lib/activity";
import type { ActivityPage } from "@/lib/activity-query";
import type { AccountDTO, CategoryDTO } from "@/lib/queries";

export function PagedActivity({start, end, workspace, accounts, categories, canEdit}: {start: string; end: string; workspace: string; accounts: AccountDTO[]; categories: CategoryDTO[]; canEdit: boolean}) {
  const sp = useSearchParams();
  const [type, setType] = useState(sp.get("type") ?? "all");
  const [account, setAccount] = useState(sp.get("account") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const {money, signedMoney} = useFormat();
  const params = new URLSearchParams({start, end, type, account, category, search: query, page: String(page), pageSize: String(pageSize), workspace});
  const {data, error, retry} = useRemoteData<ActivityPage>(`/api/activity?${params}`, accounts);
  const reset = (update: () => void) => { update(); setPage(1); };
  return <section className="space-y-4" aria-label="Transaction history">
    <div className="flex flex-wrap gap-1 border-b pb-2" aria-label="Activity type">{["all", "expense", "income", "transfer"].map(value => <Button key={value} size="sm" variant={type === value ? "default" : "ghost"} aria-pressed={type === value} onClick={() => reset(() => {setType(value); if (value === "transfer") setCategory("");})}>{({all:"All",expense:"Expenses",income:"Income",transfer:"Transfers"})[value]}</Button>)}</div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px]"><Input aria-label="Search activity" placeholder="Search notes, accounts, categories, tags…" value={search} onChange={e => reset(() => setSearch(e.target.value))} /><select aria-label="Filter account" className="min-h-11 rounded-lg border bg-background px-3 text-sm" value={account} onChange={e => reset(() => setAccount(e.target.value))}><option value="">All accounts</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><select aria-label="Filter category" disabled={type === "transfer"} className="min-h-11 rounded-lg border bg-background px-3 text-sm" value={category} onChange={e => reset(() => setCategory(e.target.value))}><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    {(type !== "all" || account || category || search) && <Button variant="ghost" size="sm" onClick={() => reset(() => {setType("all");setAccount("");setCategory("");setSearch("");})}>Clear filters</Button>}
    {error ? <div role="alert" className="dashboard-panel p-4"><p>{error}</p><Button variant="outline" onClick={retry}>Try again</Button></div> : !data ? <div role="status" className="dashboard-panel space-y-3 p-4"><p className="text-sm text-muted-foreground">Loading activity…</p>{[1,2,3].map(n => <div key={n} className="h-10 animate-pulse rounded bg-muted" />)}</div> : <>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-y py-3 text-xs"><span>{data.total} results</span><span>Income <strong className="text-positive">{money(data.income)}</strong></span><span>Expenses <strong className="text-negative">{money(data.expense)}</strong></span><span>Net <strong>{signedMoney(data.income-data.expense)}</strong></span>{type === "transfer" && <span>Transferred {money(data.transferred)}</span>}</div>
      {data.total ? <ActivityRows entries={mergeActivity(data.transactions,data.transfers)} accounts={accounts} categories={categories} canEdit={canEdit} showAuthors /> : <div className="dashboard-panel p-6 text-center"><h3 className="font-medium">No matching activity</h3><p className="mt-1 text-sm text-muted-foreground">Try another period or clear your filters.</p></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><label className="flex items-center gap-2 text-xs">Rows<select aria-label="Rows per page" className="min-h-11 rounded border bg-background px-2" value={pageSize} onChange={e => reset(() => setPageSize(Number(e.target.value)))}>{[10,25,50,100].map(n => <option key={n}>{n}</option>)}</select></label><div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page-1)}>Previous</Button><span className="text-xs" aria-live="polite">Page {data.page} of {data.pages}</span><Button variant="outline" size="sm" disabled={data.page >= data.pages} onClick={() => setPage(data.page+1)}>Next</Button></div></div>
    </>}
  </section>;
}
