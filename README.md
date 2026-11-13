# jev-coffee-demo
Voice-driven demos of Jev (TypeSafe System One): speak, and typed fields plus risk flags fill in live. iPhone home-screen web app.

Tabs: Coffee (home), Quote (trades), Front desk (clinic booking with emergency red flag), Sales (post-call notes with deal score).

- `index.html` shell, speech, rendering. `demos.js` per-demo rows, flags and arithmetic. `steve.js` Steve the dachshund easter egg (say "dachshund" or "sausage dog" in any demo).
- `netlify/functions/order.mjs` holds each demo's Jev questions and calls the ABCDJEV gateway (env var `ABCDJEV_MCP_URL`).
- To add a demo: add its question set to `SETS` in the function and a definition to `demos.js`.
