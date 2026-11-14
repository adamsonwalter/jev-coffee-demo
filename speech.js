// Speech recognition (Safari / Chrome), wrapped so the app only deals in callbacks.
// Listens continuously where the browser allows; falls back to phrase-by-phrase if it hears nothing.
// The whole session's words are rebuilt from every result, so nothing a pause cuts off is lost.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const iosApp = isIOS && standalone;    // iPhone blocks speech recognition inside home-screen apps

export const voiceProblem = () => (!SR ? 'This browser has no speech recognition. Use Safari or Chrome.' : iosApp ? 'iPhone doesn’t allow voice inside home-screen apps. Open this page in Safari to talk.' : '');
export const idleHint = () => (!SR ? 'Voice not supported here' : iosApp ? 'Voice needs Safari' : 'Tap to talk');

const ERRORS = {
  'not-allowed': 'Microphone blocked. iPhone: Settings › Safari › Microphone → Allow, and turn on Settings › Siri › Dictation.',
  'service-not-allowed': 'Dictation is off. Turn on Settings › General › Keyboard › Enable Dictation.',
  'audio-capture': 'No microphone found.',
  'network': 'Speech service unreachable. Check your connection.',
};

// onText(fullTranscript, phraseJustFinished) | onState(isListening) | onNotice(message, 'idle'|'err') | onQuickEnd()
export function createListener({ onText, onState, onNotice, onQuickEnd }) {
  let rec = null, listening = false, prefix = '', lastFull = '', gotAny = false, quickEnds = 0, continuous = true, finals = 0, startedAt = 0, noSpeech = null;

  function session() {
    rec = new SR(); rec.lang = 'en-AU'; rec.interimResults = true; rec.continuous = continuous; rec.maxAlternatives = 1;
    finals = 0; startedAt = Date.now();
    rec.onstart = () => { onState(true); if (!gotAny) onNotice('Listening…', 'idle'); };
    rec.onresult = (e) => {
      gotAny = true; quickEnds = 0;
      let said = '', fin = 0;
      for (let i = 0; i < e.results.length; i++) { said += ' ' + e.results[i][0].transcript; if (e.results[i].isFinal) fin++; }
      lastFull = (prefix + ' ' + said).replace(/\s+/g, ' ').trim();
      const phraseDone = fin > finals; finals = fin;
      if (lastFull) onText(lastFull, phraseDone);
    };
    rec.onerror = (e) => { const m = ERRORS[e.error]; if (m) { onNotice(m, 'err'); listening = false; } };
    rec.onend = () => {
      if (!listening) { onState(false); return; }
      if (!gotAny && Date.now() - startedAt < 1500) {          // ended at once with nothing heard: try the other mode
        if (++quickEnds > 4) { listening = false; onState(false); onNotice('The microphone keeps stopping. Check Settings › Safari › Microphone and Siri › Dictation.', 'err'); return; }
        continuous = !continuous; onQuickEnd();
      }
      prefix = lastFull;                                          // ended by a pause: keep what we have and carry on
      setTimeout(() => { if (!listening) return; try { session(); rec.start(); } catch (_) { listening = false; onState(false); } }, 60);
    };
  }

  return {
    get listening() { return listening; },
    start() {
      prefix = ''; lastFull = ''; gotAny = false; quickEnds = 0;
      session(); listening = true;
      try { rec.start(); } catch (err) { listening = false; onState(false); onNotice('Couldn’t start the mic: ' + err.message, 'err'); return false; }
      // silent for 6 s in continuous mode (some iPhones): switch to phrase-by-phrase
      noSpeech = setTimeout(() => { if (listening && !gotAny) { if (continuous) { continuous = false; try { rec.abort(); } catch (_) {} } onNotice('Listening… nothing heard yet. Speak closer to the phone.', 'idle'); } }, 6000);
      return true;
    },
    stop() {   // returns whether it was listening
      const was = listening; listening = false; clearTimeout(noSpeech);
      try { rec && rec.stop(); } catch (_) {}
      onState(false); return was;
    },
  };
}
