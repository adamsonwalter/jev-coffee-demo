# Jev voice demos
Speak, and Jev fills in typed fields, risk flags and numbers live. Built for iPhone Safari (voice does not work inside home-screen apps; the home-screen icon opens Safari).
Tabs: Coffee (home), Quote (trades), Front desk (clinic booking with an emergency red flag), Sales (post-call notes with a deal score).

## Where things are
| | |
|---|---|
| `demos/` | **One file per demo**: Jev's questions, what the screen shows, the maths. `index.mjs` lists them. `lib.mjs` has helpers and every threshold (`TUNING`). |
| `app.js` `styles.css` `index.html` | The screen: tabs, rows, flags, wiring. |
| `speech.js` | Speech recognition wrapped as callbacks. |
| `jev.js` | Calls the function; the settling pass and the final check (no DOM, tested in Node). |
| `fx/` | Effects: pip, Steve the dachshund, censor bleep. `fx/index.js` is the only door. |
| `server/` | `modes.mjs` read / audit / rewrite; `gateway.mjs` talks to Jev via the ABCDJEV gateway. |
| `netlify/functions/order.mjs` | The HTTP door `POST /api/order`. Needs env var `ABCDJEV_MCP_URL`. |
| `tests/` | `npm test` (no dependencies). Checks every demo and the server and final-check logic. |

## Add a demo (about 10 minutes)
1. Copy `demos/_template.mjs` to `demos/<name>.mjs`; edit questions, labels, rows, flags.
2. In `demos/index.mjs`, import it and add it to the list.
3. `npm test`, then push to `main`. The tab, the Jev questions and the screen all come from that one file.

## How a conversation flows
words -> live read about every 0.6 s -> after a pause or mic-off: **settle** unsure fields -> **final check** (Jev audits each row against what was said; clear mismatches are rewritten, tagged and chimed).

## Ideas for v2 (Netlify Blobs)
Per-demo tables (`data` in each demo: stock, rate card, scoring weights) are separated from logic so they can be loaded from a Blob store. Other fits: log final-check mismatches to find gaps in the menus, save confirmed orders, per-IP rate limiting of `/api/order`.
