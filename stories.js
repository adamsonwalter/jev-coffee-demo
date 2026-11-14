// The "What it's for" page: stories for the people who ask. Content is in stories.mjs; this only draws it.
import { PERSONAS, LEGEND, BADGE, LEDE } from './stories.mjs';
import { VERSION } from './version.mjs';
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
  foot.append(el('div', 'st-ver', 'Jev v' + VERSION), el('div', 'st-copy', FOOTER));
  page.append(head, el('p', 'st-lede', LEDE), legend, who, sec, foot);
  root.appendChild(page);
  root.scrollTop = keepScroll;
}

function story(p, s, on) {
  const a = el('article', 'st-story');
  const top = el('div', 'st-top');
  top.append(el('h4', '', s.title), el('span', 'st-badge ' + s.badge, BADGE[s.badge]));
  a.append(top, el('p', 'st-scene', s.scene));
  s.steps.forEach((st) => {
    const step = el('div', 'st-step');
    step.appendChild(st.say ? el('div', 'st-say', '“' + st.say + '”') : el('div', 'st-label', st.label));
    const pills = el('div', 'risks');
    for (const [kind, text] of st.see) {
      if (kind === 'next') { const n = el('div', 'st-next'); n.append(el('b', '', 'Say next'), el('span', '', text)); step.appendChild(n); }
      else pills.appendChild(el('span', 'risk ' + kind, text));
    }
    if (pills.childNodes.length) step.insertBefore(pills, step.querySelector('.st-next'));
    a.appendChild(step);
  });
  a.appendChild(el('p', 'st-payoff', s.payoff));
  if (s.try) {
    const b = el('button', 'st-try', s.try.scenario ? 'Set it up and try it' : 'Try it on the ' + tabName(p.tab) + ' tab');
    b.onclick = () => on.tryIt(p.tab, s.try); a.appendChild(b);
  }
  return a;
}
