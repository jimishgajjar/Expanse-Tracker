"use client";

import { useEffect, useId, useState, useTransition, type ReactElement } from "react";
import { budgetSuggestions, type BudgetSuggestion } from "@/lib/budget-suggestions";
import { useFormat } from "./settings-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormError } from "./form-error";
import { parseBudgetInput } from "@/lib/budget-input";
import { Gauge } from "lucide-react";
import { ManagerPanel } from "./manager-panel";
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
  return (
    <ManagerPanel trigger={trigger} title="Monthly budgets" icon={Gauge}
      description="Set a monthly limit for each expense category. Each category saves separately.">
      <BudgetList budgets={budgets} categories={categories} />
    </ManagerPanel>
  );
}

/** Mounted when the panel opens, so suggestions are fetched only when someone looks. */
function BudgetList({ budgets, categories }: { budgets: BudgetProgressDTO[]; categories: CategoryDTO[] }) {
  const [suggestions, setSuggestions] = useState<Map<string, BudgetSuggestion> | null>(null);
  useEffect(() => {
    let live = true;
    budgetSuggestions()
      .then((rows) => { if (live) setSuggestions(new Map(rows.map((r) => [r.categoryId, r]))); })
      .catch(() => { if (live) setSuggestions(new Map()); });
    return () => { live = false; };
  }, []);
  const current: Record<string, number> = {};
  budgets.forEach((b) => (current[b.categoryId] = b.budget));
  // Busiest categories first: that is where a limit makes the most difference.
  const expenseCats = categories
    .filter((c) => c.kind === "expense")
    .sort((a, b) => (suggestions?.get(b.id)?.average ?? 0) - (suggestions?.get(a.id)?.average ?? 0));

  return (
      <>
        <p className="text-xs text-muted-foreground">
          Suggestions use your average spending over the last three full months, rounded up. Nothing changes until you press Save. Clear an amount and select Remove to delete its limit.
        </p>
        <div className="space-y-3">
          {expenseCats.map((c) => (
            <BudgetRow
              key={`${c.id}:${current[c.id] ?? ""}`}
              category={c}
              amount={current[c.id]}
              suggestion={suggestions?.get(c.id)}
            />
          ))}
          {expenseCats.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add an expense category first.
            </p>
          )}
        </div>
      </>
  );
}

function BudgetRow({
  category,
  amount,
  suggestion,
}: {
  category: CategoryDTO;
  amount?: number;
  suggestion?: BudgetSuggestion;
}) {
  const router = useRouter();
  const { money } = useFormat();
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
      {suggestion && suggestion.suggested > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="amount">
            3-month average {money(suggestion.average)} · highest month {money(suggestion.peak)}
            {suggestion.months < 3 && ` · spent in ${suggestion.months} of 3 months`}
          </span>
          {String(suggestion.suggested) !== val.trim() && (
            <button
              type="button"
              disabled={pending}
              onClick={() => { setVal(String(suggestion.suggested)); setError(""); }}
              className="rounded-md bg-brand/10 px-2 py-1 font-medium text-brand hover:bg-brand/15"
            >
              Use {money(suggestion.suggested)}
            </button>
          )}
        </p>
      )}
      <div id={`${id}-error`}>
        <FormError>{error}</FormError>
      </div>
    </form>
  );
}
