"use server";

import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { getActiveWorkspaceId } from "./workspace";
import { getCurrentUser } from "./session";

export type BudgetSuggestion = {
  categoryId: string;
  /** Average monthly spending across the months looked at. */
  average: number;
  /** The average rounded up to a tidy limit. */
  suggested: number;
  /** Highest single month in the window. */
  peak: number;
  months: number;
};

/** Round up to a figure people would actually type as a limit. */
function tidyLimit(value: number): number {
  if (value <= 0) return 0;
  const step = value >= 5000 ? 100 : value >= 1000 ? 50 : value >= 100 ? 10 : 5;
  return Math.ceil(value / step) * step;
}

/**
 * Suggested monthly limits per expense category, from the last three complete months
 * of this tracker's expenses. Read-only: nothing is saved until the person presses Save.
 */
export async function budgetSuggestions(): Promise<BudgetSuggestion[]> {
  const [workspace, user] = await Promise.all([getActiveWorkspaceId(), getCurrentUser()]);
  if (!workspace || !user) return [];
  const db = await getDb();
  const result = await db.execute(sql`
    WITH bounds AS (
      SELECT (date_trunc('month', current_date) - interval '3 months')::date AS start,
             date_trunc('month', current_date)::date AS stop
    ), monthly AS (
      SELECT t.category_id, date_trunc('month', t.date) AS month, sum(t.amount) AS spent
      FROM transactions t, bounds b
      WHERE t.workspace_id = ${workspace} AND t.type = 'expense' AND t.category_id IS NOT NULL
        AND t.date >= b.start AND t.date < b.stop
      GROUP BY t.category_id, date_trunc('month', t.date)
    )
    SELECT category_id AS "categoryId", (sum(spent) / 3)::float8 AS average, max(spent)::float8 AS peak, count(*)::int AS months
    FROM monthly
    WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ${workspace} AND user_id = ${user.id})
    GROUP BY category_id
    ORDER BY average DESC`);
  const rows = result.rows as { categoryId: string; average: number; peak: number; months: number }[];
  return rows.map((r) => ({
    categoryId: r.categoryId,
    average: Number(r.average),
    peak: Number(r.peak),
    months: Number(r.months),
    suggested: tidyLimit(Number(r.average)),
  }));
}
