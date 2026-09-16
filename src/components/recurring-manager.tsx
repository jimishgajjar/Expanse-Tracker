"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Bell, History, Pencil, Plus, Trash2, X, Repeat } from "lucide-react";
import { ManagerPanel, PanelCreate } from "./manager-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icon";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFormat } from "@/components/settings-provider";
import {
  createRecurring,
  deleteRecurring,
  updateRecurring,
} from "@/lib/actions";
import { commitmentTotals, perMonth } from "@/lib/commitments";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, RecurringDTO } from "@/lib/queries";

const NONE = "__none__";
const FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
const KINDS = [
  { value: "subscription", label: "Subscription" },
  { value: "bill", label: "Bill" },
  { value: "emi", label: "EMI / installment" },
  { value: "other", label: "Other" },
];

// Cadence normalisation and the "still charging" test live in lib/commitments
// so this sheet and the Insights tab can never quote different totals.

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
  const { money } = useFormat();
  const [items, setItems] = useState(recurring);
  const onAdded = (r: RecurringDTO) => setItems((x) => [...x, r]);
  const onRemoved = (id: string) =>
    setItems((x) => x.filter((r) => r.id !== id));
  const onUpdated = (r: RecurringDTO) =>
    setItems((x) => x.map((it) => (it.id === r.id ? r : it)));
  // Ended rules (past their end date or out of repeats) still list below for
  // reference, but they no longer cost anything so they stay out of the total.
  const { expenses, monthly } = commitmentTotals(items, todayISO());

  const known = ["subscription", "bill", "emi"];
  const groups = [
    {
      key: "subscription",
      label: "Subscriptions",
      rules: items.filter(
        (r) => r.type === "expense" && r.commitmentType === "subscription",
      ),
    },
    {
      key: "bill",
      label: "Bills",
      rules: items.filter(
        (r) => r.type === "expense" && r.commitmentType === "bill",
      ),
    },
    {
      key: "emi",
      label: "EMIs & installments",
      rules: items.filter(
        (r) => r.type === "expense" && r.commitmentType === "emi",
      ),
    },
    {
      key: "other",
      label: "Other recurring",
      rules: items.filter(
        (r) => r.type === "expense" && !known.includes(r.commitmentType),
      ),
    },
    {
      key: "income",
      label: "Income",
      rules: items.filter((r) => r.type === "income"),
    },
  ].filter((g) => g.rules.length > 0);

  return (
    <ManagerPanel
      trigger={trigger}
      title="Subscriptions & bills"
      icon={Repeat}
      description="Manage scheduled payments, installments, and recurring income."
    >
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            Monthly commitment
          </div>
          <div className="amount mt-1 text-xl font-semibold">
            {money(monthly)}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              /mo
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {money(monthly * 12)} / year · {expenses.length} active
          </div>
        </div>

        <PanelCreate
          title="Add a subscription or bill"
          defaultOpen={items.length === 0}
        >
          <RecurringForm
            accounts={accounts}
            categories={categories}
            onSaved={onAdded}
          />
        </PanelCreate>

        {groups.map((g) => (
          <div key={g.key} className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-muted-foreground">
                {g.label} · {g.rules.length}
              </span>
              {g.key !== "income" && (
                <span className="amount text-xs text-muted-foreground">
                  {money(
                    g.rules.reduce(
                      (s, r) => s + perMonth(r.amount, r.frequency),
                      0,
                    ),
                  )}
                  /mo
                </span>
              )}
            </div>
            {g.rules.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                accounts={accounts}
                categories={categories}
                onRemoved={onRemoved}
                onUpdated={onUpdated}
              />
            ))}
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nothing recurring yet — add your first subscription or bill above.
          </p>
        )}
      </div>
    </ManagerPanel>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Create OR edit a recurring rule. With `editing`, it pre-fills and calls
    updateRecurring (which logs a price change + makes the next charge use the
    new amount); otherwise it creates. */
function RecurringForm({
  accounts,
  categories,
  editing,
  onSaved,
  onCancel,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  editing?: RecurringDTO;
  onSaved: (r: RecurringDTO) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<"income" | "expense">(
    editing?.type ?? "expense",
  );
  const [kind, setKind] = useState(
    editing && editing.type === "expense"
      ? editing.commitmentType
      : "subscription",
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [accountId, setAccountId] = useState(
    editing?.accountId ?? accounts[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? NONE);
  const [frequency, setFrequency] = useState(editing?.frequency ?? "monthly");
  const [note, setNote] = useState(editing?.note ?? "");
  const [nextDate, setNextDate] = useState(editing?.nextDate ?? todayISO());
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [maxOccurrences, setMaxOccurrences] = useState(
    editing?.maxOccurrences != null ? String(editing.maxOccurrences) : "",
  );
  const [totalAmount, setTotalAmount] = useState(
    editing?.totalAmount != null ? String(editing.totalAmount) : "",
  );
  const [autoPost, setAutoPost] = useState(editing?.autoPost ?? true);
  const [alertsEnabled, setAlertsEnabled] = useState(
    editing?.alertsEnabled ?? true,
  );
  const [remindDaysBefore, setRemindDaysBefore] = useState(
    editing ? String(editing.remindDaysBefore) : "2",
  );
  const cats = categories.filter((c) => c.kind === type);
  const isEmi = type === "expense" && kind === "emi";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    const payload = {
      type,
      amount: amt,
      note,
      accountId,
      categoryId: categoryId === NONE ? null : categoryId,
      frequency,
      nextDate,
      endDate: endDate || null,
      maxOccurrences: maxOccurrences ? Number(maxOccurrences) : null,
      alertsEnabled,
      remindDaysBefore: Number(remindDaysBefore) || 0,
      commitmentType: type === "income" ? "other" : kind,
      autoPost: type === "income" ? true : autoPost,
      totalAmount: totalAmount ? Number(totalAmount) : null,
    };
    start(async () => {
      const res = editing
        ? await updateRecurring(editing.id, payload)
        : await createRecurring(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Updated" : "Added");

      // Mirror the server's price-history logic for the optimistic row.
      const now = new Date().toISOString();
      let priceHistory: { amount: number; at: string }[];
      if (editing) {
        priceHistory = editing.priceHistory ?? [];
        if (amt !== editing.amount) {
          if (priceHistory.length === 0)
            priceHistory = [{ amount: editing.amount, at: now }];
          priceHistory = [...priceHistory, { amount: amt, at: now }];
        }
      } else {
        priceHistory = [{ amount: amt, at: now }];
      }

      onSaved({
        id: editing?.id ?? crypto.randomUUID(),
        type,
        amount: amt,
        note,
        accountId,
        categoryId: categoryId === NONE ? null : categoryId,
        frequency,
        nextDate,
        endDate: endDate || null,
        maxOccurrences: maxOccurrences ? Number(maxOccurrences) : null,
        occurrenceCount: editing?.occurrenceCount ?? 0,
        alertsEnabled,
        remindDaysBefore: Number(remindDaysBefore) || 0,
        commitmentType: type === "income" ? "other" : kind,
        autoPost: type === "income" ? true : autoPost,
        totalAmount: totalAmount ? Number(totalAmount) : null,
        priceHistory,
      });

      if (!editing) {
        setAmount("");
        setNote("");
        setEndDate("");
        setMaxOccurrences("");
        setTotalAmount("");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => {
              setType(t);
              setCategoryId(NONE);
            }}
            className={cn(
              "min-h-11 rounded-md py-2 text-sm font-medium capitalize transition-colors",
              type === t
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

      {type === "expense" && (
        <Field label="Kind">
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as string)}
            items={KINDS}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label={autoPost ? "Amount" : "Estimated amount"}>
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={autoPost ? "Amount" : "Est. amount"}
            required
          />
        </Field>
        <Field label="Frequency">
          <Select
            value={frequency}
            onValueChange={(v) => setFrequency(v as string)}
            items={FREQS}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label="Account">
          <Select
            value={accountId}
            onValueChange={(v) => setAccountId(v as string)}
            items={accounts.map((a) => ({ value: a.id, label: a.name }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category">
          <Select
            value={categoryId}
            onValueChange={(v) => setCategoryId(v as string)}
            items={[
              { value: NONE, label: "No category" },
              ...cats.map((c) => ({ value: c.id, label: c.name })),
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No category</SelectItem>
              {cats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Name">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Name (e.g. Netflix, Bell mobile, iPhone EMI)"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label="Next charge">
          <Input
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Ends (optional)">
          <Input
            type="date"
            value={endDate}
            min={nextDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label={isEmi ? "Installments" : "Stop after N (optional)"}>
          <Input
            type="number"
            inputMode="numeric"
            min="1"
            value={maxOccurrences}
            onChange={(e) => setMaxOccurrences(e.target.value)}
            placeholder={isEmi ? "e.g. 12" : "optional"}
          />
        </Field>
        {isEmi && (
          <Field label="Total (optional)">
            <Input
              type="number"
              inputMode="decimal"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="e.g. 564"
            />
          </Field>
        )}
      </div>

      {type === "expense" && (
        <label className="flex min-h-11 items-center gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={!autoPost}
            onChange={(e) => setAutoPost(!e.target.checked)}
            className="size-4 accent-primary"
          />
          Variable amount — remind me to log it (don&apos;t auto-add)
        </label>
      )}

      <div className="rounded-md border p-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={alertsEnabled}
            onChange={(e) => setAlertsEnabled(e.target.checked)}
            className="size-4 accent-primary"
          />
          <Bell className="size-3.5 text-muted-foreground" /> Email + device
          alerts
        </label>
        {alertsEnabled && (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            Remind me
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              max="30"
              value={remindDaysBefore}
              onChange={(e) => setRemindDaysBefore(e.target.value)}
              className="h-7 w-16"
            />
            day(s) before.
          </label>
        )}
      </div>

      <div className="flex gap-2">
        {editing && onCancel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" className="flex-1" disabled={pending}>
          {editing ? (
            "Save changes"
          ) : (
            <>
              <Plus className="size-4" /> Add
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function RuleRow({
  rule,
  accounts,
  categories,
  onRemoved,
  onUpdated,
}: {
  rule: RecurringDTO;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  onRemoved: (id: string) => void;
  onUpdated: (r: RecurringDTO) => void;
}) {
  const router = useRouter();
  const { money } = useFormat();
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const cat = categories.find((c) => c.id === rule.categoryId);
  const color = cat?.color ?? "#9b9a97";
  const hasHistory = rule.priceHistory.length > 1;

  async function remove() {
    const res = await deleteRecurring(rule.id);
    if (res.ok) {
      toast.success("Removed");
      onRemoved(rule.id);
      router.refresh();
    } else toast.error(res.error);
  }

  if (editing) {
    return (
      <div className="rounded-lg border bg-muted/30 p-2">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            Edit {rule.note || cat?.name || "recurring"}
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setEditing(false)}
            aria-label="Cancel edit"
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <RecurringForm
          accounts={accounts}
          categories={categories}
          editing={rule}
          onSaved={(r) => {
            onUpdated(r);
            setEditing(false);
            setShowHistory(true);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const isEmi = rule.commitmentType === "emi" && rule.maxOccurrences != null;
  const paid = rule.occurrenceCount;
  const total = rule.maxOccurrences ?? 0;
  const remainingAmt =
    rule.totalAmount != null
      ? Math.max(0, rule.totalAmount - paid * rule.amount)
      : Math.max(0, total - paid) * rule.amount;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  // The schedule is the point of this row — give it a full-width line that can
  // never be squeezed out by the amount + actions, plus a countdown that turns
  // amber as the charge gets close.
  const daysUntil = differenceInCalendarDays(
    parseISO(rule.nextDate),
    new Date(),
  );
  const due =
    daysUntil < 0
      ? { label: "overdue", tone: "text-negative font-medium" }
      : daysUntil === 0
        ? {
            label: "due today",
            tone: "text-amber-600 dark:text-amber-400 font-medium",
          }
        : daysUntil === 1
          ? {
              label: "due tomorrow",
              tone: "text-amber-600 dark:text-amber-400 font-medium",
            }
          : { label: `in ${daysUntil} days`, tone: "text-muted-foreground" };

  return (
    <div className="rounded-lg border px-2.5 py-2">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-md"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <Icon name={cat?.icon ?? "tag"} size={15} />
        </span>
        <button
          type="button"
          onClick={() => hasHistory && setShowHistory((v) => !v)}
          className={cn(
            "min-w-0 flex-1 text-left",
            hasHistory && "cursor-pointer",
          )}
          aria-label={hasHistory ? "Show price history" : undefined}
        >
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {rule.note || cat?.name || "Recurring"}
            </span>
            {rule.alertsEnabled && (
              <Bell
                className="size-3 shrink-0 text-amber-500"
                aria-label="Alerts on"
              />
            )}
            {hasHistory && (
              <History
                className="size-3 shrink-0 text-muted-foreground"
                aria-label="Price has changed"
              />
            )}
          </div>
        </button>
        <span
          className={cn(
            "amount shrink-0 text-sm font-semibold",
            rule.type === "income" ? "text-positive" : "text-negative",
          )}
        >
          {rule.type === "income" ? "+" : "−"}
          {money(rule.amount)}
          {!rule.autoPost && (
            <span className="text-[10px] font-normal text-muted-foreground">
              {" "}
              est
            </span>
          )}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          aria-label="Edit"
        >
          <Pencil className="size-3.5" />
        </Button>
        <ConfirmDialog
          trigger={
            <Button size="icon-sm" variant="ghost" aria-label="Delete">
              <Trash2 className="size-3.5" />
            </Button>
          }
          title="Delete this item?"
          onConfirm={remove}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-dashed pt-1.5 pl-0.5 text-xs">
        <span className="truncate text-muted-foreground">
          {!rule.autoPost && "remind to log · "}
          {rule.frequency} · next{" "}
          <span className="font-medium text-foreground">
            {format(parseISO(rule.nextDate), "EEE, d MMM")}
          </span>
        </span>
        <span className={cn("shrink-0", due.tone)}>{due.label}</span>
      </div>

      {isEmi && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {paid} of {total} paid
            </span>
            <span className="amount">{money(remainingAmt)} left</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out-quart"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {showHistory && hasHistory && (
        <div className="mt-2 space-y-1 border-t pt-2">
          <div className="text-xs font-medium text-muted-foreground">
            Price history
          </div>
          {[...rule.priceHistory].reverse().map((h, i) => (
            <div
              key={`${h.at}-${i}`}
              className="flex items-center justify-between text-xs"
            >
              <span className="amount font-medium">
                {money(h.amount)}
                {i === 0 && (
                  <span className="ml-1.5 rounded bg-muted px-1 text-[10px] font-normal text-muted-foreground">
                    current
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                from {format(parseISO(h.at), "d MMM yyyy")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
