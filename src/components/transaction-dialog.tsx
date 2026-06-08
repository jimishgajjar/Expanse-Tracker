"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/dates";
import { createTransaction, createTransfer, updateTransaction } from "@/lib/actions";
import type { AccountDTO, CategoryDTO, TransactionDTO } from "@/lib/queries";

const NONE = "__none__";
type TxType = "income" | "expense" | "transfer";

export function TransactionDialog({
  trigger,
  transaction,
  accounts,
  categories,
  defaultType = "expense",
  defaultAccountId,
}: {
  trigger: ReactElement;
  transaction?: TransactionDTO;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  defaultType?: "income" | "expense";
  defaultAccountId?: string;
}) {
  const isEdit = !!transaction;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const init = () => ({
    type: (transaction?.type ?? defaultType) as TxType,
    amount: transaction ? String(transaction.amount) : "",
    date: transaction?.date ?? todayISO(),
    note: transaction?.note ?? "",
    accountId: transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "",
    categoryId: transaction?.categoryId ?? NONE,
    fromAccountId: accounts[0]?.id ?? "",
    toAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "",
  });
  const [f, setF] = useState(init);

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) setF(init());
  }

  function setType(type: TxType) {
    setF((s) => {
      if (type === "transfer") return { ...s, type };
      const stillValid = categories.some((c) => c.id === s.categoryId && c.kind === type);
      return { ...s, type, categoryId: stillValid ? s.categoryId : NONE };
    });
  }

  const cats = categories.filter((c) => c.kind === f.type);
  const accountItems = accounts.map((a) => ({ value: a.id, label: a.name }));
  const categoryItems = [{ value: NONE, label: "No category" }, ...cats.map((c) => ({ value: c.id, label: c.name }))];
  const types: TxType[] = isEdit ? ["expense", "income"] : ["expense", "income", "transfer"];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      let res;
      if (f.type === "transfer") {
        res = await createTransfer({ amount: Number(f.amount), date: f.date, note: f.note, fromAccountId: f.fromAccountId, toAccountId: f.toAccountId });
      } else {
        const payload = { type: f.type, amount: Number(f.amount), date: f.date, note: f.note, accountId: f.accountId, categoryId: f.categoryId === NONE ? null : f.categoryId };
        res = isEdit ? await updateTransaction(transaction!.id, payload) : await createTransaction(payload);
      }
      if (res.ok) {
        toast.success(f.type === "transfer" ? "Transfer added" : isEdit ? "Transaction updated" : "Transaction added");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const title = f.type === "transfer" ? "New transfer" : isEdit ? "Edit transaction" : "New transaction";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3.5">
          <div className={cn("grid gap-2 rounded-lg bg-muted p-1", types.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                  f.type === t
                    ? t === "income" ? "bg-positive/15 text-positive"
                      : t === "expense" ? "bg-negative/15 text-negative"
                      : "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" inputMode="decimal" value={f.amount} onChange={(e) => setF((s) => ({ ...s, amount: e.target.value }))} placeholder="0.00" autoFocus required />
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} required />
            </div>
          </div>

          {f.type === "transfer" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>From account</Label>
                <Select value={f.fromAccountId} onValueChange={(v) => setF((s) => ({ ...s, fromAccountId: v as string }))} items={accountItems}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="From" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}><Icon name={a.icon} color={a.color} /> {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>To account</Label>
                <Select value={f.toAccountId} onValueChange={(v) => setF((s) => ({ ...s, toAccountId: v as string }))} items={accountItems}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="To" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}><Icon name={a.icon} color={a.color} /> {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Account</Label>
                <Select value={f.accountId} onValueChange={(v) => setF((s) => ({ ...s, accountId: v as string }))} items={accountItems}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}><Icon name={a.icon} color={a.color} /> {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select value={f.categoryId} onValueChange={(v) => setF((s) => ({ ...s, categoryId: v as string }))} items={categoryItems}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No category</SelectItem>
                    {cats.map((c) => <SelectItem key={c.id} value={c.id}><Icon name={c.icon} color={c.color} /> {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Input value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} placeholder="Optional description" />
          </div>

          <DialogFooter className="mt-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : isEdit ? "Save changes" : f.type === "transfer" ? "Add transfer" : "Add transaction"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
