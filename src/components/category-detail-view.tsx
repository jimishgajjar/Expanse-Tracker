"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  format,
  parseISO,
  subMonths,
  startOfMonth,
  endOfMonth,
  subDays,
  startOfYear,
  endOfYear,
} from "date-fns";
import {
  CircleAlert,
  Download,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Icon } from "@/components/icon";
import { IconPicker } from "@/components/icon-picker";
import { ColorPicker } from "@/components/color-picker";
import { TransactionDialog } from "@/components/transaction-dialog";
import { TransactionRows } from "@/components/transactions-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFormat } from "@/components/settings-provider";
import { updateCategory } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type {
  AccountDTO,
  BudgetProgressDTO,
  CategoryDTO,
  TagDTO,
  TransactionDTO,
} from "@/lib/queries";

type DatePreset =
  | "all"
  | "this_month"
  | "last_month"
  | "last_30"
  | "last_90"
  | "this_year"
  | "last_year"
  | "custom";

type AmountTier = "all" | "micro" | "small" | "medium" | "large";

type SortOption =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "note_asc";

export function CategoryDetailView({
  category,
  transactions,
  allTransactions = [],
  accounts,
  categories,
  categoryBudget,
  tags = [],
  canEdit,
}: {
  category: CategoryDTO;
  transactions: TransactionDTO[];
  allTransactions?: TransactionDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  categoryBudget?: BudgetProgressDTO | null;
  tags?: TagDTO[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { money } = useFormat();
  const [pending, startTransition] = useTransition();

  // Category Edit State
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [editIcon, setEditIcon] = useState(category.icon);
  const [editColor, setEditColor] = useState(category.color);

  // Filters State
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedTagId, setSelectedTagId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<"all" | "expense" | "income">("all");
  const [amountTier, setAmountTier] = useState<AmountTier>("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("date_desc");
  const [showFilters, setShowFilters] = useState(false);

  // --- Calculations for Category (All Time & Historical) ---
  const lifetimeStats = useMemo(() => {
    const isExpense = category.kind === "expense";
    const totalLifetime = transactions.reduce((s, t) => s + t.amount, 0);

    const now = new Date();
    const curMonthKey = format(now, "yyyy-MM");
    const prevMonthKey = format(subMonths(now, 1), "yyyy-MM");

    const curMonthTx = transactions.filter((t) => t.date.startsWith(curMonthKey));
    const prevMonthTx = transactions.filter((t) => t.date.startsWith(prevMonthKey));

    const curMonthTotal = curMonthTx.reduce((s, t) => s + t.amount, 0);
    const prevMonthTotal = prevMonthTx.reduce((s, t) => s + t.amount, 0);

    const momDelta =
      prevMonthTotal > 0
        ? Math.round(((curMonthTotal - prevMonthTotal) / prevMonthTotal) * 100)
        : null;

    // Overall workspace spend to compute category share %
    const workspaceTotal = allTransactions
      .filter((t) => t.type === category.kind)
      .reduce((s, t) => s + t.amount, 0);
    const categoryShare =
      workspaceTotal > 0
        ? Math.round((totalLifetime / workspaceTotal) * 100)
        : 0;

    // Averages
    const avgAmount =
      transactions.length > 0 ? totalLifetime / transactions.length : 0;
    const sortedByAmt = [...transactions].sort((a, b) => b.amount - a.amount);
    const largestTx = sortedByAmt[0] || null;
    const smallestTx = sortedByAmt[sortedByAmt.length - 1] || null;

    // Spend distribution by account
    const byAccountMap = new Map<string, { account: AccountDTO; total: number; count: number }>();
    for (const t of transactions) {
      if (!t.accountId) continue;
      const acc = accounts.find((a) => a.id === t.accountId);
      if (!acc) continue;
      const item = byAccountMap.get(acc.id) ?? { account: acc, total: 0, count: 0 };
      item.total += t.amount;
      item.count += 1;
      byAccountMap.set(acc.id, item);
    }
    const accountBreakdown = [...byAccountMap.values()].sort((a, b) => b.total - a.total);

    // Top merchants / notes
    const merchantMap = new Map<string, { name: string; total: number; count: number }>();
    for (const t of transactions) {
      const label = t.note.trim() || "Unlabeled";
      const item = merchantMap.get(label) ?? { name: label, total: 0, count: 0 };
      item.total += t.amount;
      item.count += 1;
      merchantMap.set(label, item);
    }
    const topMerchants = [...merchantMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // 6-Month Trend Data
    const monthlyTrend: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const mKey = format(d, "yyyy-MM");
      const mLabel = format(d, "MMM");
      const mTotal = transactions
        .filter((t) => t.date.startsWith(mKey))
        .reduce((s, t) => s + t.amount, 0);
      monthlyTrend.push({ label: mLabel, total: mTotal });
    }
    const maxMonthlySpend = Math.max(...monthlyTrend.map((m) => m.total), 1);

    return {
      totalLifetime,
      curMonthTotal,
      prevMonthTotal,
      momDelta,
      categoryShare,
      avgAmount,
      largestTx,
      smallestTx,
      accountBreakdown,
      topMerchants,
      monthlyTrend,
      maxMonthlySpend,
      isExpense,
    };
  }, [transactions, allTransactions, accounts, category.kind]);

  // --- Filtering Logic for All Possible Filters ---
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // 1. Text Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => {
        const noteMatch = t.note.toLowerCase().includes(q);
        const accMatch = t.account?.name.toLowerCase().includes(q);
        const tagMatch = t.tags.some((tag) => tag.name.toLowerCase().includes(q));
        return noteMatch || accMatch || tagMatch;
      });
    }

    // 2. Type Filter
    if (selectedType !== "all") {
      result = result.filter((t) => t.type === selectedType);
    }

    // 3. Account Filter
    if (selectedAccountId !== "all") {
      result = result.filter((t) => t.accountId === selectedAccountId);
    }

    // 4. Tag Filter
    if (selectedTagId !== "all") {
      result = result.filter((t) => t.tags.some((tag) => tag.id === selectedTagId));
    }

    // 5. Date Filter
    const today = parseISO(todayISO());
    if (datePreset === "this_month") {
      const start = format(startOfMonth(today), "yyyy-MM-dd");
      const end = format(endOfMonth(today), "yyyy-MM-dd");
      result = result.filter((t) => t.date >= start && t.date <= end);
    } else if (datePreset === "last_month") {
      const prev = subMonths(today, 1);
      const start = format(startOfMonth(prev), "yyyy-MM-dd");
      const end = format(endOfMonth(prev), "yyyy-MM-dd");
      result = result.filter((t) => t.date >= start && t.date <= end);
    } else if (datePreset === "last_30") {
      const start = format(subDays(today, 30), "yyyy-MM-dd");
      const end = format(today, "yyyy-MM-dd");
      result = result.filter((t) => t.date >= start && t.date <= end);
    } else if (datePreset === "last_90") {
      const start = format(subDays(today, 90), "yyyy-MM-dd");
      const end = format(today, "yyyy-MM-dd");
      result = result.filter((t) => t.date >= start && t.date <= end);
    } else if (datePreset === "this_year") {
      const start = format(startOfYear(today), "yyyy-MM-dd");
      const end = format(endOfYear(today), "yyyy-MM-dd");
      result = result.filter((t) => t.date >= start && t.date <= end);
    } else if (datePreset === "last_year") {
      const prevYear = subMonths(today, 12);
      const start = format(startOfYear(prevYear), "yyyy-MM-dd");
      const end = format(endOfYear(prevYear), "yyyy-MM-dd");
      result = result.filter((t) => t.date >= start && t.date <= end);
    } else if (datePreset === "custom") {
      if (customFrom) result = result.filter((t) => t.date >= customFrom);
      if (customTo) result = result.filter((t) => t.date <= customTo);
    }

    // 6. Amount Tier Filter
    if (amountTier === "micro") {
      result = result.filter((t) => t.amount < 25);
    } else if (amountTier === "small") {
      result = result.filter((t) => t.amount >= 25 && t.amount <= 100);
    } else if (amountTier === "medium") {
      result = result.filter((t) => t.amount > 100 && t.amount <= 500);
    } else if (amountTier === "large") {
      result = result.filter((t) => t.amount > 500);
    }

    // Custom Min / Max Amount
    if (minAmount && !isNaN(Number(minAmount))) {
      result = result.filter((t) => t.amount >= Number(minAmount));
    }
    if (maxAmount && !isNaN(Number(maxAmount))) {
      result = result.filter((t) => t.amount <= Number(maxAmount));
    }

    // 7. Sorting
    result.sort((a, b) => {
      if (sortOption === "date_desc") return b.date.localeCompare(a.date);
      if (sortOption === "date_asc") return a.date.localeCompare(b.date);
      if (sortOption === "amount_desc") return b.amount - a.amount;
      if (sortOption === "amount_asc") return a.amount - b.amount;
      if (sortOption === "note_asc") return a.note.localeCompare(b.note);
      return 0;
    });

    return result;
  }, [
    transactions,
    search,
    selectedType,
    selectedAccountId,
    selectedTagId,
    datePreset,
    customFrom,
    customTo,
    amountTier,
    minAmount,
    maxAmount,
    sortOption,
  ]);

  const filteredTotal = useMemo(() => {
    return filteredTransactions.reduce((s, t) => s + t.amount, 0);
  }, [filteredTransactions]);

  const hasActiveFilters =
    search.trim() !== "" ||
    datePreset !== "all" ||
    selectedAccountId !== "all" ||
    selectedTagId !== "all" ||
    selectedType !== "all" ||
    amountTier !== "all" ||
    minAmount !== "" ||
    maxAmount !== "" ||
    sortOption !== "date_desc";

  function clearAllFilters() {
    setSearch("");
    setDatePreset("all");
    setCustomFrom("");
    setCustomTo("");
    setSelectedAccountId("all");
    setSelectedTagId("all");
    setSelectedType("all");
    setAmountTier("all");
    setMinAmount("");
    setMaxAmount("");
    setSortOption("date_desc");
  }

  // Export filtered transactions to CSV
  function exportCSV() {
    if (!filteredTransactions.length) {
      toast.error("No transactions to export");
      return;
    }
    const headers = ["Date", "Type", "Amount", "Note", "Account", "Tags"];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.type,
      t.amount,
      `"${(t.note || "").replace(/"/g, '""')}"`,
      `"${(t.account?.name || "").replace(/"/g, '""')}"`,
      `"${t.tags.map((tg) => tg.name).join(", ")}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${category.name.toLowerCase().replace(/\s+/g, "-")}-transactions.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded");
  }

  function handleSaveCategory() {
    if (!editName.trim()) return;
    startTransition(async () => {
      const res = await updateCategory(category.id, {
        name: editName,
        icon: editIcon,
        color: editColor,
      });
      if (res.ok) {
        toast.success("Category updated");
        setEditOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. Category Header Card */}
      <section className="dashboard-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-xl"
              style={{
                backgroundColor: `${category.color}15`,
                color: category.color,
              }}
            >
              <Icon name={category.icon} size={24} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ">
                  {category.kind} category
                </span>
                <span className="text-xs text-muted-foreground">
                  {transactions.length} entries
                </span>
              </div>
              <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-foreground">
                {category.name}
              </h1>
            </div>
          </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <>
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-border/80 text-xs font-semibold gap-1.5 shadow-2xs hover:bg-muted/60"
                        />
                      }
                    >
                      <Pencil className="size-3.5" />
                      Edit category
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold">
                          Edit category
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                          <IconPicker
                            value={editIcon}
                            color={editColor}
                            onChange={setEditIcon}
                          />
                          <Input
                            aria-label="Category name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Category name"
                            className="h-10 rounded-xl"
                          />
                        </div>
                        <ColorPicker value={editColor} onChange={setEditColor} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={pending || !editName.trim()}
                          onClick={handleSaveCategory}
                          className="rounded-xl bg-brand font-semibold text-brand-foreground"
                        >
                          Save changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <TransactionDialog
                    accounts={accounts}
                    categories={categories}
                    defaultCategoryId={category.id}
                    defaultType={category.kind}
                    trigger={
                      <Button
                        size="sm"
                        className="rounded-xl bg-brand font-medium text-brand-foreground hover:bg-brand/90 gap-1.5"
                      >
                        <Plus className="size-3.5" />
                        Add in {category.name}
                      </Button>
                    }
                  />
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="rounded-xl border-border/80 text-xs font-semibold gap-1.5 shadow-2xs hover:bg-muted/60"
                title="Export filtered transactions to CSV"
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </div>
        </div>
      </section>

      {/* 2. Primary Financial Calculations Metric Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Filtered / Total Volume */}
        <div className="dashboard-panel p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold  text-muted-foreground">
              {hasActiveFilters ? "Filtered total" : "All-time total"}
            </span>
            <p
              className={cn(
                "amount mt-2 truncate text-xl font-bold tracking-tight sm:text-2xl",
                category.kind === "income" ? "text-positive" : "text-negative",
              )}
            >
              {money(hasActiveFilters ? filteredTotal : lifetimeStats.totalLifetime)}
            </p>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground border-t border-border/60 pt-2 flex items-center justify-between">
            <span>
              {filteredTransactions.length} transaction
              {filteredTransactions.length === 1 ? "" : "s"}
            </span>
            {hasActiveFilters && (
              <span className="font-semibold text-foreground">
                of {money(lifetimeStats.totalLifetime)}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Current Month Volume & MoM Delta */}
        <div className="dashboard-panel p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold  text-muted-foreground">
              This month
            </span>
            <p className="amount mt-2 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {money(lifetimeStats.curMonthTotal)}
            </p>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Prior: {money(lifetimeStats.prevMonthTotal)}</span>
            {lifetimeStats.momDelta !== null && (
              <span
                className={cn(
                  "font-bold text-[10px] px-1.5 py-0.5 rounded",
                  lifetimeStats.momDelta <= 0
                    ? "bg-positive/10 text-positive"
                    : "bg-negative/10 text-negative",
                )}
              >
                {lifetimeStats.momDelta > 0 ? "+" : ""}
                {lifetimeStats.momDelta}%
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Average Ticket Size & Category Share */}
        <div className="dashboard-panel p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold  text-muted-foreground">
              Average transaction
            </span>
            <p className="amount mt-2 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {money(lifetimeStats.avgAmount)}
            </p>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Share of spend</span>
            <span className="font-semibold text-foreground">
              {lifetimeStats.categoryShare}% of total
            </span>
          </div>
        </div>

        {/* Card 4: Largest Single Transaction */}
        <div className="dashboard-panel p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold  text-muted-foreground">
              Largest transaction
            </span>
            <p className="amount mt-2 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {lifetimeStats.largestTx
                ? money(lifetimeStats.largestTx.amount)
                : "—"}
            </p>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground border-t border-border/60 pt-2 truncate">
            {lifetimeStats.largestTx
              ? `${lifetimeStats.largestTx.note || "Transaction"} · ${lifetimeStats.largestTx.date}`
              : "No transactions yet"}
          </div>
        </div>
      </section>

      {/* 3. Budget Status & 6-Month Trajectory Grid */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Budget Meter */}
        <div className="dashboard-panel p-4 sm:p-5 space-y-4">
            {categoryBudget ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Monthly budget
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Limit: {money(categoryBudget.budget)} / month
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      categoryBudget.spent >= categoryBudget.budget
                        ? "bg-negative/15 text-negative"
                        : categoryBudget.spent / categoryBudget.budget >= 0.8
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-positive/15 text-positive",
                    )}
                  >
                    {Math.round((categoryBudget.spent / categoryBudget.budget) * 100)}% Used
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      categoryBudget.spent >= categoryBudget.budget
                        ? "bg-negative"
                        : categoryBudget.spent / categoryBudget.budget >= 0.8
                          ? "bg-amber-500"
                          : "bg-positive",
                    )}
                    style={{
                      width: `${Math.min(100, Math.round((categoryBudget.spent / categoryBudget.budget) * 100))}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pt-1">
                  <span>Spent so far: {money(categoryBudget.spent)}</span>
                  <span>
                    {categoryBudget.budget >= categoryBudget.spent
                      ? `${money(categoryBudget.budget - categoryBudget.spent)} remaining`
                      : `Over by ${money(categoryBudget.spent - categoryBudget.budget)}`}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                <CircleAlert className="size-5 text-muted-foreground/60" />
                <h3 className="text-sm font-semibold text-foreground">No budget set</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Assign a monthly target in Planning to track your category spending.
                </p>
              </div>
            )}
        </div>

        {/* Six-month trend Bars */}
        <div className="dashboard-panel p-4 sm:p-5 space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Six-month trend
              </h3>
              <span className="text-xs text-muted-foreground">Monthly volume</span>
            </div>
            <div className="flex items-end justify-between gap-2 h-24 pt-4">
              {lifetimeStats.monthlyTrend.map((m) => {
                const heightPct = Math.max(
                  8,
                  Math.round((m.total / lifetimeStats.maxMonthlySpend) * 100),
                );
                return (
                  <div
                    key={m.label}
                    className="group flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                  >
                    <span className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-full">
                      {money(m.total)}
                    </span>
                    <div
                      className="w-full rounded-t-md transition-all duration-300 group-hover:brightness-110"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: category.color,
                        opacity: m.total > 0 ? 0.9 : 0.2,
                      }}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
        </div>
      </section>

      {/* 4. Accounts & Top Merchants Breakdown */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Spend by Account */}
        <div className="dashboard-panel p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Spending by account
            </h3>
            {lifetimeStats.accountBreakdown.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No account activity recorded.
              </p>
            ) : (
              <ul className="space-y-3">
                {lifetimeStats.accountBreakdown.map((item) => {
                  const pct = Math.round(
                    (item.total / (lifetimeStats.totalLifetime || 1)) * 100,
                  );
                  return (
                    <li key={item.account.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="grid size-6 place-items-center rounded-lg shadow-2xs"
                            style={{
                              backgroundColor: `${item.account.color}20`,
                              color: item.account.color,
                            }}
                          >
                            <Icon name={item.account.icon} size={13} />
                          </span>
                          <span className="font-semibold text-foreground">
                            {item.account.name}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            ({item.count}×)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[10px]">
                            {pct}%
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {money(item.total)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: item.account.color,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>

        {/* Top Merchants / Notes */}
        <div className="dashboard-panel p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Frequent descriptions
            </h3>
            {lifetimeStats.topMerchants.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No descriptions recorded.
              </p>
            ) : (
              <ul className="space-y-2">
                {lifetimeStats.topMerchants.map((m, idx) => {
                  const pct = Math.round(
                    (m.total / (lifetimeStats.totalLifetime || 1)) * 100,
                  );
                  return (
                    <li
                      key={m.name}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-foreground truncate">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          ({m.count}×)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {pct}%
                        </span>
                        <span className="font-bold text-foreground font-mono">
                          {money(m.total)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      </section>

      {/* 5. Comprehensive Filtering Engine */}
      <section className="dashboard-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Category activity</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {filteredTransactions.length} of {transactions.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Filter by date, amount, account, tags, or description.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className={cn(
                  "rounded-xl gap-1.5 text-xs font-semibold shadow-2xs hover:bg-muted/60",
                  showFilters && "bg-muted border-foreground/30",
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>{showFilters ? "Hide filters" : "Filters"}</span>
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="rounded-xl text-xs font-semibold text-negative hover:bg-negative/10"
                >
                  Reset All
                </Button>
              )}
            </div>
          </div>

          {/* Search Bar & Quick Filters */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, account, or tags…"
                aria-label="Search category transactions"
                className="h-10 pl-9 rounded-xl bg-background border-border/80 text-xs shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Date Range Select */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
              {(
                [
                  ["all", "All Time"],
                  ["this_month", "This month"],
                  ["last_month", "Last Month"],
                  ["last_30", "30 Days"],
                  ["this_year", "This Year"],
                  ["custom", "Custom"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDatePreset(key)}
                  aria-pressed={datePreset === key}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors border shadow-2xs",
                    datePreset === key
                      ? "bg-foreground text-background font-bold border-foreground"
                      : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Expanded Filters Drawer */}
          {showFilters && (
            <div className="space-y-4 pt-3 border-t border-border/60">
              {/* Custom Date Range if active */}
              {datePreset === "custom" && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/60">
                  <span className="text-xs font-semibold text-foreground">
                    Custom Dates:
                  </span>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 w-36 text-xs rounded-lg"
                    aria-label="Start Date"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 w-36 text-xs rounded-lg"
                    aria-label="End Date"
                  />
                </div>
              )}

              {/* Account & Tag & Type Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Account Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Account Filter
                  </label>
                  <select
                    aria-label="Filter by account"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-xs text-foreground focus:ring-1 focus:ring-brand shadow-2xs"
                  >
                    <option value="all">All Accounts ({accounts.length})</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tag Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Tag Filter
                  </label>
                  <select
                    aria-label="Filter by tag"
                    value={selectedTagId}
                    onChange={(e) => setSelectedTagId(e.target.value)}
                    className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-xs text-foreground focus:ring-1 focus:ring-brand shadow-2xs"
                  >
                    <option value="all">All Tags ({tags.length})</option>
                    {tags.map((tg) => (
                      <option key={tg.id} value={tg.id}>
                        {tg.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Sort Order
                  </label>
                  <select
                    aria-label="Sort category transactions"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-xs text-foreground focus:ring-1 focus:ring-brand shadow-2xs"
                  >
                    <option value="date_desc">Date: Newest First</option>
                    <option value="date_asc">Date: Oldest First</option>
                    <option value="amount_desc">Amount: Highest First</option>
                    <option value="amount_asc">Amount: Lowest First</option>
                    <option value="note_asc">Description: A to Z</option>
                  </select>
                </div>
              </div>

              {/* Amount Tiers & Custom Range */}
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">
                  Amount Tier & Bounds
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["all", "All Amounts"],
                      ["micro", `< ${money(25)}`],
                      ["small", `${money(25)} – ${money(100)}`],
                      ["medium", `${money(100)} – ${money(500)}`],
                      ["large", `> ${money(500)}`],
                    ] as const
                  ).map(([tier, label]) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setAmountTier(tier)}
                      aria-pressed={amountTier === tier}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors shadow-2xs",
                        amountTier === tier
                          ? "bg-foreground text-background font-bold border-foreground"
                          : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <Input
                      type="number"
                      placeholder="Min"
                      aria-label="Minimum amount"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="h-8 w-20 text-xs rounded-lg shadow-2xs"
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      aria-label="Maximum amount"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="h-8 w-20 text-xs rounded-lg shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Filter Chips Pillbox */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50 text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Active Filters:
              </span>
              {search && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                  Search: &ldquo;{search}&rdquo;
                  <button type="button" onClick={() => setSearch("")}>
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              )}
              {datePreset !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                  Date: {datePreset.replace("_", " ")}
                  <button type="button" onClick={() => setDatePreset("all")}>
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              )}
              {selectedAccountId !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                  Account: {accounts.find((a) => a.id === selectedAccountId)?.name}
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId("all")}
                  >
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              )}
              {selectedTagId !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                  Tag: {tags.find((tg) => tg.id === selectedTagId)?.name}
                  <button type="button" onClick={() => setSelectedTagId("all")}>
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              )}
              {amountTier !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                  Tier: {amountTier}
                  <button type="button" onClick={() => setAmountTier("all")}>
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              )}
              {(minAmount || maxAmount) && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                  Range: ${minAmount || "0"} - ${maxAmount || "∞"}
                  <button
                    type="button"
                    onClick={() => {
                      setMinAmount("");
                      setMaxAmount("");
                    }}
                  >
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-bold text-brand hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
      </section>

      {/* 6. Filtered Transactions List */}
      <section className="dashboard-panel p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
            <span className="text-xs font-semibold  text-muted-foreground">
              Transactions
            </span>
            <span className="amount text-xs font-semibold text-foreground font-mono">
              Filtered total: {money(filteredTotal)}
            </span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">
                No transactions match the selected filters.
              </p>
              <p className="text-xs text-muted-foreground">
                Try adjusting or clearing your active filters to see all entries.
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="rounded-xl mt-2 text-xs shadow-2xs hover:bg-muted/60"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <TransactionRows
              transactions={filteredTransactions}
              accounts={accounts}
              categories={categories}
              canEdit={canEdit}
              emptyMessage="No transactions found."
            />
          )}
      </section>
    </div>
  );
}
