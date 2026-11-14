// The screen: tabs, rows, flags, and the wiring between speech (speech.js), Jev (jev.js) and effects (fx/).
import { DEMOS } from './demos/index.mjs';
import { TUNING as T } from './demos/lib.mjs';
import { post, settle, finalCheck, Stale } from './jev.js';
import { fx } from './fx/index.js';
import { createListener, voiceProblem, idleHint, iosApp } from './speech.js';
import * as ops from './ops.js';
import { drawBackend } from './backend.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const sayEl = $('say'), micBtn = $('mic'), micHint = $('micHint'), risksEl = $('risks'), rowsEl = $('rows'), confirmBtn = $('confirm');

// Per-conversation state. Reset by resetOutput() (tab change, Clear) and by each new mic session.
let mode = 'voice', log = [], drawn = '', hint = '', demo = DEMOS[0], seq = 0, ctl = null, lastFields = null, lastText = '', lastRender = null, lastChecked = '', pins = {};
let jevDownAt = 0, sweepTimer = null, throttleTimer = null, pendingText = '', lastFire = 0, tryTimer = null, tryIdx = 0;

const jevDown = () => Date.now() - jevDownAt < T.retryMs;
const fresh = () => { ctl && ctl.abort(); ctl = new AbortController(); return ctl.signal; };   // newest request wins
function say(text, cls) { sayEl.textContent = cls === 'heard' ? fx.mask(text) : text; sayEl.className = 'say' + (cls ? ' ' + cls : ''); }
function toast(t) { const n = $('toast'); n.textContent = t; n.classList.add('show'); setTimeout(() => n.classList.remove('show'), 2400); }
function setEngine(kind, txt) { $('engine').className = 'engine ' + kind; $('engineTxt').textContent = txt; }

// ---------- tabs ----------
function buildTabs() {
  DEMOS.forEach((d) => { const b = el('button', 'tab', d.tab); b.dataset.id = d.id; b.onclick = () => { if (!listener.listening) fx.unlock(); select(d.id); }; $('tabs').appendChild(b); });
}
function select(id) {
  listener.stop(); seq++; clearTimeout(throttleTimer); throttleTimer = null; ctl && ctl.abort();
  demo = DEMOS.find((d) => d.id === id) || DEMOS[0];
  syncUrl(); ops.load(demo.id);
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.id === demo.id));
  $('title').textContent = ''; $('title').append(demo.title[0] + ' ', el('span', '', demo.title.slice(1).join(' ')));
  document.title = demo.id === DEMOS[0].id ? 'Jev ' + demo.title[1] : 'Jev · ' + demo.tab;
  rowsEl.textContent = '';
  demo.labels.forEach((l) => { const r = el('div', 'row'); r.append(el('label', '', l), el('div', 'v empty', '—')); rowsEl.appendChild(r); });
  startTry(); fx.tab(demo.id);
  resetOutput(); setEngine('', 'ready'); fx.reset();
}
function syncUrl() {   // #quote = that tab; #quote/backend = that tab's backend (open it on a laptop beside the phone)
  const h = mode === 'backend' ? '#' + demo.id + '/backend' : demo.id === DEMOS[0].id ? '' : '#' + demo.id;
  try { history.replaceState(null, '', location.pathname + h); } catch (_) {}
}
function startTry() {   // one rotating "Try saying" line
  clearInterval(tryTimer);
  const line = el('i'); $('try').textContent = ''; $('try').append(el('b', '', 'Try saying'), line);
  tryIdx = Math.floor(Math.random() * demo.chips.length);
  const show = () => { line.style.opacity = 0; setTimeout(() => { line.textContent = '“' + demo.chips[tryIdx++ % demo.chips.length] + '”'; line.style.opacity = 1; }, 220); };
  line.style.transition = 'opacity .22s'; show();
  if (demo.chips.length > 1) tryTimer = setInterval(show, 5000);
}
function resetOutput() {
  lastFields = null; lastText = ''; lastRender = null; lastChecked = ''; pins = {}; clearTimeout(sweepTimer);
  rowsEl.querySelectorAll('.v').forEach((n) => { n.className = 'v empty'; n.textContent = '—'; });
  for (const id of ['under', 'banner', 'extra']) $(id).textContent = '';
  risksEl.textContent = '';
  confirmBtn.disabled = true; confirmBtn.className = ''; confirmBtn.textContent = demo.confirm;
  say(demo.say, 'idle');
}

// ---------- render: demo.render(fields) -> rows, flags, panels ----------
function render(f, settled, tags) {
  const out = demo.render(f, ops.data(demo.id));
  if (!out.rows.some((r) => r && r[0]) && !(out.flags || []).length) out.flags = [{ m: 'Heard you, but no order details yet. Keep talking.', s: 'warn' }];
  lastRender = out;
  let changed = false;
  [...rowsEl.children].forEach((row, i) => {
    const n = row.querySelector('.v'), [val, unsure] = out.rows[i] || [], text = val || '—', tag = tags && tags[i];
    const before = n.firstChild && n.firstChild.nodeType === 3 ? n.firstChild.textContent : n.textContent;
    n.classList.toggle('empty', !val);
    if (before !== text) { n.textContent = text; n.classList.add(settled ? 'settle' : 'flash'); setTimeout(() => n.classList.remove('flash', 'settle'), settled ? 1100 : 450); changed = true; }
    n.querySelector('small')?.remove();
    if (val && tag) n.append(el('small', 'final', tag.kind === 'revised' ? 'final check: was ' + tag.was : 'final check: doesn’t fit what was said'));
    else if (val && unsure) n.append(el('small', '', 'not sure — check'));
  });
  const said = out.rows.filter((r) => r && r[0] && r[0] !== 'None' && r[0] !== '—').map((r) => r[0]);
  $('under').textContent = ''; if (said.length) $('under').append(el('b', '', 'Understood'), el('span', '', said.join(' · ')));
  if (changed && !tags) fx.pip();

  $('banner').textContent = '';
  if (out.banner) { const b = el('div', 'banner'); b.append(el('b', '', out.banner.title), el('span', '', out.banner.body)); $('banner').appendChild(b); }
  risksEl.textContent = '';
  let flags = out.flags || [];
  const cap = out.maxFlags || demo.maxFlags || 0;
  if (cap && flags.length > cap) flags = flags.slice(0, cap - 1).concat([{ m: '+' + (flags.length - cap + 1) + ' more to check', s: 'warn' }]);
  flags.forEach((r) => risksEl.appendChild(el('span', 'risk ' + r.s, r.m)));
  renderExtra(out.extra);
  confirmBtn.disabled = !out.ok; confirmBtn.textContent = out.confirm || demo.confirm; confirmBtn.classList.toggle('danger', !!out.danger);
}
function renderExtra(x) {   // optional panel under the card: price range, score ring, or a note
  const box = $('extra'); box.textContent = '';
  if (!x) return;
  const d = el('div', 'extra');
  if (x.kind === 'range') {
    const small = el('div', 'small'); x.small.forEach((t) => small.appendChild(el('div', '', t)));
    d.append(el('div', 'big', x.big), small, el('div', 'note', x.note));
  } else if (x.kind === 'score') {
    const ring = el('div', 'ring'); ring.style.setProperty('--c', { Hot: 'var(--ok)', Warm: 'var(--amber)' }[x.band] || 'var(--out)'); ring.style.setProperty('--p', x.score); ring.append(el('b', '', x.score));
    const side = el('div'); side.append(el('div', 't', x.band + ' deal'), el('div', 's', 'Deal score, computed from Jev’s answers'));
    const row = el('div', 'score'); row.append(ring, side); d.appendChild(row);
  } else d.appendChild(el('div', 'note', x.note));
  box.appendChild(d);
}

// ---------- live reading: the words so far -> Jev -> screen ----------
async function handleText(text) {
  const mySeq = ++seq;
  if (jevDown()) { setEngine('off', 'Jev offline'); say('Jev can’t be reached right now. Try again in a moment.', 'err'); return; }
  setEngine('jev busy', 'Jev…');
  const t0 = performance.now();
  try {
    const d = await post({ demo: demo.id, transcript: text }, fresh());
    if (mySeq !== seq) return;
    const f = d.fields;
    for (const k in pins) if (f[k] && f[k].value !== pins[k].value && (f[k].confidence == null || f[k].confidence < T.pinOverride)) f[k] = pins[k];   // keep final-check rewrites
    lastFields = f; lastText = text;
    setEngine('jev', 'Jev · ' + Math.round(performance.now() - t0) + ' ms');
    render(f);
    if (listener.listening) { clearTimeout(sweepTimer); sweepTimer = setTimeout(sweep, T.pauseMs); }
  } catch (e) {
    if (e.name === 'AbortError') return;
    jevDownAt = Date.now(); setEngine('off', 'Jev offline'); say('Jev can’t be reached right now. Try again in a moment.', 'err');
  }
}
// Throttle, not debounce: while someone talks continuously, still refresh about every 0.6 s.
function readSoon(text) {
  pendingText = text;
  if (throttleTimer) return;
  throttleTimer = setTimeout(() => { throttleTimer = null; lastFire = Date.now(); handleText(pendingText); }, Math.max(150, T.throttleMs - (Date.now() - lastFire)));
}

// ---------- after a pause or mic-off: settle uncertain fields, then final-check the whole card ----------
async function sweep() {
  clearTimeout(sweepTimer);
  if (!lastFields || !lastText || jevDown()) return;
  const mySeq = seq, text = lastText, signal = fresh();
  const call = async (body) => { const d = await post({ demo: demo.id, transcript: text, ...body }, signal); if (mySeq !== seq) throw new Stale(); return d; };
  try {
    setEngine('jev busy', 'Jev checking…');
    const t0 = performance.now(), s = await settle(call, lastFields);
    if (s) { lastFields = s.merged; render(lastFields, true); setEngine('jev', 'Jev · settled ' + Math.round(performance.now() - t0) + ' ms'); }
    if (text !== lastChecked && lastRender) {
      lastChecked = text; setEngine('jev busy', 'Final check…');
      const fc = await finalCheck(call, demo, lastRender.rows, lastFields);
      if (!fc) { setEngine('jev', 'Jev · live'); return; }
      if (!fc.revised && !fc.doubts) { setEngine('jev', 'Jev · final check clean'); return; }
      Object.assign(pins, fc.pins); lastFields = fc.merged; render(fc.merged, true, fc.tags); fx.finalCheck();
      setEngine('jev', 'Jev · final check: ' + [fc.revised && fc.revised + ' revised', fc.doubts && fc.doubts + ' to check'].filter(Boolean).join(', '));
    } else if (!s) setEngine('jev', 'Jev · live');
  } catch (e) { if (!(e instanceof Stale) && e.name !== 'AbortError') setEngine('jev', 'Jev · live'); }
}

// ---------- speech ----------
const listener = createListener({
  onText(full, phraseDone) { say('“' + full + '”', 'heard'); fx.heard(full); if (phraseDone) fx.pip(); readSoon(full); },
  onState(on) { micBtn.classList.toggle('on', on); micHint.textContent = on ? 'Listening… tap to stop' : idleHint(); },
  onNotice: say,
  onQuickEnd: () => fx.audioConflict(),
});
micBtn.addEventListener('click', () => {
  if (listener.listening) { if (listener.stop()) setTimeout(sweep, 350); return; }
  const problem = voiceProblem(); if (problem) { say(problem, 'err'); return; }
  pins = {}; lastChecked = ''; fx.reset();
  if (listener.start()) fx.unlock();   // after start(), same tap
});

$('clear').addEventListener('click', () => { listener.stop(); seq++; clearTimeout(throttleTimer); throttleTimer = null; ctl && ctl.abort(); resetOutput(); setEngine('', 'ready'); fx.reset(); });
confirmBtn.addEventListener('click', () => {
  if (!lastRender) return;
  const { effects, note, toast: msg } = lastRender, id = demo.id;
  if (navigator.vibrate) navigator.vibrate(40);
  toast(msg || 'Done'); $('clear').click();
  if (effects && effects.length) ops.send(id, effects, note);   // confirming updates the backend: stock down, slot booked, CRM updated
});

// ---------- backend mode: the operations console behind the voice ----------
function setMode(m) {
  mode = m; document.body.classList.toggle('be', m === 'backend'); $('backend').hidden = m !== 'backend';
  if (m === 'backend') { listener.stop(); drawn = ''; refreshBackend(true); } else { hint = ''; ops.load(demo.id); }
  syncUrl();
}
async function refreshBackend(force) {
  const root = $('backend');
  await ops.load(demo.id); log = await ops.loadLog();
  const sig = JSON.stringify([ops.data(demo.id), log, demo.id, ops.storeKind, hint]);
  if (!force && sig === drawn) return;
  drawn = sig; const y = root.scrollTop;
  drawBackend(root, demo, ops.data(demo.id), log, {
    send: async (effects, note) => { await ops.send(demo.id, effects, note); drawn = ''; refreshBackend(true); },
    scenario: async (sid) => { hint = await ops.scenario(demo.id, sid); drawn = ''; refreshBackend(true); },
    reset: async () => { await ops.reset(demo.id); hint = ''; drawn = ''; refreshBackend(true); },
    clearLog: async () => { log = await ops.clearLog(); drawn = ''; refreshBackend(true); },
  }, ops.storeKind, hint);
  root.scrollTop = y;
}
$('modeBtn').addEventListener('click', () => setMode('backend'));
$('backend').addEventListener('click', (e) => { if (e.target.closest('[data-act=voice]')) setMode('voice'); });
let tick = 0;
setInterval(() => { if (document.hidden) return; if (mode === 'backend') refreshBackend(); else if (++tick % 3 === 0) ops.load(demo.id); }, 3000);

// ---------- Safari bounce: an old home-screen install runs without Safari, where iPhone blocks the microphone ----------
if (iosApp) {
  $('bounce').hidden = false;
  $('bounceBtn').addEventListener('click', () => {
    const url = location.origin + location.pathname + location.hash;
    window.location.href = 'x-safari-' + url;                       // asks iOS to hand the page to Safari
    setTimeout(() => { try { window.open(url, '_blank'); } catch (_) {} }, 600);   // fallback if that scheme is ignored
  });
}

// ---------- boot ----------
buildTabs();
function route() {   // #quote or #quote/backend
  const [id, sub] = (location.hash || '').slice(1).split('/'), want = DEMOS.find((d) => d.id === id) || DEMOS[0];
  if (want.id !== demo.id || !document.querySelector('.tab.on')) select(want.id);
  setMode(sub === 'backend' ? 'backend' : 'voice');
}
route();
window.addEventListener('hashchange', route);
micHint.textContent = idleHint();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
