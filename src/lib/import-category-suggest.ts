import { sql } from "drizzle-orm";
import type { AppDb } from "./db";
import type { Entry } from "./file-import-model";

/**
 * A loose merchant key: the first two words of the description, letters only.
 * "WALMART #1234 TORONTO ON" and "Walmart 88 Toronto" both become "walmart toronto"…
 * and "Netflix.com" becomes "netflix com". Kept in sync with MERCHANT_KEY_SQL below.
 */
export function merchantKey(note: string): string {
  return note.toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").slice(0, 2).join(" ");
}
const MERCHANT_KEY_SQL = (column: ReturnType<typeof sql>) =>
  sql`array_to_string((string_to_array(trim(regexp_replace(lower(${column}),'[^a-z]+',' ','g')),' '))[1:2],' ')`;

/**
 * Fill in a category for import rows that have none, using how this household
 * categorised the same description before. An exact description match wins over a
 * merchant-key match; ties go to the most used, then most recent, category.
 * Only touches rows without errors and without a category from the file.
 */
export async function suggestCategories(db: AppDb, workspace: string, actor: string, rows: Entry[]) {
  const open = rows.filter((r) => !r.errors.length && !r.categoryId && r.note.trim().length >= 2);
  if (!open.length) return;
  const wanted = open.map((r) => ({
    line: r.line, type: r.type, exact: r.note.trim().toLowerCase(), key: merchantKey(r.note),
  }));
  const result = await db.execute(sql`
    WITH r AS (
      SELECT (x->>'line')::int AS line, x->>'type' AS type, x->>'exact' AS exact, x->>'key' AS key
      FROM jsonb_array_elements(${JSON.stringify(wanted)}::jsonb) x
    ), h AS (
      SELECT r.line, c.id, c.name, bool_or(lower(trim(t.note)) = r.exact) AS exact_hit,
        count(*) AS uses, max(t.date) AS last_used
      FROM r
      JOIN transactions t ON t.workspace_id = ${workspace} AND t.type::text = r.type
        AND (lower(trim(t.note)) = r.exact OR (length(r.key) >= 3 AND ${MERCHANT_KEY_SQL(sql`t.note`)} = r.key))
      JOIN categories c ON c.id = t.category_id AND c.workspace_id = ${workspace} AND c.kind::text = r.type
      GROUP BY r.line, c.id, c.name
    )
    SELECT DISTINCT ON (line) line, id, name FROM h
    WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ${workspace} AND user_id = ${actor} AND role IN ('owner','member'))
    ORDER BY line, exact_hit DESC, uses DESC, last_used DESC`);
  const byLine = new Map(result.rows.map((row) => [Number(row.line), { id: String(row.id), name: String(row.name) }]));
  for (const row of open) {
    const hit = byLine.get(row.line);
    if (!hit) continue;
    // approve_file_import re-checks that the id and name still match this category.
    row.categoryId = hit.id;
    row.category = hit.name;
    row.suggested = true;
  }
}
