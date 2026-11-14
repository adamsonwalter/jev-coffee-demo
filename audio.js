// Soft pip on each recognition and Steve's bark, synthesised in the browser (no audio files).
// Unlocked from a tap; if it ever collides with the mic (recognition dies at once), it switches itself off.
(function () {
  let ctx = null, off = false, lastPip = 0;
  const A = {
    unlock() {
      if (off) return;
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (_) { off = true; }
    },
    active() { return !!ctx && !off; },
    disable() { off = true; try { ctx && ctx.close(); } catch (_) {} ctx = null; },
    pip() {
      if (!ctx || off || ctx.state !== 'running' || Date.now() - lastPip < 250) return;
      lastPip = Date.now();
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1180, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.06);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.1);
    },
    // Loud 1 kHz censor bleep, about 0.6 s.
    bleep() {
      if (!ctx || off || ctx.state !== 'running') return;
      const t = ctx.currentTime, dur = 0.6;
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 1000; o2.type = 'sine'; o2.frequency.value = 2000;
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.015);
      g.gain.setValueAtTime(0.55, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(ctx.destination);
      o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
    },
    bark() {
      if (!ctx || off || ctx.state !== 'running') return;
      const t = ctx.currentTime, dur = 0.2;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(170, t + dur);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.1;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const ns = ctx.createBufferSource(); ns.buffer = nb; const ng = ctx.createGain(); ng.gain.value = 0.3;
      o.connect(f); ns.connect(ng); ng.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur); ns.start(t);
    },
  };
  window.JevAudio = A;
})();
