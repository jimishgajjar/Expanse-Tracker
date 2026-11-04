import type ExcelJS from "exceljs";
import type { HouseholdDb } from "./household-db";
import { financeAccess, type FinanceScope } from "./finance-position";
import { debtTables, currencyTables } from "./finance-tables";

export async function exportFinance(wb:ExcelJS.Workbook,db:HouseholdDb,s:FinanceScope) {
  await db.transaction(async tx=>{
    await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await financeAccess(tx,s,"read");
    for (const table of [...debtTables,...currencyTables]) {
      const {rows}=await tx.query(`SELECT * FROM ${table} WHERE workspace_id=$1`,[s.workspace]);
      if (!rows.length) continue;
      const sheet=wb.addWorksheet(table);
      const columns=Object.keys(rows[0]);
      sheet.addRow(columns);
      for (const row of rows) sheet.addRow(columns.map(k=>row[k] instanceof Date?row[k].toISOString():row[k]));
    }
  });
}
