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

export default Object.assign(desk, {
  ctx: "A patient speaking to a clinic receptionist to book an appointment.",
  questions,
});
