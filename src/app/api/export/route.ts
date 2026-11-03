import ExcelJS from "exceljs";
import { fileImports } from "@/lib/db/schema";
import { fileImportsEnabled, type Entry, type Outcome } from "@/lib/file-import-model";
import { and, eq } from "drizzle-orm";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { transfers, budgets, recurring, goals, splits, tags, transactionTags, transactions as transactionTable, appSettings, transactionHistory, reconciliationSessions } from "@/lib/db/schema";
import { statementReviewsEnabled } from "@/lib/statement-review-feature";
import type { LedgerSnapshot, ReviewChoice } from "@/lib/statement-review";
import { getAccountsWithBalances, getAllTransactions, getCategories } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/export → an .xlsx workbook with all data (Transactions/Accounts/Categories).
export async function GET() {
  const workspace = await getActiveWorkspaceId();
  if (!workspace) return new Response("Unauthorized", {status:401});
  const [accounts, categories, transactions] = await Promise.all([
    getAccountsWithBalances(),
    getCategories(),
    getAllTransactions(),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Expense Tracker";
  const numFmt = "#,##0.00";

  const txWs = wb.addWorksheet("Transactions");
  txWs.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 10 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt } },
    { header: "Category", key: "category", width: 22 },
    { header: "Account", key: "account", width: 18 },
    { header: "Note", key: "note", width: 34 },
    { header: "Tags", key: "tags", width: 30 },
    { header: "ID", key: "id", width: 40 },
  ];
  for (const t of transactions) {
    txWs.addRow({
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category?.name ?? "Uncategorised",
      account: t.account?.name ?? "",
      note: t.note,
      tags: t.tags.map(tag => tag.name).join(", "),
      id: t.id,
    });
  }

  const accWs = wb.addWorksheet("Accounts");
  accWs.columns = [
    { header: "Name", key: "name", width: 20 },
    { header: "Type", key: "type", width: 12 },
    { header: "Opening Balance", key: "opening", width: 16, style: { numFmt } },
    { header: "Current Balance", key: "balance", width: 16, style: { numFmt } },
  ];
  for (const a of accounts) accWs.addRow({ name: a.name, type: a.type, opening: a.initialBalance, balance: a.balance });

  const catWs = wb.addWorksheet("Categories");
  catWs.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Kind", key: "kind", width: 12 },
  ];
  for (const c of categories) catWs.addRow({ name: c.name, kind: c.kind });

  const db = await getDb();
  const datasets = await Promise.all([
    db.select().from(transfers).where(eq(transfers.workspaceId,workspace)),
    db.select().from(budgets).where(eq(budgets.workspaceId,workspace)),
    db.select().from(recurring).where(eq(recurring.workspaceId,workspace)),
    db.select().from(goals).where(eq(goals.workspaceId,workspace)),
    db.select().from(splits).where(eq(splits.workspaceId,workspace)),
    db.select().from(tags).where(eq(tags.workspaceId,workspace)),
    db.select({transactionId:transactionTags.transactionId,tagId:transactionTags.tagId}).from(transactionTags).innerJoin(transactionTable,eq(transactionTable.id,transactionTags.transactionId)).innerJoin(tags,and(eq(tags.id,transactionTags.tagId),eq(tags.workspaceId,workspace))).where(eq(transactionTable.workspaceId,workspace)),
    db.select().from(appSettings).where(eq(appSettings.workspaceId,workspace)),
    db.select().from(transactionHistory).where(eq(transactionHistory.workspaceId,workspace)),
  ]);
  const names = ["Transfers","Budgets","Subscriptions and bills","Savings goals","Shared expenses","Tags","Transaction tags","Settings","Edit history"];
  datasets.forEach((rows,index) => {
    const sheet = wb.addWorksheet(names[index]);
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
    sheet.columns = keys.map(key => ({header:key,key,width:24}));
    rows.forEach(row => sheet.addRow(Object.fromEntries(Object.entries(row).map(([key,value]) => [key,value instanceof Date ? value.toISOString() : value !== null && typeof value === "object" ? JSON.stringify(value) : value]))));
    if (!rows.length) sheet.addRow(["No records"]);
  });
  if (statementReviewsEnabled()) {
    const rows = await db.select().from(reconciliationSessions).where(eq(reconciliationSessions.workspaceId,workspace));
    const sheet = wb.addWorksheet("Statement reviews");
    sheet.columns = ["id","accountId","startDate","endDate","closingBalance","currency","initialBalance","statusAtSave","version","actorName","createdAt","completedAt","duplicatesReviewed"].map(key=>({header:key,key,width:24}));
    const entries = wb.addWorksheet("Reviewed entries");
    entries.columns = ["reviewId","id","date","kind","amount","delta","note","accountId","fromAccountId","toAccountId","decision"].map(key=>({header:key,key,width:24}));
    const events = wb.addWorksheet("Review events");
    events.columns = ["reviewId","event","at","version","actorId","actorName","duplicatesReviewed","entryId","decision","transactionId","reason"].map(key=>({header:key,key,width:24}));
    for (const row of rows) {
      const snapshot = row.snapshot as LedgerSnapshot;
      const decisions = row.decisions as Record<string,ReviewChoice>;
      sheet.addRow({...row,currency:snapshot.currency,initialBalance:snapshot.initialBalance,statusAtSave:row.status,createdAt:row.createdAt.toISOString(),completedAt:row.completedAt?.toISOString()??""});
      for (const entry of snapshot.entries) entries.addRow({reviewId:row.id,...entry,decision:decisions[entry.id]??(entry.date<row.startDate?"Opening balance history":"Unreviewed")});
      for (const event of row.events as {event:string;at:string;version?:number;actorId:string;actorName:string;duplicatesReviewed?:boolean;decisions?:Record<string,ReviewChoice>}[]) {
        const choices=Object.entries(event.decisions??{});
        if (!choices.length) events.addRow({reviewId:row.id,...event});
        for (const [entryId,decision] of choices) events.addRow({reviewId:row.id,...event,entryId,decision});
      }
    }
    if (!rows.length) sheet.addRow(["No records"]);
  }
  if(fileImportsEnabled()){
    const batches=await db.select().from(fileImports).where(eq(fileImports.workspaceId,workspace));
    const manifest=wb.addWorksheet("Import batches"), evidence=wb.addWorksheet("Import rows");
    manifest.addRow(["Batch","File","SHA-256","Currency","Headers","Mapping","Staged by","Created","Approved by","Approved","Version"]);
    evidence.addRow(["Batch","Source row","Date","Type","Amount","Account","Category","Note","Validation","Decision","Ledger transaction ID"]);
    for(const b of batches){
      manifest.addRow([b.id,b.filename,b.fileHash,b.currency,JSON.stringify(b.headers),JSON.stringify(b.mapping),b.stagedBy,b.createdAt.toISOString(),b.approvedBy,b.approvedAt?.toISOString(),b.version]);
      const decisions=new Map(((b.receipt??[]) as Outcome[]).map(o=>[o.line,o]));
      for(const row of b.rows as Entry[]){const outcome=decisions.get(row.line);
        evidence.addRow([b.id,row.line,row.date,row.type,row.amount,row.account,row.category,row.note,row.errors.join("; "),outcome?.action??"Pending",outcome?.transactionId]);}
    }
  }
  const readme = wb.addWorksheet("About this export");
  readme.addRows([["Workspace export",new Date().toISOString()],["Scope","Current workspace only. Transfers are separate from income and expenses."],["Recovery","This workbook is for review and portability. Use a verified encrypted database backup for complete recovery."],["Currency","Amounts retain their stored values. No currency conversion performed."]]);
  if (statementReviewsEnabled()) readme.addRow(["Statement reviews","Snapshots and status at save time are retained as evidence. Reopen a review in the app to detect subsequent ledger changes. Reviews never auto-adjust balances. Explicit statement corrections include the transaction ID and reason in Review events."]);
  for (const ws of wb.worksheets) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="money-tracker-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
