// What the function can do. Every mode takes a transcript and returns plain JSON; none touches HTTP.
//   read     ask a demo's questions            (live updates, and the settling pass with final + only)
//   audit    rate each on-screen row against the transcript      (final check, step 1)
//   rewrite  re-ask one or more fields after a bad audit         (final check, step 2)
// Demos come from demos/*.mjs, so a new demo needs no change here.
import { DEMOS } from '../demos/index.mjs';
import { ch, TUNING } from '../demos/lib.mjs';
import { callSystemOne, callExtract } from './gateway.mjs';
import { logEvent } from './ops.mjs';

const MODEL = process.env.JEV_MODEL || 'jev-latest';
const SETS = Object.fromEntries(DEMOS.map((d) => [d.id, { q: d.questions, ctx: d.ctx, extract: d.extract || {} }]));
const NOFIT = 'None of these options describes what was said well';
const FINAL = ' This is the complete final transcript of everything said. Consider the whole conversation: later statements override earlier ones, and answer what the speaker meant.';

class Bad extends Error { constructor(code, status = 400) { super(code); this.status = status; } }
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const fieldOf = (a = {}) => ({ value: a.choice, confidence: a.confidence ?? null, p: a.probabilities || null });
const pick = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));

const MODES = {
  async read({ body, set, transcript, ask, extract }) {
    let questions = set.q, context = set.ctx, xKeys = Object.keys(set.extract);
    if (body.final) {
      context += FINAL;
      if (Array.isArray(body.only) && body.only.length) {
        questions = pick(set.q, body.only);   // may be empty when only free-text fields were asked for
        xKeys = xKeys.filter((k) => body.only.includes(k));
      }
    }
    // Free text (names, companies, amounts) is extracted in parallel with Jev's typed answers, so it adds no delay.
    const [d, x] = await Promise.all([
      Object.keys(questions).length ? ask({ transcript, context }, questions) : { answers: {} },
      xKeys.length ? extract({ text: transcript, fields: pick(set.extract, xKeys), min_confidence: 0.9 }).catch(() => null) : null,
    ]);
    const fields = Object.fromEntries(Object.entries(d.answers || {}).map(([k, a]) => [k, fieldOf(a)]));
    for (const k of xKeys) {
      const r = x && x.fields && x.fields[k];
      if (r) fields[k] = { value: r.value ?? null, confidence: r.value == null ? (r.p_null ?? 1) : (r.confidence ?? null), p: null };
    }
    return { model: d.model, fields };
  },

  async audit({ body, transcript, ask, log }) {
    const rows = (Array.isArray(body.shown) ? body.shown : []).slice(0, 8).map((r) => ({ label: clip(r.label, 40), value: clip(r.value, 80) })).filter((r) => r.label && r.value);
    if (!rows.length) throw new Bad('nothing_to_audit');
    const questions = {}, on_screen = {};
    rows.forEach((r, i) => {
      on_screen[r.label] = r.value;
      questions['a' + i] = ch({
        fits: `The ${r.label} shown is an accurate and specific description of what was said`,
        imprecise: `The ${r.label} shown is vague, generic or a poor description of the specific thing that was said (for example the speaker named a particular material, object or trade)`,
        wrong: `The ${r.label} shown contradicts what was said`,
      });
    });
    const d = await ask({ transcript, on_screen, context: 'The speaker dictated this. The on_screen entries are what an app displayed from it. Audit each entry against the transcript.' }, questions);
    const audit = rows.map((r, i) => { const a = (d.answers || {})['a' + i] || {}; return { label: r.label, shown: r.value, fits: a.probabilities ? a.probabilities.fits ?? 0 : 1, cls: a.choice || 'fits' }; });
    const bad = audit.filter((a) => a.fits < TUNING.auditMismatch);
    if (bad.length) await log({ type: 'audit', demo: body.demo, transcript: clip(transcript, 300), rows: bad.map((a) => ({ row: a.label, shown: a.shown, fits: Math.round(a.fits * 100) / 100 })) });
    return { audit: audit.map(({ label, fits, cls }) => ({ label, fits, cls })) };
  },

  async rewrite({ body, set, transcript, ask, log }) {
    const shown = clip(body.shown, 60);
    if (Array.isArray(body.keys)) {                       // a row built from several yes/no answers: re-ask them all, fresh
      const keys = body.keys.filter((k) => set.q[k]).slice(0, 8);
      if (!keys.length) throw new Bad('unknown_key');
      const d = await ask({ transcript, context: set.ctx + FINAL + ` The earlier reading ${JSON.stringify(shown)} was judged a poor fit; re-read everything.` }, pick(set.q, keys));
      return { fields: Object.fromEntries(keys.map((k) => [k, fieldOf((d.answers || {})[k])])) };
    }
    const key = clip(body.key, 40), base = set.q[key];
    if (!base || !base.criteria) throw new Bad('unknown_key');
    const exclude = clip(body.exclude, 40);               // one choice: take the old answer off the menu and add a "none fits" escape
    const criteria = { ...Object.fromEntries(Object.entries(base.criteria).filter(([o]) => o !== exclude)), NoFit: NOFIT };
    const d = await ask({ transcript, context: set.ctx + FINAL + ` The earlier answer ${JSON.stringify(exclude)} was judged a poor fit. Pick the best remaining option, or NoFit.` }, { [key]: { type: 'choice', criteria } });
    const field = fieldOf((d.answers || {})[key]);
    await log({ type: 'rewrite', demo: body.demo, row: key, from: exclude, to: field.value, confidence: field.confidence });
    return { field };
  },
};

// body -> { status, body }. Jev, extraction and the log are injectable so tests run without any of them.
export async function run(body = {}, { call = callSystemOne, extract = callExtract, log = logEvent } = {}) {
  const safeLog = (ev) => Promise.resolve(log(ev)).catch(() => {});   // logging must never break a request
  const demo = clip(body.demo || 'coffee', 20), mode = clip(body.mode || 'read', 10), transcript = clip(body.transcript, 900).trim();
  const set = SETS[demo];
  try {
    if (!set) throw new Bad('unknown_demo');
    if (!MODES[mode]) throw new Bad('unknown_mode');
    if (!transcript) throw new Bad('empty');
    const t0 = Date.now();
    const out = await MODES[mode]({ body, set, transcript, ask: (state, questions) => call({ model: MODEL, state, questions }), extract, log: safeLog });
    return { status: 200, body: { engine: 'jev', ms: Date.now() - t0, ...out } };
  } catch (e) {
    return { status: e instanceof Bad ? e.status : 502, body: { error: String(e.message || e) } };
  }
}
