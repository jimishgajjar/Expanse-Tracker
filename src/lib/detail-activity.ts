import type { ActivityEntry } from "./activity";
import type { AccountDTO } from "./queries";

export type ActivityFilters = {
  type: "all" | "income" | "expense" | "transfer";
  search: string;
  account: string;
  category: string;
  from: string;
  to: string;
  min: string;
  max: string;
  direction: "all" | "in" | "out";
  sort: "newest" | "oldest" | "highest" | "lowest";
};

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  type: "all",
  search: "",
  account: "all",
  category: "all",
  from: "",
  to: "",
  min: "",
  max: "",
  direction: "all",
  sort: "newest",
};

export function activityFilterError(f: ActivityFilters): string | null {
  if (f.from && f.to && f.from > f.to)
    return "Start date must be on or before the end date.";
  if (
    [f.min, f.max].some(
      (v) => v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0),
    )
  )
    return "Amounts must be zero or greater.";
  if (f.min !== "" && f.max !== "" && Number(f.min) > Number(f.max))
    return "Minimum amount must not exceed the maximum.";
  return null;
}

export function filterDetailActivity(
  entries: ActivityEntry[],
  f: ActivityFilters,
  accounts: AccountDTO[],
  accountId?: string,
): ActivityEntry[] {
  if (activityFilterError(f)) return [];
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const query = f.search.trim().toLowerCase();
  return entries
    .filter((e) => {
      const t = e.item;
      const touches = (id: string) =>
        e.kind === "transaction"
          ? e.item.accountId === id
          : e.item.fromAccountId === id || e.item.toAccountId === id;
      if (accountId && !touches(accountId)) return false;
      if (f.account !== "all" && !touches(f.account)) return false;
      if (
        f.type !== "all" &&
        (e.kind === "transfer" ? "transfer" : e.item.type) !== f.type
      )
        return false;
      if (
        f.category !== "all" &&
        (e.kind === "transfer" ||
          (e.item.categoryId ?? "uncategorized") !== f.category)
      )
        return false;
      if (
        accountId &&
        f.direction !== "all" &&
        (e.kind !== "transfer" ||
          (f.direction === "in" ? e.item.toAccountId : e.item.fromAccountId) !==
            accountId)
      )
        return false;
      if ((f.from && t.date < f.from) || (f.to && t.date > f.to)) return false;
      if (
        (f.min !== "" && t.amount < Number(f.min)) ||
        (f.max !== "" && t.amount > Number(f.max))
      )
        return false;
      const searchable =
        e.kind === "transaction"
          ? `${t.note} ${e.item.category?.name ?? ""} ${e.item.account?.name ?? ""} ${e.item.tags.map((tag) => tag.name).join(" ")}`
          : `${t.note} transfer ${names.get(e.item.fromAccountId) ?? ""} ${names.get(e.item.toAccountId) ?? ""}`;
      return searchable.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const byDate = b.item.date.localeCompare(a.item.date);
      const primary =
        f.sort === "highest"
          ? b.item.amount - a.item.amount
          : f.sort === "lowest"
            ? a.item.amount - b.item.amount
            : f.sort === "oldest"
              ? -byDate
              : byDate;
      return primary || byDate || a.item.id.localeCompare(b.item.id);
    });
}
