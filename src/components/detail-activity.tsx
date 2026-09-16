"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { FilterChips, type FilterChip } from "./filter-chips";
import { DATE_PRESETS, presetDates } from "@/lib/date-presets";
import { todayISO } from "@/lib/dates";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  ActivityRows,
  TransactionRows,
  TransferRows,
} from "./transactions-list";
import { useFormat } from "./settings-provider";
import { mergeActivity } from "@/lib/activity";
import {
  activityFilterError,
  DEFAULT_ACTIVITY_FILTERS,
  filterDetailActivity,
  type ActivityFilters,
} from "@/lib/detail-activity";
import { cn } from "@/lib/utils";
import type {
  AccountDTO,
  CategoryDTO,
  TransactionDTO,
  TransferDTO,
} from "@/lib/queries";

const NO_TRANSFERS: TransferDTO[] = [];
export function DetailActivity({
  transactions,
  transfers = NO_TRANSFERS,
  accounts,
  categories,
  accountId,
  hideCategory = false,
  canEdit,
  action,
}: {
  transactions: TransactionDTO[];
  transfers?: TransferDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  accountId?: string;
  hideCategory?: boolean;
  canEdit: boolean;
  action?: ReactNode;
}) {
  const id = useId();
  const { money } = useFormat();
  const [filters, setFilters] = useState<ActivityFilters>({
    ...DEFAULT_ACTIVITY_FILTERS,
  });
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  function update(patch: Partial<ActivityFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }
  function clear() {
    setFilters({ ...DEFAULT_ACTIVITY_FILTERS });
    setPage(1);
  }
  const entries = useMemo(
    () => mergeActivity(transactions, transfers),
    [transactions, transfers],
  );
  const filtered = useMemo(
    () => filterDetailActivity(entries, filters, accounts, accountId),
    [entries, filters, accounts, accountId],
  );
  const error = activityFilterError(filters);
  const active = Object.entries(filters).some(
    ([key, value]) =>
      value !== DEFAULT_ACTIVITY_FILTERS[key as keyof ActivityFilters],
  );
  const extraCount = [
    filters.from,
    filters.to,
    filters.min,
    filters.max,
    filters.direction !== "all",
  ].filter(Boolean).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const shown = filtered.slice(start, start + pageSize);
  const totals = filtered.reduce(
    (sum, e) => {
      if (e.kind === "transaction") sum[e.item.type] += e.item.amount;
      return sum;
    },
    { income: 0, expense: 0 },
  );
  const types = [
    { value: "all", label: accountId ? "All activity" : "All" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expenses" },
    ...(accountId ? [{ value: "transfer", label: "Transfers" }] : []),
  ];
  const chips: FilterChip[] = [];
  if (filters.type !== "all")
    chips.push({
      key: "type",
      label:
        filters.type === "income"
          ? "Income"
          : filters.type === "expense"
            ? "Expenses"
            : "Transfers",
      onRemove: () => update({ type: "all", direction: "all" }),
    });
  if (filters.account !== "all")
    chips.push({
      key: "account",
      label: accounts.find((a) => a.id === filters.account)?.name ?? "Account",
      onRemove: () => update({ account: "all" }),
    });
  if (filters.category !== "all")
    chips.push({
      key: "category",
      label:
        categories.find((c) => c.id === filters.category)?.name ??
        "Uncategorized",
      onRemove: () => update({ category: "all" }),
    });
  if (filters.search.trim())
    chips.push({
      key: "search",
      label: `Search: ${filters.search.trim()}`,
      onRemove: () => update({ search: "" }),
    });
  if (filters.from || filters.to)
    chips.push({
      key: "dates",
      label: `${filters.from || "Any start"} to ${filters.to || "Any end"}`,
      onRemove: () => update({ from: "", to: "" }),
    });
  if (filters.min)
    chips.push({
      key: "min",
      label: `At least ${money(Number(filters.min))}`,
      onRemove: () => update({ min: "" }),
    });
  if (filters.max)
    chips.push({
      key: "max",
      label: `Up to ${money(Number(filters.max))}`,
      onRemove: () => update({ max: "" }),
    });
  if (filters.direction !== "all")
    chips.push({
      key: "direction",
      label: filters.direction === "in" ? "Transfers in" : "Transfers out",
      onRemove: () => update({ direction: "all" }),
    });
  if (filters.sort !== "newest")
    chips.push({
      key: "sort",
      label: {
        oldest: "Oldest first",
        highest: "Highest amount",
        lowest: "Lowest amount",
      }[filters.sort],
      onRemove: () => update({ sort: "newest" }),
    });
  return (
    <section
      className="overflow-hidden rounded-xl border bg-card"
      aria-labelledby={`${id}-title`}
    >
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id={`${id}-title`} className="text-lg font-semibold">
              Activity
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Find a payment, follow your income, or review a period.
            </p>
          </div>
          {action}
        </div>
        <div
          className={cn(
            "grid gap-1 rounded-lg bg-muted/60 p-1 sm:flex sm:flex-wrap",
            accountId ? "grid-cols-2" : "grid-cols-3",
          )}
          role="group"
          aria-label="Activity type"
        >
          {types.map((type) => (
            <Button
              key={type.value}
              variant="ghost"
              aria-pressed={filters.type === type.value}
              onClick={() =>
                update({
                  type: type.value as ActivityFilters["type"],
                  direction: "all",
                  ...(type.value === "transfer" ? { category: "all" } : {}),
                })
              }
              className={cn(
                "min-h-11 flex-1 sm:flex-none",
                filters.type === type.value &&
                  "bg-card text-brand shadow-sm hover:bg-card",
              )}
            >
              {type.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-0 flex-1 sm:min-w-60">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search activity"
              placeholder="Search notes, categories, tags…"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              className="min-h-11 pl-9"
            />
          </div>
          {!accountId && (
            <FilterSelect
              label="Account"
              value={filters.account}
              onChange={(account) => update({ account })}
              options={[
                { value: "all", label: "All accounts" },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          )}
          {!hideCategory && (
            <FilterSelect
              label="Category"
              disabled={filters.type === "transfer"}
              value={filters.category}
              onChange={(category) => update({ category, direction: "all" })}
              options={[
                { value: "all", label: "All categories" },
                { value: "uncategorized", label: "Uncategorized" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}
          <Button
            variant="outline"
            className="min-h-11"
            aria-expanded={expanded}
            aria-controls={`${id}-filters`}
            onClick={() => setExpanded(!expanded)}
          >
            <SlidersHorizontal className="size-4" />
            More filters
            {extraCount > 0 && (
              <span className="rounded bg-brand/10 px-1.5 text-brand">
                {extraCount}
              </span>
            )}
          </Button>
        </div>
        <FilterChips chips={chips} onClear={clear} />
        {expanded && (
          <div
            id={`${id}-filters`}
            className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <div
              className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4"
              role="group"
              aria-label="Date presets"
            >
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => update(presetDates(preset.value, todayISO()))}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {(
              [
                { key: "from", label: "From date", type: "date" },
                { key: "to", label: "To date", type: "date" },
                { key: "min", label: "Minimum amount", type: "number" },
                { key: "max", label: "Maximum amount", type: "number" },
              ] as const
            ).map((field) => (
              <label
                key={field.key}
                className="grid min-w-0 gap-2 text-xs font-medium"
              >
                {field.label}
                <Input
                  type={field.type}
                  min={field.type === "number" ? 0 : undefined}
                  step={field.type === "number" ? "any" : undefined}
                  value={filters[field.key]}
                  onChange={(e) => update({ [field.key]: e.target.value })}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${id}-error` : undefined}
                  className="min-h-11 min-w-0"
                />
              </label>
            ))}
            {accountId && (
              <div className="grid gap-2 text-xs font-medium">
                <span>Transfer direction</span>
                <FilterSelect
                  label="Transfer direction"
                  value={filters.direction}
                  onChange={(direction) =>
                    update({
                      direction: direction as ActivityFilters["direction"],
                      ...(direction !== "all"
                        ? { type: "transfer", category: "all" }
                        : {}),
                    })
                  }
                  options={[
                    { value: "all", label: "Both directions" },
                    { value: "in", label: "Into this account" },
                    { value: "out", label: "Out of this account" },
                  ]}
                />
              </div>
            )}
          </div>
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" role="status">
            {filtered.length} of {entries.length} entries
            {active && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                className="ml-2 min-h-11 text-brand"
              >
                Clear filters
              </Button>
            )}
          </p>
          <FilterSelect
            label="Sort activity"
            value={filters.sort}
            onChange={(sort) =>
              update({ sort: sort as ActivityFilters["sort"] })
            }
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "highest", label: "Highest amount" },
              { value: "lowest", label: "Lowest amount" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-sm">
          <span className="text-muted-foreground">Filtered totals</span>
          <span>
            Income{" "}
            <strong className="amount ml-1 text-positive">
              {money(totals.income)}
            </strong>
          </span>
          <span>
            Expenses{" "}
            <strong className="amount ml-1 text-negative">
              {money(totals.expense)}
            </strong>
          </span>
          {accountId && (
            <span className="text-xs leading-5 text-muted-foreground">
              Transfers excluded
            </span>
          )}
        </div>
        {shown.length === 0 ? (
          <div className="py-10 text-center">
            <ArrowLeftRight className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">
              {error
                ? "Check your filter range"
                : active
                  ? "No matching activity"
                  : "No activity yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error
                ? "Adjust the dates or amounts above to see results."
                : active
                  ? "Try a wider date range or clear your filters."
                  : "Transactions will appear here when you add them."}
            </p>
            {active && !error && (
              <Button className="mt-4" variant="outline" onClick={clear}>
                Clear filters
              </Button>
            )}
          </div>
        ) : filters.sort === "highest" || filters.sort === "lowest" ? (
          <div className="space-y-4">
            {shown.map((e) =>
              e.kind === "transaction" ? (
                <TransactionRows
                  key={`transaction-${e.item.id}`}
                  transactions={[e.item]}

                  accounts={accounts}
                  categories={categories}
                  canEdit={canEdit}
                />
              ) : (
                <TransferRows
                  key={`transfer-${e.item.id}`}
                  transfers={[e.item]}
                  accounts={accounts}
                  canEdit={canEdit}
                />
              ),
            )}
          </div>
        ) : (
          <ActivityRows
            showAuthors={false}
            entries={shown}
            accounts={accounts}
            categories={categories}
            canEdit={canEdit}
          />
        )}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
            <FilterSelect
              label="Rows per page"
              value={String(pageSize)}
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
              options={[10, 25, 50, 100].map((n) => ({
                value: String(n),
                label: `${n} per page`,
              }))}
            />
            <div className="flex items-center gap-2">
              <span className="mr-2 text-xs text-muted-foreground">
                {start + 1}–{Math.min(start + pageSize, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <Button
                variant="outline"
                className="size-11"
                aria-label="Previous page"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-11"
                aria-label="Next page"
                disabled={current === pageCount}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      items={options}
      disabled={disabled}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger
        aria-label={label}
        className="min-h-11 w-full sm:w-auto sm:min-w-36"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DetailStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "amount mt-2 break-all text-lg font-semibold sm:text-xl",
          tone,
        )}
      >
        {value}
      </dd>
    </div>
  );
}
