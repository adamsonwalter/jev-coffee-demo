// POST /api/order  { transcript }  ->  typed order fields from Jev (SystemOne).
// The browser never sees the Jev key or the gateway URL.

// Jev is reached through the ABCDJEV gateway (MCP over HTTP). The gateway holds the Jev key;
// the secret gateway URL lives only in the Netlify env var ABCDJEV_MCP_URL.
import { DEMOS } from "../../demos/index.mjs";

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
  if (m.result.structuredContent && m.result.structuredContent.answers) return m.result.structuredContent;
  const txt = (m.result.content || []).map((c) => c.text || "").join("");
  return JSON.parse(txt);
}

// Every demo (questions, context) comes from demos/*.mjs. Adding a demo there adds it here, with no change to this file.
const SETS = Object.fromEntries(DEMOS.map((d) => [d.id, { q: d.questions, ctx: d.ctx }]));

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });


export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!GATEWAY) return json({ error: "no_gateway" }, 503);

  let transcript = "", demo = "coffee", only = null, final = false;
  try {
    ({ transcript, demo = "coffee", only = null, final = false } = await req.json());
  } catch {}
  transcript = String(transcript || "").trim().slice(0, 900);
  const set = SETS[demo];
  if (!set) return json({ error: "unknown_demo" }, 400);
  if (!transcript) return json({ error: "empty" }, 400);

  // Settling pass: the speaker has paused or stopped. Re-ask only the uncertain fields, on the whole conversation.
  let questions = set.q, context = set.ctx;
  if (final) {
    context += " This is the complete final transcript of everything said. Consider the whole conversation: later statements override earlier ones, and answer what the speaker meant.";
    if (Array.isArray(only) && only.length) {
      const picked = Object.fromEntries(Object.entries(set.q).filter(([k]) => only.includes(k)));
      if (Object.keys(picked).length) questions = picked;
    }
  }

  const t0 = Date.now();
  let data;
  try {
    data = await callSystemOne({ model: MODEL, state: { transcript, context }, questions });
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
