/** A blank value is an explicit removal; invalid values must never remove data. */
export function parseBudgetInput(
  value: string,
): { ok: true; amount: number | null } | { ok: false; error: string } {
  if (!value.trim()) return { ok: true, amount: null };
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0)
    return {
      ok: false,
      error:
        "Enter an amount greater than zero, or clear the field to remove the limit.",
    };
  return { ok: true, amount };
}
