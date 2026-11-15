// One conversation's state: when to ask Jev, and what to do with the answers. No DOM, so it is tested in Node (tests/conversation.test.mjs).
//   hear(text)   new words arrived. Reads are throttled, and only one is ever in flight: words that arrive meanwhile wait,
//                and the newest replaces any older ones waiting. So no Jev call is started just to be thrown away.
//   pause()      the mic stopped: run the second look soon.
//   newSession() the mic started again: earlier final-check corrections no longer hold.
//   reset()      tab change or Clear: forget everything; anything still in flight is ignored when it lands.
// After a pause the "second look" runs: settle the unsure fields, then final-check the whole card (see jev.js).
import { TUNING as T } from './demos/lib.mjs';
import { settle, finalCheck, Stale } from './jev.js';

// post(body, signal) -> Jev's reply.  demo() -> the current demo.  listening() -> is the mic on.
// ui: render(fields, settled, tags) -> the demo's render output | engine(kind, text) | offline() | chime()
export function createConversation({ post, demo, listening, ui }) {
  let epoch = 0, ctl = null, busy = false, waiting = null, throttle = null, sweepTimer = null, lastFire = 0, downAt = 0;
  let fields = null, text = '', shown = null, checked = '', pins = {};

  const down = () => Date.now() - downAt < T.retryMs;
  const fresh = () => { ctl && ctl.abort(); ctl = new AbortController(); return ctl.signal; };
  const sweepIn = (ms) => { clearTimeout(sweepTimer); sweepTimer = setTimeout(sweep, ms); };

  function hear(t) {
    waiting = t;
    if (busy || throttle) return;   // the read in flight, or the timer, picks up the newest words
    throttle = setTimeout(() => { throttle = null; const next = waiting; waiting = null; lastFire = Date.now(); read(next); }, Math.max(150, T.throttleMs - (Date.now() - lastFire)));
  }

  async function read(t) {
    if (down()) { ui.offline(); return; }
    const mine = ++epoch, signal = fresh(), t0 = Date.now();   // starting a read cancels a second look in progress
    busy = true; clearTimeout(sweepTimer); ui.engine('jev busy', 'Jev…');
    try {
      const f = (await post({ demo: demo().id, transcript: t }, signal)).fields;
      if (mine !== epoch) return;
      for (const k in pins) if (f[k] && f[k].value !== pins[k].value && (f[k].confidence == null || f[k].confidence < T.pinOverride)) f[k] = pins[k];   // keep final-check rewrites
      fields = f; text = t;
      ui.engine('jev', 'Jev · ' + (Date.now() - t0) + ' ms');
      shown = ui.render(f);
    } catch (e) {
      if (mine !== epoch || e.name === 'AbortError') return;
      downAt = Date.now(); ui.offline();
    } finally {
      if (mine === epoch) { busy = false; if (waiting != null) hear(waiting); else sweepIn(listening() ? T.pauseMs : 350); }
    }
  }

  // Second look: settle uncertain fields, then final-check the whole card.
  async function sweep() {
    clearTimeout(sweepTimer);
    if (busy || throttle || !fields || !text || down()) return;   // a pending read schedules the sweep again when it lands
    const mine = epoch, t = text, signal = fresh();
    const call = async (body) => { const d = await post({ demo: demo().id, transcript: t, ...body }, signal); if (mine !== epoch) throw new Stale(); return d; };
    try {
      ui.engine('jev busy', 'Jev checking…');
      const t0 = Date.now(), s = await settle(call, fields);
      if (s) { fields = s.merged; shown = ui.render(fields, true); ui.engine('jev', 'Jev · settled ' + (Date.now() - t0) + ' ms'); }
      if (t === checked || !shown) { if (!s) ui.engine('jev', 'Jev · live'); return; }
      ui.engine('jev busy', 'Final check…');
      const fc = await finalCheck(call, demo(), shown.rows, fields);
      checked = t;   // only once the check has actually run
      if (!fc) { ui.engine('jev', 'Jev · live'); return; }
      if (!fc.revised && !fc.doubts) { ui.engine('jev', 'Jev · final check clean'); return; }
      Object.assign(pins, fc.pins); fields = fc.merged; shown = ui.render(fields, true, fc.tags); ui.chime();
      ui.engine('jev', 'Jev · final check: ' + [fc.revised && fc.revised + ' revised', fc.doubts && fc.doubts + ' to check'].filter(Boolean).join(', '));
    } catch (e) { if (!(e instanceof Stale) && e.name !== 'AbortError') ui.engine('jev', 'Jev · live'); }
  }

  return {
    hear,
    pause: () => sweepIn(350),
    newSession() { pins = {}; checked = ''; },
    reset() {
      epoch++; ctl && ctl.abort(); clearTimeout(throttle); clearTimeout(sweepTimer);
      throttle = null; busy = false; waiting = null; fields = null; text = ''; shown = null; checked = ''; pins = {};
    },
  };
}
