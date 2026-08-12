// Shared maths for recurring rules — used by both the Subscriptions manager and
// the Insights commitments view so the two can never disagree about what your
// monthly commitment is.

import type { RecurringDTO } from "./queries";

export const COMMITMENT_KINDS = ["subscription", "bill", "emi", "other"] as const;
export type CommitmentKind = (typeof COMMITMENT_KINDS)[number];

export const COMMITMENT_LABELS: Record<CommitmentKind, string> = {
  subscription: "Subscriptions",
  bill: "Bills",
  emi: "EMIs & installments",
  other: "Other recurring",
};

/** Normalise any cadence to a monthly figure. Unknown cadences fall back to
 *  monthly, matching how the scheduler advances an unrecognised frequency. */
export const perMonth = (amount: number, frequency: string): number =>
  frequency === "weekly" ? (amount * 52) / 12 : frequency === "yearly" ? amount / 12 : amount;

/** A rule still generates charges: it hasn't passed its end date and hasn't
 *  used up its repeat count. Mirrors the stop conditions in `materialize()`. */
export function isActive(r: RecurringDTO, today: string): boolean {
  if (r.endDate && r.endDate < today) return false;
  if (r.maxOccurrences != null && r.occurrenceCount >= r.maxOccurrences) return false;
  return true;
}

export const kindOf = (r: RecurringDTO): CommitmentKind =>
  (COMMITMENT_KINDS as readonly string[]).includes(r.commitmentType) ? (r.commitmentType as CommitmentKind) : "other";

export type PriceChange = { original: number; current: number; changes: number; pct: number };

/** Price drift for a rule, or null when it has never been repriced.
 *  `priceHistory[0]` is the amount the rule started at (seeded on create, or
 *  backfilled from the old amount the first time the price changed). */
export function priceChange(r: RecurringDTO): PriceChange | null {
  const h = r.priceHistory;
  if (!h || h.length < 2) return null;
  const original = h[0].amount;
  if (!original) return null;
  return {
    original,
    current: r.amount,
    changes: h.length - 1,
    pct: Math.round(((r.amount - original) / Math.abs(original)) * 100),
  };
}

export type CommitmentTotals = {
  active: RecurringDTO[];
  expenses: RecurringDTO[];
  incomes: RecurringDTO[];
  monthly: number;
  yearly: number;
  monthlyIncome: number;
  /** Monthly expense commitment split by kind, in COMMITMENT_KINDS order. */
  byKind: { kind: CommitmentKind; label: string; monthly: number; rules: RecurringDTO[] }[];
  /** Rules whose amount is a reminder-to-log estimate rather than a fixed charge. */
  estimated: RecurringDTO[];
};

export function commitmentTotals(rules: RecurringDTO[], today: string): CommitmentTotals {
  const active = rules.filter((r) => isActive(r, today));
  const expenses = active.filter((r) => r.type === "expense");
  const incomes = active.filter((r) => r.type === "income");
  const monthly = expenses.reduce((s, r) => s + perMonth(r.amount, r.frequency), 0);

  return {
    active,
    expenses,
    incomes,
    monthly,
    yearly: monthly * 12,
    monthlyIncome: incomes.reduce((s, r) => s + perMonth(r.amount, r.frequency), 0),
    byKind: COMMITMENT_KINDS.map((kind) => {
      const rulesOfKind = expenses.filter((r) => kindOf(r) === kind);
      return {
        kind,
        label: COMMITMENT_LABELS[kind],
        monthly: rulesOfKind.reduce((s, r) => s + perMonth(r.amount, r.frequency), 0),
        rules: rulesOfKind,
      };
    }).filter((g) => g.rules.length > 0),
    estimated: expenses.filter((r) => !r.autoPost),
  };
}
