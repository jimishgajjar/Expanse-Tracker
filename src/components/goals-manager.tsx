"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFormat } from "@/components/settings-provider";
import { contributeGoal, createGoal, deleteGoal } from "@/lib/actions";
import type { GoalDTO } from "@/lib/queries";

export function GoalsManager({ trigger, goals }: { trigger: ReactElement; goals: GoalDTO[] }) {
  const { money } = useFormat();
  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Savings goals</SheetTitle>
          <SheetDescription>Set targets and watch your progress toward them.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {goals.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs font-medium text-muted-foreground">Saved across {goals.length} goal{goals.length === 1 ? "" : "s"}</div>
              <div className="amount mt-1 text-2xl font-semibold">
                {money(totalSaved)}<span className="ml-1.5 text-sm font-normal text-muted-foreground">of {money(totalTarget)}</span>
              </div>
            </div>
          )}
          <AddForm />
          <div className="space-y-2">
            {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
            {goals.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No goals yet — add one above to start saving.</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !target) return;
    start(async () => {
      const res = await createGoal({ name, targetAmount: Number(target), deadline: deadline || null });
      if (res.ok) { toast.success("Goal added"); setName(""); setTarget(""); setDeadline(""); router.refresh(); }
      else toast.error(res.error);
    });
  }
  return (
    <form onSubmit={add} className="space-y-2.5 rounded-lg border p-2.5">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name (e.g. India trip, Emergency fund)" required />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target amount" required />
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <Button type="submit" size="sm" className="w-full" disabled={pending}><Plus className="size-4" /> Add goal</Button>
    </form>
  );
}

function GoalCard({ goal }: { goal: GoalDTO }) {
  const router = useRouter();
  const { money } = useFormat();
  const [adding, setAdding] = useState(false);
  const [amt, setAmt] = useState("");
  const [pending, start] = useTransition();
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  const done = goal.targetAmount > 0 && goal.savedAmount >= goal.targetAmount;

  function contribute(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amt);
    if (!n) return;
    start(async () => {
      const res = await contributeGoal(goal.id, n);
      if (res.ok) { setAmt(""); setAdding(false); router.refresh(); }
      else toast.error(res.error);
    });
  }
  async function remove() {
    const res = await deleteGoal(goal.id);
    if (res.ok) { toast.success("Goal removed"); router.refresh(); }
    else toast.error(res.error);
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{goal.name}{done && <span className="ml-1.5 text-positive">✓</span>}</div>
          <div className="text-xs text-muted-foreground">{goal.deadline ? `by ${goal.deadline}` : "no deadline"}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Add money" onClick={() => setAdding((v) => !v)}><Plus className="size-3.5" /></Button>
          <ConfirmDialog trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete goal"><Trash2 className="size-3.5" /></Button>} title={`Delete "${goal.name}"?`} onConfirm={remove} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="amount font-medium">{money(goal.savedAmount)}</span>
        <span className="text-muted-foreground">{pct}% · {money(goal.targetAmount)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-500 ease-out-quart" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
      </div>
      {adding && (
        <form onSubmit={contribute} className="mt-2 flex gap-2">
          <Input type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Add amount (− to withdraw)" className="h-7" autoFocus />
          <Button type="submit" size="sm" disabled={pending}>Save</Button>
        </form>
      )}
    </div>
  );
}
