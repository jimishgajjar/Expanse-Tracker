export type SplitEdge = { creditorId: string; debtorId: string; amount: number };

/**
 * Net balance with each other member from a list of unsettled IOUs.
 * Positive = they owe me; negative = I owe them. Members I have no open
 * balance with are omitted.
 */
export function computeBalances(meId: string, splits: SplitEdge[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const s of splits) {
    if (s.creditorId === meId) net.set(s.debtorId, (net.get(s.debtorId) ?? 0) + s.amount);
    else if (s.debtorId === meId) net.set(s.creditorId, (net.get(s.creditorId) ?? 0) - s.amount);
  }
  return net;
}
