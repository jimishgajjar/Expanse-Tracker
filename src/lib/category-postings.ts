import {netBudgetExpenses} from "./net-budget-expenses";
import {sql,and,eq,inArray} from "drizzle-orm";
import type {AppDb} from "./db";
import {categories,purchaseAllocations,transactions} from "./db/schema";
import {merchantRulesEnabled as localM4Enabled} from "./merchant-rule-feature";
import type {Allocation} from "./purchase-allocation";

// One row per category portion for category-based reports only. Account balances,
// reconciliation, cash flow and ledger lists continue to use the parent transaction.
export function categoryPostingSQL(enabled=localM4Enabled()){
  if(!enabled)return sql`transactions`;
  return sql`(SELECT t.id,t.workspace_id,t.account_id,t.type,t.date,
    coalesce(p.category_id,t.category_id) AS category_id,coalesce(p.amount,t.amount) AS amount
    FROM transactions t LEFT JOIN purchase_allocations p ON p.transaction_id=t.id)`;
}
export function categoryPostings(db:AppDb,enabled=localM4Enabled(),netBudget=false){
  return db.select({
    workspaceId:sql<string>`p.workspace_id`.as("workspace_id"),type:sql<"income"|"expense">`p.type`.as("type"),
    date:sql<string>`p.date`.as("date"),categoryId:sql<string|null>`${categories.id}`.as("category_id"),
    amount:sql<string>`p.amount`.as("amount"),
  }).from(sql`${enabled&&netBudget?sql.raw(netBudgetExpenses):categoryPostingSQL(enabled)} p`)
    .leftJoin(categories,sql`${categories.id}=p.category_id AND ${categories.workspaceId}=p.workspace_id`).as("category_postings");
}
export async function allocationsFor(db:AppDb,workspace:string,ids:string[]){
  const map=new Map<string,Allocation[]>();
  if(!ids.length||!localM4Enabled())return map;
  const rows=await db.select({id:purchaseAllocations.transactionId,categoryId:purchaseAllocations.categoryId,amount:purchaseAllocations.amount})
    .from(purchaseAllocations).innerJoin(transactions,eq(transactions.id,purchaseAllocations.transactionId))
    .innerJoin(categories,and(eq(categories.id,purchaseAllocations.categoryId),eq(categories.workspaceId,workspace)))
    .where(and(eq(transactions.workspaceId,workspace),inArray(transactions.id,ids))).orderBy(purchaseAllocations.categoryId);
  for(const {id,...line} of rows){const lines=map.get(id)??[];lines.push(line);map.set(id,lines);}
  return map;
}
