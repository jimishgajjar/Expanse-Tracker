"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, categories, transactions } from "./db/schema";
import { getActiveWorkspaceId } from "./workspace";

type ImportResult = { ok: boolean; message: string };

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function normDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Import transactions from a CSV or .xlsx file using the same columns Export
 * produces: Date, Type, Amount, Category, Account, Note. Unknown accounts /
 * categories are created automatically.
 */
export async function importTransactions(_prev: ImportResult | undefined, formData: FormData): Promise<ImportResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { ok: false, message: "Choose a CSV or Excel file first." };

    const buf = Buffer.from(await file.arrayBuffer());
    let rows: string[][] = [];

    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      // .xlsx (ZIP magic)
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
      const ws = wb.worksheets[0];
      if (!ws) return { ok: false, message: "No sheet found in that file." };
      ws.eachRow((row) => {
        const vals = (row.values as unknown[]).slice(1).map((v) =>
          v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v),
        );
        rows.push(vals);
      });
    } else {
      rows = buf.toString("utf8").split(/\r?\n/).filter((l) => l.trim()).map(parseCsvLine);
    }
    if (rows.length < 2) return { ok: false, message: "No data rows found." };

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = {
      date: header.indexOf("date"), type: header.indexOf("type"), amount: header.indexOf("amount"),
      category: header.indexOf("category"), account: header.indexOf("account"), note: header.indexOf("note"),
    };
    if (idx.date < 0 || idx.amount < 0) return { ok: false, message: "File needs at least 'Date' and 'Amount' columns." };

    const w = await getActiveWorkspaceId();
    if (!w) return { ok: false, message: "You're not signed in." };
    const db = await getDb();
    const existingAccs = await db.select().from(accounts).where(eq(accounts.workspaceId, w));
    const existingCats = await db.select().from(categories).where(eq(categories.workspaceId, w));
    const accByName = new Map(existingAccs.map((a) => [a.name.toLowerCase(), a.id]));
    const catByKey = new Map(existingCats.map((c) => [`${c.kind}:${c.name.toLowerCase()}`, c.id]));

    let imported = 0;
    let skipped = 0;
    const toInsert: (typeof transactions.$inferInsert)[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const amount = parseFloat(String(row[idx.amount] ?? "").replace(/[^0-9.\-]/g, ""));
      const date = normDate(String(row[idx.date] ?? ""));
      if (!(amount > 0) || !date) { skipped++; continue; }

      const type = idx.type >= 0 && String(row[idx.type] ?? "").trim().toLowerCase() === "income" ? "income" : "expense";
      const note = idx.note >= 0 ? String(row[idx.note] ?? "").trim() : "";
      const accName = idx.account >= 0 ? String(row[idx.account] ?? "").trim() : "";
      const catName = idx.category >= 0 ? String(row[idx.category] ?? "").trim() : "";

      let accountId: string | null;
      if (accName) {
        accountId = accByName.get(accName.toLowerCase()) ?? null;
        if (!accountId) {
          const [a] = await db.insert(accounts).values({ name: accName, workspaceId: w }).returning({ id: accounts.id });
          accountId = a.id;
          accByName.set(accName.toLowerCase(), a.id);
        }
      } else {
        accountId = existingAccs[0]?.id ?? null;
      }

      let categoryId: string | null = null;
      if (catName && catName.toLowerCase() !== "uncategorised") {
        const key = `${type}:${catName.toLowerCase()}`;
        categoryId = catByKey.get(key) ?? null;
        if (!categoryId) {
          const [c] = await db.insert(categories).values({ name: catName, kind: type, workspaceId: w }).returning({ id: categories.id });
          categoryId = c.id;
          catByKey.set(key, c.id);
        }
      }

      toInsert.push({ workspaceId: w, type, amount: String(amount), date, note, accountId, categoryId });
      imported++;
    }

    if (toInsert.length) await db.insert(transactions).values(toInsert);
    revalidatePath("/");
    return { ok: true, message: `Imported ${imported} transaction${imported === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Import failed." };
  }
}
