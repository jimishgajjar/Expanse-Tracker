"use client";

import { useId, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Clock,
  FileText,
  Star,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { Icon } from "@/components/icon";
import { CategoryPicker } from "./category-picker";
import { CalendarDatePicker } from "./calendar-date-picker";
import { TagInput } from "@/components/tag-input";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/dates";
import { useSettings } from "@/components/settings-provider";
import { CURRENCIES } from "@/lib/currencies";
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
  template,
  accounts,
  categories,
  defaultType = "expense",
  defaultAccountId,
  defaultCategoryId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  trigger?: ReactElement;
  transaction?: TransactionDTO;
  template?: TransactionDTO;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  defaultType?: "income" | "expense" | "transfer";
  defaultAccountId?: string;
  defaultCategoryId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const fieldId = useId();
  const { currency: currencySymbol, locale } = useSettings();
  const currencyInfo = CURRENCIES.find(
    (currency) => currency.symbol === currencySymbol && currency.locale === locale,
  );

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const isEdit = !!transaction;
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [pending, start] = useTransition();

  const seed = transaction ?? template;
  const preferenceKey = `capture:${accounts.map((a) => a.id).sort().join(":")}`;
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const [addAnother, setAddAnother] = useState(false);

  const init = () => ({
    type: (seed?.type ?? defaultType) as TxType,
    amount: seed ? String(seed.amount) : "",
    date: transaction?.date ?? todayISO(),
    note: seed?.note ?? "",
    accountId:
      seed?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "",
    categoryId:
      seed?.categoryId ?? defaultCategoryId ?? NONE,
    fromAccountId: defaultAccountId ?? accounts[0]?.id ?? "",
    toAccountId:
      accounts.find((a) => a.id !== (defaultAccountId ?? accounts[0]?.id))
        ?.id ??
      accounts[0]?.id ??
      "",
  });

  const [f, setF] = useState(init);
  const [tags, setTags] = useState<TagRef[]>(seed?.tags ?? []);

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o && (isEdit || saved)) {
      setF(init());
      setTags(seed?.tags ?? []);
      setSaved(false);
    }
    if (o) {
      setError("");
      try {
        const prefs = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}");
        setFavourites(
          Array.isArray(prefs.accounts)
            ? prefs.accounts.filter((id: string) => accounts.some((a) => a.id === id))
            : [],
        );
        setRecentCategories(
          Array.isArray(prefs.categories)
            ? prefs.categories.filter((id: string) => categories.some((c) => c.id === id))
            : [],
        );
      } catch {
        /* Preferences must not block entry. */
      }
    }
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
  const orderedAccounts = [...accounts].sort(
    (a, b) => Number(favourites.includes(b.id)) - Number(favourites.includes(a.id)),
  );
  const accountItems = orderedAccounts.map((a) => ({
    value: a.id,
    label: `${favourites.includes(a.id) ? "★ " : ""}${a.name}`,
  }));

  const recentCats = recentCategories
    .map((id) => cats.find((c) => c.id === id))
    .filter((c): c is CategoryDTO => c !== undefined);

  const isFav = f.accountId ? favourites.includes(f.accountId) : false;

  function toggleFavourite() {
    if (!f.accountId) return;
    const next = isFav
      ? favourites.filter((id) => id !== f.accountId)
      : [...favourites, f.accountId];
    setFavourites(next);
    try {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({ accounts: next, categories: recentCategories }),
      );
    } catch {
      /* Browser-only preference. */
    }
  }

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
        const recent =
          f.categoryId === NONE
            ? recentCategories
            : [f.categoryId, ...recentCategories.filter((id) => id !== f.categoryId)].slice(0, 6);
        setRecentCategories(recent);
        try {
          localStorage.setItem(
            preferenceKey,
            JSON.stringify({ accounts: favourites, categories: recent }),
          );
        } catch {
          /* Browser preference only. */
        }
        setSaved(!addAnother || isEdit);
        if (addAnother && !isEdit) {
          setF((current) => ({ ...current, amount: "", note: "" }));
          setTags([]);
        } else {
          setOpen(false);
        }
        window.dispatchEvent(new Event("ledger-changed"));
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
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent
        className="transaction-sheet sm:max-w-[540px] p-5 sm:p-6"
        // Edit dialogs are launched inside a menu. Keep typing in this portal
        // from reaching the parent menu's keyboard navigation/typeahead.
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DialogHeader className="border-b border-border/70 pb-3.5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl border transition-colors",
                f.type === "expense" && "bg-negative/10 text-negative border-negative/20",
                f.type === "income" && "bg-positive/10 text-positive border-positive/20",
                f.type === "transfer" && "bg-brand/10 text-brand border-brand/20",
              )}
            >
              {f.type === "expense" && <ArrowUpRight className="size-4.5" />}
              {f.type === "income" && <ArrowDownLeft className="size-4.5" />}
              {f.type === "transfer" && <ArrowRightLeft className="size-4.5" />}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground truncate">
                {f.type === "transfer"
                  ? "Move money between your connected accounts"
                  : isEdit
                    ? "Update the details for this entry in your ledger"
                    : f.type === "expense"
                      ? "Record an outgoing payment or expense"
                      : "Record a deposit or incoming income"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="transaction-form grid min-w-0 gap-4 pt-1">
          {/* Segmented Type Picker */}
          <div
            className={cn(
              "grid min-w-0 gap-1 rounded-xl border border-border/70 bg-muted/40 p-1 shadow-2xs",
              types.length === 3 ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            {types.map((t) => {
              const isActive = f.type === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50",
                    isActive
                      ? t === "income"
                        ? "bg-card text-positive shadow-xs border border-positive/25 font-bold"
                        : t === "expense"
                          ? "bg-card text-negative shadow-xs border border-negative/25 font-bold"
                          : "bg-card text-brand shadow-xs border border-brand/25 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40",
                  )}
                >
                  {t === "income" && <ArrowDownLeft className="size-3.5" />}
                  {t === "expense" && <ArrowUpRight className="size-3.5" />}
                  {t === "transfer" && <ArrowRightLeft className="size-3.5" />}
                  <span>{t}</span>
                </button>
              );
            })}
          </div>

          {/* Hero Amount & Custom Calendar Date Card */}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-12">
            {/* Amount Input */}
            <div className="sm:col-span-7 min-w-0 rounded-xl border border-border/80 bg-background/70 p-3 focus-within:border-brand/70 focus-within:ring-2 focus-within:ring-brand/15 transition-colors">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1">
                <Label
                  htmlFor={fieldId + "-amount"}
                  className="cursor-pointer text-xs font-medium text-muted-foreground"
                >
                  Amount
                </Label>
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {currencyInfo?.code ?? currencySymbol}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-mono text-xl sm:text-2xl font-bold select-none",
                    f.type === "income"
                      ? "text-positive"
                      : f.type === "expense"
                        ? "text-negative"
                        : "text-brand",
                  )}
                >
                  {currencySymbol}
                </span>
                <Input
                  id={fieldId + "-amount"}
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  value={f.amount}
                  onChange={(e) => {
                    const amount = e.currentTarget.value;
                    setF((s) => ({ ...s, amount }));
                  }}
                  placeholder="0.00"
                  autoFocus
                  required
                  className="transaction-amount h-10 min-w-0 border-0 bg-transparent p-0 font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground shadow-none focus-visible:ring-0 focus-visible:outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            {/* Date Input with custom Calendar popover */}
            <div className="sm:col-span-5 min-w-0 rounded-xl border border-border/80 bg-background/70 p-3 focus-within:border-brand/70 focus-within:ring-2 focus-within:ring-brand/15 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1">
                <Label
                  htmlFor={fieldId + "-date"}
                  className="cursor-pointer text-xs font-medium text-muted-foreground"
                >
                  Date
                </Label>
              </div>
              <CalendarDatePicker
                id={fieldId + "-date"}
                value={f.date}
                onChange={(date) => setF((s) => ({ ...s, date }))}
              />
            </div>
          </div>

          {/* Account & Category Controls */}
          {f.type === "transfer" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor={fieldId + "-fromAccountId"}
                  className="text-xs font-semibold text-foreground"
                >
                  From account
                </Label>
                <Select
                  value={f.fromAccountId}
                  onValueChange={(v) =>
                    setF((s) => ({ ...s, fromAccountId: v as string }))
                  }
                  items={accountItems}
                >
                  <SelectTrigger
                    id={fieldId + "-fromAccountId"}
                    className="h-11 w-full min-w-0 rounded-xl border-border/80 bg-background text-sm font-medium"
                  >
                    <SelectValue placeholder="From account" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <span style={{ color: a.color }}>
                            <Icon name={a.icon} size={15} />
                          </span>
                          <span>{a.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor={fieldId + "-toAccountId"}
                  className="text-xs font-semibold text-foreground"
                >
                  To account
                </Label>
                <Select
                  value={f.toAccountId}
                  onValueChange={(v) =>
                    setF((s) => ({ ...s, toAccountId: v as string }))
                  }
                  items={accountItems}
                >
                  <SelectTrigger
                    id={fieldId + "-toAccountId"}
                    className="h-11 w-full min-w-0 rounded-xl border-border/80 bg-background text-sm font-medium"
                  >
                    <SelectValue placeholder="To account" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <span style={{ color: a.color }}>
                            <Icon name={a.icon} size={15} />
                          </span>
                          <span>{a.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Symmetrical Account & Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={fieldId + "-accountId"}
                      className="text-xs font-semibold text-foreground"
                    >
                      Account
                    </Label>
                    {f.accountId && (
                      <button
                        type="button"
                        onClick={toggleFavourite}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                          isFav
                            ? "bg-amber-500/10 text-amber-500 font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        )}
                        title={isFav ? "Favorited account" : "Star as favorite account"}
                      >
                        <Star
                          className={cn(
                            "size-3",
                            isFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
                          )}
                        />
                        <span>{isFav ? "Favorited" : "Favorite"}</span>
                      </button>
                    )}
                  </div>
                  <Select
                    value={f.accountId}
                    onValueChange={(v) =>
                      setF((s) => ({ ...s, accountId: v as string }))
                    }
                    items={accountItems}
                  >
                    <SelectTrigger
                      id={fieldId + "-accountId"}
                      className="h-11 w-full min-w-0 rounded-xl border-border/80 bg-background text-sm font-medium"
                    >
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderedAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2">
                            <span style={{ color: a.color }}>
                              <Icon name={a.icon} size={15} />
                            </span>
                            <span>{a.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={fieldId + "-categoryId"}
                      className="text-xs font-semibold text-foreground"
                    >
                      Category
                    </Label>
                  </div>
                  <CategoryPicker
                    key={f.type}
                    id={fieldId + "-categoryId"}
                    categories={cats}
                    kind={f.type}
                    value={f.categoryId === NONE ? null : f.categoryId}
                    onChange={(categoryId) =>
                      setF((s) => ({ ...s, categoryId: categoryId ?? NONE }))
                    }
                  />
                </div>
              </div>

              {/* Dedicated Recent Categories Location - Full-width clean pill row */}
              {recentCats.length > 0 && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3 text-muted-foreground" />
                      <span>Recent categories</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">Quick select</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {recentCats.map((c) => {
                      const isSelected = f.categoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setF((s) => ({ ...s, categoryId: c.id }))}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50",
                            isSelected
                              ? "bg-brand/15 text-brand border-brand/40 shadow-xs font-semibold"
                              : "bg-muted/30 hover:bg-muted/70 text-muted-foreground hover:text-foreground border-border/60 hover:border-border",
                          )}
                        >
                          <span style={{ color: c.color }} className="shrink-0">
                            <Icon name={c.icon} size={12} />
                          </span>
                          <span className="truncate max-w-[130px]">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes & Tags - Visible directly without hiding */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label
                htmlFor={fieldId + "-note"}
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span>Note</span>
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">Optional</span>
              </Label>
              <Input
                id={fieldId + "-note"}
                maxLength={200}
                value={f.note}
                onChange={(e) => {
                  const note = e.currentTarget.value;
                  setF((s) => ({ ...s, note }));
                }}
                placeholder="What was this for? (e.g. Grocery run, coffee, client invoice...)"
                className="h-10 rounded-xl border-border/80 bg-background text-sm"
              />
            </div>

            {f.type !== "transfer" && (
              <div className="space-y-1.5">
                <Label
                  htmlFor={fieldId + "-tags"}
                  className="text-xs font-semibold text-foreground flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Tag className="size-3.5 text-muted-foreground" />
                    <span>Tags</span>
                  </span>
                  <span className="text-[10px] font-normal text-muted-foreground">Optional</span>
                </Label>
                <TagInput
                  id={fieldId + "-tags"}
                  value={tags}
                  onChange={setTags}
                />
              </div>
            )}
          </div>

          <FormError>{error}</FormError>

          {/* Modal Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border/70 pt-4 mt-1">
            <div className="flex items-center gap-3">
              {!isEdit ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addAnother}
                    onChange={(e) => setAddAnother(e.target.checked)}
                    className="size-4 rounded border-border text-brand focus:ring-brand/30 accent-brand cursor-pointer"
                  />
                  <span>Save and add another</span>
                </label>
              ) : (
                <span className="text-[11px] text-muted-foreground">Editing existing entry</span>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 rounded-xl px-4 text-xs font-semibold hover:bg-muted/70"
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={pending}
                className={cn(
                  "min-h-10 rounded-xl px-5 text-xs font-semibold text-white shadow-xs hover:shadow-sm active:scale-[0.98] transition-colors motion-reduce:transition-none motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50",
                  f.type === "expense"
                    ? "bg-negative hover:bg-negative/90"
                    : f.type === "income"
                      ? "bg-positive hover:bg-positive/90"
                      : "bg-brand hover:bg-brand/90",
                )}
              >
                {pending
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : f.type === "transfer"
                      ? "Add transfer"
                      : f.type === "income"
                        ? "Add income"
                        : "Add expense"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
