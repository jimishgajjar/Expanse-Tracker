/** Compare in integer cents so floating point noise cannot create a discrepancy. */
export function statementComparison(initial: number, transactions: {date: string; type: string; amount: number}[], transfers: {date: string; amount: number; fromAccountId: string; toAccountId: string}[], accountId: string, through: string, statement: number) {
  const cents = (value: number) => Math.round(value * 100);
  let ledger = cents(initial);
  for (const t of transactions) if (t.date <= through) ledger += (t.type === "income" ? 1 : -1) * cents(t.amount);
  for (const t of transfers) if (t.date <= through) ledger += ((t.toAccountId === accountId ? 1 : 0) - (t.fromAccountId === accountId ? 1 : 0)) * cents(t.amount);
  const difference = cents(statement) - ledger;
  return { ledger: ledger / 100, difference: difference / 100, matched: difference === 0 };
}
