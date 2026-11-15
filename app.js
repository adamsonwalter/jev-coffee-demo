// The screen: tabs, rows, flags, and the wiring between speech (speech.js), Jev (jev.js) and effects (fx/).
import { DEMOS } from './demos/index.mjs';
import { pickSay } from './demos/lib.mjs';
import { post } from './jev.js';
import { createConversation } from './conversation.js';
import { fx } from './fx/index.js';
import { createListener, voiceProblem, idleHint, iosApp } from './speech.js';
import * as ops from './ops.js';
import { drawBackend } from './backend.js';
import { drawStories } from './stories.js';
import { PERSONAS } from './stories.mjs';
import { stamp, loadVersion } from './version.js';
import { el } from './dom.js';

const $ = (id) => document.getElementById(id);
const sayEl = $('say'), micBtn = $('mic'), micHint = $('micHint'), risksEl = $('risks'), rowsEl = $('rows'), confirmBtn = $('confirm');

// Screen state. What Jev has understood so far lives in conversation.js; this file only draws it.
let mode = 'voice', drawn = '', hint = '', demo = DEMOS[0], lastRender = null;
let storiesOpen = false, lastHash = '', pendingSay = null;
let tryTimer = null, tryIdx = 0;

// The resting line (nothing said yet) also carries the version, so you can tell which copy of the app you are looking at.
function restTag() { sayEl.classList.add('rest'); sayEl.appendChild(stamp(el('small', 'vtag'), 'Jev v')); }
function say(text, cls) { sayEl.textContent = cls === 'heard' ? fx.mask(text) : text; sayEl.className = 'say' + (cls ? ' ' + cls : ''); }
function toast(t) { const n = $('toast'); n.textContent = t; n.classList.add('show'); setTimeout(() => n.classList.remove('show'), 2400); }
function setEngine(kind, txt) { $('engine').className = 'engine ' + kind; $('engineTxt').textContent = txt; }

// ---------- tabs ----------
function buildTabs() {
  DEMOS.forEach((d) => { const b = el('button', 'tab', d.tab); b.dataset.id = d.id; b.onclick = () => { if (!listener.listening) fx.unlock(); select(d.id); }; $('tabs').appendChild(b); });
}
function select(id) {
  demo = DEMOS.find((d) => d.id === id) || DEMOS[0];
  syncUrl(); ops.load(demo.id);
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.id === demo.id));
  $('title').textContent = ''; $('title').append(demo.title[0] + ' ', el('span', '', demo.title.slice(1).join(' ')));
  document.title = demo.id === DEMOS[0].id ? 'Jev ' + demo.title[1] : 'Jev · ' + demo.tab;
  rowsEl.textContent = '';
  demo.labels.forEach((l) => { const r = el('div', 'row'); r.append(el('label', '', l), el('div', 'v empty', '—')); rowsEl.appendChild(r); });
  $('demoBtn').hidden = !demo.video;
  const sb = $('storiesBtn'); if (sb) sb.href = '#stories/' + personaFor(demo.id);   // the icon opens the stories for the tab you're on
  startTry(); fx.tab(demo.id);
  clearAll();
}
const personaFor = (tab) => (PERSONAS.find((p) => p.tab === tab) || PERSONAS[0]).id;   // the first person whose stories belong to this tab
function syncUrl() {   // while the stories page is open the URL belongs to it
  if (storiesOpen) return;
  // #quote = that tab; #quote/backend = that tab's backend (open it on a laptop beside the phone)
  const h = mode === 'backend' ? '#' + demo.id + '/backend' : demo.id === DEMOS[0].id ? '' : '#' + demo.id;
  try { history.replaceState(null, '', location.pathname + h); } catch (_) {}
}
function startTry() {   // one rotating "Try saying" line. While Jev has something worth saying next, the same slot shows that instead (showNext).
  clearInterval(tryTimer);
  const box = $('try'); box.className = 'try'; delete box.dataset.next;
  const line = el('i'); box.textContent = ''; box.append(el('b', '', 'Try saying'), line);
  tryIdx = Math.floor(Math.random() * demo.chips.length);
  const show = () => { line.style.opacity = 0; setTimeout(() => { line.textContent = '“' + demo.chips[tryIdx++ % demo.chips.length] + '”'; line.style.opacity = 1; }, 220); };
  line.style.transition = 'opacity .22s'; show();
  if (demo.chips.length > 1) tryTimer = setInterval(show, 5000);
}
function showNext(text) {   // "Say next": one sentence in the Try saying slot, so the screen gets no new block. No sentence -> examples come back.
  const box = $('try');
  if (!text) { if (box.dataset.next) startTry(); return; }
  if (box.dataset.next === text) return;
  clearInterval(tryTimer);
  box.className = 'try next'; box.dataset.next = text; box.textContent = '';
  box.append(el('b', '', 'Say next'), el('i', '', '“' + text + '”'));
}
// Stop listening and wipe the conversation and the card (tab change, Clear, after Confirm).
function clearAll() {
  listener.stop(); convo.reset(); fx.reset(); setEngine('', 'ready'); lastRender = null;
  rowsEl.querySelectorAll('.v').forEach((n) => { n.className = 'v empty'; n.textContent = '—'; });
  for (const id of ['under', 'banner', 'extra']) $(id).textContent = '';
  risksEl.textContent = '';
  confirmBtn.disabled = true; confirmBtn.className = ''; confirmBtn.textContent = demo.confirm;
  say(demo.say, 'idle'); restTag(); showNext(null);
}

// ---------- render: demo.render(fields) -> rows, flags, panels ----------
function render(f, settled, tags) {
  const out = demo.render(f, ops.data(demo.id));
  if (!out.rows.some((r) => r && r[0]) && !(out.flags || []).length) out.flags = [{ m: 'Heard you, but no order details yet. Keep talking.', s: 'warn' }];
  lastRender = out; showNext(pickSay(out));
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
  return out;
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

// ---------- the conversation: words -> Jev -> screen (timing and the second look are in conversation.js) ----------
const convo = createConversation({
  post, demo: () => demo, listening: () => listener.listening,
  ui: {
    render, engine: setEngine, chime: fx.finalCheck,
    offline() { setEngine('off', 'Jev offline'); say('Jev can’t be reached right now. Try again in a moment.', 'err'); },
  },
});

// ---------- speech ----------
const listener = createListener({
  onText(full, phraseDone) { say('“' + full + '”', 'heard'); fx.heard(full); if (phraseDone) fx.pip(); convo.hear(full); },
  onState(on) { micBtn.classList.toggle('on', on); micHint.textContent = on ? 'Listening… tap to stop' : idleHint(); },
  onNotice: say,
  onQuickEnd: () => fx.audioConflict(),
});
micBtn.addEventListener('click', () => {
  if (listener.listening) { if (listener.stop()) convo.pause(); return; }
  const problem = voiceProblem(); if (problem) { say(problem, 'err'); return; }
  convo.newSession(); fx.reset();
  if (listener.start()) fx.unlock();   // after start(), same tap
});

$('clear').addEventListener('click', clearAll);
confirmBtn.addEventListener('click', () => {
  if (!lastRender) return;
  const { effects, note, toast: msg } = lastRender, id = demo.id;
  if (navigator.vibrate) navigator.vibrate(40);
  toast(msg || 'Done'); clearAll();
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
  await ops.load(demo.id, true);   // data and quality log in one call
  const sig = JSON.stringify([ops.data(demo.id), ops.log, demo.id, ops.storeKind, hint]);
  if (!force && sig === drawn) return;
  drawn = sig; const y = root.scrollTop;
  drawBackend(root, demo, ops.data(demo.id), ops.log, {
    send: async (effects, note) => { await ops.send(demo.id, effects, note); drawn = ''; refreshBackend(true); },
    scenario: async (sid) => { hint = await ops.scenario(demo.id, sid); drawn = ''; refreshBackend(true); },
    reset: async () => { await ops.reset(demo.id); hint = ''; drawn = ''; refreshBackend(true); },
    clearLog: async () => { await ops.clearLog(); drawn = ''; refreshBackend(true); },
  }, ops.storeKind, hint);
  root.scrollTop = y;
}
$('modeBtn').addEventListener('click', () => setMode('backend'));
$('backend').addEventListener('click', (e) => { if (e.target.closest('[data-act=voice]')) setMode('voice'); });
let tick = 0;
setInterval(() => { if (document.hidden) return; if (mode === 'backend') refreshBackend(); else if (++tick % 3 === 0) ops.load(demo.id); }, 3000);

// ---------- Safari bounce: an old home-screen install runs without Safari, where iPhone blocks the microphone ----------
if (iosApp) {
  $('bounce').hidden = false; $('bounce').appendChild(stamp(el('small', 'vtag'), 'Jev v'));
  $('bounceBtn').addEventListener('click', () => {
    const url = location.origin + location.pathname + location.hash;
    window.location.href = 'x-safari-' + url;                       // asks iOS to hand the page to Safari
    setTimeout(() => { try { window.open(url, '_blank'); } catch (_) {} }, 600);   // fallback if that scheme is ignored
  });
}

// ---------- demo video: opens full screen, plays on tap, closes on × / backdrop / Escape ----------
function closeVideo() { const v = $('playerVideo'); v.pause(); v.removeAttribute('src'); v.load(); $('player').hidden = true; }
$('demoBtn').addEventListener('click', () => {
  if (!demo.video) return;
  listener.stop(); fx.unlock();
  const v = $('playerVideo'); v.src = demo.video; $('player').hidden = false;
  v.play().catch(() => {});   // if autoplay is refused, the controls are right there
});
$('playerClose').addEventListener('click', closeVideo);
$('player').addEventListener('click', (e) => { if (e.target === $('player')) closeVideo(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('player').hidden) closeVideo(); });

// ---------- boot ----------
buildTabs();
// ---------- stories: "What it's for", opened from the icon in the header; #stories/dentist links straight to one person's stories ----------
function showStories(personaId) {
  const root = $('stories'); if (!root) return;   // an older page without the stories element: stay on the demo
  listener.stop(); storiesOpen = true;
  if (!document.querySelector('.tab.on')) select(DEMOS[0].id);   // a direct link still needs the demo behind it
  const wasHidden = root.hidden;
  drawStories(root, personaId || personaFor(demo.id), {
    pick: (pid) => { location.hash = '#stories/' + pid; },
    close: () => { location.hash = lastHash; },
    tryIt: async (tab, t) => {   // set up the scenario (if any), go to that tab, and show the phrase to say
      if (t && t.scenario) await ops.scenario(tab, t.scenario);
      if (t) pendingSay = 'Say: “' + t.say + '”';
      location.hash = tab === DEMOS[0].id ? '' : '#' + tab;
    },
  });
  root.hidden = false; if (wasHidden) root.scrollTop = 0;
}
function hideStories() { storiesOpen = false; const root = $('stories'); if (root) root.hidden = true; }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && storiesOpen) location.hash = lastHash; });

function route() {   // #quote, #quote/backend, #stories or #stories/dentist
  const [id, sub] = (location.hash || '').slice(1).split('/');
  if (id === 'stories') { showStories(sub); return; }
  hideStories(); lastHash = location.hash;
  const want = DEMOS.find((d) => d.id === id) || DEMOS[0];
  if (want.id !== demo.id || !document.querySelector('.tab.on')) select(want.id);
  setMode(sub === 'backend' ? 'backend' : 'voice');
  if (pendingSay) { say(pendingSay, 'idle'); pendingSay = null; }
}
route();
window.addEventListener('hashchange', route);
if ($('ver')) stamp($('ver'), 'v');
loadVersion();   // read /version.json; every label above fills in when it arrives
micHint.textContent = idleHint();
// The service worker is retired (see sw.js). Remove any that an earlier version left on this phone.
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
