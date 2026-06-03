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
import { createTransaction, updateTransaction } from "@/lib/actions";
import type { AccountDTO, CategoryDTO, TransactionDTO } from "@/lib/queries";

const NONE = "__none__";

export function TransactionDialog({
  trigger,
  transaction,
  accounts,
  categories,
  defaultType = "expense",
}: {
  trigger: ReactElement;
  transaction?: TransactionDTO;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  defaultType?: "income" | "expense";
}) {
  const isEdit = !!transaction;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const init = () => ({
    type: transaction?.type ?? defaultType,
    amount: transaction ? String(transaction.amount) : "",
    date: transaction?.date ?? todayISO(),
    note: transaction?.note ?? "",
    accountId: transaction?.accountId ?? accounts[0]?.id ?? "",
    categoryId: transaction?.categoryId ?? NONE,
  });
  const [f, setF] = useState(init);

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) setF(init());
  }

  function setType(type: "income" | "expense") {
    setF((s) => {
      const stillValid = categories.some((c) => c.id === s.categoryId && c.kind === type);
      return { ...s, type, categoryId: stillValid ? s.categoryId : NONE };
    });
  }

  const cats = categories.filter((c) => c.kind === f.type);
  const accountItems = accounts.map((a) => ({ value: a.id, label: a.name }));
  const categoryItems = [{ value: NONE, label: "No category" }, ...cats.map((c) => ({ value: c.id, label: c.name }))];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        type: f.type,
        amount: Number(f.amount),
        date: f.date,
        note: f.note,
        accountId: f.accountId,
        categoryId: f.categoryId === NONE ? null : f.categoryId,
      };
      const res = isEdit ? await updateTransaction(transaction!.id, payload) : await createTransaction(payload);
      if (res.ok) {
        toast.success(isEdit ? "Transaction updated" : "Transaction added");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit transaction" : "New transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          {/* type toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                  f.type === t
                    ? t === "income"
                      ? "bg-positive/15 text-positive"
                      : "bg-negative/15 text-negative"
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
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={f.amount}
                onChange={(e) => setF((s) => ({ ...s, amount: e.target.value }))}
                placeholder="0.00"
                autoFocus
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Account</Label>
              <Select value={f.accountId} onValueChange={(v) => setF((s) => ({ ...s, accountId: v as string }))} items={accountItems}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <Icon name={a.icon} color={a.color} /> {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={f.categoryId} onValueChange={(v) => setF((s) => ({ ...s, categoryId: v as string }))} items={categoryItems}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No category</SelectItem>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <Icon name={c.icon} color={c.color} /> {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Input value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} placeholder="Optional description" />
          </div>

          <DialogFooter className="mt-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
