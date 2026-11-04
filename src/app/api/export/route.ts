import { pilotAvailable } from "@/lib/pilot-release";
import { householdSetup,openingCutoffs } from "@/lib/db/schema";
import { workbookFits } from "@/lib/activity-exports";
import { exportFinance } from "@/lib/finance-export";
import { financeDatabase,financeRelease } from "@/lib/finance-release";
import { getSession } from "@/lib/session";
import { fileImports, merchantRuleVersions, receiptImages, monthlyPlans, goalReservations, payPeriodPlans, annualGoalPlans, refundLinks, budgetMoves, goalOpeningReviews, forecastScenarios } from "@/lib/db/schema";
import { merchantRulesEnabled } from "@/lib/merchant-rule-feature";
import { fileImportsEnabled, type Entry, type Outcome } from "@/lib/file-import-model";
import { and, eq } from "drizzle-orm";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { isPersonalLedger } from "@/lib/household-access";
import { transfers, budgets, recurring, goals, splits, tags, transactionTags, transactions as transactionTable, appSettings, transactionHistory, reconciliationSessions } from "@/lib/db/schema";
import { statementReviewsEnabled } from "@/lib/statement-review-feature";
import type { LedgerSnapshot, ReviewChoice } from "@/lib/statement-review";
import { getAccountsWithBalances, getAllTransactions, getCategories } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/export → an .xlsx workbook with all data (Transactions/Accounts/Categories).
export async function GET(request: Request) {
  const workspace = await getActiveWorkspaceId();
  if (!workspace) return new Response("Unauthorized", {status:401});
  const expected = new URL(request.url).searchParams.get("workspace");
  // Legacy unscoped shared-tracker links still work. A private workbook must
  // always originate from an explicit matching tracker selection.
  if ((expected !== null || isPersonalLedger(workspace)) && expected !== workspace)
    return new Response("Tracker changed. Reopen the intended tracker and choose Export data again.",
      {status:409,headers:{"Cache-Control":"private, no-store"}});
  const db = await getDb();
  if (!await workbookFits(db,workspace,{reviews:statementReviewsEnabled(),imports:fileImportsEnabled(),planning:merchantRulesEnabled(),finance:!!financeRelease(),pilot:pilotAvailable()}))
    return new Response('<main><h1>This workbook is too large</h1><p>Download transactions and transfers in smaller files. Contact the operator for a complete household export.</p><a href="/exports?workspace='+encodeURIComponent(workspace)+'">Open activity downloads</a></main>',
      {status:413,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store"}});
  const [accounts, categories, transactions] = await Promise.all([
    getAccountsWithBalances(),
    getCategories(),
    getAllTransactions(),
  ]);

  const {default:ExcelJS}=await import("exceljs");
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
      category: t.allocations?.length?"Split purchase":t.category?.name ?? "Uncategorised",
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
  const visibleAccounts = new Set(accounts.map(a=>a.id));
  const visibleCategories = new Set(categories.map(c=>c.id));
  const visibleTags = new Set(datasets[5].map(t=>t.id));
  // Older foreign keys may point across ledgers. Keep the financial row and omit the inaccessible reference.
  const visibleId = (id:string|null, scope:Set<string>) => id && scope.has(id) ? id : null;
  const sheets = [
    datasets[0].map(t=>({...t,fromAccountId:visibleId(t.fromAccountId,visibleAccounts),toAccountId:visibleId(t.toAccountId,visibleAccounts)})),
    datasets[1].map(b=>({...b,categoryId:visibleId(b.categoryId,visibleCategories)})),
    datasets[2].map(r=>({...r,accountId:visibleId(r.accountId,visibleAccounts),categoryId:visibleId(r.categoryId,visibleCategories),
      tagIds:r.tagIds.filter(id=>visibleTags.has(id))})),
    ...datasets.slice(3),
  ];
  const names = ["Transfers","Budgets","Subscriptions and bills","Savings goals","Shared expenses","Tags","Transaction tags","Settings","Edit history"];
  sheets.forEach((rows,index) => {
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
  if(transactions.some(t=>t.allocations?.length)){
    const parts=wb.addWorksheet("Purchase allocations");
    parts.addRow(["Receipt ID","Category ID","Category","Portion"]);
    for(const t of transactions)for(const p of t.allocations??[])
      parts.addRow([t.id,p.categoryId,categories.find(c=>c.id===p.categoryId)?.name,Number(p.amount)]);
  }
  if(merchantRulesEnabled()){
    const [plans,holds]=await Promise.all([
      db.select().from(monthlyPlans).where(eq(monthlyPlans.workspaceId,workspace)),
      db.select().from(goalReservations).where(eq(goalReservations.workspaceId,workspace)),
    ]);
    const planSheet=wb.addWorksheet("Monthly plans"),heldSheet=wb.addWorksheet("Goal reservations");
    planSheet.addRow(["Category ID","Effective month","Monthly allocation","Carry remainder","Version"]);
    for(const p of plans)planSheet.addRow([p.categoryId,p.month,Number(p.amount),p.rollover,p.version]);
    heldSheet.addRow(["Event ID","Goal ID","Account ID","Amount reserved or released","Created","Actor"]);
    for(const h of holds)heldSheet.addRow([h.id,h.goalId,h.accountId,Number(h.delta),h.createdAt.toISOString(),h.actorId]);
    const [periods,funds]=await Promise.all([
      db.select().from(payPeriodPlans).where(eq(payPeriodPlans.workspaceId,workspace)),
      db.select().from(annualGoalPlans).where(eq(annualGoalPlans.workspaceId,workspace)),
    ]);
    const scenarios=await db.select().from(forecastScenarios).where(eq(forecastScenarios.workspaceId,workspace));
    const scenarioSheet=wb.addWorksheet("Forecast assumptions");
    scenarioSheet.addRow(["Account ID","Scenario","Additional daily spending","Cash buffer","Version"]);
    for(const r of scenarios)scenarioSheet.addRow([r.accountId,r.scenario,Number(r.daily),Number(r.buffer),r.version]);
    const reviews=await db.select().from(goalOpeningReviews).where(eq(goalOpeningReviews.workspaceId,workspace));
    const reviewSheet=wb.addWorksheet("Goal opening reviews");
    reviewSheet.addRow(["Goal ID","Version","Original manual amount","Reserved when reviewed","Confirmed outside tracked accounts","Reviewer ID","Reviewed at"]);
    for(const r of reviews)reviewSheet.addRow([r.goalId,r.version,Number(r.opening),Number(r.reserved),Number(r.outside),r.actorId,r.createdAt.toISOString()]);
    const moves=await db.select().from(budgetMoves).where(eq(budgetMoves.workspaceId,workspace));
    const moveSheet=wb.addWorksheet("Budget moves");
    moveSheet.addRow(["Move ID","Budget month","From category ID","To category ID","Amount","Note","Moved by","Recorded at"]);
    for(const m of moves)moveSheet.addRow([m.id,m.month,m.fromCategory,m.toCategory,Number(m.amount),m.note,m.actorId,m.createdAt.toISOString()]);
    const links=await db.select().from(refundLinks).where(eq(refundLinks.workspaceId,workspace));
    const refunds=wb.addWorksheet("Linked refunds");
    refunds.addRow(["Credit ID","Original purchase ID","Category ID","Refund amount","Linked by","Linked at"]);
    for(const link of links)for(const line of link.portions)refunds.addRow([link.creditId,link.purchaseId,line.categoryId,Number(line.amount),link.actorId,link.createdAt.toISOString()]);
    const paydaySheet=wb.addWorksheet("Payday budgets"),fundSheet=wb.addWorksheet("Annual fund schedules");
    paydaySheet.addRow(["Account ID","First payday","Next payday (exclusive)","Frequency","Expected income","Spending limit","Version"]);
    for(const p of periods)paydaySheet.addRow([p.accountId,p.start,p.next,p.cadence,Number(p.expected),Number(p.limit),p.version]);
    fundSheet.addRow(["Goal ID","Annual due date","Version"]);
    for(const f of funds)fundSheet.addRow([f.goalId,f.due,f.version]);
    const photos=await db.select({id:receiptImages.id,transaction:receiptImages.transactionId,bytes:receiptImages.bytes,at:receiptImages.createdAt})
      .from(receiptImages).innerJoin(transactionTable,eq(transactionTable.id,receiptImages.transactionId)).where(eq(transactionTable.workspaceId,workspace));
    const photoSheet=wb.addWorksheet("Receipt inventory"); photoSheet.addRow(["Receipt ID","Transaction ID","JPEG bytes","Attached at"]);
    for(const p of photos)photoSheet.addRow([p.id,p.transaction,p.bytes,p.at.toISOString()]);
    readme.addRow(["Receipt photos","Download each JPEG from Activity → More actions → Receipt. Verified database backups include the image bytes."]);
    const versions=await db.select().from(merchantRuleVersions).where(eq(merchantRuleVersions.workspaceId,workspace));
    const sheet=wb.addWorksheet("Merchant rules");
    sheet.addRow(["Rule","Version","Account","Type","Merchant","Aliases","Category ID","Tag IDs","Priority","Enabled","Editor","Saved at"]);
    for(const v of versions){
      const d=v.definition;
      sheet.addRow([v.id,v.version,v.accountId,v.kind,d.name,JSON.stringify(d.aliases),d.categoryId,JSON.stringify(d.tagIds),d.priority,d.enabled,v.actorId,v.createdAt.toISOString()]);
    }
  }
  readme.addRows([["Workspace export",new Date().toISOString()],["Scope","Current workspace only. Transfers are separate from income and expenses."],["Recovery","This workbook is for review and portability. Use a verified encrypted database backup for complete recovery."],["Currency","Amounts retain their stored values. No currency conversion performed."]]);
  if (statementReviewsEnabled()) readme.addRow(["Statement reviews","Snapshots and status at save time are retained as evidence. Reopen a review in the app to detect subsequent ledger changes. Reviews never auto-adjust balances. Explicit statement corrections include the transaction ID and reason in Review events."]);
  if (financeRelease()) {
    const [local,session]=await Promise.all([financeDatabase(),getSession()]);
    if (local && session) await exportFinance(wb,local,{workspace,actor:session.user.id});
    readme.addRow(["Reviewed amounts","Finance bookings retain original amounts, both transfer legs, fees and historical rates. Valuation quotes apply only to current positions. Legacy balances are in the original ledger units."]);
  }
  if (pilotAvailable()) {
    const [prefs,cutoffs]=await Promise.all([db.select().from(householdSetup).where(eq(householdSetup.workspaceId,workspace)),
      db.select().from(openingCutoffs).where(eq(openingCutoffs.workspaceId,workspace))]);
    const setup=wb.addWorksheet("Household setup"),openings=wb.addWorksheet("Opening statements");
    setup.addRow(["Time zone","Bills skipped","Invitation skipped"]);
    for (const p of prefs) setup.addRow([p.timezone,p.billsSkipped,p.inviteSkipped]);
    openings.addRow(["Account ID","Covered through","Statement balance"]);
    for (const c of cutoffs) openings.addRow([c.accountId,c.throughDate,c.statementBalance]);
  }
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
