// TEMPLATE for a new demo. Copy this file (e.g. demos/hotel.mjs), edit it, then add ONE line to demos/index.mjs:
//     import hotel from './hotel.mjs';   ...and add `hotel` to the DEMOS list.
// Nothing else changes: the tab, the Jev questions and the screen all come from this file.
//
// How a demo works:  person speaks -> Jev answers your typed questions -> render() turns the answers into rows, flags and numbers.
// Jev only classifies what was said. Any maths (prices, scores) belongs in render(), in code.
import { v, yes, low, pr, yn, ch } from './lib.mjs';

// 1. What Jev is asked. Keep each option's description short and concrete; add 'Unspecified' for "not mentioned".
//    ch({...})  pick one option          yn('yes means…', 'no means…')  a yes/no flag
const questions = {
  vehicle: ch({ Small: 'A small or economy car', Suv: 'An SUV or 4WD', Van: 'A van or people mover', Unspecified: 'No vehicle type mentioned' }),
  days: ch({ Short: 'One to two days', Week: 'About a week', Long: 'More than a week', Unspecified: 'Length not mentioned' }),
  young_driver: yn('A driver is under 25', 'No driver under 25 mentioned'),
  one_way: yn('Dropping the car at a different location', 'Returning to the same place'),
};

// 2. What the screen shows.
const demo = {
  id: 'rental',                       // unique, used in the URL (#rental) and sent to the function
  tab: 'Rental',                      // tab label (keep it short: four to five tabs fit on a phone)
  title: ['Jev', 'Car Rental'],       // heading: 'Jev' plain, the rest in amber italics
  say: 'Tell me what car you need and for how long',
  chips: ['An SUV for a week, one way to Sydney', 'A small car for the weekend, my son is 22'],   // rotating "Try saying" lines
  labels: ['Vehicle', 'Length', 'Drivers', 'Return'],   // row labels, in the order render() returns rows
  rowKeys: ['vehicle', 'days', null, null],             // the question behind each row (null if none). Lets the final check rewrite a row
  confirm: 'Reserve car',
  maxFlags: 3,                        // optional: cap the warning chips so the fields keep the screen

  // f = Jev's answers: f.vehicle = { value: 'Suv', confidence: 0.97, p: { Suv: 0.97, … } }
  render(f) {
    const vehicle = v(f, 'vehicle'), days = v(f, 'days');
    if (!vehicle) return { rows: [[null], [null], [null], [null]], flags: [], ok: false };   // nothing heard yet
    const flags = [];
    if (yes(f, 'young_driver')) flags.push({ m: 'Under-25 surcharge applies', s: 'warn' });   // s: 'out' red, 'warn' amber, 'ok' green
    if (yes(f, 'one_way')) flags.push({ m: 'One-way fee: confirm the drop-off branch', s: 'warn' });
    if (!flags.length) flags.push({ m: 'No flags', s: 'ok' });
    return {
      // one [text, unsure?] per label; null text shows a dash; unsure? adds a "not sure, check" note
      rows: [
        [vehicle === 'Unspecified' ? null : vehicle, low(f, 'vehicle')],
        [days === 'Unspecified' ? null : days, low(f, 'days')],
        [yes(f, 'young_driver') ? 'Includes under 25' : 'Standard'],
        [yes(f, 'one_way') ? 'One way' : 'Same place'],
      ],
      flags,
      ok: true,                                                 // enables the confirm button
      toast: 'Reserved: ' + vehicle,                            // shown after confirm
      // optional panels under the card:
      //   extra: { kind: 'range', big: 'A$310 – A$420', small: ['Base A$280', 'Fee A$40'], note: 'Illustrative.' }
      //   extra: { kind: 'score', score: 72, band: 'Hot' }       (band: Hot | Warm | Cold)
      //   extra: { kind: 'note', note: 'Small print.' }
      //   banner: { title: 'Stop', body: 'Escalate.' }  danger: true  confirm: 'Escalate now'   (for red-alert states)
    };
  },
};

export default Object.assign(demo, {
  ctx: 'A customer speaking to a car rental desk.',   // one line telling Jev who is talking
  questions,
});
