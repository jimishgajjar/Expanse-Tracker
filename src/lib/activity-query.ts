import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDb } from "./db";
import type { TransactionDTO, TransferDTO } from "./queries";

export const activityFilterSchema = z.object({
  start: z.iso.date(), end: z.iso.date(),
  type: z.enum(["all", "income", "expense", "transfer"]).default("all"),
  account: z.string().max(100).default(""), category: z.string().max(100).default(""),
  search: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).refine(d => d.start < d.end, "Invalid period");
export type ActivityFilter = z.infer<typeof activityFilterSchema>;
export type ActivityPage = { transactions: TransactionDTO[]; transfers: TransferDTO[]; total: number; income: number; expense: number; transferred: number; page: number; pages: number };

/** Filtering, totals and pagination share one statement and snapshot. No full ledger crosses the network. */
export async function queryActivity(db: AppDb, workspace: string, filter: ActivityFilter): Promise<ActivityPage> {
  const f = activityFilterSchema.parse(filter);
  const result = await db.execute(sql`
    WITH entries AS (
      SELECT t.id, t.date, t.created_at, t.type::text AS kind, t.amount,
        jsonb_build_object('id',t.id,'type',t.type,'amount',t.amount::float8,'date',t.date,'note',t.note,
          'accountId',t.account_id,'categoryId',t.category_id,
          'account',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('name',a.name,'icon',a.icon,'color',a.color) END,
          'category',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name',c.name,'icon',c.icon,'color',c.color) END,
          'createdByName',COALESCE(NULLIF(u.name,''),u.email),
          'tags',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'color',g.color)) FROM transaction_tags tt JOIN tags g ON g.id=tt.tag_id AND g.workspace_id=${workspace} WHERE tt.transaction_id=t.id),'[]'::jsonb)) AS item
      FROM transactions t LEFT JOIN accounts a ON a.id=t.account_id AND a.workspace_id=${workspace}
      LEFT JOIN categories c ON c.id=t.category_id AND c.workspace_id=${workspace} LEFT JOIN users u ON u.id=t.created_by
      WHERE t.workspace_id=${workspace} AND t.date>=${f.start}::date AND t.date<${f.end}::date
        AND (${f.type}='all' OR t.type::text=${f.type})
        AND (${f.account}='' OR t.account_id=${f.account}) AND (${f.category}='' OR t.category_id=${f.category})
        AND (${f.search}='' OR strpos(lower(concat_ws(' ',t.note,a.name,c.name)),lower(${f.search}))>0
          OR EXISTS(SELECT 1 FROM transaction_tags tt JOIN tags g ON g.id=tt.tag_id AND g.workspace_id=${workspace} WHERE tt.transaction_id=t.id AND strpos(lower(g.name),lower(${f.search}))>0))
      UNION ALL
      SELECT t.id,t.date,t.created_at,'transfer',t.amount,
        jsonb_build_object('id',t.id,'amount',t.amount::float8,'date',t.date,'note',t.note,'fromAccountId',t.from_account_id,'toAccountId',t.to_account_id)
      FROM transfers t LEFT JOIN accounts a ON a.id=t.from_account_id AND a.workspace_id=${workspace}
      LEFT JOIN accounts b ON b.id=t.to_account_id AND b.workspace_id=${workspace}
      WHERE t.workspace_id=${workspace} AND t.date>=${f.start}::date AND t.date<${f.end}::date
        AND ${f.type} IN ('all','transfer') AND ${f.category}=''
        AND (${f.account}='' OR t.from_account_id=${f.account} OR t.to_account_id=${f.account})
        AND (${f.search}='' OR strpos(lower(concat_ws(' ',t.note,a.name,b.name)),lower(${f.search}))>0)
    ), totals AS (
      SELECT count(*)::int AS total, COALESCE(sum(amount) FILTER (WHERE kind='income'),0)::float8 AS income,
        COALESCE(sum(amount) FILTER (WHERE kind='expense'),0)::float8 AS expense,
        COALESCE(sum(amount) FILTER (WHERE kind='transfer'),0)::float8 AS transferred FROM entries
    ), pagination AS (SELECT *,greatest(1,ceil(total::numeric/${f.pageSize})::int) AS pages FROM totals),
    selected AS (SELECT * FROM entries ORDER BY date DESC,created_at DESC,id DESC,kind DESC
      LIMIT ${f.pageSize} OFFSET ((SELECT least(${f.page},pages) FROM pagination)-1)*${f.pageSize})
    SELECT pagination.*,least(${f.page},pages) AS page,
      COALESCE((SELECT jsonb_agg(item ORDER BY date DESC,created_at DESC,id DESC) FROM selected WHERE kind<>'transfer'),'[]'::jsonb) AS transactions,
      COALESCE((SELECT jsonb_agg(item ORDER BY date DESC,created_at DESC,id DESC) FROM selected WHERE kind='transfer'),'[]'::jsonb) AS transfers FROM pagination
  `);
  return result.rows[0] as ActivityPage;
}
