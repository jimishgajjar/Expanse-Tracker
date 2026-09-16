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
  DialogDescription,
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
import { IconPicker } from "@/components/icon-picker";
import { ColorPicker } from "@/components/color-picker";
import { createAccount, updateAccount } from "@/lib/actions";
import type { AccountDTO } from "@/lib/queries";

const TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "wallet", label: "Wallet" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
];

function initial(a?: AccountDTO) {
  return {
    name: a?.name ?? "",
    type: a?.type ?? "bank",
    icon: a?.icon ?? "wallet",
    color: a?.color ?? "#6366f1",
    initialBalance: a ? String(a.initialBalance) : "",
  };
}

export function AccountDialog({
  trigger,
  account,
}: {
  trigger: ReactElement;
  account?: AccountDTO;
}) {
  const fieldId = useId();
  const [error, setError] = useState("");
  const isEdit = !!account;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [f, setF] = useState(() => initial(account));

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) {
      setF(initial(account));
      setError("");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!f.name.trim()) {
      setError("Enter a name for this account.");
      return;
    }
    if (!Number.isFinite(Number(f.initialBalance || 0))) {
      setError("Enter a valid opening balance.");
      return;
    }
    start(async () => {
      const payload = {
        name: f.name,
        type: f.type,
        icon: f.icon,
        color: f.color,
        initialBalance: Number(f.initialBalance || 0),
      };
      const res = isEdit
        ? await updateAccount(account!.id, payload)
        : await createAccount(payload);
      if (res.ok) {
        toast.success(isEdit ? "Account updated" : "Account added");
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="form-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            Choose how this account appears in your tracker.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-layout">
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId + "-name"}>Name</Label>
            <div className="flex gap-2">
              <IconPicker
                value={f.icon}
                color={f.color}
                onChange={(icon) => setF((s) => ({ ...s, icon }))}
              />
              <Input
                id={fieldId + "-name"}
                value={f.name}
                onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. HDFC Bank"
                autoFocus
                maxLength={60}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={fieldId + "-type"}>Type</Label>
              <Select
                value={f.type}
                onValueChange={(v) =>
                  setF((s) => ({ ...s, type: v as string }))
                }
                items={TYPES}
              >
                <SelectTrigger id={fieldId + "-type"} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={fieldId + "-balance"}>
                {isEdit ? "Opening balance" : "Starting balance"}
              </Label>
              <Input
                id={fieldId + "-balance"}
                type="number"
                step="0.01"
                inputMode="decimal"
                value={f.initialBalance}
                onChange={(e) =>
                  setF((s) => ({ ...s, initialBalance: e.target.value }))
                }
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Colour</Label>
            <ColorPicker
              value={f.color}
              onChange={(color) => setF((s) => ({ ...s, color }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Opening balance is the amount before your recorded transactions.
          </p>
          <FormError>{error}</FormError>
          <DialogFooter className="mt-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
