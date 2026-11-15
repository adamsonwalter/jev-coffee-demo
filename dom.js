// The one DOM helper every screen uses: el('div', 'row', 'text').
export const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
