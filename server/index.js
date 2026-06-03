import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as notion from './notion.js';
import { streamTutor, hasServerKey, aiError } from './ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: '1mb' }));

let notionReady = false;
if (notion.isConfigured()) {
  try { notionReady = await notion.init(); }
  catch (e) { console.warn('[notion] init failed:', e.message); }
}

// ── API ──────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({ notion: notionReady, aiServerKey: hasServerKey() });
});

app.get('/api/progress', async (_req, res) => {
  if (!notionReady) return res.json({ progress: {} });
  try { res.json({ progress: await notion.getProgress() }); }
  catch (e) { res.status(500).json({ error: e.message, progress: {} }); }
});

app.put('/api/progress/:id', async (req, res) => {
  if (!notionReady) return res.status(503).json({ error: 'Notion not configured' });
  try {
    await notion.setLesson(req.params.id, !!req.body?.done, req.body?.meta || {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reset', async (_req, res) => {
  if (!notionReady) return res.json({ ok: true });
  try { await notion.reset(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai', async (req, res) => {
  const apiKey = req.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(400).json({ error: 'No Anthropic API key. Paste your key in the AI panel.' });

  const { lesson, question } = req.body || {};
  if (!question || !String(question).trim()) return res.status(400).json({ error: 'Empty question.' });

  try {
    const { started } = await streamTutor(res, { apiKey, lesson, question });
    if (!started) { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.write(''); }
    res.end();
  } catch (err) {
    const msg = aiError(err);
    if (!res.headersSent) res.status(err?.status || 500).json({ error: msg });
    else { try { res.write(`\n\n⚠️ ${msg}`); } catch { /* ignore */ } res.end(); }
  }
});

// ── Static frontend ──────────────────────────────────────
app.use(express.static(join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`\n  Full-Stack Mastery Tracker → http://localhost:${PORT}`);
  console.log(`  Notion sync:   ${notionReady ? 'ON' : 'OFF (progress saved in the browser)'}`);
  console.log(`  AI server key: ${hasServerKey() ? 'set' : 'not set (users paste their own in the UI)'}\n`);
});
