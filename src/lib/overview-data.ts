import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { getActiveWorkspaceId } from "./workspace";
import { getTransactionsInRange, type TransactionDTO } from "./queries";
import type { RangeType } from "./dates";

export async function getOverviewData(start: string, end: string, range: RangeType) {
  const workspace = await getActiveWorkspaceId();
  if (!workspace) return { chartTransactions: [] as TransactionDTO[], recent: [] as TransactionDTO[], transferCount: 0 };
  const db = await getDb();
  const bucket = range === "all" || range === "years" ? "year" : range === "year" ? "month" : "day";
  const [grouped, recent, counts] = await Promise.all([
    db.execute(sql`SELECT date_trunc(${bucket},t.date)::date::text AS date,t.type,t.category_id AS "categoryId",sum(t.amount)::float8 AS amount,
      CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name',c.name,'icon',c.icon,'color',c.color) END AS category
      FROM transactions t LEFT JOIN categories c ON c.id=t.category_id AND c.workspace_id=${workspace}
      WHERE t.workspace_id=${workspace} AND t.date>=${start}::date AND t.date<${end}::date
      GROUP BY 1,t.type,t.category_id,c.id ORDER BY date DESC`),
    getTransactionsInRange(start,end,5),
    db.execute(sql`SELECT count(*)::int AS count FROM transfers WHERE workspace_id=${workspace} AND date>=${start}::date AND date<${end}::date`),
  ]);
  const chartTransactions = grouped.rows.map((r, i) => ({ ...(r as Pick<TransactionDTO,"date"|"type"|"categoryId"|"amount"|"category">), id:`aggregate-${i}`, note:"", accountId:null, account:null, createdByName:null, tags:[] })) as TransactionDTO[];
  return {chartTransactions, recent, transferCount: Number(counts.rows[0]?.count ?? 0)};
}
