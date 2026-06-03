import ExcelJS from "exceljs";
import { getAccountsWithBalances, getAllTransactions, getCategories } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/export → an .xlsx workbook with all data (Transactions/Accounts/Categories).
export async function GET() {
  const [accounts, categories, transactions] = await Promise.all([
    getAccountsWithBalances(),
    getCategories(),
    getAllTransactions(),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Money Tracker";
  const numFmt = "#,##0.00";

  const txWs = wb.addWorksheet("Transactions");
  txWs.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 10 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt } },
    { header: "Category", key: "category", width: 22 },
    { header: "Account", key: "account", width: 18 },
    { header: "Note", key: "note", width: 34 },
  ];
  for (const t of transactions) {
    txWs.addRow({
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category?.name ?? "Uncategorised",
      account: t.account?.name ?? "",
      note: t.note,
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

  for (const ws of [txWs, accWs, catWs]) {
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
