// POST /api/order  { transcript }  ->  typed order fields from Jev (SystemOne).
// The browser never sees the Jev key or the gateway URL.

// Jev is reached through the ABCDJEV gateway (MCP over HTTP). The gateway holds the Jev key;
// the secret gateway URL lives only in the Netlify env var ABCDJEV_MCP_URL.
const GATEWAY = process.env.ABCDJEV_MCP_URL;
const MODEL = process.env.JEV_MODEL || "jev-latest";
const H = { "content-type": "application/json", accept: "application/json, text/event-stream" };

async function rpc(body, sid) {
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: sid ? { ...H, "mcp-session-id": sid } : H,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(9000),
  });
  const text = await r.text();
  let msg = null;
  if ((r.headers.get("content-type") || "").includes("text/event-stream")) {
    const line = text.split("\n").filter((l) => l.startsWith("data:")).pop();
    msg = line ? JSON.parse(line.slice(5)) : null;
  } else if (text) {
    try { msg = JSON.parse(text); } catch {}
  }
  return { ok: r.ok, msg, sid: r.headers.get("mcp-session-id") };
}

async function callSystemOne(args) {
  const call = (id) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "systemone", arguments: args } });
  let res = await rpc(call(1)).catch(() => null);
  if (!res || !res.ok || !res.msg || res.msg.error) {
    // stateful gateway: handshake, then retry
    const init = await rpc({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "jev-coffee", version: "1" } } });
    if (!init.ok) throw new Error("gateway_init");
    await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, init.sid).catch(() => {});
    res = await rpc(call(2), init.sid);
  }
  const m = res && res.msg;
  if (!m || m.error || !m.result || m.result.isError) throw new Error("gateway_call");
  const txt = (m.result.content || []).map((c) => c.text || "").join("");
  return JSON.parse(txt);
}

const yn = (yes, no) => ({ type: "choice", criteria: { yes, no } });
const ch = (criteria) => ({ type: "choice", criteria });

const COFFEE = {
  drink: {
    type: "choice",
    criteria: {
      Latte: "Customer ordered a latte",
      Cappuccino: "Customer ordered a cappuccino",
      "Flat White": "Customer ordered a flat white",
      Espresso: "Customer ordered an espresso or short black",
      Americano: "Customer ordered an americano",
      Mocha: "Customer ordered a mocha",
      "Long Black": "Customer ordered a long black",
      None: "No drink named yet",
    },
  },
  size: {
    type: "choice",
    criteria: {
      Small: "Small size",
      Medium: "Medium or regular size",
      Large: "Large or big size",
      Unspecified: "No size mentioned",
    },
  },
  milk: {
    type: "choice",
    criteria: {
      Oat: "Oat milk",
      Almond: "Almond milk",
      Soy: "Soy milk",
      Skim: "Skim or low fat milk",
      "Full cream": "Full cream or regular dairy milk",
      None: "No milk, or a black coffee",
      Unspecified: "Milk not mentioned",
    },
  },
  extra_shot: yn("Customer asks for an extra, double or additional shot", "No extra shot requested"),
  croissant: yn("Customer asks for a croissant", "No croissant requested"),
  muffin: yn("Customer asks for a muffin", "No muffin requested"),
  syrup: yn("Customer asks for a syrup such as vanilla or caramel", "No syrup requested"),
};


const QUOTE = {
  trade: ch({ Plumbing: "Plumbing, drains, hot water, taps", Electrical: "Electrical, wiring, switchboard, lighting", Painting: "Painting or plastering", Bathroom: "Bathroom, kitchen or tiling renovation", Roofing: "Roof, gutters, leaks from above", Carpentry: "Carpentry, decking, framing, doors", Landscaping: "Landscaping, fencing, concreting", Other: "Anything else or unclear" }),
  scope: ch({ Small: "Under one day of work", Medium: "Between two and five days of work", Large: "A week or more of work, or a full renovation" }),
  access: ch({ Easy: "Easy access, empty site, any hours", Restricted: "Restricted access: strata, limited hours, tight space, occupied home, weekends only", Unknown: "Access not mentioned" }),
  old_building: yn("Building is old (pre-1990), or fibro, asbestos, old wiring or lead paint is mentioned", "No sign of an old building"),
  hidden_risk: yn("Leak, damp, rot, termites, cracks or unknown conditions behind walls or under floors are mentioned", "No hidden-damage signals"),
  permit: yn("Work likely needs a permit, certifier or licensed sign-off (structural, gas, electrical, plumbing, removing walls)", "Unlikely to need a permit"),
  materials: ch({ Customer: "Customer supplies materials", Contractor: "Contractor supplies materials", Unspecified: "Not mentioned" }),
  urgency: ch({ Emergency: "Emergency: active leak, no power, unsafe, needs attention today", Soon: "Wanted within the next week or two", Flexible: "Flexible timing" }),
};

const DESK = {
  reason: ch({ Checkup: "Routine check-up or review", Injury: "New injury, pain or illness", Followup: "Follow-up on an existing issue", Repeat: "Repeat prescription or referral", Results: "Test results", Other: "Anything else or unclear" }),
  urgency: ch({ Routine: "Routine, can wait a week or more", Soon: "Should be seen within a few days", Urgent: "Needs to be seen today" }),
  red_flag: yn("Mentions chest pain, trouble breathing, stroke signs, severe bleeding, fainting, severe allergic reaction, or thoughts of self-harm", "No emergency symptoms mentioned"),
  patient: ch({ New: "New patient, first visit", Existing: "Existing patient", Unspecified: "Not mentioned" }),
  day: ch({ Today: "Today", Tomorrow: "Tomorrow", ThisWeek: "Later this week", NextWeek: "Next week or later", Unspecified: "No day mentioned" }),
  time: ch({ Morning: "Morning", Afternoon: "Afternoon", Evening: "After work or evening", Unspecified: "No time preference" }),
};

const SALES = {
  interest: ch({ Hot: "Buyer is keen and engaged, asking about next steps or price", Warm: "Interested but not committed", Cold: "Little interest or polite brush-off" }),
  budget: ch({ Confirmed: "Budget confirmed or approved", Vague: "Budget discussed only vaguely", TooHigh: "Buyer says it is too expensive", NotDiscussed: "Budget not discussed" }),
  timeline: ch({ Now: "Wants to move this month", Quarter: "Within about three months", Later: "Later, no date, or just exploring" }),
  decision_maker: ch({ Yes: "Spoke with the decision maker", No: "Needs sign-off from someone else", Unknown: "Not clear who decides" }),
  competitor: yn("A competitor or alternative is mentioned", "No competitor mentioned"),
  stall: yn("Buyer hesitates, delays, goes quiet, or says they will think about it", "No stalling signals"),
  next_step: ch({ Proposal: "Send a proposal or quote", Demo: "Book a demo or meeting", Call: "Follow-up call", None: "No next step agreed" }),
};

const SETS = {
  coffee: { q: COFFEE, ctx: "Customer speaking a coffee order at a cafe counter." },
  quote: { q: QUOTE, ctx: "A tradesperson dictating a job description for a quote. Judge only what is said." },
  desk: { q: DESK, ctx: "A patient speaking to a clinic receptionist to book an appointment." },
  sales: { q: SALES, ctx: "A salesperson dictating notes after a customer call." },
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!GATEWAY) return json({ error: "no_gateway" }, 503);

  let transcript = "", demo = "coffee";
  try {
    ({ transcript, demo = "coffee" } = await req.json());
  } catch {}
  transcript = String(transcript || "").trim().slice(0, 900);
  const set = SETS[demo];
  if (!set) return json({ error: "unknown_demo" }, 400);
  if (!transcript) return json({ error: "empty" }, 400);

  const t0 = Date.now();
  let data;
  try {
    data = await callSystemOne({ model: MODEL, state: { transcript, context: set.ctx }, questions: set.q });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
  const fields = {};
  for (const [k, v] of Object.entries(data.answers || {})) {
    fields[k] = { value: v.choice, confidence: v.confidence ?? null, p: v.probabilities || null };
  }
  return json({ engine: "jev", model: data.model, ms: Date.now() - t0, fields });
};

export const config = { path: "/api/order" };
