// The effects the app can trigger. To add an easter egg or a sound: write a module like steve.js and call it from here.
import audio from './audio.js';
import steve from './steve.js';
import censor from './censor.js';

export const fx = {
  heard(text) { steve.check(text); censor.check(text); },   // run on every transcript update
  mask: (text) => censor.mask(text),                        // transcript with swear words blanked out
  reset() { steve.reset(); censor.reset(); },               // new conversation
  tab(id) { censor.setTab(id); },                           // some words are only censored on some tabs
  unlock: () => audio.unlock(),                             // call from a tap: browsers only allow sound after one
  pip: () => audio.pip(),
  finalCheck: () => audio.finalCheck(),
  audioConflict() { if (audio.active()) audio.disable(); }, // sound broke the microphone: carry on silently
};
