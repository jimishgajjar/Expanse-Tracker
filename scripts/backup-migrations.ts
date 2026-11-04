import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { debtTables, currencyTables } from "../src/lib/finance-tables";

/** Keep scheduled backups working while an additive release is only local.
 * Never migrates the source. The selected journal is bundled into the backup. */
export function backupMigrationsForTables(folder: string, tables: string[]): string {
  const optional = [["reconciliation_sessions","0012_statement_reviews"],["file_imports","0013_file_imports"],["merchant_rule_versions","0014_merchant_rules"],["purchase_allocations","0015_purchase_allocations"],["receipt_images","0016_receipts_and_drafts"],["monthly_plans","0017_monthly_planning"],["pay_period_plans","0018_pay_periods_and_annual_funds"],["refund_links","0019_linked_refunds"],["budget_moves","0020_budget_moves"],["goal_opening_reviews","0021_goal_opening_reviews"],["forecast_scenarios","0022_forecast_scenarios"],["personal_ledgers","0023_personal_ledgers"],["account_shares","0024_account_shares"],["reimbursements","0025_reimbursements"],["transaction_comments","0026_transaction_comments"],["notification_preferences","0027_notification_preferences"],["invitation_preferences","0028_direct_notifications"]] as const;
  if(tables.includes("invitation_preferences")!==tables.includes("comment_mentions") || (tables.includes("invitation_preferences")&&!tables.includes("notification_preferences"))) throw new Error("Unexpected partial direct notification schema.");
  if(tables.includes("notification_preferences")&&!tables.includes("transaction_comments"))throw new Error("Unexpected partial notification schema.");
  if(tables.includes("transaction_comments")&&!tables.includes("reimbursements"))throw new Error("Unexpected partial comment schema.");
  if(tables.includes("reimbursements")&&!tables.includes("account_shares"))throw new Error("Unexpected partial reimbursement schema.");
  if(tables.includes("account_shares")&&!tables.includes("personal_ledgers"))throw new Error("Unexpected partial account sharing schema.");
  if(tables.includes("personal_ledgers")&&!tables.includes("forecast_scenarios"))throw new Error("Unexpected partial personal ledger schema.");
  if(tables.includes("forecast_scenarios")&&!tables.includes("goal_opening_reviews"))throw new Error("Unexpected partial forecast scenario schema.");
  if(tables.includes("goal_opening_reviews")&&!tables.includes("budget_moves"))throw new Error("Unexpected partial goal review schema.");
  if(tables.includes("budget_moves")&&!tables.includes("refund_links"))throw new Error("Unexpected partial budget move schema.");
  if(tables.includes("refund_links")&&!tables.includes("pay_period_plans"))throw new Error("Unexpected partial refund schema.");
  if(tables.includes("pay_period_plans")!==tables.includes("annual_goal_plans")||(tables.includes("pay_period_plans")&&!tables.includes("monthly_plans")))throw new Error("Unexpected partial payday schema.");
  if(tables.includes("monthly_plans")!==tables.includes("goal_reservations")||(tables.includes("monthly_plans")&&!tables.includes("receipt_images")))throw new Error("Unexpected partial planning schema.");
  if(tables.includes("receipt_images")!==tables.includes("capture_drafts")||(tables.includes("receipt_images")&&!tables.includes("purchase_allocations")))throw new Error("Unexpected partial receipt or draft schema.");
  if(tables.includes("purchase_allocations")&&!tables.includes("merchant_rule_versions"))throw new Error("Unexpected partial allocation schema.");
  if (tables.includes("merchant_rule_versions") && !tables.includes("file_imports")) throw new Error("Unexpected partial merchant rule schema.");
  if (tables.includes("file_imports") && !tables.includes("reconciliation_sessions")) throw new Error("Unexpected partial import schema.");
  for (const group of [debtTables,currencyTables]) {
    if (group.some(t=>tables.includes(t)) && !group.every(t=>tables.includes(t))) throw Error("Incomplete financial position schema.");
  }
  if (tables.includes("finance_books") && !tables.includes("finance_accounts")) throw Error("Missing liability review schema.");
  const pilot = ["household_setup","opening_cutoffs","pilot_feedback"];
  if (pilot.some(t=>tables.includes(t)) && (!pilot.every(t=>tables.includes(t)) || !tables.includes("finance_books"))) throw Error("Incomplete household setup schema.");
  const stages=[...optional,["finance_accounts","0029_debt_reviews"],["finance_books","0030_booked_currencies"],["household_setup","0031_household_setup"]];
  const absent=stages.filter(([table,tag])=>existsSync(join(folder,tag+".sql"))&&!tables.includes(table)).map(([,tag])=>String(tag));
  if(!absent.length)return folder;
  const journal = JSON.parse(readFileSync(join(folder,"meta/_journal.json"),"utf8"));
  if (journal.entries.some((entry:{idx:number})=>entry.idx>31)) throw new Error("Review backup compatibility for newer migrations before continuing.");
  const compatible = mkdtempSync(join(tmpdir(),"expense-backup-schema-"));
  cpSync(folder,compatible,{recursive:true});
  journal.entries = journal.entries.filter((entry:{tag:string})=>!absent.includes(entry.tag));
  writeFileSync(join(compatible,"meta/_journal.json"),JSON.stringify(journal,null,2));
  return compatible;
}
