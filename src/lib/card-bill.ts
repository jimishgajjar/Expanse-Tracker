/** Expense categories that look like a lump-sum card bill rather than real spending. */
export const CARD_BILL_PATTERN = /credit\s*card|card\s*(bill|payment)|\bcc\s*(bill|payment)\b/i;

type Category = { id: string; name: string; kind: string };
type Entry = { type: string; amount: number; categoryId: string | null };

/**
 * How much of the period's spending sits in card-bill categories. Returns null when
 * there is nothing worth flagging (no such category, no entries, or under 10%).
 */
export function cardBillShare(categories: Category[], transactions: Entry[]) {
  const billIds = new Set(categories.filter((c) => c.kind === "expense" && CARD_BILL_PATTERN.test(c.name)).map((c) => c.id));
  if (!billIds.size) return null;
  const expenses = transactions.filter((t) => t.type === "expense");
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const bills = expenses.filter((t) => t.categoryId !== null && billIds.has(t.categoryId));
  const billTotal = bills.reduce((s, t) => s + t.amount, 0);
  const share = total > 0 ? Math.round((billTotal / total) * 100) : 0;
  if (!bills.length || share < 10) return null;
  const name = categories.find((c) => billIds.has(c.id))?.name ?? "Credit card bill";
  return { share, billTotal, name };
}
