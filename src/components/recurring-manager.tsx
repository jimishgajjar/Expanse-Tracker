"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icon";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFormat } from "@/components/settings-provider";
import { createRecurring, deleteRecurring } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, RecurringDTO } from "@/lib/queries";

const NONE = "__none__";
const FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function RecurringManager({
  trigger,
  recurring,
  accounts,
  categories,
}: {
  trigger: ReactElement;
  recurring: RecurringDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
}) {
  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Recurring</SheetTitle>
          <SheetDescription>Auto-create transactions on a schedule, with an optional end, a repeat limit, and email + device alerts.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <AddForm accounts={accounts} categories={categories} />
          <div className="space-y-1.5">
            {recurring.map((r) => <RuleRow key={r.id} rule={r} categories={categories} />)}
            {recurring.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No recurring rules yet.</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function AddForm({ accounts, categories }: { accounts: AccountDTO[]; categories: CategoryDTO[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(NONE);
  const [frequency, setFrequency] = useState("monthly");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [remindDaysBefore, setRemindDaysBefore] = useState("1");
  const cats = categories.filter((c) => c.kind === type);

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createRecurring({
        type, amount: Number(amount), note, accountId,
        categoryId: categoryId === NONE ? null : categoryId,
        frequency, nextDate,
        endDate: endDate || null,
        maxOccurrences: maxOccurrences ? Number(maxOccurrences) : null,
        alertsEnabled,
        remindDaysBefore: Number(remindDaysBefore) || 0,
      });
      if (res.ok) {
        toast.success("Recurring rule added");
        setAmount(""); setNote(""); setEndDate(""); setMaxOccurrences("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={add} className="space-y-2.5 rounded-lg border p-2.5">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
        {(["expense", "income"] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setType(t); setCategoryId(NONE); }}
            className={cn("rounded-md py-1 text-sm font-medium capitalize transition-colors",
              type === t ? (t === "income" ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative") : "text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required />
        <Select value={frequency} onValueChange={(v) => setFrequency(v as string)} items={FREQS}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{FREQS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={accountId} onValueChange={(v) => setAccountId(v as string)} items={accounts.map((a) => ({ value: a.id, label: a.name }))}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v as string)} items={[{ value: NONE, label: "No category" }, ...cats.map((c) => ({ value: c.id, label: c.name }))]}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={NONE}>No category</SelectItem>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. Rent)" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Starts"><Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} required /></Field>
        <Field label="Ends (optional)"><Input type="date" value={endDate} min={nextDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>
      <Field label="Stop after N times (optional)">
        <Input type="number" inputMode="numeric" min="1" value={maxOccurrences} onChange={(e) => setMaxOccurrences(e.target.value)} placeholder="e.g. 12" />
      </Field>
      <div className="rounded-md border p-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={alertsEnabled} onChange={(e) => setAlertsEnabled(e.target.checked)} className="size-4 accent-primary" />
          <Bell className="size-3.5 text-muted-foreground" /> Email + device alerts
        </label>
        {alertsEnabled && (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            Remind me
            <Input type="number" inputMode="numeric" min="0" max="30" value={remindDaysBefore} onChange={(e) => setRemindDaysBefore(e.target.value)} className="h-7 w-16" />
            day(s) before, and confirm when it posts.
          </label>
        )}
      </div>
      <Button type="submit" size="sm" className="w-full" disabled={pending}><Plus className="size-4" /> Add recurring</Button>
    </form>
  );
}

function RuleRow({ rule, categories }: { rule: RecurringDTO; categories: CategoryDTO[] }) {
  const router = useRouter();
  const { money } = useFormat();
  const cat = categories.find((c) => c.id === rule.categoryId);
  const color = cat?.color ?? "#94a3b8";

  async function remove() {
    const res = await deleteRecurring(rule.id);
    if (res.ok) { toast.success("Recurring rule removed"); router.refresh(); }
    else toast.error(res.error);
  }

  const meta = [`every ${rule.frequency.replace("ly", "")}`, `next ${rule.nextDate}`];
  if (rule.endDate) meta.push(`until ${rule.endDate}`);
  if (rule.maxOccurrences != null) meta.push(`${rule.occurrenceCount}/${rule.maxOccurrences}`);

  return (
    <div className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-md" style={{ backgroundColor: `${color}22`, color }}>
        <Icon name={cat?.icon ?? "tag"} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{rule.note || cat?.name || "Recurring"}</span>
          {rule.alertsEnabled && <Bell className="size-3 shrink-0 text-amber-500" aria-label="Alerts on" />}
        </div>
        <div className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</div>
      </div>
      <span className={cn("shrink-0 font-mono text-sm font-semibold", rule.type === "income" ? "text-positive" : "text-negative")}>
        {rule.type === "income" ? "+" : "−"}{money(rule.amount)}
      </span>
      <ConfirmDialog
        trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete recurring"><Trash2 className="size-3.5" /></Button>}
        title="Delete recurring rule?"
        onConfirm={remove}
      />
    </div>
  );
}
