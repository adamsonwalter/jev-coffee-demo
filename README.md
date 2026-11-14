# jev-coffee-demo
Voice-driven demos of Jev (TypeSafe System One): speak, and typed fields plus risk flags fill in live. iPhone web app.

Tabs: Coffee (home), Quote (trades), Front desk (clinic booking with emergency red flag), Sales (post-call notes with deal score).

## Layout
- `index.html` shell, speech, rendering. `steve.js` Steve the dachshund (say "dachshund" or "sausage dog"). `censor.js` bleep and blank-out. `audio.js` pip, bark, bleep.
- `demos/` one file per demo: the Jev questions, what the screen shows, and the arithmetic. `demos/index.mjs` lists them. `demos/lib.mjs` shared helpers.
- `netlify/functions/order.mjs` sends a demo's questions to Jev through the ABCDJEV gateway (env var `ABCDJEV_MCP_URL`). It reads the demos folder, so it never needs editing for a new demo.

## Add a demo (about 10 minutes)
1. Copy `demos/_template.mjs` to `demos/<name>.mjs` and edit the questions, labels, rows and flags.
2. In `demos/index.mjs`, import it and add it to the list.
3. Push to `main`. The tab, the Jev questions and the screen all come from that one file.
