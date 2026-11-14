// Demo: desk. One self-contained file: the questions Jev is asked, what the screen shows, and the arithmetic.
// (Copy demos/_template.mjs to make a new one, then add one line to demos/index.mjs.)
import { v, yes, low, pr, yn, ch } from './lib.mjs';

// What Jev is asked. Each key becomes a typed question; answers arrive as fields[key] = { value, confidence, p }.
const questions = {
  reason: ch({ Checkup: "Routine check-up or review", Injury: "New injury, pain or illness", Followup: "Follow-up on an existing issue", Repeat: "Repeat prescription or referral", Results: "Test results", Other: "Anything else or unclear" }),
  urgency: ch({ Routine: "Routine, can wait a week or more", Soon: "Should be seen within a few days", Urgent: "Needs to be seen today" }),
  red_flag: yn("Mentions chest pain, trouble breathing, stroke signs, severe bleeding, fainting, severe allergic reaction, or thoughts of self-harm", "No emergency symptoms mentioned"),
  patient: ch({ New: "New patient, first visit", Existing: "Existing patient", Unspecified: "Not mentioned" }),
  day: ch({ Today: "Today", Tomorrow: "Tomorrow", ThisWeek: "Later this week", NextWeek: "Next week or later", Unspecified: "No day mentioned" }),
  time: ch({ Morning: "Morning", Afternoon: "Afternoon", Evening: "After work or evening", Unspecified: "No time preference" }),
};

// ---------- FRONT DESK ----------
// Operational data: the clinic's appointment calendar. render() finds a real free slot (or says there isn't one and
// suggests the next); confirming books it. The backend screen shows and edits the calendar.
const REASON = { Checkup: 'Check-up', Injury: 'New injury or illness', Followup: 'Follow-up', Repeat: 'Repeat prescription', Results: 'Test results', Other: 'Other' };
const TIMES = ['08:40', '09:20', '10:00', '11:40', '14:00', '15:20', '16:40'], WHO = ['Dr Chen', 'Dr Patel', 'Nurse Kim'];
const PATIENTS = ['M. Okafor', 'J. Lindqvist', 'S. Rahman', 'T. Nguyen', 'A. Moreau', 'K. Dlamini', 'P. Fischer', 'R. Tanaka'];
const band = (t) => (t < '12:00' ? 'Morning' : t < '17:00' ? 'Afternoon' : 'Evening');
const dayLabel = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : new Date(Date.now() + n * 864e5).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }));

function makeSlots() {   // five days, three clinicians; today afternoon is deliberately full so the voice has something to flag
  const slots = {}; let n = 0;
  for (let day = 0; day < 5; day++) for (let wi = 0; wi < WHO.length; wi++) for (let ti = 0; ti < TIMES.length; ti++) {
    const free = day === 0 && TIMES[ti] >= '12:00' ? WHO[wi] === 'Nurse Kim' && TIMES[ti] === '16:40' : (day * 31 + ti * 17 + wi * 13) % 5 < 2;
    slots['s' + String(n++).padStart(3, '0')] = { day, time: TIMES[ti], who: WHO[wi], status: free ? 'free' : 'booked', patient: free ? '' : PATIENTS[n % PATIENTS.length] };
  }
  return slots;
}
const DEFAULT_DATA = { slots: makeSlots(), activity: [] };
const slotEffects = (d, rule) => Object.entries(d.slots).flatMap(([id, s]) => { const [status, patient] = rule(s); return [{ op: 'set', path: `slots.${id}.status`, value: status }, { op: 'set', path: `slots.${id}.patient`, value: patient }]; });

function findSlot(slots, f) {
  const gpOnly = ['Injury', 'Followup', 'Checkup'].includes(v(f, 'reason'));
  const [d0, d1] = { Today: [0, 0], Tomorrow: [1, 1], ThisWeek: [1, 4], NextWeek: [3, 4] }[v(f, 'day')] || [0, 4];
  const wanted = { Morning: 'Morning', Afternoon: 'Afternoon', Evening: 'Evening' }[v(f, 'time')] || null;
  const free = Object.entries(slots).filter(([, s]) => s.status === 'free' && (!gpOnly || s.who !== 'Nurse Kim')).map(([id, s]) => ({ id, ...s })).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  const match = free.find((s) => s.day >= d0 && s.day <= d1 && (!wanted || band(s.time) === wanted)) || null;
  return { match, alt: match ? null : free.find((s) => s.day >= d0) || free[0] || null, d0, wanted };
}

const desk = {
  id: 'desk', tab: 'Front desk', title: ['Jev', 'Front Desk'],
  say: 'Speak as a caller would: who, why, and when',
  chips: [
    'Hi it is Dave, I have been before, I need a repeat script, mornings next week are fine',
    'First time here, sore knee since the weekend, can I come in tomorrow afternoon',
    'I have had tight chest pain since this morning and it goes down my arm, can I come in today',
    'Hello, my name is Walter Adamson, a bit of pain in my leg, can I see the doctor today in the afternoon',
  ],
  labels: ['Name', 'Reason', 'Urgency', 'Patient', 'When'],
  rowKeys: [null, 'reason', 'urgency', 'patient', null],   // the question(s) behind each row (null: none). Lets the final check rewrite a row
  confirm: 'Book appointment',
  data: DEFAULT_DATA,
  scenarios: [
    { id: 'full', name: 'Fully booked week', blurb: 'One slot left, on Thursday morning', say: "Hi it's Dave, I've been before, my knee is sore, can I come in tomorrow afternoon",
      effects: (d) => slotEffects(d, (s) => (s.day === 3 && s.who === 'Dr Patel' && s.time === '09:20' ? ['free', ''] : ['booked', s.patient || 'Booked'])) },
    { id: 'open', name: 'Quiet day', blurb: 'Every slot free', say: "Hi it's Dave, I've been before, my knee is sore, can I come in tomorrow afternoon",
      effects: (d) => slotEffects(d, () => ['free', '']) },
    { id: 'away', name: 'Dr Chen on leave', blurb: 'Dr Chen booked out for three days', say: 'I would like a check-up tomorrow morning, I have been before',
      effects: (d) => slotEffects(d, (s) => (s.who === 'Dr Chen' && s.day <= 2 ? ['booked', 'On leave'] : [s.status, s.patient])) },
  ],
  backend: {
    name: 'Practice calendar', sub: 'Appointments · what reception and the voice both check',
    sections: [{ type: 'slots', title: 'Appointments', path: 'slots', groupBy: ['day', 'who'], chip: (s) => s.time, groupLabel: (field, val) => (field === 'day' ? dayLabel(val) : val) }, { type: 'activity' }],
  },
  render(f, data = desk.data) {
    if (!f.reason) return { rows: [[null], [null], [null], [null], [null]], flags: [], ok: false };
    const red = yes(f, 'red_flag'), name = (f.name && f.name.value) || null, urgent = v(f, 'urgency') === 'Urgent';
    const { match, alt, wanted } = findSlot(data.slots, f);
    const pick = match || alt, when = pick ? dayLabel(pick.day) + ' ' + pick.time + ' · ' + pick.who : null;
    const asked = [{ Today: 'today', Tomorrow: 'tomorrow', ThisWeek: 'this week', NextWeek: 'next week' }[v(f, 'day')], wanted && wanted.toLowerCase()].filter(Boolean).join(' ');
    const flags = [];
    if (!red && !pick) flags.push({ m: 'Fully booked all week. Offer the waitlist', s: 'out' });
    else if (!red && !match) flags.push({ m: 'No ' + (asked ? asked + ' ' : '') + 'slots. Next free: ' + when, s: urgent ? 'out' : 'warn' });
    else if (!red) flags.push({ m: 'Free: ' + when, s: 'ok' });
    if (urgent && !red && pick && pick.day > 0) flags.push({ m: 'Urgent but nothing free today: send to nurse triage', s: 'out' });
    if (v(f, 'patient') === 'New') flags.push({ m: 'New patient: collect ID and Medicare', s: 'warn' });
    if (v(f, 'reason') === 'Repeat') flags.push({ m: 'Needs clinician sign-off', s: 'warn' });
    if (!red && !name) flags.push({ m: 'Name not heard: ask the caller', s: 'warn' });
    flags.sort((a, b) => ({ out: 0, warn: 1, ok: 2 })[a.s] - ({ out: 0, warn: 1, ok: 2 })[b.s]);
    return {
      banner: red ? { title: 'Possible emergency. Do not book.', body: 'Transfer to the nurse now. If the caller is alone or worsening, tell them to call 000.' } : null,
      rows: [[name, f.name && name != null && f.name.confidence != null && f.name.confidence < 0.9], [REASON[v(f, 'reason')], low(f, 'reason')], [v(f, 'urgency') === 'Soon' ? 'Within days' : v(f, 'urgency'), low(f, 'urgency')], [v(f, 'patient') === 'Unspecified' ? '—' : v(f, 'patient')], [when || (pick ? '—' : 'Fully booked')]],
      flags, ok: red || !!pick, confirm: red ? 'Escalate to nurse now' : pick ? 'Book ' + dayLabel(pick.day) + ' ' + pick.time : null, danger: red,
      extra: { kind: 'note', note: 'Demo only. Not medical advice. Jev sorts what was said; a person decides.' },
      toast: red ? 'Escalated to nurse' : 'Booked ' + when + (name ? ' for ' + name : ''),
      effects: red || !pick ? [] : [{ op: 'set', path: 'slots.' + pick.id + '.status', value: 'booked' }, { op: 'set', path: 'slots.' + pick.id + '.patient', value: name || 'Caller' }],
      note: pick && !red ? 'Booked ' + pick.who + ' ' + dayLabel(pick.day) + ' ' + pick.time + (name ? ' for ' + name : '') : '',
    };
  },
};

export default Object.assign(desk, {
  ctx: "A patient speaking to a clinic receptionist to book an appointment.",
  questions,
  extract: { name: { type: 'text', instructions: "The caller's own full name, if they say it (for example after 'my name is', 'it's' or 'this is'). Null if no name is given." } },
});
