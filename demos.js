// Demo definitions. Each demo: what to say, how to turn Jev's typed answers into screen rows, flags and numbers.
// Jev returns fields: { key: { value, confidence, p } }. All arithmetic happens here, in code.
(function () {
  const v = (f, k) => (f[k] && f[k].value) || null;
  const yes = (f, k) => !!f[k] && f[k].value === 'yes';
  const low = (f, k) => !!f[k] && f[k].confidence != null && f[k].confidence < 0.7;
  const pr = (f, k, opt) => (f[k] && f[k].p && f[k].p[opt]) || 0;

  // ---------- COFFEE (home) ----------
  const stock = { Oat: true, Almond: true, Soy: false, Skim: true, 'Full cream': true, croissant: false, muffin: true, extra_shot: true, syrup: true };
  const coffee = {
    id: 'coffee', tab: 'Coffee', title: ['Jev', 'Coffee'],
    say: 'Tap the mic and say your order',
    placeholder: 'Or type here, or use your keyboard’s mic',
    chips: ['Large oat latte, extra shot, croissant', 'Flat white no milk', 'Medium cappuccino almond milk', 'Small soy mocha and a muffin'],
    labels: ['Drink', 'Size', 'Milk', 'Extras'],
    confirm: 'Confirm order',
    render(f) {
      const drink = f.drink && f.drink.value !== 'None' ? v(f, 'drink') : null;
      const size = f.size && f.size.value !== 'Unspecified' ? v(f, 'size') : (drink ? 'Medium' : null);
      const milk = f.milk && f.milk.value !== 'Unspecified' ? v(f, 'milk') : null;
      const labels = { extra_shot: 'Extra shot', croissant: 'Croissant', muffin: 'Muffin', syrup: 'Vanilla syrup' };
      const ex = Object.keys(labels).filter((k) => yes(f, k));
      const flags = [];
      if (milk && stock[milk] === false) flags.push({ m: milk + ' milk out of stock', s: 'out' });
      if (yes(f, 'croissant') && !stock.croissant) flags.push({ m: 'Croissant unavailable — try a muffin', s: 'out' });
      if (yes(f, 'muffin') && !stock.muffin) flags.push({ m: 'Muffin unavailable', s: 'out' });
      if (yes(f, 'extra_shot') && !stock.extra_shot) flags.push({ m: 'Extra shots limited', s: 'warn' });
      if (drink && !milk && !['Espresso', 'Long Black', 'Americano'].includes(drink)) flags.push({ m: 'Milk not heard — ask customer', s: 'warn' });
      if (drink && !flags.length) flags.push({ m: 'No stock issues', s: 'ok' });
      return {
        rows: [[drink, low(f, 'drink')], [size, low(f, 'size')], [milk, low(f, 'milk')], [ex.length ? ex.map((k) => labels[k]).join(', ') : (drink ? 'None' : null)]],
        flags, ok: !!drink && !flags.some((x) => x.s === 'out'),
        toast: [size, drink].filter(Boolean).join(' ') + (milk && milk !== 'None' ? ' · ' + milk : ''),
      };
    },
  };

  // ---------- QUOTE ----------
  const SCOPE = { Small: [350, 1200], Medium: [1500, 5500], Large: [6500, 22000] };
  const TRADE_X = { Bathroom: 1.2, Roofing: 1.1 };
  const quote = {
    id: 'quote', tab: 'Quote', title: ['Jev', 'Quote'],
    say: 'Describe the job as you would to a colleague',
    placeholder: 'Or type the job here',
    chips: [
      '1970s brick unit bathroom reno, strata weekdays nine to three only, damp under the vanity, moving the toilet, customer buys tiles',
      'Replace a hot water system, easy access, it is leaking now',
      'Repaint three bedrooms in a new house, any day, flexible',
    ],
    labels: ['Trade', 'Scope', 'Access', 'Materials'],
    confirm: 'Send range to customer',
    render(f) {
      const trade = v(f, 'trade'), scope = v(f, 'scope');
      if (!trade || !scope) return { rows: [[null], [null], [null], [null]], flags: [], ok: false };
      let [lo, hi] = SCOPE[scope]; const x = TRADE_X[trade] || 1; lo *= x; hi *= x;
      const flags = [], adds = [];
      if (v(f, 'access') === 'Restricted') { lo *= 1.1; hi *= 1.1; flags.push({ m: 'Access window limits the schedule (+10%)', s: 'warn' }); }
      if (yes(f, 'hidden_risk')) { lo *= 1.2; hi *= 1.2; flags.push({ m: 'Hidden-damage contingency (+20%)', s: 'warn' }); }
      if (v(f, 'urgency') === 'Emergency') { lo *= 1.25; hi *= 1.25; flags.push({ m: 'Emergency call-out loading (+25%)', s: 'out' }); }
      if (yes(f, 'old_building')) { adds.push(['Asbestos / lead check before demolition', 450, 900]); flags.push({ m: 'Old building: test before you touch it', s: 'out' }); }
      if (yes(f, 'permit')) { adds.push(['Permit and certifier sign-off', 300, 1200]); flags.push({ m: 'Licensed sign-off or permit likely', s: 'warn' }); }
      if (low(f, 'scope')) flags.push({ m: 'Scope unclear: ask how many rooms and days', s: 'warn' });
      let tlo = lo, thi = hi; adds.forEach((a) => { tlo += a[1]; thi += a[2]; });
      const fmt = (n) => 'A$' + (Math.round(n / 50) * 50).toLocaleString('en-AU');
      const mat = v(f, 'materials');
      return {
        rows: [[trade === 'Bathroom' ? 'Bathroom / kitchen' : trade], [scope, low(f, 'scope')], [v(f, 'access') === 'Unknown' ? '—' : v(f, 'access')], [mat === 'Unspecified' ? '—' : (mat === 'Customer' ? 'Customer supplies' : 'Contractor supplies')]],
        flags: flags.length ? flags : [{ m: 'No risk flags', s: 'ok' }],
        extra: { kind: 'range', big: fmt(tlo) + ' – ' + fmt(thi), small: ['Labour and base scope ' + fmt(lo) + ' – ' + fmt(hi)].concat(adds.map((a) => a[0] + ' ' + fmt(a[1]) + ' – ' + fmt(a[2]))), note: 'Indicative range only. Not a quote.' },
        ok: true, toast: 'Range sent: ' + fmt(tlo) + ' – ' + fmt(thi),
      };
    },
  };

  // ---------- FRONT DESK ----------
  const REASON = { Checkup: 'Check-up', Injury: 'New injury or illness', Followup: 'Follow-up', Repeat: 'Repeat prescription', Results: 'Test results', Other: 'Other' };
  const DAY = { Today: 'Today', Tomorrow: 'Tomorrow', ThisWeek: 'This week', NextWeek: 'Next week' };
  const desk = {
    id: 'desk', tab: 'Front desk', title: ['Jev', 'Front Desk'],
    say: 'Speak as a caller would: who, why, and when',
    placeholder: 'Or type what the caller says',
    chips: [
      'Hi it is Dave, I have been before, I need a repeat script, mornings next week are fine',
      'First time here, sore knee since the weekend, can I come in tomorrow afternoon',
      'I have had tight chest pain since this morning and it goes down my arm, can I come in today',
    ],
    labels: ['Reason', 'Urgency', 'Patient', 'When'],
    confirm: 'Book appointment',
    render(f) {
      if (!f.reason) return { rows: [[null], [null], [null], [null]], flags: [], ok: false };
      const red = yes(f, 'red_flag');
      const when = [DAY[v(f, 'day')], v(f, 'time') && v(f, 'time') !== 'Unspecified' ? v(f, 'time').toLowerCase() : null].filter(Boolean).join(' · ');
      const flags = [];
      if (v(f, 'urgency') === 'Urgent' && !red) flags.push({ m: 'Needs a same-day slot', s: 'warn' });
      if (v(f, 'patient') === 'New') flags.push({ m: 'New patient: collect ID and Medicare', s: 'warn' });
      if (v(f, 'reason') === 'Repeat') flags.push({ m: 'Needs clinician sign-off', s: 'warn' });
      if (!red && !flags.length) flags.push({ m: 'Routine booking', s: 'ok' });
      return {
        banner: red ? { title: 'Possible emergency. Do not book.', body: 'Transfer to the nurse now. If the caller is alone or worsening, tell them to call 000.' } : null,
        rows: [[REASON[v(f, 'reason')], low(f, 'reason')], [v(f, 'urgency') === 'Soon' ? 'Within days' : v(f, 'urgency'), low(f, 'urgency')], [v(f, 'patient') === 'Unspecified' ? '—' : v(f, 'patient')], [when || '—']],
        flags, ok: true, confirm: red ? 'Escalate to nurse now' : null, danger: red,
        extra: { kind: 'note', note: 'Demo only. Not medical advice. Jev sorts what was said; a person decides.' },
        toast: red ? 'Escalated to nurse' : 'Booked: ' + (when || 'time to confirm'),
      };
    },
  };

  // ---------- SALES NOTES ----------
  const sales = {
    id: 'sales', tab: 'Sales', title: ['Jev', 'Sales Notes'],
    say: 'Dictate your call notes in your own words',
    placeholder: 'Or type your call notes',
    chips: [
      'Good call with Priya at Northwind, she loves it but says the price is steep and needs her CFO to sign off. Looking at a competitor too. Wants it live by end of quarter. Said she will think about it. I will send a proposal Friday',
      'Met the owner, signed budget of fifty thousand, wants to start this month, book a demo for Tuesday',
    ],
    labels: ['Interest', 'Budget', 'Timeline', 'Decision maker', 'Next step'],
    confirm: 'Save to CRM',
    render(f) {
      if (!f.interest) return { rows: [[null], [null], [null], [null], [null]], flags: [], ok: false };
      const interest = 40 * pr(f, 'interest', 'Hot') + 22 * pr(f, 'interest', 'Warm') + 5 * pr(f, 'interest', 'Cold');
      const bud = { Confirmed: 20, Vague: 10, NotDiscussed: 6, TooHigh: 2 }[v(f, 'budget')] || 0;
      const tl = { Now: 15, Quarter: 10, Later: 3 }[v(f, 'timeline')] || 0;
      const dm = { Yes: 15, No: 6, Unknown: 3 }[v(f, 'decision_maker')] || 0;
      const nx = { Proposal: 10, Demo: 10, Call: 6, None: 0 }[v(f, 'next_step')] || 0;
      let score = interest + bud + tl + dm + nx - (yes(f, 'stall') ? 10 : 0) - (yes(f, 'competitor') ? 5 : 0);
      score = Math.max(0, Math.min(100, Math.round(score)));
      const band = score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold';
      const flags = [];
      if (yes(f, 'stall')) flags.push({ m: 'Stalling: re-engage within 48 hours', s: 'warn' });
      if (yes(f, 'competitor')) flags.push({ m: 'Competitor in play: prepare a comparison', s: 'warn' });
      if (v(f, 'budget') === 'TooHigh') flags.push({ m: 'Price objection: offer a phased scope', s: 'out' });
      if (v(f, 'decision_maker') === 'No') flags.push({ m: 'Decision maker not on the call: ask for an intro', s: 'warn' });
      if (v(f, 'next_step') === 'None') flags.push({ m: 'No next step agreed', s: 'out' });
      if (!flags.length) flags.push({ m: 'Clean deal, no flags', s: 'ok' });
      const T = { Now: 'This month', Quarter: 'This quarter', Later: 'Later or unknown' }, B = { Confirmed: 'Confirmed', Vague: 'Vague', TooHigh: 'Objection: too high', NotDiscussed: 'Not discussed' };
      const D = { Yes: 'Yes', No: 'Needs sign-off', Unknown: 'Unclear' }, N = { Proposal: 'Send proposal', Demo: 'Book demo', Call: 'Follow-up call', None: 'None agreed' };
      return {
        rows: [[v(f, 'interest'), low(f, 'interest')], [B[v(f, 'budget')]], [T[v(f, 'timeline')]], [D[v(f, 'decision_maker')]], [N[v(f, 'next_step')]]],
        flags, ok: true, extra: { kind: 'score', score, band }, toast: 'Saved: ' + band + ' deal, score ' + score,
      };
    },
  };

  window.DEMOS = [coffee, quote, desk, sales];
})();
