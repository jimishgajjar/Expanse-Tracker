import { DATA } from './data.js';

/* ───────────────────────── helpers & rendering ───────────────────────── */
const ESC = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = s => String(s).replace(/"/g, '&quot;');

const KW = /\b(record|sealed|interface|implements|permits|switch|case|return|class|void|double|new|var|final|private|public|import|static|export|signal|type|input)\b/g;
const GQL = /\b(type|input|scalar|enum|union|Query|Mutation|Subscription|ID|String|Boolean)\b/g;
function hl(lang, raw) {
  let h = ESC(raw);
  h = h.replace(/(\/\/[^\n]*)/g, '<span class="c">$1</span>');
  if (lang === "graphql") { h = h.replace(GQL, '<span class="g">$1</span>'); }
  else { h = h.replace(/(@[A-Za-z]+)/g, '<span class="s">$1</span>'); h = h.replace(KW, '<span class="k">$1</span>'); }
  return h;
}

const TRACK_NAME = { foundations: "web development", frontend: "web frontend", angular: "Angular", java: "Java", spring: "Spring Boot", database: "SQL database", api: "GraphQL", testing: "software testing", security: "web security", devops: "Docker DevOps", systemdesign: "system design", career: "software engineering", projects: "full stack project" };
const READ_HINT = { foundations: "tutorial mdn web docs", frontend: "tutorial mdn web docs", angular: "Angular tutorial angular.dev", java: "Java tutorial baeldung", spring: "Spring Boot tutorial baeldung", database: "SQL tutorial", api: "GraphQL tutorial graphql.org spring", testing: "software testing tutorial junit cypress playwright", security: "web security OWASP tutorial", devops: "Docker tutorial", systemdesign: "system design tutorial", career: "software engineer career tutorial", projects: "full stack project tutorial" };
const TRY_LINK = { foundations: "https://learngitbranching.js.org/", frontend: "https://stackblitz.com/", angular: "https://stackblitz.com/fork/angular", java: "https://www.jdoodle.com/online-java-compiler/", spring: "https://start.spring.io/", database: "https://www.db-fiddle.com/", api: "https://countries.trevorblades.com/", testing: "https://playwright.dev/", security: "https://portswigger.net/web-security", devops: "https://labs.play-with-docker.com/", systemdesign: "https://github.com/donnemartin/system-design-primer", career: "https://leetcode.com/", projects: "https://roadmap.sh/full-stack" };
const CHANNEL = { foundations: "freeCodeCamp", frontend: "Web Dev Simplified", angular: "Codevolution", java: "Telusko", spring: "Java Brains", database: "freeCodeCamp", api: "The Net Ninja", testing: "Web Dev Simplified", security: "freeCodeCamp", devops: "TechWorld with Nana", systemdesign: "ByteByteGo", career: "NeetCode", projects: "freeCodeCamp" };
function links(track, title) {
  const ch = CHANNEL[track];
  return {
    read: "https://www.google.com/search?q=" + encodeURIComponent(READ_HINT[track] + " " + title),
    watch: "https://www.youtube.com/results?search_query=" + encodeURIComponent(ch + " " + title),
    try: TRY_LINK[track],
    ch
  };
}

/* ───────────────────────── derived structures ───────────────────────── */
let total = 0; const ids = []; const HRS = {}; let totalHours = 0; const FLAT = []; const AIINFO = {}; const META = {};
DATA.forEach((tr, ti) => tr.modules.forEach((m, mi) => m.lessons.forEach((l, li) => {
  if (!l.lang) {
    l.id = `${ti}-${mi}-${li}`; ids.push(l.id); total++;
    const h = tr.track === 'projects' ? 12 : (l.pr ? 2 : 1.5);
    HRS[l.id] = h; totalHours += h;
    FLAT.push({ id: l.id, t: l.t, c: tr.color, tg: tr.title, h });
    AIINFO[l.id] = { t: l.t, track: tr.title, sub: l.sub || "", mod: m.t };
    META[l.id] = { lesson: l.t, track: tr.title, phase: tr.phase, module: m.t, hours: h, points: (l.pts || []).join('\n'), learn: l.sub || '' };
  }
})));

/* ───────────────────────── storage & sync ───────────────────────── */
const LKEY = 'fsmastery_v1', PKEY = 'fsmastery_perday', AKEY = 'anthropic_api_key';
let state = {};           // { lessonId: true }
let MODE = 'local';       // 'local' | 'notion'
let AI_NEEDS_KEY = true;  // false when the server holds an ANTHROPIC_API_KEY

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
function saveLocal() { ls.set(LKEY, JSON.stringify(state)); }
function loadLocal() { try { const r = ls.get(LKEY); state = r ? JSON.parse(r) : {}; } catch { state = {}; } }
function getPerDay() { const v = parseInt(ls.get(PKEY), 10); return (v >= 1 && v <= 6) ? v : 3; }
function setPerDay(v) { ls.set(PKEY, String(v)); }
function getKey() { return ls.get(AKEY) || ''; }
function setKey(v) { ls.set(AKEY, v); }
function note(msg) { const n = document.getElementById('storenote'); if (n) n.textContent = msg || ''; }

async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* ───────────────────────── icons ───────────────────────── */
const SVG_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M5 13l4 4L19 7"/></svg>';
const SVG_READ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 5h7a3 3 0 0 1 3 3v11a2.5 2.5 0 0 0-2.5-2.5H2zM22 5h-7a3 3 0 0 0-3 3v11a2.5 2.5 0 0 1 2.5-2.5H22z"/></svg>';
const SVG_WATCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5zM1 5h15v14H1z"/></svg>';
const SVG_TRY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z"/></svg>';
const SVG_AI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.9 4.8L18.5 9.7l-4.6 1.9L12 16.4l-1.9-4.8L5.5 9.7l4.6-1.9zM19 14l.8 2L22 16.8l-2.2.8L19 20l-.8-2.4L16 16.8l2.2-.8z"/></svg>';

const root = document.getElementById('root');
const tabsEl = document.getElementById('tabs');

function buildTabs() {
  let h = '<button class="tab on" data-t="all" style="--tc:var(--paper)">All</button>';
  DATA.forEach(tr => { h += `<button class="tab" data-t="${tr.track}" style="--tc:${tr.color}">${tr.title}</button>`; });
  tabsEl.innerHTML = h;
  tabsEl.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    tabsEl.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    const f = t.dataset.t;
    document.querySelectorAll('.track').forEach(s => s.classList.toggle('hidden', f !== 'all' && s.dataset.track !== f));
  }));
}

function render() {
  root.innerHTML = "";
  DATA.forEach((tr, ti) => {
    const sec = document.createElement('section');
    sec.className = "track"; sec.dataset.track = tr.track; sec.style.setProperty('--tc', tr.color);
    sec.innerHTML = `<div class="thead"><span class="ph">${tr.phase}</span><h2>${tr.title}</h2><span class="tprog" id="tp-${ti}"></span></div><p class="tdesc">${tr.desc}</p>`;
    tr.modules.forEach((m, mi) => {
      const mod = document.createElement('div'); mod.className = "mod";
      mod.innerHTML = `<div class="mhead"><span class="mnum">${String(mi + 1).padStart(2, '0')}</span><span class="mtitle">${m.t}</span><span class="mmeta" id="mm-${ti}-${mi}"></span><svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg></div><div class="mbar"><i id="mb-${ti}-${mi}"></i></div><div class="mbody"></div>`;
      const body = mod.querySelector('.mbody');
      m.lessons.forEach(l => {
        if (l.lang) { const d = document.createElement('div'); d.innerHTML = `<div class="code-tag">${l.lang}</div><pre>${hl(l.lang, l.raw)}</pre>`; body.appendChild(d); return; }
        const les = document.createElement('div'); les.className = "les"; les.dataset.id = l.id;
        les.dataset.search = (l.t + " " + l.pts.join(" ") + " " + (l.sub || "") + " " + (l.pr ? l.pr.join(" ") : "")).toLowerCase();
        const lk = links(tr.track, l.t);
        const subs = l.sub ? `<div class="subwrap"><span class="lbl">Learn</span><ul class="pts subpts">${l.sub.split(" · ").map(s => `<li>${s}</li>`).join("")}</ul></div>` : "";
        const practice = l.pr ? `<div class="practice"><div class="ph">✎ Practice</div><ul>${l.pr.map(p => `<li>${p}</li>`).join("")}</ul></div>` : "";
        const aiBtn = `<button class="lnk ai" data-ai="${l.id}">${SVG_AI}Ask AI</button>`;
        les.innerHTML = `<div class="lrow"><div class="ck" data-id="${l.id}">${SVG_CHECK}</div><div class="lmain"><div class="lt" data-id="${l.id}">${l.t}</div><ul class="pts">${l.pts.map(p => `<li>${p}</li>`).join("")}</ul>${subs}${practice}<div class="links">${aiBtn}<a class="lnk watch" href="${lk.watch}" target="_blank" rel="noopener noreferrer">${SVG_WATCH}${lk.ch}</a><a class="lnk read" href="${lk.read}" target="_blank" rel="noopener noreferrer">${SVG_READ}Read</a><a class="lnk try" href="${lk.try}" target="_blank" rel="noopener noreferrer">${SVG_TRY}Try</a></div><div class="aipanel" data-aipanel="${l.id}"></div></div></div>`;
        body.appendChild(les);
      });
      mod.querySelector('.mhead').addEventListener('click', () => mod.classList.toggle('open'));
      sec.appendChild(mod);
    });
    root.appendChild(sec);
  });
  document.querySelectorAll('.ck,.lt').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); toggle(el.dataset.id); }));
  document.querySelectorAll('.lnk.ai').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); toggleAI(b.dataset.ai); }));
  paint();
}

function renderPlan() {
  const pd = getPerDay();
  let doneH = 0; ids.forEach(id => { if (state[id]) doneH += HRS[id]; });
  const leftH = Math.max(0, totalHours - doneH);
  const totalDays = Math.ceil(totalHours / pd);
  const daysLeft = Math.ceil(leftH / pd);
  const tpct = totalHours ? doneH / totalHours * 100 : 0;
  let finTxt = "Done 🎉";
  if (daysLeft > 0) { const f = new Date(); f.setDate(f.getDate() + daysLeft); finTxt = f.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
  let acc = 0; const today = [];
  for (const x of FLAT) { if (!state[x.id]) { today.push(x); acc += x.h; if (acc >= pd) break; } }
  let opt = ""; for (let i = 1; i <= 6; i++) opt += `<option value="${i}" ${i === pd ? 'selected' : ''}>${i}</option>`;
  const todayHtml = today.length
    ? today.map(x => `<div class="titem" data-jump="${x.id}"><span class="dot" style="background:${x.c}"></span><span class="nm">${x.t}</span><span class="tg">${x.tg}</span><span class="hr">${x.h}h</span></div>`).join("")
    : '<div class="alldone">Everything complete — you finished the entire path!</div>';
  document.getElementById('plan').innerHTML = `
    <div class="ptiles">
      <div class="tile"><div class="k">Total Workload</div><div class="v">${Math.round(totalHours)}<small> hrs</small></div></div>
      <div class="tile"><div class="k">Daily Pace</div><div class="v"><select id="pace">${opt}</select><small> hrs/day</small></div></div>
      <div class="tile"><div class="k">Full Plan</div><div class="v">${totalDays}<small> days</small></div></div>
      <div class="tile lead"><div class="k">Days Remaining</div><div class="v">${daysLeft}</div></div>
      <div class="tile"><div class="k">Finish By</div><div class="v" style="font-size:19px">${finTxt}</div></div>
    </div>
    <div class="timebar"><i style="width:${tpct}%"></i></div>
    <div class="timelbl"><span>${Math.round(doneH)} hrs studied</span><span>${Math.round(tpct)}% of time</span><span>${Math.round(leftH)} hrs left</span></div>
    <div class="today"><div class="ph">▶ Today's ${pd}-hour plan</div><div class="tlist">${todayHtml}</div></div>`;
  const pace = document.getElementById('pace');
  if (pace) pace.addEventListener('change', e => { setPerDay(parseInt(e.target.value, 10)); renderPlan(); });
  document.querySelectorAll('.titem[data-jump]').forEach(it => it.addEventListener('click', () => jumpTo(it.dataset.jump)));
}

function jumpTo(id) {
  const el = document.querySelector(`.les[data-id="${id}"]`); if (!el) return;
  el.classList.remove('hidden');
  const tr = el.closest('.track'); if (tr) tr.classList.remove('hidden');
  const mod = el.closest('.mod'); if (mod) { mod.classList.remove('hidden'); mod.classList.add('open'); }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const o = el.style.background; el.style.background = 'rgba(95,179,196,.14)';
  setTimeout(() => el.style.background = o, 1400);
}

async function toggle(id) {
  const now = !state[id];
  state[id] = now; paint();
  if (MODE === 'notion') {
    try { await api('PUT', `/api/progress/${id}`, { done: now, meta: META[id] }); }
    catch { note('Saved in this browser — Notion update failed.'); saveLocal(); }
  } else {
    saveLocal();
  }
}

async function reset() {
  state = {}; paint();
  if (MODE === 'notion') { try { await api('POST', '/api/reset', {}); } catch { /* ignore */ } }
  saveLocal();
}

function paint() {
  ids.forEach(id => {
    const done = !!state[id];
    document.querySelectorAll(`.ck[data-id="${id}"]`).forEach(c => c.classList.toggle('done', done));
    const les = document.querySelector(`.les[data-id="${id}"]`); if (les) les.classList.toggle('done', done);
  });
  let doneAll = 0;
  DATA.forEach((tr, ti) => {
    let td = 0, tt = 0;
    tr.modules.forEach((m, mi) => {
      let d = 0, t = 0;
      m.lessons.forEach(l => { if (!l.lang) { t++; tt++; if (state[l.id]) { d++; td++; } } });
      const mb = document.getElementById(`mb-${ti}-${mi}`); if (mb) mb.style.width = (t ? d / t * 100 : 0) + '%';
      const mm = document.getElementById(`mm-${ti}-${mi}`); if (mm) mm.textContent = `${d}/${t}`;
    });
    doneAll += td;
    const tp = document.getElementById(`tp-${ti}`); if (tp) tp.textContent = `${td}/${tt} · ${Math.round(td / tt * 100) || 0}%`;
  });
  const pct = Math.round(doneAll / total * 100);
  document.getElementById('pct').textContent = pct + '%';
  document.getElementById('obar').style.width = pct + '%';
  renderPlan();
}

/* ───────────────────────── AI tutor ───────────────────────── */
function toggleAI(id) {
  const panel = document.querySelector(`.aipanel[data-aipanel="${id}"]`);
  if (!panel) return;
  if (!panel.dataset.built) buildAIPanel(id, panel);
  panel.classList.toggle('open');
}

function buildAIPanel(id, panel) {
  panel.dataset.built = '1';
  const info = AIINFO[id] || {};
  const quicks = ['Explain simply', 'Give an example', 'Quiz me', 'Common mistakes', 'Why it matters'];
  const needKey = AI_NEEDS_KEY && !getKey();
  const keyRow = needKey
    ? `<div class="airow aikeyrow"><input class="aiinput aikey" type="password" placeholder="Paste your Anthropic API key (sk-ant-…)"><button class="aisend aikeysave">Save</button></div>
       <div class="aimuted aikeynote">Stored only in this browser; sent to your local server to call Claude.</div>`
    : '';
  panel.innerHTML = `
    <div class="aihint">✦ AI Tutor · ${ESC(info.t || '')}</div>
    ${keyRow}
    <div class="aibody${needKey ? ' hidden' : ''}">
      <div class="aiquick">${quicks.map(q => `<button class="qbtn" data-q="${escAttr(q)}">${q}</button>`).join('')}</div>
      <div class="airow"><input class="aiinput aimain" placeholder="Ask anything about ${escAttr(info.t || 'this topic')}…"><button class="aisend aiask">Ask</button></div>
      <div class="airesp"></div>
    </div>`;

  const body = panel.querySelector('.aibody');
  const resp = panel.querySelector('.airesp');
  const input = panel.querySelector('.aimain');
  const askBtn = panel.querySelector('.aiask');
  const ask = q => { if (q && q.trim()) askAI(id, q.trim(), resp, askBtn); };

  if (askBtn) askBtn.addEventListener('click', () => ask(input.value));
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') ask(input.value); });
  panel.querySelectorAll('.qbtn').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)));

  const keyInput = panel.querySelector('.aikey');
  if (keyInput) {
    const save = () => {
      const v = keyInput.value.trim(); if (!v) return;
      setKey(v);
      panel.querySelector('.aikeyrow').classList.add('hidden');
      panel.querySelector('.aikeynote').classList.add('hidden');
      body.classList.remove('hidden');
      input.focus();
    };
    panel.querySelector('.aikeysave').addEventListener('click', save);
    keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  }
}

async function askAI(id, question, resp, askBtn) {
  resp.innerHTML = `<span class="spin"></span><span class="aimuted">Thinking…</span>`;
  if (askBtn) askBtn.disabled = true;
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getKey(); if (key) headers['x-anthropic-key'] = key;
    const r = await fetch('/api/ai', { method: 'POST', headers, body: JSON.stringify({ question, lesson: META[id] }) });
    if (!r.ok || !r.body) {
      const e = await r.json().catch(() => ({ error: 'Request failed.' }));
      resp.innerHTML = `<div class="aimuted">⚠️ ${ESC(e.error || 'Request failed.')}</div>`;
      return;
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let text = '';
    resp.innerHTML = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      resp.innerHTML = mdToHtml(text);
    }
    text += dec.decode();
    resp.innerHTML = text ? mdToHtml(text) : '<div class="aimuted">No response.</div>';
  } catch (e) {
    resp.innerHTML = `<div class="aimuted">⚠️ ${ESC(e.message || 'Network error.')}</div>`;
  } finally {
    if (askBtn) askBtn.disabled = false;
  }
}

// Minimal, XSS-safe Markdown → HTML for tutor replies.
function mdToHtml(src) {
  const codes = [];
  let s = String(src).replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) => {
    codes.push(`<pre><code>${ESC(code.replace(/\n$/, ''))}</code></pre>`);
    return ` CODE${codes.length - 1} `;
  });
  s = ESC(s);
  s = s.replace(/`([^`\n]+)`/g, (_m, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  const lines = s.split('\n');
  let html = '', i = 0;
  const isUL = t => /^\s*[-*]\s+/.test(t);
  const isOL = t => /^\s*\d+\.\s+/.test(t);
  const isH = t => /^#{1,4}\s+/.test(t);
  const isCode = t => /^ CODE\d+ $/.test(t);
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (isCode(line)) { html += line; i++; continue; }
    const hm = line.match(/^(#{1,4})\s+(.*)$/);
    if (hm) { const tag = hm[1].length <= 2 ? 'h3' : 'h4'; html += `<${tag}>${hm[2]}</${tag}>`; i++; continue; }
    if (isUL(line)) { html += '<ul>'; while (i < lines.length && isUL(lines[i])) { html += `<li>${lines[i].replace(/^\s*[-*]\s+/, '')}</li>`; i++; } html += '</ul>'; continue; }
    if (isOL(line)) { html += '<ol>'; while (i < lines.length && isOL(lines[i])) { html += `<li>${lines[i].replace(/^\s*\d+\.\s+/, '')}</li>`; i++; } html += '</ol>'; continue; }
    const para = [line]; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isUL(lines[i]) && !isOL(lines[i]) && !isH(lines[i]) && !isCode(lines[i])) { para.push(lines[i]); i++; }
    html += `<p>${para.join('<br>')}</p>`;
  }
  return html.replace(/ CODE(\d+) /g, (_m, n) => codes[+n]);
}

/* ───────────────────────── controls & boot ───────────────────────── */
document.getElementById('search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.les').forEach(l => l.classList.toggle('hidden', q && !l.dataset.search.includes(q)));
  if (q) document.querySelectorAll('.mod').forEach(m => { const any = [...m.querySelectorAll('.les')].some(l => !l.classList.contains('hidden')); m.classList.toggle('open', any); m.classList.toggle('hidden', !any && !!m.querySelector('.les')); });
  else document.querySelectorAll('.mod').forEach(m => m.classList.remove('hidden'));
});
document.getElementById('reset').addEventListener('click', reset);

(async () => {
  let cfg = { notion: false, aiServerKey: false };
  try { cfg = await api('GET', '/api/config'); } catch { /* server not reachable */ }
  AI_NEEDS_KEY = !cfg.aiServerKey;

  if (cfg.notion) {
    try {
      const r = await api('GET', '/api/progress');
      state = r.progress || {}; MODE = 'notion';
      note('Synced with Notion.');
    } catch {
      MODE = 'local'; loadLocal();
      note('Notion unreachable — progress saved in this browser.');
    }
  } else {
    MODE = 'local'; loadLocal();
    note('Progress saved in this browser. Add a Notion token to sync across devices.');
  }

  buildTabs();
  render();
})();
