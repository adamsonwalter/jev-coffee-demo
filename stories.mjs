// "What it's for": stories for the people who ask what this is. One persona per friend, a few scenes each.
// Plain data, no DOM, so tests can check it against the real demos (tests/stories.test.mjs).
//
// badge 'today' = it works in the demo. Every step carries `proof` (the scenario and the fields Jev would hear), and the
//                 test renders it through the real demo: each line on screen below must be wording the app really shows.
// badge 'yours' = not built yet. The same engine on the person's own numbers; the screen wording is illustrative.
//
// see: [kind, text]. kind: ok | warn | out (flags, as the app colours them)
//                          ask  = a prompt for something not yet said
//                          next = what to say next (not a live feature yet; only the "Offer…" and "ask…" lines inside flags are)

export const LEGEND = [
  ['checked', 'Checked against your numbers'],
  ['warned', 'Warned: sold out, booked out, nobody free'],
  ['asked', 'Asked for what’s missing'],
  ['next', 'Told what to say next'],
];

export const BADGE = { today: 'Works in the demo', yours: 'Not built yet · on your own numbers' };

export const LEDE = 'Say it once, in your own words. Jev fills in the form, checks it against what’s really true in your business, and tells you what’s missing or what to say next, while the other person is still on the line.';

export const PERSONAS = [
  {
    id: 'cafe', who: 'Café owner', tab: 'coffee',
    hook: 'Know it’s sold out before you say yes.',
    checks: 'Checks the stockroom: milk, food, espresso shots.',
    stories: [
      {
        id: 'oat', title: 'The oat that ran out at 7:10', badge: 'today', tags: ['checked', 'warned'],
        scene: 'Friday rush. Oat is down to two and there’s one muffin left, but nobody has counted since opening.',
        steps: [{
          say: 'A large oat flat white and a muffin',
          see: [['warn', 'Oat milk low (2 left). Offer Almond or Skim'], ['warn', 'Only 1 muffin left']],
          proof: { scenario: 'rush', fields: { drink: 'Flat White', size: 'Large', milk: 'Oat', muffin: 'yes' } },
        }],
        payoff: 'The warning lands while the customer is still talking, so the answer is “I can do almond, and that’s the last muffin” instead of a refund. Confirm the order and the counts drop for the next one.',
        try: { say: 'A large oat flat white and a muffin', scenario: 'rush' },
      },
      {
        id: 'croissant', title: 'The last croissant, twice', badge: 'today', tags: ['checked', 'warned'],
        scene: 'One croissant left, nothing else baked, and two people in the queue want one.',
        steps: [{
          say: 'A flat white with a croissant and a muffin',
          see: [['out', 'Muffin sold out. Offer Croissant'], ['warn', 'Only 1 croissant left']],
          proof: { scenario: 'lastone', fields: { drink: 'Flat White', milk: 'Full cream', croissant: 'yes', muffin: 'yes' } },
        }],
        payoff: 'It counts what is actually left, including the thing you were about to promise the next person. A barista in their first week gets the same answer as you would.',
        try: { say: 'A flat white with a croissant and a muffin', scenario: 'lastone' },
      },
      {
        id: 'regular', title: '“Just a regular coffee”', badge: 'today', tags: ['asked'],
        scene: 'The orders that cause remakes: vague words, and a request that could mean two drinks.',
        steps: [
          { say: 'A regular coffee', see: [['ask', '“Regular” is unclear: ask size and milk']], proof: { fields: { drink: 'Drip Coffee', regular_word: 'yes' } } },
          { say: 'Iced latte with no ice and milk to the top', see: [['ask', 'No ice, milk to the top: latte or just a splash?']], proof: { fields: { drink: 'Latte', iced: 'yes', no_ice_milk_top: 'yes' } } },
        ],
        payoff: 'The follow-up question is on the screen before the cup is made, so awkward orders come out right the first time.',
        try: { say: 'A regular coffee' },
      },
      {
        id: 'couch', title: 'Sunday night, from the couch', badge: 'today', tags: ['checked'],
        scene: 'You’re at home. Open Backend and the stockroom is there, with what was changed and when.',
        steps: [{ label: 'Backend › Stockroom', see: [['warn', 'Oat: 2 left'], ['out', 'Soy: 0'], ['warn', 'Muffin: 1 left']] }],
        payoff: 'Every confirmed order takes stock off the same list. Monday’s delivery order is a glance at your phone, not a stocktake.',
      },
    ],
  },
  {
    id: 'trades', who: 'Plumber / roofer', tab: 'quote',
    hook: 'Quote the job before you’re off the ladder.',
    checks: 'Checks the dispatch board: crews free today and tomorrow, parts on the vans.',
    stories: [
      {
        id: 'hotwater', title: 'Hot water’s gone, strata block, weekdays only', badge: 'today', tags: ['checked', 'warned'],
        scene: 'You’re up a ladder with the customer on speaker, and it’s storm week.',
        steps: [{
          say: 'Hot water has gone and the tank is leaking, strata block, weekdays only',
          see: [['out', 'Emergency call-out loading (+25%)'], ['out', 'No plumber free today. Tomorrow: 1 crew'], ['out', 'Hot water unit 250L out of stock: 2-day lead time'], ['warn', 'Access window limits the schedule (+10%)']],
          proof: { scenario: 'storm', fields: { trade: 'Plumbing', issue: 'HotWater', scope: 'Small', access: 'Restricted', urgency: 'Emergency' } },
        }],
        payoff: 'You give the honest answer on the call: tomorrow at the earliest, unit in two days. The customer has a price range before you’re back on the ground.',
        try: { say: 'Hot water has gone and the tank is leaking, strata block, weekdays only', scenario: 'storm' },
      },
      {
        id: 'gas', title: '“I can smell gas”', badge: 'today', tags: ['warned'],
        scene: 'The call you never want to get wrong.',
        steps: [{
          say: 'I can smell gas in the kitchen',
          see: [['out', 'Gas smell: leave the house, call the gas emergency line, then book'], ['out', 'Emergency call-out loading (+25%)']],
          proof: { fields: { trade: 'Gas', issue: 'Gas', scope: 'Small', access: 'Easy', urgency: 'Emergency' } },
        }],
        payoff: 'The safety line appears the moment it’s said, so you read it out instead of remembering it under pressure. A burst pipe gets “turn the water off at the main now” the same way.',
        try: { say: 'I can smell gas in the kitchen' },
      },
      {
        id: 'reno', title: 'The vague reno', badge: 'today', tags: ['checked', 'warned'],
        scene: 'An old unit, damp under the vanity, a toilet to move. Most quotes that blow out start here.',
        steps: [{
          say: '1970s brick unit bathroom reno, strata weekdays nine to three only, damp under the vanity, moving the toilet, customer buys tiles',
          see: [['out', 'Old building: test before you touch it'], ['warn', 'Access window limits the schedule (+10%)'], ['warn', 'Hidden-damage contingency (+20%)'], ['warn', 'Licensed sign-off or permit likely']],
          proof: { fields: { trade: 'Bathroom', issue: 'Reno', scope: 'Large', access: 'Restricted', urgency: 'Flexible', materials: 'Customer', old_building: 'yes', hidden_risk: 'yes', permit: 'yes' } },
        }],
        payoff: 'The asbestos test, the permit and the hidden-damage allowance are in the range before the first site visit, so day two isn’t a surprise.',
        try: { say: '1970s brick unit bathroom reno, strata weekdays nine to three only, damp under the vanity, moving the toilet, customer buys tiles' },
      },
      {
        id: 'roof', title: 'Forty leaking roofs after a storm', badge: 'yours', tags: ['warned', 'asked', 'next'],
        scene: 'The phone doesn’t stop. You dictate each call in fifteen seconds between jobs.',
        steps: [{
          say: 'Leaking tile roof, two storeys, ceiling already stained, urgent',
          see: [['out', 'Emergency: first on tomorrow’s board'], ['warn', 'Two storeys: scaffold or a second crew'], ['ask', 'Is the ceiling sagging? Ask before sending anyone up'], ['next', '“Put a bucket under it and keep clear of the stain. We’ll be there tomorrow morning.”']],
        }],
        payoff: 'Each caller gets a safe instruction and a real day, and your board sorts itself by urgency instead of by who rang first.',
      },
    ],
  },
  {
    id: 'dentist', who: 'Dentist', tab: 'desk',
    hook: 'A real appointment time while they’re still on the phone.',
    checks: 'Checks the appointment book: which chair, which day, who is free.',
    stories: [
      {
        id: 'booked', title: 'Booked out tomorrow afternoon', badge: 'yours', tags: ['checked', 'warned', 'next'],
        scene: 'You’re mid-treatment and reception is on two calls. A patient wants tomorrow afternoon. (The Front desk tab shows this with a clinic’s calendar; yours would be your chairs.)',
        steps: [{
          say: 'Hi, it’s Dave, I’ve been before, my tooth is sore, can I come in tomorrow afternoon',
          see: [['warn', 'No tomorrow afternoon slots. Next free: Thursday 9:20 · Dr Patel'], ['next', '“Thursday 9:20 is the first one. Shall I put you on the cancellation list for tomorrow?”']],
        }],
        payoff: 'The book is checked while the patient is on the line, so the answer is a real time instead of “we’ll call you back”. Confirm it and the slot is taken.',
      },
      {
        id: 'newpatient', title: 'The new patient', badge: 'today', tags: ['asked'],
        scene: 'First call from someone who has never been in.',
        steps: [{
          say: 'Hi, I’d like a check-up, I haven’t been before',
          see: [['ask', 'New patient: collect ID and Medicare'], ['ask', 'Name not heard: ask the caller']],
          proof: { fields: { reason: 'Checkup', urgency: 'Routine', red_flag: 'no', patient: 'New', day: 'Unspecified', time: 'Unspecified' } },
        }],
        payoff: 'Reception never forgets the ID, the name or the form, because the screen asks for whatever the caller hasn’t said yet.',
        try: { say: 'Hi, I’d like a check-up, I haven’t been before' },
      },
      {
        id: 'swelling', title: 'Face swelling, hard to swallow', badge: 'yours', tags: ['warned', 'next'],
        scene: 'You write the red-flag list for your own practice once. The demo’s list is a clinic’s (chest pain, trouble breathing); yours would be swelling that spreads, trouble swallowing, bleeding that won’t stop.',
        steps: [{
          say: 'My face is swelling and it hurts to swallow',
          see: [['out', 'Possible emergency. Do not book.'], ['out', 'Transfer to the dentist now. If breathing is hard, tell them to call 000.'], ['next', '“Stay on the line, I’m getting the dentist now.”']],
        }],
        payoff: 'It never decides for you. It puts the right question and the right sentence in front of reception in the second it matters.',
      },
    ],
  },
  {
    id: 'pool', who: 'Pool builder', tab: 'quote',
    hook: 'Give them the honest date in the backyard.',
    checks: 'Would check your dig-crew diary, supplier lead times and site notes. The Quote tab is the closest demo.',
    stories: [
      {
        id: 'walk', title: 'Walking the block with a couple who are ready to say yes', badge: 'yours', tags: ['asked', 'warned'],
        scene: 'A sloping yard, a couple who want to start, and you’re dictating as you walk.',
        steps: [{
          say: 'Eight by four concrete pool, sloping block, rock at the back left, they want a spa and it done before Christmas',
          see: [['warn', 'Rock possible: price excavation as provisional'], ['warn', 'Slope: retaining wall likely'], ['ask', 'Side access width not heard: will an excavator fit?'], ['ask', 'Council approval and fencing not mentioned: ask']],
        }],
        payoff: 'The questions you’d remember in the ute are on the screen while you’re still standing there, and the risks are in the number before you give it.',
      },
      {
        id: 'date', title: 'The honest date', badge: 'yours', tags: ['checked', 'warned', 'next'],
        scene: 'They want it before Christmas. Your diary says otherwise.',
        steps: [{
          say: '…and we want it finished before Christmas',
          see: [['out', 'Dig crew booked until mid-February'], ['out', 'Shell lead time pushes handover past Christmas'], ['next', '“The honest answer is late February. I can hold a dig date with the deposit.”']],
        }],
        payoff: 'They hear the real date in the backyard, not in an apologetic email in December. The conversation becomes “which date”, not a complaint.',
      },
      {
        id: 'variation', title: 'The Friday variation', badge: 'yours', tags: ['checked', 'asked', 'next'],
        scene: 'Six weeks in. The owner wants the steps moved and a swim jet added, and you’re on site.',
        steps: [{
          say: 'Move the steps to the shallow end and add a swim jet',
          see: [['warn', 'Variation: plumbing and shell change'], ['warn', 'Adds about two days to the schedule'], ['ask', 'Written approval needed before work starts'], ['next', '“I’ll text you the price in a minute. A yes by Friday keeps the date.”']],
        }],
        payoff: 'The change is priced, dated and agreed in writing before anyone downs tools, and nobody argues at handover about what was said.',
      },
    ],
  },
  {
    id: 'sales', who: 'Sales manager', tab: 'sales',
    hook: 'Every call logged and checked before the rep starts the car.',
    checks: 'Checks the CRM and the diary: who the deal is, what’s free this week. For airtime, it would check the airtime sheet.',
    stories: [
      {
        id: 'carpark', title: 'The car-park debrief', badge: 'today', tags: ['checked'],
        scene: 'Your rep walks out of a client meeting. In the old days the notes arrived on Friday, if at all.',
        steps: [{
          say: 'Met Elena at Redgum Coffee, keen, book a follow-up call',
          see: [['warn', 'New lead: Redgum Coffee is not in the CRM yet'], ['ok', 'Calendar: Thu 2:00pm is free']],
          proof: { scenario: 'open', fields: { interest: 'Warm', next_step: 'Call', company: 'Redgum Coffee' } },
        }],
        payoff: 'The lead is logged and the follow-up is in the diary before the rep has started the car. You watch the pipeline move live, not in Monday’s report.',
        try: { say: 'Met Elena at Redgum Coffee, keen, book a follow-up call', scenario: 'open' },
      },
      {
        id: 'nextstep', title: 'Nobody agreed what happens next', badge: 'today', tags: ['asked'],
        scene: 'A friendly call that ends with “I’ll come back to you”, which is the sound of a deal going cold.',
        steps: [{
          say: 'Spoke to Elena at Redgum Coffee, keen but budget not discussed, she will come back to me',
          see: [['out', 'No next step agreed'], ['warn', 'Stalling: re-engage within 48 hours']],
          proof: { fields: { interest: 'Warm', budget: 'Vague', timeline: 'Later', decision_maker: 'Unknown', stall: 'yes', next_step: 'None', company: 'Redgum Coffee' } },
        }],
        payoff: 'The rep is told while it’s still fixable. Twenty reps get the same prompt, not the one their manager happens to remember to give.',
        try: { say: 'Spoke to Elena at Redgum Coffee, keen but budget not discussed, she will come back to me' },
      },
      {
        id: 'quarterend', title: 'End of quarter, diary full', badge: 'today', tags: ['checked', 'warned'],
        scene: 'Thursday is the only day the buyer can do, and Thursday is gone.',
        steps: [{
          say: 'Priya at Northwind wants a demo Thursday, she needs her CFO to sign off, and she’s looking at a competitor',
          see: [['out', 'No free calendar slots this week'], ['warn', 'Competitor in play: prepare a comparison'], ['warn', 'Decision maker not on the call: ask for an intro'], ['ok', 'CRM: Northwind · Proposal · A$1,950']],
          proof: { scenario: 'quarterend', fields: { interest: 'Hot', next_step: 'Demo', company: 'Northwind', competitor: 'yes', decision_maker: 'No' } },
        }],
        payoff: 'The manager sees in one glance that the diary is full, the buyer isn’t the decider, and a rival is in the room.',
        try: { say: 'Priya at Northwind wants a demo Thursday, she needs her CFO to sign off, and she’s looking at a competitor', scenario: 'quarterend' },
      },
      {
        id: 'airtime', title: 'Breakfast is sold out that week', badge: 'yours', tags: ['checked', 'warned', 'next'],
        scene: 'Your stock was never boxes. It’s airtime: slots that can only be sold once.',
        steps: [{
          say: 'Priya wants breakfast the week of the fourteenth, thirty-second spots, two weeks',
          see: [['out', 'Breakfast, week of the 14th: sold out'], ['ok', 'Free: Drive 3–6pm, Weekend breakfast'], ['next', '“Breakfast is gone that week. I can hold Drive for 48 hours.”']],
        }],
        payoff: 'The rep never promises a slot that’s gone. The airtime sheet is the stock list, exactly like the oat, and the call ends with a held slot instead of “I’ll check”.',
      },
    ],
  },
  {
    id: 'grower', who: 'Grower', tab: 'coffee',
    hook: 'Promise only what’s cut and cooled.',
    checks: 'Would check what’s cut, what’s in the cold room and who’s picking. The Coffee tab is the closest demo: it’s the same stock check.',
    stories: [
      {
        id: 'trays', title: 'Forty trays you haven’t cut', badge: 'yours', tags: ['checked', 'warned', 'next'],
        scene: 'A buyer rings the packing shed while you’re elbow-deep in rhubarb.',
        steps: [{
          say: 'I need forty trays of baby spinach and twenty of rhubarb for Thursday, and can you do silverbeet',
          see: [['ok', 'Baby spinach: 40 trays ready'], ['warn', 'Rhubarb: 12 trays cut, 8 more on Monday'], ['out', 'Silverbeet: none planted this season'], ['next', '“Twelve rhubarb Thursday, eight Monday, and no silverbeet this month.”']],
        }],
        payoff: 'You promise only what exists, and the buyer gets a straight answer in one call instead of a short delivery later.',
      },
      {
        id: 'missing', title: 'The order that’s missing something', badge: 'yours', tags: ['asked'],
        scene: 'Orders arrive by phone, text and a voice message from the truck.',
        steps: [{
          say: 'Forty trays of spinach for Thursday',
          see: [['ask', 'Delivery window not heard: ask'], ['ask', 'Pack size not heard: trays or 250 g bags?'], ['ask', 'Which store or depot? Not heard']],
        }],
        payoff: 'Every order is complete the first time. The picking list is ready when you tap Confirm, with no callback to chase the dock number.',
      },
      {
        id: 'coldroom', title: 'The cold room is the stock', badge: 'yours', tags: ['checked', 'warned', 'next'],
        scene: 'What runs out here isn’t always product. It’s cold-room space and pickers.',
        steps: [{
          say: 'Add twenty trays of herbs for Thursday',
          see: [['warn', 'Cold room: space for 6 more trays'], ['out', 'Wednesday picking crew is fully booked'], ['next', '“I can do ten herbs Thursday and ten Friday.”']],
        }],
        payoff: 'Capacity gets checked the same way stock does, so a yes on the phone is a yes on Wednesday morning.',
      },
    ],
  },
];
