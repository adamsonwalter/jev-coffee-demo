// Backend mode: the operations console behind each demo (stock, calendar, crews, CRM), plus the quality log.
// Built only from demo.backend (a list of sections) and the demo's data, so a new demo gets a console for free.
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const clock = (t) => new Date(t).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });

// h = { send(effects, note), scenario(id), reset(), clearLog() }; hint = what to say after a scenario was applied
export function drawBackend(root, demo, data, log, h, storeKind = '', hint = '') {
  root.textContent = '';
  const be = demo.backend;
  const top = el('div', 'be-top'), back = el('button', 'be-back', '‹ Voice'); back.dataset.act = 'voice';
  const title = el('div', 'be-title'); title.append(el('b', '', be.name), el('span', '', be.sub));
  const live = el('div', 'be-live' + (storeKind === 'memory' ? ' warn' : '')); live.append(el('i'), document.createTextNode(storeKind === 'memory' ? 'Not saved' : 'Live'));
  top.append(back, title, live); root.appendChild(top);
  if (demo.scenarios && demo.scenarios.length) root.appendChild(scenarios(demo.scenarios, h, hint));
  for (const sec of be.sections) { const f = SECTIONS[sec.type]; if (f) root.appendChild(f(sec, data, h)); }
  root.appendChild(qualityLog(log, h));
  const foot = el('div', 'be-foot'), reset = el('button', 'be-reset', 'Reset demo data'); reset.onclick = () => h.reset();
  foot.append(el('span', '', 'Changes here show up in the voice screen within seconds, and the other way round.' + (storeKind === 'blobs' ? ' Saved in Netlify Blobs.' : storeKind === 'memory' ? ' Storage unavailable: changes will reset.' : '')), reset); root.appendChild(foot);
}

const card = (title, ...kids) => { const c = el('section', 'be-card'); if (title) c.appendChild(el('h3', '', title)); c.append(...kids); return c; };
const lowAt = (sec, data) => (typeof sec.low === 'string' ? Number(data[sec.low]) : sec.low ?? 1);
const dot = (n, low) => el('i', 'dot ' + (n <= 0 ? 'out' : n <= low ? 'low' : 'ok'));
function stepper(n, onDelta) {
  const w = el('div', 'step'), minus = el('button', '', '−'), plus = el('button', '', '+');
  minus.disabled = n <= 0; minus.onclick = () => onDelta(-1); plus.onclick = () => onDelta(1);
  w.append(minus, el('output', '', String(n)), plus); return w;
}

const SECTIONS = {
  // name -> quantity, with − / + and a status dot (red at zero, amber when low)
  stock(sec, data, h) {
    const node = data[sec.path] || {}, low = lowAt(sec, data), t = el('div', 'be-rows');
    for (const k of sec.keys || Object.keys(node)) {
      const n = Number(node[k]) || 0, row = el('div', 'be-row');
      row.append(dot(n, low), el('span', 'name', k), stepper(n, (d) => h.send([{ op: 'add', path: `${sec.path}.${k}`, by: d }], `Backend: ${k} ${d > 0 ? '+1' : '−1'}`)));
      if (n > 0) { const z = el('button', 'zero', 'Sold out'); z.onclick = () => h.send([{ op: 'add', path: `${sec.path}.${k}`, by: -n }], `Backend: ${k} marked sold out`); row.appendChild(z); }
      t.appendChild(row);
    }
    return card(sec.title, t);
  },
  // row x column of quantities (crews free today / tomorrow)
  grid(sec, data, h) {
    const node = data[sec.path] || {}, t = el('div', 'be-grid');
    t.style.setProperty('--cols', sec.cols.length);
    t.appendChild(el('span'));
    sec.cols.forEach((c, i) => t.appendChild(el('span', 'colh', (sec.colLabels || sec.cols)[i])));
    for (const [k, row] of Object.entries(node)) {
      t.appendChild(el('span', 'name', k));
      for (const c of sec.cols) { const n = Number(row[c]) || 0, cell = el('span', 'cell'); cell.append(dot(n, 0), stepper(n, (d) => h.send([{ op: 'add', path: `${sec.path}.${k}.${c}`, by: d }], `Backend: ${k} ${c} ${d > 0 ? '+1' : '−1'}`))); t.appendChild(cell); }
    }
    return card(sec.title, t);
  },
  // free / booked chips, optionally grouped (appointments by day then clinician); tap to flip
  slots(sec, data, h) {
    const items = Object.entries(data[sec.path] || {}).map(([id, s]) => ({ id, ...s })), box = el('div', 'be-slots');
    const chip = (s) => {
      const b = el('button', 'chip ' + s.status, sec.chip(s)); b.title = s.status === 'booked' && s.patient ? s.patient : s.status;
      b.onclick = () => h.send(s.status === 'free'
        ? [{ op: 'set', path: `${sec.path}.${s.id}.status`, value: 'booked' }, ...('patient' in s ? [{ op: 'set', path: `${sec.path}.${s.id}.patient`, value: 'Backend booking' }] : [])]
        : [{ op: 'set', path: `${sec.path}.${s.id}.status`, value: 'free' }, ...('patient' in s ? [{ op: 'set', path: `${sec.path}.${s.id}.patient`, value: '' }] : [])], `Backend: ${sec.chip(s)} ${s.status === 'free' ? 'booked' : 'freed'}`);
      return b;
    };
    const [g1, g2] = sec.groupBy || [];
    if (!g1) { items.forEach((s) => box.appendChild(chip(s))); return card(sec.title, box); }
    const by = (arr, f) => arr.reduce((m, s) => ((m[s[f]] = m[s[f]] || []).push(s), m), {});
    for (const [v1, list1] of Object.entries(by(items, g1))) {
      const day = el('div', 'be-group'); day.appendChild(el('h4', '', sec.groupLabel(g1, Number.isNaN(+v1) ? v1 : +v1)));
      for (const [v2, list2] of Object.entries(g2 ? by(list1, g2) : { '': list1 })) {
        const line = el('div', 'be-line'); if (g2) line.appendChild(el('span', 'who', sec.groupLabel(g2, v2)));
        const free = list2.filter((s) => s.status === 'free').length; line.appendChild(el('span', 'count', free + ' free'));
        const chips = el('div', 'chips'); list2.forEach((s) => chips.appendChild(chip(s))); line.appendChild(chips); day.appendChild(line);
      }
      box.appendChild(day);
    }
    return card(sec.title, box);
  },
  // read-only table (the CRM pipeline); voice updates it
  records(sec, data) {
    const t = el('table', 'be-table'), head = el('tr');
    sec.columns.forEach(([, label]) => head.appendChild(el('th', '', label))); t.appendChild(head);
    for (const rec of Object.values(data[sec.path] || {})) { const tr = el('tr'); sec.columns.forEach(([k, , fmt]) => tr.appendChild(el('td', k === 'stage' ? 'stage' : '', fmt ? fmt(rec[k]) : rec[k] ?? '—'))); t.appendChild(tr); }
    const wrap = el('div', 'be-scroll'); wrap.appendChild(t); return card(sec.title, wrap);
  },
  // what changed, newest first: the record-keeping behind the voice
  activity(sec, data) {
    const list = el('div', 'be-act'); const a = Array.isArray(data.activity) ? data.activity : [];
    if (!a.length) list.appendChild(el('p', 'empty', 'Nothing yet. Confirm something by voice, or tap a count above.'));
    a.forEach((x) => { const r = el('div', 'be-actrow'); r.append(el('time', '', clock(x.t)), el('span', '', x.note)); list.appendChild(r); });
    return card('Activity', list);
  },
};

// One tap sets up a pitch situation. Afterwards it says what to say in Voice to see the backend "ping".
function scenarios(list, h, hint) {
  const box = el('div', 'be-scen');
  list.forEach((sc) => { const b = el('button', 'scen'); b.append(el('b', '', sc.name), el('span', '', sc.blurb)); b.onclick = () => h.scenario(sc.id); box.appendChild(b); });
  const c = card('Scenarios · set up a situation in one tap', box);
  if (hint) { const t = el('div', 'be-hint'); t.append(el('b', '', 'Ready. '), document.createTextNode('Tap ‹ Voice and say: '), el('em', '', '“' + hint + '”')); c.appendChild(t); }
  return c;
}

function qualityLog(log, h) {
  const body = el('div', 'be-act');
  if (!log.length) body.appendChild(el('p', 'empty', 'Nothing flagged. When the final check catches a mismatch, it is recorded here, so gaps in the menus show up.'));
  log.slice(0, 12).forEach((e) => {
    const r = el('div', 'be-actrow q'); r.appendChild(el('time', '', clock(e.t)));
    const what = e.type === 'audit' ? (e.rows || []).map((x) => `${x.row}: “${x.shown}” fits ${Math.round(x.fits * 100)}%`).join(' · ') : `${e.row}: ${e.from} → ${e.to || 'no fit'}`;
    const span = el('span'); span.append(el('b', '', e.demo + ' · ' + (e.type === 'audit' ? 'mismatch' : 'rewritten') + ' '), document.createTextNode(what));
    if (e.transcript) span.appendChild(el('em', '', ' “' + e.transcript.slice(0, 140) + '”'));
    r.appendChild(span); body.appendChild(r);
  });
  const c = card('Quality log · what the final check caught', body);
  if (log.length) { const b = el('button', 'be-reset', 'Clear log'); b.onclick = () => h.clearLog(); c.appendChild(b); }
  return c;
}
