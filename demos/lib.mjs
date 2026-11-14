// Helpers shared by every demo (and by the Jev function). Pure functions, no browser or server APIs.

// Question builders. Jev answers each as a typed choice with a confidence and probabilities.
export const yn = (yes, no) => ({ type: 'choice', criteria: { yes, no } });   // a yes/no question
export const ch = (criteria) => ({ type: 'choice', criteria });               // pick one: { Option: 'what it means' }

// Readers for Jev's answers: f = fields object from the function.
export const v = (f, k) => (f[k] && f[k].value) || null;                                        // chosen option, or null
export const yes = (f, k) => !!f[k] && f[k].value === 'yes';                                    // yes/no question answered yes
export const low = (f, k) => !!f[k] && f[k].confidence != null && f[k].confidence < 0.7;        // Jev was unsure
export const pr = (f, k, opt) => (f[k] && f[k].p && f[k].p[opt]) || 0;                          // probability of one option
