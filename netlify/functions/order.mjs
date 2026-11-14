// POST /api/order  { transcript }  ->  typed order fields from Jev (SystemOne).
// The browser never sees the Jev key or the gateway URL.

// Jev is reached through the ABCDJEV gateway (MCP over HTTP). The gateway holds the Jev key;
// the secret gateway URL lives only in the Netlify env var ABCDJEV_MCP_URL.
import { DEMOS } from "../../demos/index.mjs";
import { ch } from "../../demos/lib.mjs";

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

  let transcript = "", demo = "coffee", only = null, final = false, mode = "read", shown = [], key = "", exclude = "";
  try {
    ({ transcript, demo = "coffee", only = null, final = false, mode = "read", shown = [], key = "", exclude = "" } = await req.json());
  } catch {}
  transcript = String(transcript || "").trim().slice(0, 900);
  const set = SETS[demo];
  if (!set) return json({ error: "unknown_demo" }, 400);
  if (!transcript) return json({ error: "empty" }, 400);

  // FINAL CHECK, step 1: audit what is on screen against what was said, row by row.
  if (mode === "audit") {
    const rows = (Array.isArray(shown) ? shown : []).slice(0, 8).map((r) => ({ label: String(r.label || "").slice(0, 40), value: String(r.value || "").slice(0, 80) })).filter((r) => r.label && r.value);
    if (!rows.length) return json({ error: "nothing_to_audit" }, 400);
    const questions = {}, on_screen = {};
    rows.forEach((r, i) => {
      on_screen[r.label] = r.value;
      questions["a" + i] = ch({
        fits: "The " + r.label + " shown is an accurate and specific description of what was said",
        imprecise: "The " + r.label + " shown is vague, generic or a poor description of the specific thing that was said (for example the speaker named a particular material, object or trade)",
        wrong: "The " + r.label + " shown contradicts what was said",
      });
    });
    const t1 = Date.now();
    let d;
    try {
      d = await callSystemOne({ model: MODEL, state: { transcript, on_screen, context: "The speaker dictated this. The on_screen entries are what an app displayed from it. Audit each entry against the transcript." }, questions });
    } catch (e) { return json({ error: String(e.message || e) }, 502); }
    const audit = rows.map((r, i) => { const a = (d.answers || {})["a" + i] || {}; return { label: r.label, fits: a.probabilities ? a.probabilities.fits ?? 0 : 1, cls: a.choice || "fits" }; });
    return json({ engine: "jev", ms: Date.now() - t1, audit });
  }

  // FINAL CHECK, step 2: rewrite one field with the previous answer taken off the menu (plus a "none fits" escape).
  if (mode === "rewrite") {
    const base = set.q[key];
    if (!base || !base.criteria) return json({ error: "unknown_key" }, 400);
    const criteria = Object.fromEntries(Object.entries(base.criteria).filter(([o]) => o !== exclude));
    criteria.NoFit = "None of these options describes what was said well";
    const t2 = Date.now();
    let d;
    try {
      d = await callSystemOne({ model: MODEL, state: { transcript, context: set.ctx + " This is the complete final transcript. The earlier answer " + JSON.stringify(String(exclude).slice(0, 40)) + " was judged a poor fit. Re-read everything and pick the best remaining option, or NoFit." }, questions: { [key]: { type: "choice", criteria } } });
    } catch (e) { return json({ error: String(e.message || e) }, 502); }
    const a = (d.answers || {})[key] || {};
    return json({ engine: "jev", ms: Date.now() - t2, field: { value: a.choice, confidence: a.confidence ?? null, p: a.probabilities || null } });
  }

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
