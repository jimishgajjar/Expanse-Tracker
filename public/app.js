/* Notion Money Tracker — frontend.
   Talks to the server API when Notion is configured; otherwise falls back to a
   fully-functional browser-local demo so the app is useful out of the box. */

const CURRENCY = "₹"; // ← change to your currency symbol ($, €, £, …)
const PALETTE = [
  "#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb7185",
  "#22d3ee", "#facc15", "#4ade80", "#f97316", "#818cf8", "#2dd4bf",
  "#e879f9", "#94a3b8",
];

/* ───────────────────────── helpers ───────────────────────── */
const $ = (sel) => document.querySelector(sel);
const ESC = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => ESC(s).replace(/"/g, "&quot;");
const rid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const ym = (d) => String(d || "").slice(0, 7);
const nf = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = (n) => CURRENCY + nf.format(Math.abs(Number(n) || 0));
const monthLabel = (m) => { const [y, mo] = m.split("-"); return new Date(+y, +mo - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }); };
const dayLabel = (d) => { const dt = new Date(d + "T00:00:00"); return isNaN(dt) ? d : dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }); };

/* ───────────────────────── data store ─────────────────────────
   store.mode is 'notion' (server-backed) or 'local' (this browser). */
const LKEY = "money:data:v1";
const TKEY = "money:token";

const local = {
  read() { try { return JSON.parse(localStorage.getItem(LKEY)) || null; } catch { return null; } },
  write(d) { try { localStorage.setItem(LKEY, JSON.stringify(d)); } catch { /* private mode */ } },
  getData() { let d = this.read(); if (!d) { d = seed(); this.write(d); } return d; },
  add(tx) {
    const d = this.getData();
    let cat = d.categories.find((c) => c.type === tx.type && c.name.toLowerCase() === (tx.category || "").trim().toLowerCase());
    if (!cat && (tx.category || "").trim()) {
      cat = { id: "cat-" + rid(), name: tx.category.trim(), type: tx.type, color: PALETTE[d.categories.length % PALETTE.length] };
      d.categories.push(cat);
    }
    const t = {
      id: "tx-" + rid(), type: tx.type, amount: Number(tx.amount) || 0,
      category: cat ? cat.name : (tx.category || "").trim(),
      accountId: tx.accountId || d.accounts[0]?.id || null,
      date: tx.date || today(), note: (tx.note || "").trim(),
    };
    d.transactions.push(t); this.write(d); return t;
  },
  remove(id) { const d = this.getData(); d.transactions = d.transactions.filter((t) => t.id !== id); this.write(d); return { ok: true }; },
};

const store = {
  mode: "local",
  token: "",
  async getData() { return this.mode === "notion" ? this.call("GET", "/api/data") : local.getData(); },
  async add(tx) { return this.mode === "notion" ? this.call("POST", "/api/transactions", tx) : local.add(tx); },
  async remove(id) { return this.mode === "notion" ? this.call("DELETE", "/api/transactions/" + encodeURIComponent(id)) : local.remove(id); },
  async call(method, url, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers.Authorization = "Bearer " + this.token;
    const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { const e = new Error("unauthorized"); e.code = 401; throw e; }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "API " + r.status); }
    return r.json();
  },
};

/* A small, friendly seed so local mode looks alive on first run. */
function seed() {
  const d = today();
  const back = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  const accounts = [
    { id: "acc-cash", name: "Cash", type: "Cash" },
    { id: "acc-bank", name: "Savings", type: "Savings" },
  ];
  const C = (name, type, i) => ({ id: "cat-" + name.toLowerCase().replace(/\W+/g, ""), name, type, color: PALETTE[i % PALETTE.length] });
  const categories = [
    C("Food", "expense", 0), C("Transport", "expense", 1), C("Rent", "expense", 3),
    C("Shopping", "expense", 4), C("Bills", "expense", 5),
    C("Salary", "income", 8), C("Freelance", "income", 11),
  ];
  const T = (type, amount, category, accountId, date, note) => ({ id: "tx-" + rid(), type, amount, category, accountId, date, note });
  const transactions = [
    T("income", 65000, "Salary", "acc-bank", back(28), "Monthly salary"),
    T("income", 12000, "Freelance", "acc-bank", back(12), "Logo design"),
    T("expense", 18000, "Rent", "acc-bank", back(27), "Flat rent"),
    T("expense", 2400, "Food", "acc-cash", back(6), "Groceries"),
    T("expense", 650, "Transport", "acc-cash", back(4), "Cab"),
    T("expense", 3200, "Shopping", "acc-bank", back(3), "Sneakers"),
    T("expense", 1500, "Bills", "acc-bank", back(2), "Electricity"),
    T("expense", 480, "Food", "acc-cash", d, "Lunch"),
  ];
  return { accounts, categories, transactions };
}

/* ───────────────────────── app state ───────────────────────── */
const state = { data: null, month: "all", type: "all", q: "", confirmId: null, formType: "expense" };

/* ───────────────────────── computed ───────────────────────── */
function accountBalances(data) {
  const bal = {};
  data.accounts.forEach((a) => (bal[a.id] = 0));
  data.transactions.forEach((t) => {
    if (!(t.accountId in bal)) bal[t.accountId] = 0;
    bal[t.accountId] += t.type === "income" ? t.amount : -t.amount;
  });
  return bal;
}
const sum = (arr) => arr.reduce((s, t) => s + (Number(t.amount) || 0), 0);
const inPeriod = (data) => state.month === "all" ? data.transactions : data.transactions.filter((t) => ym(t.date) === state.month);

function visibleTx(data) {
  let tx = inPeriod(data).slice();
  if (state.type !== "all") tx = tx.filter((t) => t.type === state.type);
  const q = state.q.trim().toLowerCase();
  if (q) {
    const accName = (id) => (data.accounts.find((a) => a.id === id)?.name || "").toLowerCase();
    tx = tx.filter((t) => (t.note || "").toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q) || accName(t.accountId).includes(q));
  }
  return tx.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id.localeCompare(a.id));
}
function catColor(data, name, type) {
  const c = data.categories.find((x) => x.name === name && x.type === type);
  return c ? c.color : PALETTE[Math.abs([...String(name)].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7)) % PALETTE.length];
}

/* ───────────────────────── render ───────────────────────── */
function render() {
  if (!state.data) return;
  renderModeNote();
  renderSummary();
  renderAccounts();
  renderCharts();
  renderTxList();
}

function renderModeNote() {
  const el = $("#modenote");
  if (store.mode === "notion") { el.className = "modenote on"; el.innerHTML = `<span class="dot"></span> Synced with Notion — changes write straight to your databases.`; }
  else { el.className = "modenote local"; el.innerHTML = `<span class="dot"></span> Local demo mode — add a <code>NOTION_TOKEN</code> on the server to sync real data.`; }
}

function renderSummary() {
  const data = state.data;
  const period = inPeriod(data);
  const income = sum(period.filter((t) => t.type === "income"));
  const expense = sum(period.filter((t) => t.type === "expense"));
  const net = income - expense;
  const balances = accountBalances(data);
  const balance = Object.values(balances).reduce((s, v) => s + v, 0);
  const label = state.month === "all" ? "all time" : monthLabel(state.month);
  $("#summary").innerHTML = `
    <div class="tile balance"><div class="k">Total balance</div><div class="v">${money(balance)}</div><div class="sub2">across ${data.accounts.length} account${data.accounts.length === 1 ? "" : "s"}</div></div>
    <div class="tile income"><div class="k">Income · ${ESC(label)}</div><div class="v">${money(income)}</div><div class="sub2">${period.filter((t) => t.type === "income").length} entries</div></div>
    <div class="tile expense"><div class="k">Expenses · ${ESC(label)}</div><div class="v">${money(expense)}</div><div class="sub2">${period.filter((t) => t.type === "expense").length} entries</div></div>
    <div class="tile net"><div class="k">Net · ${ESC(label)}</div><div class="v ${net >= 0 ? "up" : "down"}">${net < 0 ? "−" : "+"}${money(net)}</div><div class="sub2">${income ? Math.round((net / income) * 100) : 0}% of income saved</div></div>`;
}

function renderAccounts() {
  const data = state.data;
  const bal = accountBalances(data);
  if (!data.accounts.length) { $("#accounts").innerHTML = ""; return; }
  $("#accounts").innerHTML = data.accounts.map((a, i) => {
    const v = bal[a.id] || 0;
    const tc = PALETTE[i % PALETTE.length];
    return `<div class="acct" style="--tc:${tc}">
      <div class="an"><span>${ESC(a.name)}</span><span class="chip">${ESC(a.type)}</span></div>
      <div class="ab ${v < 0 ? "neg" : ""}">${v < 0 ? "−" : ""}${money(v)}</div>
    </div>`;
  }).join("");
}

function donut(segments, total) {
  const size = 180, stroke = 24, r = (size - stroke) / 2, c = 2 * Math.PI * r, cx = size / 2;
  let off = 0;
  const arcs = segments.map((s) => {
    const frac = total ? s.value / total : 0, dash = frac * c;
    const el = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cx})" stroke-linecap="butt"/>`;
    off += dash; return el;
  }).join("");
  return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>${arcs}</svg>`;
}

function renderCharts() {
  const data = state.data;
  const focus = state.type === "income" ? "income" : "expense"; // charts follow the type filter
  const rows = inPeriod(data).filter((t) => t.type === focus);
  const byCat = {};
  rows.forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + (Number(t.amount) || 0)));
  const segs = Object.entries(byCat)
    .map(([name, value]) => ({ name, value, color: catColor(data, name, focus) }))
    .sort((a, b) => b.value - a.value);
  const total = segs.reduce((s, x) => s + x.value, 0);
  const heading = focus === "income" ? "Income by source" : "Spending by category";

  if (!segs.length) {
    $("#charts").innerHTML = `<h3>${heading}</h3><div class="emptychart">No ${focus} in this period.</div>`;
    return;
  }
  const legend = segs.map((s) => `
    <div class="legrow">
      <span class="ld" style="background:${s.color}"></span>
      <span class="ln">${ESC(s.name)}</span>
      <span class="lp">${total ? Math.round((s.value / total) * 100) : 0}%</span>
      <span class="lv">${money(s.value)}</span>
    </div>`).join("");
  $("#charts").innerHTML = `
    <h3>${heading}</h3>
    <div class="donutwrap">${donut(segs, total)}
      <div class="donutmid"><div class="dt">${focus === "income" ? "Earned" : "Spent"}</div><div class="dv">${money(total)}</div></div>
    </div>
    <div class="legend">${legend}</div>`;
}

function renderTxList() {
  const data = state.data;
  const tx = visibleTx(data);
  const acctName = (id) => data.accounts.find((a) => a.id === id)?.name || "—";
  if (!tx.length) {
    $("#txlist").innerHTML = `<h3>Transactions</h3><div class="emptytx"><b>Nothing here yet</b>${state.q || state.type !== "all" || state.month !== "all" ? "Try clearing the filters." : "Add your first transaction to get started."}</div>`;
    return;
  }
  // group by date
  const groups = {};
  tx.forEach((t) => (groups[t.date] = groups[t.date] || []).push(t));
  const body = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map((date) => {
    const rows = groups[date];
    const net = rows.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
    const items = rows.map((t) => {
      const confirming = state.confirmId === t.id;
      const tail = confirming
        ? `<div class="confirm"><button class="yes" data-delyes="${t.id}">Delete</button><button data-delno="${t.id}">Keep</button></div>`
        : `<button class="del" data-del="${t.id}" title="Delete">🗑</button>`;
      return `<div class="tx">
        <span class="cd" style="background:${catColor(data, t.category, t.type)}"></span>
        <div class="tmain">
          <div class="tt">${ESC(t.note || t.category || "Transaction")}</div>
          <div class="tmeta"><span class="ct">${ESC(t.category || "—")}</span><span class="ac">${ESC(acctName(t.accountId))}</span></div>
        </div>
        <span class="amt ${t.type}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</span>
        ${tail}
      </div>`;
    }).join("");
    return `<div class="txgroup">
      <div class="txdate"><span>${ESC(dayLabel(date))}</span><span class="dsum">${net < 0 ? "−" : "+"}${money(net)}</span></div>
      ${items}
    </div>`;
  }).join("");
  $("#txlist").innerHTML = `<h3>Transactions <span style="color:var(--dim)">${tx.length}</span></h3>${body}`;
}

/* ───────────────────────── month filter options ───────────────────────── */
function rebuildMonthOptions() {
  const data = state.data;
  const months = [...new Set(data.transactions.map((t) => ym(t.date)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  if (state.month !== "all" && !months.includes(state.month)) state.month = "all";
  const sel = $("#monthFilter");
  sel.innerHTML = `<option value="all">All time</option>` + months.map((m) => `<option value="${m}">${ESC(monthLabel(m))}</option>`).join("");
  sel.value = state.month;
}

/* ───────────────────────── add-transaction modal ───────────────────────── */
function setFormType(type) {
  state.formType = type;
  document.querySelectorAll("#typeToggle .tt").forEach((b) => b.classList.toggle("on", b.dataset.type === type));
  $("#fCatLabel").textContent = type === "income" ? "Source" : "Category";
  $("#fAccLabel").textContent = type === "income" ? "Deposit to" : "Paid from";
  // category suggestions for this type
  const cats = state.data.categories.filter((c) => c.type === type).map((c) => c.name);
  $("#catList").innerHTML = cats.map((c) => `<option value="${escAttr(c)}">`).join("");
}
function openForm() {
  const data = state.data;
  if (!data.accounts.length) { alert("No accounts found. Add an account in Notion first."); return; }
  $("#fAccount").innerHTML = data.accounts.map((a) => `<option value="${escAttr(a.id)}">${ESC(a.name)}</option>`).join("");
  $("#fAmount").value = ""; $("#fCategory").value = ""; $("#fNote").value = ""; $("#fDate").value = today();
  $("#formErr").textContent = "";
  setFormType(state.type === "income" ? "income" : "expense");
  $("#formModal").classList.remove("hidden");
  setTimeout(() => $("#fAmount").focus(), 30);
}
function closeForm() { $("#formModal").classList.add("hidden"); }

async function submitForm(e) {
  e.preventDefault();
  const amount = parseFloat($("#fAmount").value);
  if (!(amount > 0)) { $("#formErr").textContent = "Enter an amount greater than zero."; return; }
  const tx = {
    type: state.formType,
    amount,
    category: $("#fCategory").value.trim(),
    accountId: $("#fAccount").value,
    date: $("#fDate").value || today(),
    note: $("#fNote").value.trim(),
  };
  const save = $("#formSave");
  save.disabled = true; save.textContent = "Saving…";
  try {
    await store.add(tx);
    await reload();
    closeForm();
  } catch (err) {
    $("#formErr").textContent = err.code === 401 ? "Session expired — reload and unlock again." : (err.message || "Could not save.");
  } finally {
    save.disabled = false; save.textContent = "Save transaction";
  }
}

/* ───────────────────────── delete flow ───────────────────────── */
async function doDelete(id) {
  state.confirmId = null;
  try { await store.remove(id); await reload(); }
  catch (err) { alert(err.message || "Could not delete."); }
}

/* ───────────────────────── reload + boot ───────────────────────── */
async function reload() {
  state.data = await store.getData();
  rebuildMonthOptions();
  render();
}

function wireEvents() {
  $("#addBtn").addEventListener("click", openForm);
  $("#formClose").addEventListener("click", closeForm);
  $("#formCancel").addEventListener("click", closeForm);
  $("#formModal").addEventListener("click", (e) => { if (e.target.id === "formModal") closeForm(); });
  $("#txForm").addEventListener("submit", submitForm);
  document.querySelectorAll("#typeToggle .tt").forEach((b) => b.addEventListener("click", () => setFormType(b.dataset.type)));

  $("#monthFilter").addEventListener("change", (e) => { state.month = e.target.value; render(); });
  $("#typeFilter").addEventListener("change", (e) => { state.type = e.target.value; render(); });
  $("#search").addEventListener("input", (e) => { state.q = e.target.value; renderTxList(); });

  // delegated delete buttons
  $("#txlist").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]"); const yes = e.target.closest("[data-delyes]"); const no = e.target.closest("[data-delno]");
    if (del) { state.confirmId = del.dataset.del; renderTxList(); }
    else if (yes) { doDelete(yes.dataset.delyes); }
    else if (no) { state.confirmId = null; renderTxList(); }
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeForm(); });
}

async function boot() {
  wireEvents();
  let cfg = { notion: false, authRequired: false };
  try { cfg = await store.call("GET", "/api/config"); } catch { /* server unreachable → local */ }

  if (cfg.notion) {
    store.mode = "notion";
    store.token = localStorage.getItem(TKEY) || "";
    if (cfg.authRequired && !store.token) return showUnlock();
    try { await reload(); return; }
    catch (err) {
      if (err.code === 401) return showUnlock();
      store.mode = "local"; // Notion errored — degrade gracefully
    }
  } else {
    store.mode = "local";
  }
  await reload();
}

/* ───────────────────────── unlock gate ───────────────────────── */
function showUnlock() {
  const gate = $("#unlock");
  gate.classList.remove("hidden");
  const input = $("#unlockInput");
  setTimeout(() => input.focus(), 30);
  $("#unlockForm").onsubmit = async (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    store.mode = "notion"; store.token = val;
    try {
      await reload();
      localStorage.setItem(TKEY, val);
      gate.classList.add("hidden");
    } catch (err) {
      $("#unlockErr").textContent = err.code === 401 ? "Wrong token. Try again." : (err.message || "Could not connect.");
    }
  };
}

boot();
