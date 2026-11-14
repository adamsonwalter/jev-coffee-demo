// Helpers shared by every demo (and by the Jev function). Pure functions, no browser or server APIs.

// Every confidence threshold and timing in one place. (Confidences are Jev's 0..1 certainty in an answer.)
export const TUNING = {
  unsure: 0.7,         // below this a row shows "not sure, check"
  guess: 0.6,          // below this an optional answer (size, iced) is treated as not said
  settle: 0.8,         // after a pause or mic-off, fields under this are re-asked on the whole conversation
  pinOverride: 0.97,   // a final-check correction is only undone by a later live answer this sure
  auditMismatch: 0.15, // final check: Jev says a row "fits" at under this chance -> clear mismatch
  adopt: 0.7,          // final check: a rewritten answer is used only at or above this
  throttleMs: 600,     // live refresh interval while someone is talking
  pauseMs: 2200,       // silence before the settling pass and final check run
  retryMs: 15000,      // after a failed Jev call, wait this long before trying again
};

// Question builders. Jev answers each as a typed choice with a confidence and probabilities.
export const yn = (yes, no) => ({ type: 'choice', criteria: { yes, no } });   // a yes/no question
export const ch = (criteria) => ({ type: 'choice', criteria });               // pick one: { Option: 'what it means' }

// Readers for Jev's answers: f = fields object from the function.
export const v = (f, k) => (f[k] && f[k].value) || null;                                        // chosen option, or null
export const yes = (f, k) => !!f[k] && f[k].value === 'yes';                                    // yes/no question answered yes
export const low = (f, k) => !!f[k] && f[k].confidence != null && f[k].confidence < TUNING.unsure;  // Jev was unsure
export const pr = (f, k, opt) => (f[k] && f[k].p && f[k].p[opt]) || 0;                          // probability of one option

// For scenarios: set many numbers or values at once. setAll('stock', { Oat: 2, Soy: 0 }) -> effects.
export const setAll = (prefix, map) => Object.entries(map).map(([k, value]) => ({ op: 'set', path: `${prefix}.${k}`, value }));
