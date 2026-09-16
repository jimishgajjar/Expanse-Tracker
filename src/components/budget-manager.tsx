"use client";

import { useId, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormError } from "./form-error";
import { parseBudgetInput } from "@/lib/budget-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { deleteBudget, setBudget } from "@/lib/actions";
import type { BudgetProgressDTO, CategoryDTO } from "@/lib/queries";

export function BudgetManager({
  budgets,
  categories,
  trigger,
}: {
  budgets: BudgetProgressDTO[];
  categories: CategoryDTO[];
  trigger: ReactElement;
}) {
  const expenseCats = categories.filter((c) => c.kind === "expense");
  const current: Record<string, number> = {};
  budgets.forEach((b) => (current[b.categoryId] = b.budget));

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Monthly budgets</SheetTitle>
          <SheetDescription>
            Set a monthly limit per expense category. Save each category
            separately. Clear an amount and select Remove to delete its limit.
          </SheetDescription>
        </SheetHeader>
        <div className="max-h-[calc(100dvh-7rem)] space-y-2 overflow-y-auto p-4">
          {expenseCats.map((c) => (
            <BudgetRow
              key={`${c.id}:${current[c.id] ?? ""}`}
              category={c}
              amount={current[c.id]}
            />
          ))}
          {expenseCats.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add an expense category first.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BudgetRow({
  category,
  amount,
}: {
  category: CategoryDTO;
  amount?: number;
}) {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState("");
  const initial = amount != null ? String(amount) : "";
  const [val, setVal] = useState(initial);
  const [pending, start] = useTransition();

  function save() {
    if (pending || val.trim() === initial.trim()) return;
    const parsed = parseBudgetInput(val);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError("");
    start(async () => {
      const res =
        parsed.amount === null
          ? await deleteBudget(category.id)
          : await setBudget({ categoryId: category.id, amount: parsed.amount });
      if (res.ok) {
        toast.success("Budgets updated");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-3 rounded-xl border p-4"
    >
      <label
        htmlFor={id}
        className="flex items-center gap-2.5 text-sm font-medium"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{
            backgroundColor: `${category.color}22`,
            color: category.color,
          }}
        >
          <Icon name={category.icon} size={15} />
        </span>
        {category.name}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          // Keep invalid input visible: number inputs turn e.g. "1e" into an
          // empty value, which would be mistaken for an explicit removal.
          type="text"
          inputMode="decimal"
          value={val}
          disabled={pending}
          onChange={(e) => {
            setVal(e.target.value);
            setError("");
          }}
          placeholder="No budget"
          className="min-h-11 flex-1"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button
          type="submit"
          variant="outline"
          className="min-h-11 min-w-20"
          disabled={pending || val.trim() === initial.trim()}
        >
          {pending
            ? "Saving…"
            : !val.trim() && amount != null
              ? "Remove"
              : "Save"}
        </Button>
      </div>
      <div id={`${id}-error`}>
        <FormError>{error}</FormError>
      </div>
    </form>
  );
}
