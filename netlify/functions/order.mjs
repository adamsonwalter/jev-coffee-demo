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

const QUESTIONS = {
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

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!GATEWAY) return json({ error: "no_gateway" }, 503);

  let transcript = "";
  try {
    ({ transcript } = await req.json());
  } catch {}
  transcript = String(transcript || "").trim().slice(0, 600);
  if (!transcript) return json({ error: "empty" }, 400);

  const t0 = Date.now();
  let data;
  try {
    data = await callSystemOne({
      model: MODEL,
      state: { transcript, context: "Customer speaking a coffee order at a cafe counter." },
      questions: QUESTIONS,
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
  const a = data.answers || {};
  const pick = (k) => (a[k] ? { value: a[k].choice, confidence: a[k].confidence ?? null } : null);
  const flag = (k) => (a[k] && a[k].choice === "yes" ? { confidence: a[k].confidence ?? null } : null);

  return json({
    engine: "jev",
    model: data.model,
    ms: Date.now() - t0,
    drink: pick("drink"),
    size: pick("size"),
    milk: pick("milk"),
    extras: {
      extra_shot: flag("extra_shot"),
      croissant: flag("croissant"),
      muffin: flag("muffin"),
      syrup: flag("syrup"),
    },
  });
};

export const config = { path: "/api/order" };
