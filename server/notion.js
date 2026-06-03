import { Client } from "@notionhq/client";
import { DB, PROP, PALETTE } from "./config.js";

// Notion SDK v5 talks the 2025-09-03 API, where a *database* contains one or
// more *data sources* and rows are queried/created against the data source —
// not the database directly. We resolve each configured database to its first
// data source once at startup and keep the mapping in `DS`.

const TOKEN = process.env.NOTION_TOKEN;
const notion = TOKEN ? new Client({ auth: TOKEN }) : null;

let DS = {};        // { expenses, incomes, accounts, expenseCategories, incomeCategories } -> data_source_id
let ready = false;

export function isConfigured() { return !!notion; }
export function isReady() { return ready; }

// ── property accessors ───────────────────────────────────
const titleText = (p) => (p?.title || []).map((t) => t.plain_text).join("");
const num = (p) => (typeof p?.number === "number" ? p.number : 0);
const dateStart = (p) => p?.date?.start || null;
const relIds = (p) => (p?.relation || []).map((r) => r.id);
const today = () => new Date().toISOString().slice(0, 10);

async function resolveDataSource(databaseId) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const ds = db.data_sources?.[0]?.id;
  if (!ds) throw new Error(`Notion database ${databaseId} has no data source`);
  return ds;
}

/**
 * Resolve every configured database to its data source. Throws if any database
 * is unreachable (wrong ID, or not shared with the integration) — the caller
 * treats that as "Notion off" and the app falls back to browser-local mode.
 */
export async function init() {
  if (!notion) return false;
  const entries = await Promise.all(
    Object.entries(DB).map(async ([key, id]) => [key, await resolveDataSource(id)])
  );
  DS = Object.fromEntries(entries);
  ready = true;
  return true;
}

async function queryAll(dataSourceId) {
  const out = [];
  let cursor;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

// Read accounts + both category databases and build the lookup maps the rest
// of the module needs (id→name, name→id, and the client-facing colour list).
async function buildMaps() {
  const [accs, ecat, icat] = await Promise.all([
    queryAll(DS.accounts),
    queryAll(DS.expenseCategories),
    queryAll(DS.incomeCategories),
  ]);

  const accounts = accs.map((p) => {
    const name = titleText(p.properties[PROP.accountTitle]);
    return { id: p.id, name, type: /cash/i.test(name) ? "Cash" : "Savings" };
  });

  const catById = {};
  const categories = [];
  let ci = 0;
  ecat.forEach((p) => {
    const name = titleText(p.properties[PROP.expenseCatTitle]).trim();
    catById[p.id] = { name, type: "expense" };
    categories.push({ id: p.id, name, type: "expense", color: PALETTE[ci++ % PALETTE.length] });
  });
  icat.forEach((p) => {
    const name = titleText(p.properties[PROP.incomeCatTitle]).trim();
    catById[p.id] = { name, type: "income" };
    categories.push({ id: p.id, name, type: "income", color: PALETTE[ci++ % PALETTE.length] });
  });

  const expCatByName = {};
  const incCatByName = {};
  ecat.forEach((p) => (expCatByName[titleText(p.properties[PROP.expenseCatTitle]).trim().toLowerCase()] = p.id));
  icat.forEach((p) => (incCatByName[titleText(p.properties[PROP.incomeCatTitle]).trim().toLowerCase()] = p.id));

  return { accounts, categories, catById, expCatByName, incCatByName };
}

/** Everything the dashboard needs in one shot: accounts, categories, transactions. */
export async function getAllData() {
  const maps = await buildMaps();
  const [exp, inc] = await Promise.all([queryAll(DS.expenses), queryAll(DS.incomes)]);
  const fallbackAccount = maps.accounts[0]?.id || null;
  const transactions = [];

  for (const p of exp) {
    const P = p.properties;
    transactions.push({
      id: p.id,
      type: "expense",
      amount: num(P[PROP.expense.amount]),
      category: maps.catById[relIds(P[PROP.expense.category])[0]]?.name || "Others",
      accountId: relIds(P[PROP.expense.account])[0] || fallbackAccount,
      date: dateStart(P[PROP.expense.date]) || today(),
      note: titleText(P[PROP.expense.title]),
    });
  }
  for (const p of inc) {
    const P = p.properties;
    transactions.push({
      id: p.id,
      type: "income",
      amount: num(P[PROP.income.amount]),
      category: maps.catById[relIds(P[PROP.income.category])[0]]?.name || "Other Income",
      accountId: relIds(P[PROP.income.account])[0] || fallbackAccount,
      date: dateStart(P[PROP.income.date]) || today(),
      note: titleText(P[PROP.income.title]),
    });
  }

  return { accounts: maps.accounts, categories: maps.categories, transactions };
}

/** Create a transaction page (creating its category on the fly if new). */
export async function addTransaction(t) {
  const maps = await buildMaps();
  const isIncome = t.type === "income";
  const prop = isIncome ? PROP.income : PROP.expense;
  const byName = isIncome ? maps.incCatByName : maps.expCatByName;

  // resolve (or create) the category page
  let catId = byName[(t.category || "").trim().toLowerCase()];
  if (!catId && t.category) {
    const titleProp = isIncome ? PROP.incomeCatTitle : PROP.expenseCatTitle;
    const created = await notion.pages.create({
      parent: { type: "data_source_id", data_source_id: isIncome ? DS.incomeCategories : DS.expenseCategories },
      properties: { [titleProp]: { title: [{ text: { content: t.category } }] } },
    });
    catId = created.id;
  }

  const properties = {
    [prop.title]: { title: [{ text: { content: t.note || t.category || "Transaction" } }] },
    [prop.amount]: { number: Number(t.amount) || 0 },
    [prop.date]: { date: { start: t.date || today() } },
  };
  if (catId) properties[prop.category] = { relation: [{ id: catId }] };
  if (t.accountId) properties[prop.account] = { relation: [{ id: t.accountId }] };

  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: isIncome ? DS.incomes : DS.expenses },
    properties,
  });
  return { id: page.id, ...t };
}

/** Archive (soft-delete) a transaction page. */
export async function deleteTransaction(id) {
  await notion.pages.update({ page_id: id, in_trash: true });
  return { ok: true };
}
