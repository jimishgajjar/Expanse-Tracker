"use client";

import { useId, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "./form-error";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/icon";
import { TagInput } from "@/components/tag-input";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/dates";
import {
  createTransaction,
  createTransfer,
  updateTransaction,
} from "@/lib/actions";
import type {
  AccountDTO,
  CategoryDTO,
  TagRef,
  TransactionDTO,
} from "@/lib/queries";

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
  defaultType?: "income" | "expense" | "transfer";
  defaultAccountId?: string;
}) {
  const fieldId = useId();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const isEdit = !!transaction;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const init = () => ({
    type: (transaction?.type ?? defaultType) as TxType,
    amount: transaction ? String(transaction.amount) : "",
    date: transaction?.date ?? todayISO(),
    note: transaction?.note ?? "",
    accountId:
      transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "",
    categoryId: transaction?.categoryId ?? NONE,
    fromAccountId: defaultAccountId ?? accounts[0]?.id ?? "",
    toAccountId:
      accounts.find((a) => a.id !== (defaultAccountId ?? accounts[0]?.id))
        ?.id ??
      accounts[0]?.id ??
      "",
  });
  const [f, setF] = useState(init);
  const [tags, setTags] = useState<TagRef[]>(transaction?.tags ?? []);

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o && (isEdit || saved)) {
      setF(init());
      setTags(transaction?.tags ?? []);
      setSaved(false);
    }
    if (o) setError("");
  }

  function setType(type: TxType) {
    setF((s) => {
      if (type === "transfer") return { ...s, type };
      const stillValid = categories.some(
        (c) => c.id === s.categoryId && c.kind === type,
      );
      return { ...s, type, categoryId: stillValid ? s.categoryId : NONE };
    });
  }

  const cats = categories.filter((c) => c.kind === f.type);
  const accountItems = accounts.map((a) => ({ value: a.id, label: a.name }));
  const categoryItems = [
    { value: NONE, label: "No category" },
    ...cats.map((c) => ({ value: c.id, label: c.name })),
  ];
  const types: TxType[] = isEdit
    ? ["expense", "income"]
    : ["expense", "income", "transfer"];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!Number.isFinite(Number(f.amount)) || Number(f.amount) <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (f.type !== "transfer" && !f.accountId) {
      setError("Choose an account for this transaction.");
      return;
    }
    if (f.type === "transfer" && f.fromAccountId === f.toAccountId) {
      setError("Choose two different accounts for a transfer.");
      return;
    }
    start(async () => {
      let res;
      if (f.type === "transfer") {
        res = await createTransfer({
          amount: Number(f.amount),
          date: f.date,
          note: f.note,
          fromAccountId: f.fromAccountId,
          toAccountId: f.toAccountId,
        });
      } else {
        const payload = {
          type: f.type,
          amount: Number(f.amount),
          date: f.date,
          note: f.note,
          accountId: f.accountId,
          categoryId: f.categoryId === NONE ? null : f.categoryId,
          tagIds: tags.map((t) => t.id),
        };
        res = isEdit
          ? await updateTransaction(transaction!.id, payload)
          : await createTransaction(payload);
      }
      if (res.ok) {
        toast.success(
          f.type === "transfer"
            ? "Transfer added"
            : isEdit
              ? "Transaction updated"
              : "Transaction added",
        );
        setSaved(true);
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const title =
    f.type === "transfer"
      ? "New transfer"
      : isEdit
        ? "Edit transaction"
        : "New transaction";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="transaction-sheet sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="form-layout">
          <div
            className={cn(
              "grid gap-2 rounded-lg bg-muted p-1",
              types.length === 3 ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            {types.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={f.type === t}
                onClick={() => setType(t)}
                className={cn(
                  "min-h-11 rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                  f.type === t
                    ? t === "income"
                      ? "bg-positive/15 text-positive"
                      : t === "expense"
                        ? "bg-negative/15 text-negative"
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
              <Label htmlFor={fieldId + "-amount"}>Amount</Label>
              <Input
                id={fieldId + "-amount"}
                className="h-14 text-2xl font-semibold md:text-2xl"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={f.amount}
                onChange={(e) =>
                  setF((s) => ({ ...s, amount: e.target.value }))
                }
                placeholder="0.00"
                autoFocus
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={fieldId + "-date"}>Date</Label>
              <Input
                id={fieldId + "-date"}
                type="date"
                value={f.date}
                onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))}
                required
              />
            </div>
          </div>

          {f.type === "transfer" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={fieldId + "-fromAccountId"}>From account</Label>
                <Select
                  value={f.fromAccountId}
                  onValueChange={(v) =>
                    setF((s) => ({ ...s, fromAccountId: v as string }))
                  }
                  items={accountItems}
                >
                  <SelectTrigger
                    id={fieldId + "-fromAccountId"}
                    className="w-full"
                  >
                    <SelectValue placeholder="From" />
                  </SelectTrigger>
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
                <Label htmlFor={fieldId + "-toAccountId"}>To account</Label>
                <Select
                  value={f.toAccountId}
                  onValueChange={(v) =>
                    setF((s) => ({ ...s, toAccountId: v as string }))
                  }
                  items={accountItems}
                >
                  <SelectTrigger
                    id={fieldId + "-toAccountId"}
                    className="w-full"
                  >
                    <SelectValue placeholder="To" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <Icon name={a.icon} color={a.color} /> {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={fieldId + "-accountId"}>Account</Label>
                <Select
                  value={f.accountId}
                  onValueChange={(v) =>
                    setF((s) => ({ ...s, accountId: v as string }))
                  }
                  items={accountItems}
                >
                  <SelectTrigger id={fieldId + "-accountId"} className="w-full">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
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
                <Label htmlFor={fieldId + "-categoryId"}>Category</Label>
                <Select
                  value={f.categoryId}
                  onValueChange={(v) =>
                    setF((s) => ({ ...s, categoryId: v as string }))
                  }
                  items={categoryItems}
                >
                  <SelectTrigger
                    id={fieldId + "-categoryId"}
                    className="w-full"
                  >
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
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
          )}

          <details className="rounded-xl border p-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
              Notes & tags{" "}
              <span className="ml-1 font-normal text-muted-foreground">
                Optional
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              {f.type !== "transfer" && (
                <div className="grid gap-1.5">
                  <Label htmlFor={fieldId + "-tags"}>Tags</Label>
                  <TagInput
                    id={fieldId + "-tags"}
                    value={tags}
                    onChange={setTags}
                  />
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor={fieldId + "-note"}>Note</Label>
                <Input
                  id={fieldId + "-note"}
                  maxLength={200}
                  value={f.note}
                  onChange={(e) =>
                    setF((s) => ({ ...s, note: e.target.value }))
                  }
                  placeholder="Optional description"
                />
              </div>
            </div>
          </details>
          <FormError>{error}</FormError>
          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              Your draft stays here until you save or leave this page.
            </p>
          )}
          <DialogFooter className="mt-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : f.type === "transfer"
                    ? "Add transfer"
                    : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
