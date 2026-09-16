import { describe, expect, it } from "vitest";
import { mergeActivity } from "../activity";
import {
  activityFilterError,
  DEFAULT_ACTIVITY_FILTERS,
  filterDetailActivity,
  type ActivityFilters,
} from "../detail-activity";
import type { AccountDTO, TransactionDTO, TransferDTO } from "../queries";

const tx = (id: string, patch: Partial<TransactionDTO>): TransactionDTO => ({
  id,
  type: "expense",
  amount: 20,
  date: "2026-09-02",
  note: "Lunch",
  accountId: "bank",
  categoryId: "food",
  account: { name: "Checking", icon: "wallet", color: "green" },
  category: { name: "Food", icon: "utensils", color: "green" },
  createdByName: null,
  tags: [{ id: "work", name: "Work", color: "green" }],
  ...patch,
});
const transactions = [
  tx("expense", {}),
  tx("income", {
    type: "income",
    amount: 100,
    date: "2026-09-01",
    categoryId: null,
    category: null,
  }),
  tx("other", { accountId: "cash", amount: 999 }),
  tx("small", { amount: 5, date: "2026-09-01" }),
];
const transfers: TransferDTO[] = [
  {
    id: "out",
    amount: 30,
    date: "2026-09-03",
    note: "Reserve",
    fromAccountId: "bank",
    toAccountId: "cash",
  },
  {
    id: "in",
    amount: 40,
    date: "2026-09-02",
    note: "Return",
    fromAccountId: "cash",
    toAccountId: "bank",
  },
  {
    id: "unrelated",
    amount: 9,
    date: "2026-09-02",
    note: "",
    fromAccountId: "third",
    toAccountId: "fourth",
  },
];
const accounts = [
  { id: "bank", name: "Checking" },
  { id: "cash", name: "Cash" },
] as AccountDTO[];
const entries = mergeActivity(transactions, transfers);
const run = (
  patch: Partial<ActivityFilters> = {},
  scope: string | undefined = "bank",
) =>
  filterDetailActivity(
    entries,
    { ...DEFAULT_ACTIVITY_FILTERS, ...patch },
    accounts,
    scope,
  ).map((e) => e.item.id);

describe("detail activity filters", () => {
  it("keeps account scope for transactions and either side of transfers", () => {
    expect(run()).toEqual(["out", "expense", "in", "income", "small"]);
  });
  it("separates income, expenses and transfers", () => {
    expect(run({ type: "income" })).toEqual(["income"]);
    expect(run({ type: "expense" })).toEqual(["expense", "small"]);
    expect(run({ type: "transfer" })).toEqual(["out", "in"]);
  });
  it("combines inclusive dates, amounts, category and tag search", () => {
    expect(
      run({
        from: "2026-09-02",
        to: "2026-09-02",
        min: "20",
        max: "20",
        category: "food",
        search: "work",
      }),
    ).toEqual(["expense"]);
  });
  it("finds uncategorized transactions without including transfers", () => {
    expect(run({ category: "uncategorized" })).toEqual(["income"]);
  });
  it("filters incoming and outgoing transfers and searches account names", () => {
    expect(run({ direction: "in", search: "cash" })).toEqual(["in"]);
    expect(run({ direction: "out" })).toEqual(["out"]);
  });
  it("sorts amounts across dates without mutating original entries", () => {
    const before = entries.map((e) => e.item.id);
    expect(run({ sort: "highest" })).toEqual([
      "income",
      "in",
      "out",
      "expense",
      "small",
    ]);
    expect(run({ sort: "lowest" })).toEqual([
      "small",
      "expense",
      "out",
      "in",
      "income",
    ]);
    expect(entries.map((e) => e.item.id)).toEqual(before);
  });
  it("supports oldest first and account selection on category or tag pages", () => {
    expect(run({ sort: "oldest" })).toEqual([
      "income",
      "small",
      "expense",
      "in",
      "out",
    ]);
    expect(
      filterDetailActivity(
        entries,
        { ...DEFAULT_ACTIVITY_FILTERS, account: "cash", type: "expense" },
        accounts,
      ).map((e) => e.item.id),
    ).toEqual(["other"]);
  });
  it("rejects reversed or invalid ranges and returns no misleading results", () => {
    for (const patch of [
      { from: "2026-10-01", to: "2026-09-01" },
      { min: "30", max: "20" },
      { min: "-1" },
      { max: "NaN" },
    ]) {
      expect(
        activityFilterError({ ...DEFAULT_ACTIVITY_FILTERS, ...patch }),
      ).toBeTruthy();
      expect(run(patch)).toEqual([]);
    }
  });
});
