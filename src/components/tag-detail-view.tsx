"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TransactionRows } from "@/components/transactions-list";
import { useFormat } from "@/components/settings-provider";
import { deleteTag, renameTag } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, TagDTO, TransactionDTO } from "@/lib/queries";

const PAGE_SIZES = [10, 25, 50, 100];

export function TagDetailView({
  tag,
  transactions,
  accounts,
  categories,
  canEdit,
}: {
  tag: TagDTO;
  transactions: TransactionDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
}) {
  const { money } = useFormat();
  const router = useRouter();
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = name.trim();
    if (!next || next === tag.name) {
      setEditing(false);
      setName(tag.name);
      return;
    }
    setBusy(true);
    const res = await renameTag(tag.id, { name: next });
    setBusy(false);
    if (res.ok) {
      toast.success("Tag renamed");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove() {
    const res = await deleteTag(tag.id);
    if (res.ok) {
      toast.success("Tag deleted");
      router.push("/");
    } else {
      toast.error(res.error);
    }
  }

  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const total = transactions.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, pageCount);
  const start = (curPage - 1) * pageSize;
  const pageItems = useMemo(() => transactions.slice(start, start + pageSize), [transactions, start, pageSize]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={40}
                className="h-8 max-w-[12rem]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") { setEditing(false); setName(tag.name); }
                }}
              />
              <Button size="icon-sm" onClick={save} disabled={busy} aria-label="Save tag name"><Check className="size-4" /></Button>
              <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(false); setName(tag.name); }} aria-label="Cancel"><X className="size-4" /></Button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>
                # {tag.name}
              </span>
              {canEdit && (
                <>
                  <Button size="icon-sm" variant="ghost" onClick={() => { setName(tag.name); setEditing(true); }} aria-label="Rename tag"><Pencil className="size-3.5" /></Button>
                  <ConfirmDialog
                    trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete tag"><Trash2 className="size-3.5" /></Button>}
                    title="Delete tag?"
                    description={`"${tag.name}" will be removed from all ${total} transaction${total === 1 ? "" : "s"}. The transactions are kept.`}
                    onConfirm={remove}
                  />
                </>
              )}
            </>
          )}
          <span className="ml-auto text-sm text-muted-foreground">
            {total} transaction{total === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="In" value={money(income)} tone="text-positive" />
          <Stat label="Out" value={money(expense)} tone="text-negative" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <TransactionRows transactions={pageItems} allTransactions={transactions} accounts={accounts} categories={categories} canEdit={canEdit} emptyMessage="No transactions with this tag yet." />

        {total > pageSize && (
          <div className="mt-4 flex flex-col items-stretch gap-3 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }} items={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}>
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
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("amount mt-0.5 text-sm font-semibold", tone)}>{value}</div>
    </div>
  );
}
