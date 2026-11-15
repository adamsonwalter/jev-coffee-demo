// The version lives in one place: /version.json. Nothing else in the app or the page contains it.
// Pages ask for it at run time, so whatever is deployed is what is shown. Elements are stamped with a prefix and filled in when it arrives.
let current = null;

// Mark a node as a version label ("Jev v" + 3.4). Safe to call before the version has loaded.
export function stamp(node, prefix) {
  node.dataset.ver = prefix; node.textContent = current ? prefix + current : '';
  return node;
}

export async function loadVersion() {
  try {
    const r = await fetch('/version.json', { cache: 'no-store' });
    const v = r.ok ? (await r.json()).version : null;
    current = typeof v === 'string' && v ? v : null;
  } catch (_) { /* offline: no label */ }
  document.querySelectorAll('[data-ver]').forEach((n) => { n.textContent = current ? n.dataset.ver + current : ''; });
  return current;
}
