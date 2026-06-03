"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
          <SheetDescription>Set a monthly limit per expense category. Leave blank to remove.</SheetDescription>
        </SheetHeader>
        <div className="max-h-[calc(100vh-7rem)] space-y-2 overflow-y-auto p-4">
          {expenseCats.map((c) => <BudgetRow key={c.id} category={c} amount={current[c.id]} />)}
          {expenseCats.length === 0 && <p className="text-sm text-muted-foreground">Add an expense category first.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BudgetRow({ category, amount }: { category: CategoryDTO; amount?: number }) {
  const router = useRouter();
  const initial = amount != null ? String(amount) : "";
  const [val, setVal] = useState(initial);
  const [pending, start] = useTransition();

  function save() {
    if (val.trim() === initial.trim()) return;
    const n = parseFloat(val);
    start(async () => {
      const res = !val.trim() || !(n > 0)
        ? await deleteBudget(category.id)
        : await setBudget({ categoryId: category.id, amount: n });
      if (res.ok) { toast.success("Budgets updated"); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-md" style={{ backgroundColor: `${category.color}22`, color: category.color }}>
        <Icon name={category.icon} size={15} />
      </span>
      <span className="flex-1 truncate text-sm font-medium">{category.name}</span>
      <Input
        type="number"
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        placeholder="No budget"
        className="h-8 w-24"
      />
      <Button type="submit" size="icon-sm" variant="ghost" disabled={pending} aria-label="Save budget">
        <Check className="size-4" />
      </Button>
    </form>
  );
}
