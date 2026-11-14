# Jev voice demos
Speak, and Jev fills in typed fields, risk flags and numbers live, checked against a backend (stock, calendars, crews, CRM). Built for iPhone Safari; voice does not work inside home-screen apps, so the home-screen icon opens Safari.
Tabs: Coffee (home), Quote (trades), Front desk (clinic booking), Sales (post-call notes). Open `#coffee/backend` (any tab id) to see the operations console behind a demo, for example on a laptop beside the phone.

## Where things are
| | |
|---|---|
| `demos/` | **One file per demo**: Jev's questions, the screen, the maths, its operational `data`, its `backend` sections, and the `effects` confirming applies. `index.mjs` lists them. `lib.mjs` has helpers and every threshold (`TUNING`). `effects.mjs` is the only way data changes. |
| `app.js` `styles.css` `index.html` | The screen: tabs, rows, flags, wiring, Backend mode. |
| `backend.js` `ops.js` | The Backend console, built from each demo's `backend`; the browser's copy of the data. |
| `speech.js` `jev.js` | Speech recognition; the Jev client with the settling pass and the final check (no DOM, tested in Node). |
| `fx/` | Effects: pip, Steve the dachshund, censor bleep. `fx/index.js` is the only door. |
| `server/` | `modes.mjs` read / audit / rewrite (+ name extraction); `gateway.mjs` talks to Jev; `ops.mjs` data and quality log; `guard.mjs` origin + rate limits; `store.mjs` Netlify Blobs (memory fallback). |
| `netlify/functions/` | `order.mjs` = `POST /api/order` (Jev). `ops.mjs` = `/api/data` and `/api/log`. |
| `tests/` | `npm test`, no extra dependencies. Checks every demo, the server, the effects engine and the final check. |

## Add a demo (about 10 minutes)
1. Copy `demos/_template.mjs` to `demos/<name>.mjs`; edit questions, labels, rows, flags, data, backend.
2. In `demos/index.mjs`, import it and add it to the list.
3. `npm test`, then push to `main`. The tab, the Jev questions, the screen and its Backend all come from that one file.

## Scenarios
Each demo's Backend has a **Scenarios** card: one tap sets up a pitch situation ("Friday rush", "Fully booked week", "Storm week", "End of quarter") from clean data, then says what to say in Voice. Defined in the demo as `scenarios: [{ id, name, blurb, say, effects(data) }]`. `tests/ops.test.mjs` checks each one applies cleanly and that the voice then pings what it should; add the expected pings to `SCEN` there when you add a scenario.

## How a conversation flows
words -> live read about every 0.6 s (Jev for choices, extraction for names) -> render reads the backend data and pings stockouts or no availability -> after a pause or mic-off: **settle** unsure fields -> **final check** (Jev audits each row; clear mismatches are rewritten, tagged, chimed, and logged) -> **confirm** applies the demo's effects to the backend.

## Setup on Netlify
- `ABCDJEV_MCP_URL` (environment variable, mark it secret): the ABCDJEV gateway URL. Functions read it at run time.
- Netlify Blobs needs nothing enabled. Optional tuning: `JEV_PER_MIN` (default 150 Jev calls per visitor per minute), `JEV_DAILY_LIMIT` (default 30000 per day, all visitors).
- Stored: `demo-data` (each demo's data), `quality-log` (final-check mismatches: includes short snippets of what was said; clear it from the Backend screen), `limits` (counters).
