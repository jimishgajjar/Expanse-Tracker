import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as notion from "./notion.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const APP_TOKEN = process.env.APP_TOKEN || "";

const app = express();
app.use(express.json({ limit: "1mb" }));

let notionReady = false;
if (notion.isConfigured()) {
  try { notionReady = await notion.init(); }
  catch (e) { console.warn("[notion] init failed — running without sync:", e.message); }
}

// Optional shared-password gate. Active only when APP_TOKEN is set; otherwise
// every request passes (fine for localhost / a trusted network).
function auth(req, res, next) {
  if (!APP_TOKEN) return next();
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token !== APP_TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
}

// ── public probes (no auth — the UI needs these to decide what to show) ──
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/config", (_req, res) => res.json({ notion: notionReady, authRequired: !!APP_TOKEN }));

// ── data routes (gated by auth when APP_TOKEN is set) ──
app.get("/api/data", auth, async (_req, res) => {
  if (!notionReady) return res.status(503).json({ error: "Notion not configured" });
  try { res.json(await notion.getAllData()); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.post("/api/transactions", auth, async (req, res) => {
  if (!notionReady) return res.status(503).json({ error: "Notion not configured" });
  try { res.json(await notion.addTransaction(req.body || {})); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.delete("/api/transactions/:id", auth, async (req, res) => {
  if (!notionReady) return res.status(503).json({ error: "Notion not configured" });
  try { res.json(await notion.deleteTransaction(req.params.id)); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ── static frontend ──
app.use(express.static(join(__dirname, "..", "public")));

app.listen(PORT, () => {
  console.log(`\n  Notion Money Tracker → http://localhost:${PORT}`);
  console.log(`  Notion:   ${notionReady ? "ON" : "OFF (browser-local mode)"}`);
  console.log(`  API lock: ${APP_TOKEN ? "on (APP_TOKEN set)" : "off"}\n`);
});
