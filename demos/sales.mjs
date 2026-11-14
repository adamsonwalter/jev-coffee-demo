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
// Operational data: the CRM pipeline and the salesperson's calendar. render() finds the deal (or says it's a new lead) and
// a free calendar slot for the next step; confirming updates the CRM. `weights` are the scoring points (out of 100).
const DEFAULT_DATA = {
  weights: {
    interest: { Hot: 40, Warm: 22, Cold: 5 },
    budget: { Confirmed: 20, Quoted: 12, Vague: 10, NotDiscussed: 6, TooHigh: 2 },
    timeline: { Now: 15, Quarter: 10, Later: 3 },
    decisionMaker: { Yes: 15, No: 6, Unknown: 3 },
    nextStep: { Proposal: 10, Payment: 12, Demo: 10, Call: 6, None: 0 },
  },
  deals: {
    northwind: { company: 'Northwind', contact: 'Priya Nair', stage: 'Proposal', value: 1950, last: 'Proposal sent Fri', score: 58 },
    'harbour-freight': { company: 'Harbour Freight', contact: 'Marcus Webb', stage: 'Demo booked', value: 12000, last: 'Demo Tuesday', score: 71 },
    'bluegum-dental': { company: 'Bluegum Dental', contact: 'Dr Anita Rao', stage: 'New', value: 0, last: 'Inbound enquiry', score: 34 },
    'tidewater-legal': { company: 'Tidewater Legal', contact: 'Joel Kim', stage: 'Closing', value: 4800, last: 'Payment link sent', score: 83 },
    'orchard-wines': { company: 'Orchard Wines', contact: 'Sam Pereira', stage: 'Follow-up', value: 2600, last: 'Left voicemail', score: 41 },
  },
  calendar: {
    c1: { label: 'Thu 2:00pm', status: 'free' }, c2: { label: 'Thu 4:30pm', status: 'booked' }, c3: { label: 'Fri 10:00am', status: 'free' },
    c4: { label: 'Mon 9:00am', status: 'free' }, c5: { label: 'Mon 1:30pm', status: 'booked' },
  },
  activity: [],
};
const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (x) => norm(x).replace(/ /g, '-').slice(0, 40);
const money = (n) => (n ? 'A$' + Number(n).toLocaleString('en-AU') : 'A$0');
const STAGE = { Proposal: 'Proposal', Payment: 'Closing', Demo: 'Demo booked', Call: 'Follow-up' };
const sales = {
  id: 'sales', tab: 'Sales', title: ['Jev', 'Sales Notes'],
  say: 'Dictate your call notes in your own words',
  chips: [
    'Good call with Priya at Northwind, she loves it but says the price is steep and needs her CFO to sign off. Looking at a competitor too. Wants it live by end of quarter. Said she will think about it. I will send a proposal Friday',
    'Met the owner at Orchard Wines, signed budget of fifty thousand, wants to start this month, book a demo for Thursday',
    'Spoke to Elena at Redgum Coffee, keen but budget not discussed, she will come back to me, book a follow-up call',
  ],
  labels: ['Who', 'Interest', 'Budget', 'Timeline', 'Decision maker', 'Next step'],
  rowKeys: [null, 'interest', 'budget', 'timeline', 'decision_maker', 'next_step'],   // the question(s) behind each row (null: none). Lets the final check rewrite a row
  confirm: 'Save to CRM',
  data: DEFAULT_DATA,
  scenarios: [
    { id: 'quarterend', name: 'End of quarter', blurb: 'Diary completely full', say: 'Spoke to Priya at Northwind, she wants a demo, book it for Thursday',
      effects: (d) => Object.keys(d.calendar).map((id) => ({ op: 'set', path: `calendar.${id}.status`, value: 'booked' })) },
    { id: 'open', name: 'Open diary', blurb: 'Every slot free, a new lead to log', say: 'Met Elena at Redgum Coffee, keen, book a follow-up call',
      effects: (d) => Object.keys(d.calendar).map((id) => ({ op: 'set', path: `calendar.${id}.status`, value: 'free' })) },
    { id: 'hot', name: 'Hot pipeline', blurb: 'Three deals closing', say: 'Met Marcus at Harbour Freight, signed budget, wants to start this month, book a demo',
      effects: () => [{ op: 'set', path: 'deals.harbour-freight.stage', value: 'Closing' }, { op: 'set', path: 'deals.harbour-freight.score', value: 88 }, { op: 'set', path: 'deals.tidewater-legal.score', value: 91 }, { op: 'set', path: 'deals.northwind.stage', value: 'Closing' }, { op: 'set', path: 'deals.northwind.score', value: 76 }] },
  ],
  backend: {
    name: 'CRM', sub: 'Pipeline and calendar · what the voice looks up and updates',
    sections: [
      { type: 'records', title: 'Pipeline', path: 'deals', columns: [['company', 'Company'], ['contact', 'Contact'], ['stage', 'Stage'], ['value', 'Value', money], ['last', 'Last activity'], ['score', 'Score']] },
      { type: 'slots', title: 'My calendar', path: 'calendar', chip: (s) => s.label },
      { type: 'activity' },
    ],
  },
  render(f, data = sales.data) {
    if (!f.interest) return { rows: [[null], [null], [null], [null], [null], [null]], flags: [], ok: false };
    const w = data.weights;
    const interest = Object.entries(w.interest).reduce((sum, [opt, pts]) => sum + pts * pr(f, 'interest', opt), 0);
    const bud = w.budget[v(f, 'budget')] || 0;
    const tl = w.timeline[v(f, 'timeline')] || 0;
    const dm = w.decisionMaker[v(f, 'decision_maker')] || 0;
    const nx = w.nextStep[v(f, 'next_step')] || 0;
    let score = interest + bud + tl + dm + nx - (yes(f, 'stall') ? 10 : 0) - (yes(f, 'competitor') ? 5 : 0);
    score = Math.max(0, Math.min(100, Math.round(score)));
    const band = score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold';
    const contact = (f.contact && f.contact.value) || null, company = (f.company && f.company.value) || null, next = v(f, 'next_step');
    // CRM lookup by company, then by contact name
    const deal = Object.entries(data.deals || {}).find(([, d]) => (company && (norm(d.company).includes(norm(company)) || norm(company).includes(norm(d.company)))) || (contact && norm(d.contact) === norm(contact)));
    const slot = ['Demo', 'Call'].includes(next) ? Object.entries(data.calendar || {}).filter(([, c]) => c.status === 'free').sort(([a], [b]) => a.localeCompare(b))[0] : null;
    const flags = [];
    if (yes(f, 'stall')) flags.push({ m: 'Stalling: re-engage within 48 hours', s: 'warn' });
    if (yes(f, 'competitor')) flags.push({ m: 'Competitor in play: prepare a comparison', s: 'warn' });
    if (v(f, 'budget') === 'TooHigh') flags.push({ m: 'Price objection: offer a phased scope', s: 'out' });
    if (v(f, 'decision_maker') === 'No') flags.push({ m: 'Decision maker not on the call: ask for an intro', s: 'warn' });
    if (next === 'None') flags.push({ m: 'No next step agreed', s: 'out' });
    if (deal) flags.push({ m: 'CRM: ' + deal[1].company + ' · ' + deal[1].stage + (deal[1].value ? ' · ' + money(deal[1].value) : ''), s: 'ok' });
    else if (company) flags.push({ m: 'New lead: ' + company + ' is not in the CRM yet', s: 'warn' });
    else flags.push({ m: 'No company heard: say who the call was with', s: 'warn' });
    if (['Demo', 'Call'].includes(next)) flags.push(slot ? { m: 'Calendar: ' + slot[1].label + ' is free', s: 'ok' } : { m: 'No free calendar slots this week', s: 'out' });
    flags.sort((a, b) => ({ out: 0, warn: 1, ok: 2 })[a.s] - ({ out: 0, warn: 1, ok: 2 })[b.s]);
    const T = { Now: 'This month', Quarter: 'This quarter', Later: 'Later or unknown' }, B = { Confirmed: 'Confirmed', Quoted: 'Price quoted', Vague: 'Vague', TooHigh: 'Objection: too high', NotDiscussed: 'Not discussed' };
    const D = { Yes: 'Yes', No: 'Needs sign-off', Unknown: 'Unclear' }, N = { Proposal: 'Send proposal', Payment: 'Send payment link', Demo: 'Book demo', Call: 'Follow-up call', None: 'None agreed' };
    const who = [contact, company].filter(Boolean).join(' · ');
    const stage = STAGE[next], lastNote = (N[next] || '') + ' · ' + band + ' (' + score + ')';
    return {
      rows: [[who || null, [f.contact, f.company].some((x) => x && x.value != null && x.confidence != null && x.confidence < 0.9)], [v(f, 'interest'), low(f, 'interest')], [B[v(f, 'budget')]], [T[v(f, 'timeline')]], [D[v(f, 'decision_maker')]], [N[next]]],
      flags, ok: true, extra: { kind: 'score', score, band }, toast: 'Saved: ' + (company || 'call') + ', ' + band + ' deal, score ' + score,
      effects: [
        ...(deal ? [{ op: 'set', path: 'deals.' + deal[0] + '.last', value: lastNote }, { op: 'set', path: 'deals.' + deal[0] + '.score', value: score }, ...(stage ? [{ op: 'set', path: 'deals.' + deal[0] + '.stage', value: stage }] : [])]
          : company ? [{ op: 'put', path: 'deals', id: slug(company), value: { company, contact: contact || '', stage: stage || 'New', value: 0, last: lastNote, score } }] : []),
        ...(slot ? [{ op: 'set', path: 'calendar.' + slot[0] + '.status', value: 'booked' }] : []),
      ],
      note: 'Call logged: ' + (company || 'unknown company') + ' (' + band + ', ' + score + ')' + (slot ? ', booked ' + slot[1].label : ''),
    };
  },
};

export default Object.assign(sales, {
  ctx: "A salesperson dictating notes after a customer call.",
  questions,
  extract: {
    contact: { type: 'text', instructions: 'Full name of the customer contact the call was with, if named. Null if no person is named.' },
    company: { type: 'text', instructions: "Name of the customer's company or organisation, if named. Null if none." },
  },
});
