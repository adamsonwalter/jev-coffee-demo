// "What it's for": stories for the people who ask. One persona per friend, a few scenes each, each scene in the shape that suits it.
// Plain data, no DOM, so tests can check it against the real demos (tests/stories.test.mjs).
//
// badge 'today' = it works in the demo. Lines on screen are proven by the test (`proof` = the scenario and the fields Jev would hear),
//                 or come straight from the demo's own data (`fromData`).
// badge 'yours' = not built yet. The same engine on the person's own numbers; the wording is illustrative.
//
// layout (how the scene is told):
//   scene     what you say, what the screen shows                      beats: [{ say, see, next?, proof? }]
//   dialogue  a conversation, with the screen glanced at in the middle  beats: [{ who: 'them'|'you', say, see?, suggested?, proof? }]
//   timeline  a few minutes, stamped                                    beats: [{ at, label?, say?, see?, next?, proof? }]
//   compare   how it goes today vs with Jev                             without: '…', beats: [{ say, see, next?, proof? }]
//   parallel  what they said beside what the screen said               cols: [a, b], rows: [{ said, see: [kind, text] }], proof?
//   board     a list as it looks in the Backend                         cols: [a, b], rows: [[left, right, kind]], say?, next?
//   alarm     one line that must not be missed                          beats: [{ say, see, proof? }]
// see: [kind, text] with kind ok | warn | out | ask (ask = a prompt for something not yet said). `next` = what to say next: not a live feature yet.

import { DEMOS } from './demos/index.mjs';

export const LEGEND = [
  ['checked', 'Checked against your numbers'],
  ['warned', 'Warned: sold out, booked out, nobody free'],
  ['asked', 'Asked for what’s missing'],
  ['next', 'Told what to say next'],
];

export const BADGE = { today: 'Works in the demo', yours: 'Not built yet · on your own numbers' };

export const LEDE = 'Say it once, in your own words. Jev fills in the form, checks it against what’s really true in your business, and tells you what’s missing or what to say next, while the other person is still on the line.';

export const LAYOUTS = ['scene', 'dialogue', 'timeline', 'compare', 'parallel', 'board', 'alarm'];

const data = (id) => DEMOS.find((d) => d.id === id).data;
const stock = data('coffee').stock, lowAt = data('coffee').low;
const level = (n) => (n <= 0 ? 'out' : n <= lowAt ? 'warn' : 'ok');
const money = (n) => (n ? 'A$' + n.toLocaleString('en-AU') : 'no value yet');

export const PERSONAS = [
  {
    id: 'cafe', who: 'Café owner', tab: 'coffee',
    hook: 'Find out it’s gone before you say yes.',
    checks: 'Checks the stockroom: milk, food, espresso shots.',
    stories: [
      {
        id: 'oat', title: 'The oat that ran out at 7:10', badge: 'today', tags: ['checked', 'warned'], layout: 'compare',
        scene: 'Friday rush. Oat is down to two, there’s one muffin left, and nobody has counted since opening.',
        without: 'You make the flat white. Then you find the oat’s gone and that was the last muffin. Remake, apology, a regular who walks next door.',
        beats: [{
          say: 'A large oat flat white and a muffin',
          see: [['warn', 'Oat milk low (2 left). Offer Almond or Skim'], ['warn', 'Only 1 muffin left']],
          proof: { scenario: 'rush', fields: { drink: 'Flat White', size: 'Large', milk: 'Oat', muffin: 'yes' } },
        }],
        kicker: 'Same customer, same order. You said “I can do almond, and that’s the last muffin” before anyone picked up a jug.',
        try: { say: 'A large oat flat white and a muffin', scenario: 'rush' },
      },
      {
        id: 'regular', title: 'The orders that cause remakes', badge: 'today', tags: ['asked'], layout: 'parallel',
        scene: 'New staff don’t know which words hide a second question.',
        cols: ['They say', 'The screen asks'],
        rows: [
          { said: '“Just a regular.”', see: ['ask', '“Regular” is unclear: ask size and milk'] },
          { said: '“Iced latte, no ice, milk to the top.”', see: ['ask', 'No ice, milk to the top: latte or just a splash?'] },
        ],
        proof: { fields: { drink: 'Latte', iced: 'yes', no_ice_milk_top: 'yes', regular_word: 'yes' } },
        kicker: 'The question is there before the cup is made.',
        try: { say: 'A regular coffee' },
      },
      {
        id: 'couch', title: 'Sunday night, from the couch', badge: 'today', tags: ['checked'], layout: 'board', fromData: true,
        scene: 'Open Backend on your phone. This is the stockroom, and every confirmed order takes stock off it.',
        cols: ['Stockroom', 'Left'],
        rows: ['Oat', 'Almond', 'Soy', 'Muffin', 'Croissant', 'Espresso shots'].map((n) => [n, stock[n] <= 0 ? 'sold out' : stock[n] + ' left', level(stock[n])]),
        kicker: 'Monday’s delivery order is a glance, not a stocktake.',
      },
    ],
  },
  {
    id: 'trades', who: 'Plumber / roofer', tab: 'quote',
    hook: 'Quote it before you’re off the ladder.',
    checks: 'Checks the dispatch board: crews free today and tomorrow, parts on the vans.',
    stories: [
      {
        id: 'hotwater', title: 'Hot water’s gone, strata block', badge: 'today', tags: ['checked', 'warned'], layout: 'dialogue',
        scene: 'You’re up a ladder with the customer on speaker, and it’s storm week.',
        beats: [
          {
            who: 'them', say: 'Hot water’s gone and the tank’s leaking. We’re in a strata block, weekdays only.',
            see: [['out', 'Emergency call-out loading (+25%)'], ['out', 'No plumber free today. Tomorrow: 1 crew'], ['out', 'Hot water unit 250L out of stock: 2-day lead time'], ['warn', 'Access window limits the schedule (+10%)']],
            proof: { scenario: 'storm', fields: { trade: 'Plumbing', issue: 'HotWater', scope: 'Small', access: 'Restricted', urgency: 'Emergency' } },
          },
          { who: 'you', say: 'Tomorrow’s the earliest I can get someone to you, and the unit’s a two-day wait. I’m sending a price range to your phone now.' },
        ],
        try: { say: 'Hot water has gone and the tank is leaking, strata block, weekdays only', scenario: 'storm' },
      },
      {
        id: 'gas', title: '“I can smell gas”', badge: 'today', tags: ['warned'], layout: 'alarm',
        scene: 'The call you can’t get wrong.',
        beats: [{
          say: 'I can smell gas in the kitchen',
          see: [['out', 'Gas smell: leave the house, call the gas emergency line, then book'], ['out', 'Emergency call-out loading (+25%)']],
          proof: { fields: { trade: 'Gas', issue: 'Gas', scope: 'Small', access: 'Easy', urgency: 'Emergency' } },
        }],
        kicker: 'You read it out. You don’t have to remember it. A burst pipe gets “turn the water off at the main now” the same way.',
        try: { say: 'I can smell gas in the kitchen' },
      },
      {
        id: 'reno', title: 'The vague reno, priced as they describe it', badge: 'today', tags: ['checked', 'warned'], layout: 'parallel',
        scene: 'An old unit, damp, a toilet to move. Most quotes that blow out start here.',
        cols: ['You described', 'It priced in'],
        rows: [
          { said: '“1970s brick unit”', see: ['out', 'Old building: test before you touch it'] },
          { said: '“Strata, weekdays nine to three”', see: ['warn', 'Access window limits the schedule (+10%)'] },
          { said: '“Damp under the vanity”', see: ['warn', 'Hidden-damage contingency (+20%)'] },
          { said: '“Moving the toilet”', see: ['warn', 'Licensed sign-off or permit likely'] },
        ],
        proof: { fields: { trade: 'Bathroom', issue: 'Reno', scope: 'Large', access: 'Restricted', urgency: 'Flexible', materials: 'Customer', old_building: 'yes', hidden_risk: 'yes', permit: 'yes' } },
        kicker: 'Day two of the job stops being a surprise.',
        try: { say: '1970s brick unit bathroom reno, strata weekdays nine to three only, damp under the vanity, moving the toilet, customer buys tiles' },
      },
      {
        id: 'roofs', title: 'Forty leaking roofs after the storm', badge: 'yours', tags: ['warned', 'next'], layout: 'board',
        scene: 'The phone doesn’t stop. You dictate each call in fifteen seconds between jobs and the board sorts itself.',
        cols: ['Tomorrow’s board', 'Slot'],
        rows: [
          ['Tile roof, two storeys, ceiling stained', 'First on', 'out'],
          ['Gutter overflowing, rear unit', 'Morning', 'warn'],
          ['Ridge capping lifted, no leak yet', 'Friday', 'ok'],
        ],
        say: 'Leaking tile roof, two storeys, ceiling already stained, urgent',
        next: '“Put a bucket under it and keep clear of the stain. We’ll be there tomorrow morning.”',
      },
    ],
  },
  {
    id: 'dentist', who: 'Dentist', tab: 'desk',
    hook: 'A real appointment time while they’re still on the phone.',
    checks: 'Checks the appointment book: which chair, which day, who is free. The Front desk tab shows this with a clinic’s calendar.',
    stories: [
      {
        id: 'booked', title: 'Booked out tomorrow afternoon', badge: 'yours', tags: ['checked', 'warned', 'next'], layout: 'dialogue',
        scene: 'You’re mid-treatment and reception is on two calls.',
        beats: [
          { who: 'them', say: 'Hi, it’s Dave, I’ve been before, my tooth is sore, can I come in tomorrow afternoon?', see: [['warn', 'No tomorrow afternoon slots. Next free: Thursday 9:20 · Dr Patel']] },
          { who: 'you', suggested: true, say: 'Thursday 9:20 is the first one. Shall I put you on the cancellation list for tomorrow?' },
        ],
      },
      {
        id: 'newpatient', title: 'The new patient', badge: 'today', tags: ['asked'], layout: 'scene',
        scene: 'First call from someone who has never been in. Reception has the checklist in their head, on a good day.',
        beats: [{
          say: 'Hi, I’d like a check-up, I haven’t been before',
          see: [['ask', 'New patient: collect ID and Medicare'], ['ask', 'Name not heard: ask the caller']],
          proof: { fields: { reason: 'Checkup', urgency: 'Routine', red_flag: 'no', patient: 'New', day: 'Unspecified', time: 'Unspecified' } },
        }],
        kicker: 'The screen asks for whatever the caller hasn’t said yet.',
        try: { say: 'Hi, I’d like a check-up, I haven’t been before' },
      },
      {
        id: 'swelling', title: 'Face swelling, hard to swallow', badge: 'yours', tags: ['warned', 'next'], layout: 'timeline',
        scene: 'You write the red-flag list for your own practice once. The demo’s list is a clinic’s; yours would be swelling that spreads, trouble swallowing, bleeding that won’t stop.',
        beats: [
          { at: '0:00', say: 'My face is swelling and it hurts to swallow' },
          { at: '0:02', see: [['out', 'Possible emergency. Do not book.']] },
          { at: '0:03', see: [['out', 'Transfer to the dentist now. If breathing is hard, tell them to call 000.']], next: '“Stay on the line, I’m getting the dentist now.”' },
        ],
        kicker: 'It never decides for you. It puts the right sentence in front of reception in the first three seconds.',
      },
    ],
  },
  {
    id: 'pool', who: 'Pool builder', tab: 'quote',
    hook: 'Give them the honest date in the backyard.',
    checks: 'Would check your dig-crew diary, supplier lead times and site notes. The Quote tab is the closest demo.',
    stories: [
      {
        id: 'walk', title: 'Walking the block with a couple who are ready to say yes', badge: 'yours', tags: ['asked', 'warned'], layout: 'scene',
        scene: 'A sloping yard, a couple who want to start, and you’re dictating as you walk.',
        beats: [{
          say: 'Eight by four concrete pool, sloping block, rock at the back left, they want a spa and it done before Christmas',
          see: [['warn', 'Rock possible: price excavation as provisional'], ['warn', 'Slope: retaining wall likely'], ['ask', 'Side access width not heard: will an excavator fit?'], ['ask', 'Council approval and fencing not mentioned: ask']],
        }],
        kicker: 'The questions you’d remember in the ute are on the screen while you’re still standing in the yard.',
      },
      {
        id: 'date', title: '“Done before Christmas”', badge: 'yours', tags: ['checked', 'warned', 'next'], layout: 'compare',
        scene: 'They want it finished before Christmas. Your diary says otherwise.',
        without: '“Unfortunately, due to supply delays, we won’t be able to complete before Christmas…” Sent in December, after the deposit.',
        beats: [{
          say: '…and we want it finished before Christmas',
          see: [['out', 'Dig crew booked until mid-February'], ['out', 'Shell lead time pushes handover past Christmas']],
          next: '“The honest answer is late February. I can hold a dig date with the deposit.”',
        }],
      },
      {
        id: 'variation', title: 'The Friday variation', badge: 'yours', tags: ['checked', 'asked', 'next'], layout: 'timeline',
        scene: 'Six weeks in, on site. The owner wants the steps moved and a swim jet added.',
        beats: [
          { at: '2:10pm', say: 'Move the steps to the shallow end and add a swim jet' },
          { at: '2:11pm', see: [['warn', 'Variation: plumbing and shell change'], ['warn', 'Adds about two days to the schedule'], ['ask', 'Written approval needed before work starts']] },
          { at: '2:12pm', label: 'You’re still standing there.', next: '“I’ll text you the price in a minute. A yes by Friday keeps the date.”' },
        ],
        kicker: 'Nobody argues at handover about what was agreed.',
      },
    ],
  },
  {
    id: 'sales', who: 'Sales manager', tab: 'sales',
    hook: 'Every call logged before the rep starts the car.',
    checks: 'Checks the CRM and the diary: who the deal is, what’s free this week. For airtime, it would check the airtime sheet.',
    stories: [
      {
        id: 'carpark', title: 'The car-park debrief', badge: 'today', tags: ['checked'], layout: 'timeline',
        scene: 'In the old days these notes arrived on Friday, if at all.',
        beats: [
          { at: '10:42', label: 'Client meeting ends. Your rep is in the car park.' },
          {
            at: '10:43', say: 'Met Elena at Redgum Coffee, keen, book a follow-up call',
            see: [['warn', 'New lead: Redgum Coffee is not in the CRM yet'], ['ok', 'Calendar: Thu 2:00pm is free']],
            proof: { scenario: 'open', fields: { interest: 'Warm', next_step: 'Call', company: 'Redgum Coffee' } },
          },
          { at: '10:44', label: 'Lead logged, call in the diary. Rep pulls out.' },
        ],
        try: { say: 'Met Elena at Redgum Coffee, keen, book a follow-up call', scenario: 'open' },
      },
      {
        id: 'nextstep', title: 'What every rep says, and what you’d say back', badge: 'today', tags: ['asked'], layout: 'parallel',
        scene: 'A friendly call that ends with “I’ll come back to you” is the sound of a deal going cold.',
        cols: ['The rep says', 'The screen says'],
        rows: [
          { said: '“She’ll come back to me.”', see: ['out', 'No next step agreed'] },
          { said: '“Keen, but she wants to think about it.”', see: ['warn', 'Stalling: re-engage within 48 hours'] },
        ],
        proof: { fields: { interest: 'Warm', budget: 'Vague', timeline: 'Later', decision_maker: 'Unknown', stall: 'yes', next_step: 'None', company: 'Redgum Coffee' } },
        kicker: 'Twenty reps get the same prompt, not the one you happen to remember to give.',
        try: { say: 'Spoke to Elena at Redgum Coffee, keen but budget not discussed, she will come back to me' },
      },
      {
        id: 'pipeline', title: 'Your pipeline, moving while you watch', badge: 'today', tags: ['checked'], layout: 'board', fromData: true,
        scene: 'Open Backend on the Sales tab. These are the deals, and every dictated call moves them.',
        cols: ['Deal', 'Stage'],
        rows: Object.values(data('sales').deals).map((d) => [d.company + (d.value ? ' · ' + money(d.value) : ''), d.stage, d.score >= 70 ? 'ok' : d.score >= 40 ? 'warn' : 'out']),
        kicker: 'You see it on Tuesday, not in Monday’s report.',
      },
      {
        id: 'airtime', title: 'Breakfast is sold out that week', badge: 'yours', tags: ['checked', 'warned', 'next'], layout: 'dialogue',
        scene: 'Your stock was never boxes. It’s airtime: slots that can only be sold once.',
        beats: [
          { who: 'them', say: 'Can I get breakfast the week of the fourteenth? Thirty-second spots, two weeks.', see: [['out', 'Breakfast, week of the 14th: sold out'], ['ok', 'Free: Drive 3–6pm, Weekend breakfast']] },
          { who: 'you', suggested: true, say: 'Breakfast is gone that week. I can hold Drive for 48 hours.' },
        ],
        kicker: 'The airtime sheet is the stockroom.',
      },
    ],
  },
  {
    id: 'grower', who: 'Grower', tab: 'coffee',
    hook: 'Promise only what’s cut and cooled.',
    checks: 'Would check what’s cut, what’s in the cold room and who’s picking. The Coffee tab is the closest demo: it’s the same stock check.',
    stories: [
      {
        id: 'trays', title: 'Forty trays you haven’t cut', badge: 'yours', tags: ['checked', 'warned', 'next'], layout: 'parallel',
        scene: 'A buyer rings the packing shed while you’re elbow-deep in rhubarb.',
        cols: ['The buyer asks for', 'You can promise'],
        rows: [
          { said: '40 trays baby spinach', see: ['ok', '40 trays ready'] },
          { said: '20 trays rhubarb', see: ['warn', '12 cut, 8 more Monday'] },
          { said: 'Silverbeet', see: ['out', 'None planted this season'] },
        ],
        next: '“Twelve rhubarb Thursday, eight Monday, and no silverbeet this month.”',
      },
      {
        id: 'missing', title: 'The order that’s missing something', badge: 'yours', tags: ['asked'], layout: 'scene',
        scene: 'Orders arrive by phone, text and a voice message from the truck.',
        beats: [{
          say: 'Forty trays of spinach for Thursday',
          see: [['ask', 'Delivery window not heard: ask'], ['ask', 'Pack size not heard: trays or 250 g bags?'], ['ask', 'Which store or depot? Not heard']],
        }],
        kicker: 'The picking list is ready when you tap Confirm, with no callback to chase the dock number.',
      },
      {
        id: 'coldroom', title: 'The cold room is the stock', badge: 'yours', tags: ['checked', 'warned', 'next'], layout: 'board',
        scene: 'What runs out here isn’t always product. It’s cold-room space and pickers.',
        say: 'Add twenty trays of herbs for Thursday',
        cols: ['Thursday', 'Capacity'],
        rows: [['Cold room', '54 of 60 trays', 'warn'], ['Wednesday pickers', 'Fully booked', 'out'], ['Thursday truck', 'Room for 2 more pallets', 'ok']],
        next: '“I can do ten herbs Thursday and ten Friday.”',
      },
    ],
  },
];
