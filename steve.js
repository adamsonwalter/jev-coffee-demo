// Steve the dachshund (barks via audio.js). Say "dachshund" or "sausage dog" in any demo and he trots through, barks twice, and leaves.
// Any page that loads this file and calls Steve.check(text) gets him. Total screen time ~2.9s.
(function () {
  const TRIGGER = /\b(dach?s?[ -]?h[uo]nds?|dacks?[ -]?h[uo]nds?|dash[ -]?(?:hound|hund|hunt|und)s?|dax[ -]?hunds?|sausage[ -]?dogs?|wiener[ -]?dogs?|weiner[ -]?dogs?|doxie)\b/i;
  const COOLDOWN = 7000;
  let last = 0, seen = 0;
  const TRIGGER_G = new RegExp(TRIGGER.source, 'gi');

  const SVG = `
<svg viewBox="0 0 230 120" width="230" height="120" aria-hidden="true">
  <g class="steve-bob">
    <path d="M196 46 C212 40 218 28 214 18" fill="none" stroke="#9a4a1c" stroke-width="7" stroke-linecap="round" class="steve-tail"/>
    <rect x="58" y="36" width="142" height="32" rx="16" fill="#b25a22"/>
    <rect x="70" y="56" width="118" height="12" rx="6" fill="#c9783a" opacity=".55"/>
    <g class="steve-leg l1"><rect x="72" y="60" width="11" height="30" rx="5.5" fill="#8a4119"/></g>
    <g class="steve-leg l2"><rect x="92" y="60" width="11" height="30" rx="5.5" fill="#9a4a1c"/></g>
    <g class="steve-leg l3"><rect x="168" y="60" width="11" height="30" rx="5.5" fill="#9a4a1c"/></g>
    <g class="steve-leg l4"><rect x="186" y="60" width="11" height="30" rx="5.5" fill="#8a4119"/></g>
    <ellipse cx="52" cy="44" rx="24" ry="19" fill="#b25a22"/>
    <rect x="12" y="42" width="40" height="15" rx="7.5" fill="#b25a22"/>
    <g class="steve-jaw"><rect x="16" y="54" width="34" height="8" rx="4" fill="#8a4119"/><rect x="24" y="58" width="14" height="6" rx="3" fill="#ff7a8a" class="steve-tongue"/></g>
    <circle cx="14" cy="45" r="5.5" fill="#1c0f0a"/>
    <circle cx="46" cy="37" r="4.6" fill="#fff"/><circle cx="45" cy="37.5" r="2.4" fill="#1c0f0a"/>
    <path d="M58 30 C74 28 80 48 70 66 C62 62 56 48 58 30Z" fill="#6e3213" class="steve-ear"/>
  </g>
</svg>`;

  function css() {
    if (document.getElementById('steve-css')) return;
    const s = document.createElement('style'); s.id = 'steve-css';
    s.textContent = `
#steve{position:fixed;left:0;bottom:calc(env(safe-area-inset-bottom) + 96px);z-index:9999;pointer-events:none;width:230px;transform:translateX(110vw)}
#steve.go{animation:steve-run 2.9s cubic-bezier(.3,.1,.3,1) forwards}
@keyframes steve-run{0%{transform:translateX(110vw)}28%{transform:translateX(calc(50vw - 115px))}74%{transform:translateX(calc(50vw - 115px))}100%{transform:translateX(-260px)}}
#steve .steve-bob{animation:steve-bob .22s ease-in-out infinite alternate}
#steve.bark .steve-bob,#steve.still .steve-bob{animation:none}
@keyframes steve-bob{to{transform:translateY(-3px)}}
#steve .steve-leg{transform-box:fill-box;transform-origin:50% 0;animation:steve-leg .22s ease-in-out infinite alternate}
#steve .l2,#steve .l3{animation-direction:alternate-reverse}
#steve.still .steve-leg{animation:none}
@keyframes steve-leg{from{transform:rotate(-28deg)}to{transform:rotate(28deg)}}
#steve .steve-tail{transform-box:fill-box;transform-origin:0 100%;animation:steve-wag .14s ease-in-out infinite alternate}
@keyframes steve-wag{from{transform:rotate(-10deg)}to{transform:rotate(14deg)}}
#steve .steve-jaw{transform-box:fill-box;transform-origin:100% 0;transition:transform .07s}
#steve.open .steve-jaw{transform:rotate(22deg)}
#steve .steve-tongue{opacity:0}#steve.open .steve-tongue{opacity:1}
#steve.bark svg{animation:steve-recoil .12s ease-out}
@keyframes steve-recoil{0%{transform:translateX(0)}40%{transform:translateX(6px) scale(1.04)}100%{transform:translateX(0)}}
#steve .steve-say{position:absolute;left:-6px;top:-34px;background:#faeed6;color:#1a0c06;font:800 18px ui-rounded,"Avenir Next",sans-serif;padding:6px 12px;border-radius:14px;opacity:0;transform:scale(.6);transform-origin:30px 100%;white-space:nowrap}
#steve .steve-say::after{content:"";position:absolute;left:26px;bottom:-8px;border:8px solid transparent;border-top-color:#faeed6;border-bottom:0}
#steve.open .steve-say{opacity:1;transform:scale(1);transition:transform .09s,opacity .09s}
@media (prefers-reduced-motion:reduce){#steve .steve-bob,#steve .steve-leg,#steve .steve-tail{animation:none}}
`;
    document.head.appendChild(s);
  }

  function ensure() {
    css();
    let n = document.getElementById('steve');
    if (!n) {
      n = document.createElement('div'); n.id = 'steve';
      n.innerHTML = SVG + '<div class="steve-say">WOOF!</div>';
      document.body.appendChild(n);
    }
    return n;
  }

  function run() {
    const n = ensure();
    n.className = ''; void n.offsetWidth; n.classList.add('go');
    const open = (ms) => setTimeout(() => { n.classList.add('open', 'bark'); setTimeout(() => n.classList.remove('open', 'bark'), 190); }, ms);
    setTimeout(() => n.classList.add('still'), 810);
    open(860); setTimeout(() => window.JevAudio && JevAudio.bark(), 860);
    open(1400); setTimeout(() => window.JevAudio && JevAudio.bark(), 1400);
    setTimeout(() => n.classList.remove('still'), 2150);
    setTimeout(() => { n.className = ''; }, 3000);
    if (navigator.vibrate) navigator.vibrate([30, 80, 30]);
  }

  window.Steve = {
    // Fires only when a NEW mention appears, so a transcript that still contains the word never re-triggers him.
    check(text) {
      if (!text) return false;
      const n = (text.match(TRIGGER_G) || []).length;
      if (n <= seen) return false;
      seen = n;
      const now = Date.now();
      if (now - last < COOLDOWN) return false;
      last = now; run(); return true;
    },
    reset() { last = 0; seen = 0; },
    run,
  };
})();
