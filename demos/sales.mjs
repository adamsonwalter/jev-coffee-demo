// Demo: sales. One self-contained file: the questions Jev is asked, what the screen shows, and the arithmetic.
// (Copy demos/_template.mjs to make a new one, then add one line to demos/index.mjs.)
import { v, yes, low, pr, yn, ch } from './lib.mjs';

// What Jev is asked. Each key becomes a typed question; answers arrive as fields[key] = { value, confidence, p }.
const questions = {
  interest: ch({ Hot: "Buyer is keen and engaged, asking about next steps or price", Warm: "Interested but not committed", Cold: "Little interest or polite brush-off" }),
  budget: ch({ Confirmed: "Budget confirmed or approved", Quoted: "A price was quoted and the buyer has not yet agreed to it", Vague: "Budget discussed only vaguely", TooHigh: "Buyer says it is too expensive", NotDiscussed: "Budget not discussed" }),
  timeline: ch({ Now: "Wants to move this month", Quarter: "Within about three months", Later: "Later, no date, or just exploring" }),
  decision_maker: ch({ Yes: "Spoke with the decision maker", No: "Needs sign-off from someone else", Unknown: "Not clear who decides" }),
  competitor: yn("A competitor or alternative is mentioned", "No competitor mentioned"),
  stall: yn("Buyer hesitates, delays, goes quiet, or says they will think about it", "No stalling signals"),
  next_step: ch({ Proposal: "Send a proposal or quote", Payment: "Send an invoice or payment link", Demo: "Book a demo or meeting", Call: "Follow-up call", None: "No next step agreed" }),
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
    const bud = { Confirmed: 20, Quoted: 12, Vague: 10, NotDiscussed: 6, TooHigh: 2 }[v(f, 'budget')] || 0;
    const tl = { Now: 15, Quarter: 10, Later: 3 }[v(f, 'timeline')] || 0;
    const dm = { Yes: 15, No: 6, Unknown: 3 }[v(f, 'decision_maker')] || 0;
    const nx = { Proposal: 10, Payment: 12, Demo: 10, Call: 6, None: 0 }[v(f, 'next_step')] || 0;
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
    const T = { Now: 'This month', Quarter: 'This quarter', Later: 'Later or unknown' }, B = { Confirmed: 'Confirmed', Quoted: 'Price quoted', Vague: 'Vague', TooHigh: 'Objection: too high', NotDiscussed: 'Not discussed' };
    const D = { Yes: 'Yes', No: 'Needs sign-off', Unknown: 'Unclear' }, N = { Proposal: 'Send proposal', Payment: 'Send payment link', Demo: 'Book demo', Call: 'Follow-up call', None: 'None agreed' };
    return {
      rows: [[v(f, 'interest'), low(f, 'interest')], [B[v(f, 'budget')]], [T[v(f, 'timeline')]], [D[v(f, 'decision_maker')]], [N[v(f, 'next_step')]]],
      flags, ok: true, extra: { kind: 'score', score, band }, toast: 'Saved: ' + band + ' deal, score ' + score,
    };
  },
};

export default Object.assign(sales, {
  ctx: "A salesperson dictating notes after a customer call.",
  questions,
});
