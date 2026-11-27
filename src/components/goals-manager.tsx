"use client";

import { use, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Plus, Trash2, Target } from "lucide-react";
import { ToolEmpty, ToolPage, ToolSection, ToolSummary } from "./tool-page";
import { shortDay } from "@/lib/dates";
import { ManagerPanel, PanelCreate } from "./manager-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFormat,MerchantRulesContext } from "@/components/settings-provider";
import { contributeGoal, createGoal, deleteGoal } from "@/lib/actions";
import type { GoalDTO } from "@/lib/queries";

export function GoalsManager({
  trigger,
  defaultOpen = false,
  goals,
}: {
  trigger: ReactElement;
  defaultOpen?: boolean;
  goals: GoalDTO[];
}) {
  const { money } = useFormat();
  const [localItems, setItems] = useState(goals);
  const items=use(MerchantRulesContext)?goals:localItems;
  const totalSaved = items.reduce((s, g) => s + g.savedAmount, 0);
  const totalTarget = items.reduce((s, g) => s + g.targetAmount, 0);

  const onAdded = (g: GoalDTO) => setItems((x) => [...x, g]);
  const onContributed = (id: string, saved: number) =>
    setItems((x) =>
      x.map((g) => (g.id === id ? { ...g, savedAmount: saved } : g)),
    );
  const onRemoved = (id: string) =>
    setItems((x) => x.filter((g) => g.id !== id));

  const left = Math.max(0, totalTarget - totalSaved);
  const reached = items.filter((g) => g.targetAmount > 0 && g.savedAmount >= g.targetAmount).length;

  return (
    <ManagerPanel
      defaultOpen={defaultOpen}
      trigger={trigger}
      title="Savings goals"
      icon={Target}
      description="Set targets and track your progress, one contribution at a time."
    >
      <ToolPage
        summary={items.length > 0 && (
          <ToolSummary
            items={[
              { label: "Saved so far", value: money(totalSaved), hint: `Across ${items.length} ${items.length === 1 ? "goal" : "goals"}`, tone: "positive" },
              { label: "Total of targets", value: money(totalTarget), hint: totalTarget > 0 ? `${Math.round((totalSaved / totalTarget) * 100)}% of the way` : undefined },
              { label: "Still to save", value: money(left), hint: reached ? `${reached} ${reached === 1 ? "goal" : "goals"} reached` : "No goal reached yet" },
            ]}
          />
        )}
        main={
          items.length === 0 ? (
            <ToolEmpty title="No savings goals yet">
              Give each pot of money a name and a target, like an emergency fund or next year&apos;s car insurance, and record what you put aside.
            </ToolEmpty>
          ) : (
            <ToolSection title={`Goals (${items.length})`}>
              {items.map((g) => (
                <GoalCard key={g.id} goal={g} onContributed={onContributed} onRemoved={onRemoved} />
              ))}
            </ToolSection>
          )
        }
        aside={
          <PanelCreate title="Add a savings goal" defaultOpen={items.length === 0}>
            <AddForm onAdded={onAdded} />
          </PanelCreate>
        }
      />
    </ManagerPanel>
  );
}

/** Common household sinking funds. Picking one only fills the form; the person sets the amount. */
const GOAL_IDEAS = [
  { name: "Car costs fund", hint: "Insurance, servicing, tyres and repairs, saved monthly", months: 12 },
  { name: "Emergency fund", hint: "Three to six months of essential costs", months: 12 },
  { name: "Family support", hint: "Money set aside for transfers home", months: 6 },
  { name: "Annual bills", hint: "Yearly renewals and subscriptions", months: 12 },
  { name: "Travel", hint: "Flights and trips", months: 9 },
] as const;
function monthsAhead(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function AddForm({ onAdded }: { onAdded: (g: GoalDTO) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !target) return;
    start(async () => {
      const res = await createGoal({
        name,
        targetAmount: Number(target),
        deadline: deadline || null,
      });
      if (res.ok && res.data) {
        toast.success("Goal added");
        window.dispatchEvent(new Event("ledger-changed"));
        onAdded({
          id: res.data.id,
          name: name.trim(),
          targetAmount: Number(target),
          savedAmount: 0,
          deadline: deadline || null,
          color: "#047857",
        });
        setName("");
        setTarget("");
        setDeadline("");
        router.refresh();
      } else if (!res.ok) toast.error(res.error);
    });
  }
  return (
    <form onSubmit={add} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Start from an idea</p>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_IDEAS.map((idea) => (
            <button
              key={idea.name}
              type="button"
              aria-pressed={name === idea.name}
              title={idea.hint}
              onClick={() => { setName(idea.name); if (!deadline && idea.months) setDeadline(monthsAhead(idea.months)); }}
              className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground aria-pressed:border-brand/50 aria-pressed:bg-brand/10 aria-pressed:text-brand"
            >
              {idea.name}
            </button>
          ))}
        </div>
      </div>
      <label className="grid gap-1.5 text-xs font-medium">
        Goal name
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Emergency fund"
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1.5 text-xs font-medium">
          Target amount
          <Input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Target date (optional)
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
      </div>
      <Button type="submit" size="sm" className="w-full" disabled={pending}>
        <Plus className="size-4" /> Add goal
      </Button>
    </form>
  );
}

function GoalCard({
  goal,
  onContributed,
  onRemoved,
}: {
  goal: GoalDTO;
  onContributed: (id: string, saved: number) => void;
  onRemoved: (id: string) => void;
}) {
  const router = useRouter();
  const { money } = useFormat();
  const [adding, setAdding] = useState(false);
  const [amt, setAmt] = useState("");
  const [pending, start] = useTransition();
  const pct =
    goal.targetAmount > 0
      ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))
      : 0;
  const done = goal.targetAmount > 0 && goal.savedAmount >= goal.targetAmount;
  const backed=use(MerchantRulesContext);

  function contribute(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amt);
    if (!n) return;
    start(async () => {
      const res = await contributeGoal(goal.id, n);
      if (res.ok) {
        onContributed(goal.id, Math.max(0, goal.savedAmount + n));
        setAmt("");
        setAdding(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }
  async function remove() {
    const res = await deleteGoal(goal.id);
    if (res.ok) {
      toast.success("Goal removed");
      window.dispatchEvent(new Event("ledger-changed"));
      onRemoved(goal.id);
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{goal.name}</span>
            {done && <CheckCircle2 className="size-4 shrink-0 text-positive" aria-label="Target reached" />}
          </p>
          <p className="text-xs text-muted-foreground">{goal.deadline ? `Target date ${shortDay(goal.deadline)}` : "No target date"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {backed ? (
            <Link className="text-xs font-medium text-brand underline-offset-4 hover:underline" href="/?tab=planning#monthly-plan">Allocate cash</Link>
          ) : (
            <Button size="sm" variant="outline" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
              <Plus className="size-3.5" /> Add money
            </Button>
          )}
          <ConfirmDialog
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label={`Delete ${goal.name}`} className="text-muted-foreground hover:bg-negative/10 hover:text-negative">
                <Trash2 className="size-3.5" />
              </Button>
            }
            title={`Delete "${goal.name}"?`}
            onConfirm={remove}
          />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 text-sm">
        <span><span className="amount font-semibold">{money(goal.savedAmount)}</span> <span className="text-muted-foreground">of <span className="amount">{money(goal.targetAmount)}</span></span></span>
        <span className="amount text-xs font-medium text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${goal.name} progress`}>
        <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out-quart" style={{ width: `${pct}%` }} />
      </div>
      {backed && <p className="mt-1.5 text-xs text-muted-foreground">{money(goal.reserved ?? 0)} reserved, {money(goal.outside ?? 0)} confirmed separate savings{(goal.openingProgress ?? 0) > 0 && <>. Original entry {money(goal.openingProgress ?? 0)} ({goal.openingReviewed ? "reviewed" : "awaiting review"}). <Link className="underline" href="/?tab=planning#goal-opening-review">View review</Link></>}</p>}
      {adding && (
        <form onSubmit={contribute} className="mt-3 flex gap-2">
          <Input
            aria-label="Contribution amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="Amount (use − to take money out)"
            className="h-9"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
        </form>
      )}
    </div>
  );
}
