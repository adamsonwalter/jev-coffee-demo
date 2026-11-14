// Transport to Jev: the ABCDJEV gateway (MCP over HTTP) holds the Jev key.
// The secret gateway URL lives only in the Netlify env var ABCDJEV_MCP_URL.
const H = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };

async function rpc(url, body, sid) {
  const r = await fetch(url, { method: 'POST', headers: sid ? { ...H, 'mcp-session-id': sid } : H, body: JSON.stringify(body), signal: AbortSignal.timeout(9000) });
  const text = await r.text();
  let msg = null;
  if ((r.headers.get('content-type') || '').includes('text/event-stream')) {
    const line = text.split('\n').filter((l) => l.startsWith('data:')).pop();
    msg = line ? JSON.parse(line.slice(5)) : null;
  } else if (text) {
    try { msg = JSON.parse(text); } catch {}
  }
  return { ok: r.ok, msg, sid: r.headers.get('mcp-session-id') };
}

// Call one gateway tool ('systemone' for Jev's typed answers, 'clairic_extract' for free text like names). Throws Error('gateway_*').
export async function callTool(name, args, url = process.env.ABCDJEV_MCP_URL) {
  const call = (id) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
  let res = await rpc(url, call(1)).catch(() => null);
  if (!res || !res.ok || !res.msg || res.msg.error) {   // a stateful gateway would want a handshake first
    const init = await rpc(url, { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'jev-demo', version: '1' } } });
    if (!init.ok) throw new Error('gateway_init');
    await rpc(url, { jsonrpc: '2.0', method: 'notifications/initialized' }, init.sid).catch(() => {});
    res = await rpc(url, call(2), init.sid);
  }
  const m = res && res.msg;
  if (!m || m.error || !m.result || m.result.isError) throw new Error('gateway_call');
  if (m.result.structuredContent && typeof m.result.structuredContent === 'object') return m.result.structuredContent;   // the gateway puts the answers here
  return JSON.parse((m.result.content || []).map((c) => c.text || '').join(''));
}

// One typed request to Jev. Returns { model, answers, usage }.
export const callSystemOne = (args, url) => callTool('systemone', args, url);
// Pull typed text values out of a transcript. fields: { name: { type: 'text', instructions } }. Returns { fields: { name: { value, confidence } } }.
export const callExtract = (args, url) => callTool('clairic_extract', args, url);
