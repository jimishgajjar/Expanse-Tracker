import { Client } from '@notionhq/client';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Notion SDK v5 uses the 2025-09-03 API: a *database* contains one or more
// *data sources*, and rows are queried/created against the data source — not
// the database. We track both IDs (DB = database, DS = data source).

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = join(__dirname, '..', '.notion-db.json');

const TOKEN = process.env.NOTION_TOKEN;
const PARENT = process.env.NOTION_PARENT_PAGE_ID || null;
let DB = process.env.NOTION_DATABASE_ID || null;
let DS = null;

const notion = TOKEN ? new Client({ auth: TOKEN }) : null;
let ready = false;

export function isConfigured() { return !!TOKEN; }
export function isReady() { return ready; }
export function ids() { return { database: DB, dataSource: DS }; }

const SCHEMA = {
  'Lesson': { title: {} },
  'Lesson ID': { rich_text: {} },
  'Phase': { select: {} },
  'Track': { select: {} },
  'Module': { rich_text: {} },
  'Hours': { number: { format: 'number' } },
  'Done': { checkbox: {} },
  'Completed At': { date: {} },
};

/** Resolve (or create) the progress database + its data source. */
export async function init() {
  if (!notion) return false;

  if (!DB && existsSync(CACHE)) {
    try {
      const c = JSON.parse(readFileSync(CACHE, 'utf8'));
      DB = c.databaseId || null; DS = c.dataSourceId || null;
    } catch { /* ignore */ }
  }

  if (DB) {
    try {
      const db = await notion.databases.retrieve({ database_id: DB });
      DS = db.data_sources?.[0]?.id || DS;
      if (!DS) throw new Error('database has no data source');
      ready = true;
      return true;
    } catch (e) {
      console.warn('[notion] configured database not accessible:', e.message);
      DB = null; DS = null;
    }
  }

  if (PARENT) {
    const created = await notion.databases.create({
      parent: { type: 'page_id', page_id: PARENT },
      title: [{ type: 'text', text: { content: 'Full-Stack Mastery — Progress' } }],
      initial_data_source: { properties: SCHEMA },
    });
    DB = created.id;
    DS = created.data_sources?.[0]?.id || null;
    try { writeFileSync(CACHE, JSON.stringify({ databaseId: DB, dataSourceId: DS }, null, 2)); } catch { /* ignore */ }
    console.log('[notion] created progress database', DB);
    ready = !!DS;
    return ready;
  }

  console.warn('[notion] NOTION_TOKEN is set but neither NOTION_DATABASE_ID nor NOTION_PARENT_PAGE_ID is — cannot sync.');
  return false;
}

async function findPage(lessonId) {
  const r = await notion.dataSources.query({
    data_source_id: DS,
    filter: { property: 'Lesson ID', rich_text: { equals: lessonId } },
    page_size: 1,
  });
  return r.results[0] || null;
}

/** Map of { lessonId: true } for every completed lesson. */
export async function getProgress() {
  const done = {};
  let cursor;
  do {
    const r = await notion.dataSources.query({ data_source_id: DS, start_cursor: cursor, page_size: 100 });
    for (const p of r.results) {
      const id = p.properties?.['Lesson ID']?.rich_text?.[0]?.plain_text;
      if (id && p.properties?.['Done']?.checkbox) done[id] = true;
    }
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return done;
}

/** Upsert a lesson's completion state. Creates a row only when marking done. */
export async function setLesson(id, done, meta = {}) {
  const base = {
    'Done': { checkbox: !!done },
    'Completed At': done ? { date: { start: new Date().toISOString() } } : { date: null },
  };

  const existing = await findPage(id);
  if (existing) {
    await notion.pages.update({ page_id: existing.id, properties: base });
    return;
  }
  if (!done) return;

  await notion.pages.create({
    parent: { type: 'data_source_id', data_source_id: DS },
    properties: {
      'Lesson': { title: [{ text: { content: meta.lesson || id } }] },
      'Lesson ID': { rich_text: [{ text: { content: id } }] },
      'Phase': meta.phase ? { select: { name: meta.phase } } : { select: null },
      'Track': meta.track ? { select: { name: meta.track } } : { select: null },
      'Module': { rich_text: [{ text: { content: meta.module || '' } }] },
      'Hours': { number: typeof meta.hours === 'number' ? meta.hours : null },
      ...base,
    },
  });
}

/** Move every row to trash — a clean slate. */
export async function reset() {
  const pages = [];
  let cursor;
  do {
    const r = await notion.dataSources.query({ data_source_id: DS, start_cursor: cursor, page_size: 100 });
    for (const p of r.results) pages.push(p.id);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  for (const pid of pages) {
    try { await notion.pages.update({ page_id: pid, in_trash: true }); } catch { /* ignore */ }
  }
}
