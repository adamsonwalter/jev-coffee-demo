// Profanity censor: a TV-style bleep (no words) and the word blanked out on screen.
// Covers common swearing and the masked forms phones produce ("f***ing"). Extend WORDS to taste.
(function () {
  const WORDS = '(?:mother)?fuck\\w*|shit\\w*|bullshit|bastards?|arseholes?|wankers?|dickheads?';
  const MASKED = '(?:[fsbad][*#@]{2,}|sh[*#@]+t|fu[*#@]+k|f[*#@]+ck)\\w*';   // f***ing, s***, sh*t, f*ck, b*****d
  const BASE = '\\b(?:' + WORDS + ')\\b|\\b' + MASKED;
  // Digs at tradies: only blanked out and bleeped on the Quote tab.
  const TRADIE = '\\b(?:cowboys?|bodgy|bodgie|shonky|rip-?off merchants?|shitter fitters?)\\b';
  let RE = new RegExp(BASE, 'gi');
  let seen = 0, last = 0;
  window.Censor = {
    setTab(id) { RE = new RegExp(id === 'quote' ? TRADIE + '|' + BASE : BASE, 'gi'); seen = 0; },
    // Heard text with swear words replaced by blocks of the same length.
    mask(text) { return String(text || '').replace(RE, (m) => '▮'.repeat(Math.max(3, Math.min(m.length, 8)))); },
    // Bleeps once per NEW swear word, however often the transcript is re-sent.
    check(text) {
      const n = ((text || '').match(RE) || []).length;
      if (n <= seen) return false;
      seen = n;
      const now = Date.now();
      if (now - last < 700) return false;
      last = now;
      if (window.JevAudio) window.JevAudio.bleep();
      if (navigator.vibrate) navigator.vibrate(120);
      return true;
    },
    reset() { seen = 0; last = 0; },
  };
})();
