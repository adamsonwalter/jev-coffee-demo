// Demo: quote. One self-contained file: the questions Jev is asked, what the screen shows, and the arithmetic.
// (Copy demos/_template.mjs to make a new one, then add one line to demos/index.mjs.)
import { v, yes, low, pr, yn, ch } from './lib.mjs';

// What Jev is asked. Each key becomes a typed question; answers arrive as fields[key] = { value, confidence, p }.
const questions = {
  trade: ch({
    Plumbing: "Plumbing: plumber, drains, taps, toilets, dunny diver, drain surgeon",
    Electrical: "Electrical: electrician, sparky, wiring, switchboard, lights, power points, EV charger, solar",
    Gas: "Gas fitting: gas appliances, gas lines, gas leaks",
    Climate: "Heating, cooling and refrigeration: fridgy, air conditioning, ducted heating",
    Carpentry: "Carpentry: chippy, carpenter, joiner, decks, doors, timber, cabinetry",
    Bricklaying: "Bricklaying or masonry: bricky",
    Roofing: "Roofing: roofer, tiles, flashing, gutters",
    Bathroom: "Bathroom, kitchen or tiling renovation: tiler",
    Painting: "Painting or plastering",
    Landscaping: "Landscaping, concreting, paving or fencing: concreter, landscaper",
    Pest: "Pest control: pestie, termites, rodents, spiders, ants",
    Locksmith: "Locksmith or garage doors",
    Other: "Anything else or unclear",
  }),
  issue: ch({
    Blocked: "Blocked pipe, toilet or drain",
    Burst: "Burst pipe, burst tap or showerhead",
    Leak: "Internal leak, leaking tank or leaking roof",
    Power: "Power failure, tripping safety switch or blown fuse",
    HotWater: "Hot water system failed or leaking",
    Gas: "Gas leak or smell of gas",
    Climate: "Heating or cooling breakdown",
    Lockout: "Locked out, or a lock is broken",
    Garage: "Garage door broken",
    Install: "Planned install or upgrade: fan, lights, switchboard, solar, EV charger, appliance hookup, tapware",
    Repair: "General repair or maintenance: deck, door, plasterboard, gutters, tiles, fence, paving",
    Reno: "Renovation or rebuild",
    Pest: "Pest treatment or inspection",
    Other: "Anything else or unclear",
  }),
  scope: ch({ Small: "Under one day of work", Medium: "Between two and five days of work", Large: "A week or more of work, or a full renovation" }),
  access: ch({ Easy: "Easy access, empty site, any hours", Restricted: "Restricted access: strata, limited hours, tight space, occupied home, weekends only", Unknown: "Access not mentioned" }),
  old_building: yn("Building is old (pre-1990), or fibro, asbestos, old wiring or lead paint is mentioned", "No sign of an old building"),
  hidden_risk: yn("Leak, damp, rot, termites, cracks or unknown conditions behind walls or under floors are mentioned", "No hidden-damage signals"),
  permit: yn("Work likely needs a permit, certifier or licensed sign-off (structural, gas, electrical, plumbing, removing walls)", "Unlikely to need a permit"),
  materials: ch({ Customer: "Customer supplies materials", Contractor: "Contractor supplies materials", Unspecified: "Not mentioned" }),
  urgency: ch({ Emergency: "Emergency: active leak, no power, gas smell, blocked toilet, unsafe, needs attention today", Soon: "Wanted within the next week or two", Flexible: "Flexible timing" }),
};

// ---------- QUOTE ----------
// Illustrative rate card (AUD). Replace with the business's own rates.
const SCOPE = { Small: [350, 1200], Medium: [1500, 5500], Large: [6500, 22000] };
const TRADE_X = { Bathroom: 1.2, Roofing: 1.1 };
const FIXED = { Blocked: [180, 450], Burst: [250, 800], Leak: [200, 700], Power: [150, 450], HotWater: [1200, 3500], Gas: [200, 600], Climate: [250, 1200], Lockout: [150, 350], Garage: [200, 900] };
const TRADE = { Plumbing: 'Plumber', Electrical: 'Sparky', Gas: 'Gas fitter', Climate: 'Fridgy / HVAC', Carpentry: 'Chippy', Bricklaying: 'Bricky', Roofing: 'Roofer', Bathroom: 'Bathroom / kitchen', Painting: 'Painter', Landscaping: 'Concreter / landscaper', Pest: 'Pestie', Locksmith: 'Locksmith', Other: 'Other' };
const ISSUE = { Blocked: 'Blocked drain or toilet', Burst: 'Burst pipe or tap', Leak: 'Leak', Power: 'Power failure', HotWater: 'Hot water system', Gas: 'Gas leak', Climate: 'Heating or cooling down', Lockout: 'Lockout', Garage: 'Garage door', Install: 'Install or upgrade', Repair: 'Repair or maintenance', Reno: 'Renovation', Pest: 'Pest treatment', Other: 'Other' };
const quote = {
  id: 'quote', tab: 'Quote', title: ['Jev', 'Quote'],
  say: 'Describe the job as you would to a colleague',
  chips: [
    'The dunny is blocked and backing up, I need a dunny diver today',
    'Power has gone and the safety switch keeps tripping, need a sparky',
    'I can smell gas in the kitchen',
    'Need a chippy to fix a rotten deck, any weekday is fine',
    'Hot water has gone and the tank is leaking, strata block, weekdays only',
    'Need a fridgy for the ducted air con, it is a heatwave',
    'Pestie for termites in a 1960s fibro house',
    '1970s brick unit bathroom reno, strata weekdays nine to three only, damp under the vanity, moving the toilet, customer buys tiles',
    'Replace a hot water system, easy access, it is leaking now',
    'Repaint three bedrooms in a new house, any day, flexible',
  ],
  labels: ['Trade', 'Issue', 'Scope', 'Access', 'When', 'Materials'],
  confirm: 'Send range to customer',
  maxFlags: 4,
  render(f) {
    const trade = v(f, 'trade'), issue = v(f, 'issue'), scope = v(f, 'scope');
    if (!trade || !scope) return { rows: [[null], [null], [null], [null], [null], [null]], flags: [], ok: false };
    const fixed = FIXED[issue];
    let [lo, hi] = fixed || SCOPE[scope]; if (!fixed) { const x = TRADE_X[trade] || 1; lo *= x; hi *= x; }
    const flags = [], adds = [], add = (m, s2) => flags.push({ m, s: s2 });
    const urg = v(f, 'urgency');
    if (issue === 'Gas') add('Gas smell: leave the house, call the gas emergency line, then book', 'out');
    if (issue === 'Burst') add('Burst pipe: turn the water off at the main now', 'warn');
    if (issue === 'Blocked') add('Blocked drain: hand tools on the spot, camera or waterjet quoted extra', 'warn');
    if (issue === 'Power') add('Power failure: check the safety switch first, it may save a callout', 'warn');
    if (issue === 'Lockout') add('Lockout: verify ID and ownership first', 'warn');
    if (v(f, 'access') === 'Restricted') { lo *= 1.1; hi *= 1.1; add('Access window limits the schedule (+10%)', 'warn'); }
    if (yes(f, 'hidden_risk')) { lo *= 1.2; hi *= 1.2; add('Hidden-damage contingency (+20%)', 'warn'); }
    if (urg === 'Emergency') { lo *= 1.25; hi *= 1.25; add('Emergency call-out loading (+25%)', 'out'); }
    if (yes(f, 'old_building')) { adds.push(['Asbestos / lead check before demolition', 450, 900]); add('Old building: test before you touch it', 'out'); }
    if (yes(f, 'permit')) { adds.push(['Permit and certifier sign-off', 300, 1200]); add('Licensed sign-off or permit likely', 'warn'); }
    if (!fixed && low(f, 'scope')) add('Scope unclear: ask how many rooms and days', 'warn');
    if (issue === 'Blocked') adds.push(['If a camera or waterjet is needed', 400, 900]);
    flags.sort((a, b) => ({ out: 0, warn: 1, ok: 2 })[a.s] - ({ out: 0, warn: 1, ok: 2 })[b.s]);
    let tlo = lo, thi = hi; adds.forEach((a) => { if (a[0].indexOf('If a camera') !== 0) { tlo += a[1]; thi += a[2]; } });
    const fmt = (n) => 'A$' + (Math.round(n / 50) * 50).toLocaleString('en-AU');
    const mat = v(f, 'materials');
    return {
      rows: [[TRADE[trade] || trade], [ISSUE[issue] || null, low(f, 'issue')], [fixed ? '—' : scope, !fixed && low(f, 'scope')], [v(f, 'access') === 'Unknown' ? '—' : v(f, 'access')], [{ Emergency: 'Emergency', Soon: 'Within a week or two', Flexible: 'Flexible' }[urg]], [mat === 'Unspecified' ? '—' : (mat === 'Customer' ? 'Customer supplies' : 'Contractor supplies')]],
      flags: flags.length ? flags : [{ m: 'No risk flags', s: 'ok' }],
      extra: { kind: 'range', big: fmt(tlo) + ' – ' + fmt(thi), small: ['Labour and base scope ' + fmt(lo) + ' – ' + fmt(hi)].concat(adds.map((a) => a[0] + ' ' + fmt(a[1]) + ' – ' + fmt(a[2]))), note: 'Illustrative rates, not a quote. Replace with your own rate card.' },
      ok: true, toast: 'Range sent: ' + fmt(tlo) + ' – ' + fmt(thi),
    };
  },
};

export default Object.assign(quote, {
  ctx: "A tradesperson dictating a job description for a quote. Judge only what is said.",
  questions,
});
