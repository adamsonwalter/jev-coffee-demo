// The "What it's for" page: stories for the people who ask. Content is in stories.mjs; this only draws it.
// Each story is told in the layout it declares (scene, dialogue, timeline, compare, parallel, board, alarm), so pages don't read alike.
import { PERSONAS, LEGEND, BADGE, LEDE } from './stories.mjs';
import { stamp } from './version.js';
import { DEMOS } from './demos/index.mjs';

const FOOTER = '© 2026 Walter Adamson | BHP 20 years, Head IT Audit - IT Strategy - Corporate Planning - International Bus Development | 100+ AI workflow solutions delivered | linkedin.com/in/adamson | walter@outcomesnow.com';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const tabName = (id) => (DEMOS.find((d) => d.id === id) || {}).tab || id;

// root: the #stories element. personaId: which friend's stories to show. on: { pick(id), close(), tryIt(tab, t) }
export function drawStories(root, personaId, on) {
  const p = PERSONAS.find((x) => x.id === personaId) || PERSONAS[0];
  const keepScroll = root.dataset.persona === p.id ? root.scrollTop : 0;
  root.textContent = ''; root.dataset.persona = p.id;
  const page = el('div', 'st-page');

  const head = el('header', 'st-head');
  const close = el('button', 'st-close', '×'); close.setAttribute('aria-label', 'Back to the demo'); close.onclick = on.close;
  head.append(el('h2', '', 'What it’s for'), close);

  const legend = el('ul', 'st-legend');
  LEGEND.forEach(([k, t]) => legend.appendChild(el('li', 'st-k-' + k, t)));

  const who = el('nav', 'st-who'); who.setAttribute('aria-label', 'Who it’s for');
  PERSONAS.forEach((x) => { const b = el('button', x.id === p.id ? 'on' : '', x.who); b.onclick = () => on.pick(x.id); who.appendChild(b); });

  const sec = el('section', 'st-persona');
  sec.append(el('h3', '', p.hook), el('p', 'st-checks', p.checks));
  p.stories.forEach((s) => sec.appendChild(story(p, s, on)));
  const open = el('button', 'st-open', 'Open the ' + tabName(p.tab) + ' demo ›'); open.onclick = () => on.tryIt(p.tab, null);
  sec.appendChild(open);

  const foot = el('footer', 'st-foot');
  foot.append(stamp(el('div', 'st-ver'), 'Jev v'), el('div', 'st-copy', FOOTER));
  page.append(head, el('p', 'st-lede', LEDE), legend, who, sec, foot);
  root.appendChild(page);
  root.scrollTop = keepScroll;
}

// ---------- small parts ----------
const pills = (see) => { const d = el('div', 'risks'); see.forEach(([k, t]) => d.appendChild(el('span', 'risk ' + k, t))); return d; };
const sayLine = (t) => el('div', 'st-say', '“' + t + '”');
const nextBox = (t) => { const n = el('div', 'st-next'); n.append(el('b', '', 'Say next'), el('span', '', '“' + t + '”')); return n; };
const dot = (kind) => el('i', 'st-dot ' + kind);

function story(p, s, on) {
  const a = el('article', 'st-story lay-' + s.layout);
  const top = el('div', 'st-top');
  top.append(el('h4', '', s.title), el('span', 'st-badge ' + s.badge, BADGE[s.badge]));
  a.append(top, el('p', 'st-scene', s.scene));
  LAYOUT[s.layout](a, s);
  if (s.kicker) a.appendChild(el('p', 'st-kicker', s.kicker));
  if (s.try) {
    const b = el('button', 'st-try');   // filled and iconed so it can't be mistaken for story text
    b.innerHTML = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>';
    b.append(el('span', '', s.try.scenario ? 'Set it up and try it' : 'Try it on the ' + tabName(p.tab) + ' tab'));
    b.onclick = () => on.tryIt(p.tab, s.try); a.appendChild(b);
  }
  return a;
}

// ---------- layouts ----------
const beat = (b) => {   // a spoken line, what the screen showed, what to say next
  const d = el('div', 'st-step');
  if (b.say) d.appendChild(sayLine(b.say));
  if (b.label) d.appendChild(el('div', 'st-label', b.label));
  if (b.see) d.appendChild(pills(b.see));
  if (b.next) d.appendChild(nextBox(b.next));
  return d;
};

const LAYOUT = {
  scene(a, s) { s.beats.forEach((b) => a.appendChild(beat(b))); },

  dialogue(a, s) {
    const chat = el('div', 'st-chat');
    s.beats.forEach((b) => {
      const row = el('div', 'st-bub ' + b.who + (b.suggested ? ' suggested' : ''));
      if (b.suggested) row.appendChild(el('b', '', 'Say next'));
      row.appendChild(el('span', '', b.suggested ? '“' + b.say + '”' : b.say));
      chat.appendChild(row);
      if (b.see) { const scr = el('div', 'st-screen'); scr.append(el('b', '', 'On your screen'), pills(b.see)); chat.appendChild(scr); }
    });
    a.appendChild(chat);
  },

  timeline(a, s) {
    const ol = el('ol', 'st-tl');
    s.beats.forEach((b) => { const li = el('li'); li.append(el('time', '', b.at), beat(b)); ol.appendChild(li); });
    a.appendChild(ol);
  },

  compare(a, s) {
    const was = el('div', 'st-was'); was.append(el('b', '', 'Today'), el('p', '', s.without));
    const now = el('div', 'st-now'); now.appendChild(el('b', '', 'With Jev')); s.beats.forEach((b) => now.appendChild(beat(b)));
    a.append(was, now);
  },

  parallel(a, s) {
    const g = el('div', 'st-par');
    g.append(el('b', '', s.cols[0]), el('b', '', s.cols[1]));
    s.rows.forEach((r) => { g.appendChild(el('div', 'st-said', r.said)); g.appendChild(pills([r.see])); });
    a.appendChild(g);
    if (s.next) a.appendChild(nextBox(s.next));
  },

  board(a, s) {
    if (s.say) a.appendChild(sayLine(s.say));
    const t = el('div', 'st-board');
    t.append(el('b', '', s.cols[0]), el('b', '', s.cols[1]));
    s.rows.forEach(([l, r, kind]) => { const left = el('div', 'st-l'); left.append(dot(kind), el('span', '', l)); t.append(left, el('div', 'st-r ' + kind, r)); });
    a.appendChild(t);
    if (s.next) a.appendChild(nextBox(s.next));
  },

  alarm(a, s) {
    s.beats.forEach((b) => {
      a.appendChild(sayLine(b.say));
      const [first, ...rest] = b.see;
      a.appendChild(el('div', 'st-alarm', first[1]));
      if (rest.length) a.appendChild(pills(rest));
      if (b.next) a.appendChild(nextBox(b.next));
    });
  },
};
