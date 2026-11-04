import { sql } from "drizzle-orm";
import type { AppDb } from "./db";
import { debtTables,currencyTables } from "./finance-tables";

// Identifiers come only from the built-in worksheet list. Always bind tracker and cursor values.
export async function workbookFits(db:AppDb,workspace:string,features:{reviews:boolean;imports:boolean;planning:boolean;finance:boolean;pilot?:boolean}) {
  const tables=["transactions","transfers","accounts","categories","budgets","recurring","goals","splits","tags","app_settings","transaction_history"];
  if (features.reviews) tables.push("reconciliation_sessions");
  if (features.imports) tables.push("file_imports");
  if (features.planning) tables.push("merchant_rule_versions","monthly_plans","goal_reservations","pay_period_plans","annual_goal_plans","refund_links","budget_moves","goal_opening_reviews","forecast_scenarios");
  if (features.pilot) tables.push("household_setup","opening_cutoffs");
  if (features.finance) tables.push(...debtTables,...currencyTables);
  const slices=tables.map(table=>sql`SELECT octet_length(to_jsonb(r)::text) AS bytes FROM
    (SELECT * FROM ${sql.identifier(table)} WHERE workspace_id=${workspace} LIMIT 12001) r`);
  const children=["transaction_tags",...(features.planning?["purchase_allocations","receipt_images"]:[])];
  for (const name of children) slices.push(sql`SELECT ${name==="receipt_images"?sql`160`:sql`octet_length(to_jsonb(r)::text)`} AS bytes
    FROM ${sql.identifier(name)} r JOIN transactions t ON t.id=r.transaction_id WHERE t.workspace_id=${workspace} LIMIT 12001`);
  const result=await db.execute(sql`SELECT count(*)<=12000 AND coalesce(sum(bytes),0)<=4194304 AS fits
    FROM (${sql.join(slices.map(slice=>sql`(${slice})`),sql` UNION ALL `)}) inventory`);
  return result.rows[0]?.fits===true;
}

export const partSize=500;
export type ExportKind="transactions"|"transfers";
export async function activityPart(db:AppDb,workspace:string,actor:string,kind:ExportKind,after:string) {
  const table=sql.identifier(kind);
  const selection=kind==="transactions"?sql`t.type::text AS kind,a.name AS account,c.name AS counterpart`:
    sql`'transfer' AS kind,a.name AS account,b.name AS counterpart`;
  const joins=kind==="transactions"?sql`LEFT JOIN accounts a ON a.workspace_id=t.workspace_id AND a.id=t.account_id
    LEFT JOIN categories c ON c.workspace_id=t.workspace_id AND c.id=t.category_id`:sql`LEFT JOIN accounts a ON a.workspace_id=t.workspace_id AND a.id=t.from_account_id
    LEFT JOIN accounts b ON b.workspace_id=t.workspace_id AND b.id=t.to_account_id`;
  const result=await db.execute(sql`SELECT t.id,t.date::text,t.amount::text,t.note,${selection}
    FROM ${table} t ${joins} WHERE t.workspace_id=${workspace} AND t.id>${after} AND EXISTS(
    SELECT 1 FROM workspace_members m WHERE m.workspace_id=t.workspace_id AND m.user_id=${actor} AND m.role IN ('owner','member','viewer'))
    ORDER BY t.id LIMIT ${partSize+1}`);
  const rows=result.rows.slice(0,partSize);
  return {rows,next:result.rows.length>partSize?String(rows[rows.length-1].id):null};
}

export function activityCsv(rows:Record<string,unknown>[]) {
  const headers=["id","date","kind","amount","account","counterpart","note"];
  const cell=(v:unknown)=>{
    const raw=String(v??"");
    const safe=/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(raw)?"'"+raw:raw;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  return "\uFEFF"+[headers.join(","),...rows.map(row=>headers.map(key=>cell(row[key])).join(","))].join("\r\n")+"\r\n";
}
