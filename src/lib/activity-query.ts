import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDb } from "./db";
import type { TransactionDTO, TransferDTO } from "./queries";
import {merchantRulesEnabled} from "./merchant-rule-feature";

export const activityFilterSchema = z.object({
  start: z.iso.date(), end: z.iso.date(),
  entry:z.string().max(128).optional(),
  type: z.enum(["all", "income", "expense", "transfer"]).default("all"),
  account: z.string().max(100).default(""), category: z.string().max(100).default(""),
  search: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).refine(d => d.start < d.end, "Invalid period");
export type ActivityFilter = z.infer<typeof activityFilterSchema>;
export type ActivityPage = { transactions: TransactionDTO[]; transfers: TransferDTO[]; total: number; income: number; expense: number; transferred: number; page: number; pages: number };

/** Filtering, totals and pagination share one statement and snapshot. Hydrate
 * display JSON/tags only after LIMIT, not for every matching ledger entry. */
export async function queryActivity(db: AppDb, workspace: string, filter: ActivityFilter,split=merchantRulesEnabled()): Promise<ActivityPage> {
  const f = activityFilterSchema.parse(filter);
  const order = sql`date DESC,created_at DESC,id DESC,kind DESC`;
  // On the final page there is no reason to walk past every earlier record.
  // Fetch its exact remaining row count from the oldest end of the same snapshot.
  const selected = f.page === 1 ? sql`SELECT * FROM entries ORDER BY ${order} LIMIT ${f.pageSize}` : sql`
    (SELECT * FROM entries WHERE (SELECT pages > ${f.page} FROM pagination) ORDER BY ${order}
      LIMIT ${f.pageSize} OFFSET ${(f.page-1)*f.pageSize})
    UNION ALL
    (SELECT * FROM entries WHERE (SELECT pages <= ${f.page} FROM pagination)
      ORDER BY date,created_at,id,kind LIMIT (SELECT total-(pages-1)*${f.pageSize} FROM pagination))`;
  const result = await db.execute(sql`
    WITH entries AS ${f.search || f.category ? sql`MATERIALIZED` : sql`NOT MATERIALIZED`} (
      SELECT t.id, t.date, t.created_at, t.type::text AS kind, ${split&&f.category?sql`coalesce(portion.amount,t.amount)`:sql`t.amount`} AS amount
      FROM transactions t LEFT JOIN accounts a ON a.id=t.account_id AND a.workspace_id=${workspace}
      LEFT JOIN categories c ON c.id=t.category_id AND c.workspace_id=${workspace}
      ${split&&f.category?sql`LEFT JOIN purchase_allocations portion ON portion.transaction_id=t.id AND portion.category_id=${f.category}
        AND EXISTS (SELECT 1 FROM categories pc WHERE pc.id=portion.category_id AND pc.workspace_id=t.workspace_id)`:sql``}
      WHERE t.workspace_id=${workspace} AND t.date>=${f.start}::date AND t.date<${f.end}::date
        ${f.entry?sql`AND t.id=${f.entry}`:sql``}
        AND (${f.type}='all' OR t.type::text=${f.type})
        AND (${f.account}='' OR a.id=${f.account}) AND (${f.category}='' OR c.id=${f.category} ${split&&f.category?sql`OR portion.transaction_id IS NOT NULL`:sql``})
        AND (${f.search}='' OR strpos(lower(concat_ws(' ',t.note,a.name,c.name)),lower(${f.search}))>0
          OR EXISTS(SELECT 1 FROM transaction_tags tt JOIN tags g ON g.id=tt.tag_id AND g.workspace_id=${workspace} WHERE tt.transaction_id=t.id AND strpos(lower(g.name),lower(${f.search}))>0))
      UNION ALL
      SELECT t.id,t.date,t.created_at,'transfer',t.amount
      FROM transfers t LEFT JOIN accounts a ON a.id=t.from_account_id AND a.workspace_id=${workspace}
      LEFT JOIN accounts b ON b.id=t.to_account_id AND b.workspace_id=${workspace}
      WHERE t.workspace_id=${workspace} AND t.date>=${f.start}::date AND t.date<${f.end}::date
        ${f.entry?sql`AND t.id=${f.entry}`:sql``}
        AND ${f.type} IN ('all','transfer') AND ${f.category}=''
        AND (${f.account}='' OR a.id=${f.account} OR b.id=${f.account})
        AND (${f.search}='' OR strpos(lower(concat_ws(' ',t.note,a.name,b.name)),lower(${f.search}))>0)
    ), totals AS (
      SELECT count(*)::int AS total, COALESCE(sum(amount) FILTER (WHERE kind='income'),0)::float8 AS income,
        COALESCE(sum(amount) FILTER (WHERE kind='expense'),0)::float8 AS expense,
        COALESCE(sum(amount) FILTER (WHERE kind='transfer'),0)::float8 AS transferred FROM entries
    ), pagination AS (SELECT *,greatest(1,ceil(total::numeric/${f.pageSize})::int) AS pages FROM totals),
    selected AS MATERIALIZED (${selected}),
    presented AS (
      SELECT s.*,CASE WHEN s.kind='transfer' THEN
        jsonb_build_object('id',s.id,'amount',s.amount::float8,'date',s.date,'note',tr.note,'fromAccountId',coalesce(fa.id,''),'toAccountId',coalesce(ta.id,''))
      ELSE jsonb_build_object('id',s.id,'type',s.kind,'amount',s.amount::float8,'date',s.date,'note',t.note,
        ${split?sql`'allocations',coalesce((SELECT jsonb_agg(jsonb_build_object('categoryId',p.category_id,'amount',p.amount::text) ORDER BY p.category_id) FROM purchase_allocations p JOIN categories pc ON pc.id=p.category_id AND pc.workspace_id=t.workspace_id WHERE p.transaction_id=t.id),'[]'::jsonb),
        'receiptAmount',t.amount::float8,`:sql``}
        'accountId',a.id,'categoryId',c.id,
        'account',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('name',a.name,'icon',a.icon,'color',a.color) END,
        'category',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name',c.name,'icon',c.icon,'color',c.color) END,
        'createdByName',COALESCE(NULLIF(u.name,''),u.email),
        'tags',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'color',g.color))
          FROM transaction_tags tt JOIN tags g ON g.id=tt.tag_id AND g.workspace_id=${workspace}
          WHERE tt.transaction_id=t.id),'[]'::jsonb)) END AS item
      FROM selected s
      LEFT JOIN transactions t ON s.kind<>'transfer' AND t.id=s.id AND t.workspace_id=${workspace}
      LEFT JOIN transfers tr ON s.kind='transfer' AND tr.id=s.id AND tr.workspace_id=${workspace}
      LEFT JOIN accounts fa ON fa.id=tr.from_account_id AND fa.workspace_id=${workspace}
      LEFT JOIN accounts ta ON ta.id=tr.to_account_id AND ta.workspace_id=${workspace}
      LEFT JOIN accounts a ON a.id=t.account_id AND a.workspace_id=${workspace}
      LEFT JOIN categories c ON c.id=t.category_id AND c.workspace_id=${workspace}
      LEFT JOIN users u ON u.id=t.created_by
    )
    SELECT pagination.*,least(${f.page},pages) AS page,
      COALESCE((SELECT jsonb_agg(item ORDER BY date DESC,created_at DESC,id DESC) FROM presented WHERE kind<>'transfer'),'[]'::jsonb) AS transactions,
      COALESCE((SELECT jsonb_agg(item ORDER BY date DESC,created_at DESC,id DESC) FROM presented WHERE kind='transfer'),'[]'::jsonb) AS transfers FROM pagination
  `);
  return result.rows[0] as ActivityPage;
}
