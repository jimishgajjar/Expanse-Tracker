import type { TransactionDTO, TransferDTO } from "./queries";

export type ActivityEntry =
  | { kind: "transaction"; item: TransactionDTO }
  | { kind: "transfer"; item: TransferDTO };

/** A transfer participates in activity pagination, never in income/spending totals. */
export function mergeActivity(
  transactions: TransactionDTO[],
  transfers: TransferDTO[],
): ActivityEntry[] {
  return [
    ...transactions.map((item): ActivityEntry => ({
      kind: "transaction",
      item,
    })),
    ...transfers.map((item): ActivityEntry => ({ kind: "transfer", item })),
  ].sort(
    (a, b) =>
      b.item.date.localeCompare(a.item.date) ||
      a.item.id.localeCompare(b.item.id),
  );
}
