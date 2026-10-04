// @openav/sound · the instrument registry.
//
// A sound you can pick is plain data plus one factory:
//
//   registerInstrument({
//     id: 'kalimba',                              // lowercase, digits, '-', at most one '/'
//     name: { en: 'Kalimba', zh: '拇指琴' },       // or a plain string
//     category: 'mallets',                        // groups the picker (CATEGORIES below)
//     credit: { text: '…', url: '…' },            // optional; shown next to the picker
//     params: [{ key: 'decay', label: 'Decay', min: 0.2, max: 4, def: 1.2 }],   // → sound/decay
//     defaults: { cutoff: 8000 },                 // optional starting values for the shared params
//     create(Tone, { output }) {                  // called on enable / on switch, Tone already loaded
//       return { noteOn(note, vel01, time), noteOff(note, time), set?(key, v), ready?, dispose() };
//     },
//   });
//
// Why a registry and not an options bag: a piece (or a third party) adds a
// sound by importing one file — no edit to packages/*, and every picker on
// the page shows it. The registry lives on globalThis so two copies of this
// module (two ?v= stamps, a lab bundle next to an ES import) still share one list.

/** The params every instrument shares — they live after the instrument, on the output chain,
 *  so the timeline, a knob or a hand keep performing them across instrument switches. */
export const SOUND_PARAMS = [
  { key: 'cutoff', label: 'Filter cutoff', min: 100, max: 8000, def: 2500 },
  { key: 'space',  label: 'Space (wet)',   min: 0,   max: 1,    def: 0.3 },
  { key: 'volume', label: 'Volume (dB)',   min: -36, max: 0,    def: -8 },
];
const SHARED = new Set(SOUND_PARAMS.map((p) => p.key));

/** Picker order. Unknown categories are allowed; they sort after these. */
export const CATEGORIES = [
  { id: 'keys',    name: { en: 'Keys',    zh: '鍵盤' } },
  { id: 'mallets', name: { en: 'Mallets', zh: '敲擊琴' } },
  { id: 'strings', name: { en: 'Strings', zh: '弦樂' } },
  { id: 'plucked', name: { en: 'Plucked', zh: '撥弦' } },
  { id: 'organ',   name: { en: 'Organ',   zh: '風琴' } },
  { id: 'voice',   name: { en: 'Voice',   zh: '人聲' } },
  { id: 'synth',   name: { en: 'Synth',   zh: '合成器' } },
  { id: 'drums',   name: { en: 'Drums',   zh: '鼓' } },
  { id: 'other',   name: { en: 'Other',   zh: '其他' } },
];

const REG = globalThis.__openavInstruments || (globalThis.__openavInstruments = { defs: new Map(), subs: new Set() });
const ID_RE = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/;
const fin = (x) => typeof x === 'number' && Number.isFinite(x);

/** Everything wrong with a definition, as readable sentences ([] = valid). */
export function validateInstrument(def) {
  if (!def || typeof def !== 'object') return ['an instrument definition is an object'];
  const errs = [];
  if (typeof def.id !== 'string' || !ID_RE.test(def.id)) errs.push(`id ${JSON.stringify(def.id)}: lowercase letters, digits and "-", at most one "/" (e.g. "synth/pad")`);
  const n = def.name;
  if (!(typeof n === 'string' && n) && !(n && typeof n === 'object' && typeof n.en === 'string' && n.en)) errs.push('name: a string, or { en, zh }');
  if (typeof def.category !== 'string' || !def.category) errs.push('category: a string such as "keys", "mallets", "synth"');
  if (typeof def.create !== 'function') errs.push('create(Tone, ctx) must be a function returning { noteOn, noteOff, dispose }');
  if (def.params != null) {
    if (!Array.isArray(def.params)) errs.push('params: an array of { key, min, max, def }');
    else def.params.forEach((p, i) => {
      const at = `params[${i}]${p && p.key ? ` (${p.key})` : ''}`;
      if (!p || typeof p.key !== 'string' || !/^[a-zA-Z][\w-]*$/.test(p.key)) errs.push(`${at}: key is a word like "decay"`);
      else if (SHARED.has(p.key)) errs.push(`${at}: "${p.key}" is a shared sound param; set its starting value with defaults: { ${p.key}: … }`);
      else if (!(fin(p.min) && fin(p.max) && p.min < p.max)) errs.push(`${at}: needs numbers min < max`);
      else if (!fin(p.def) || p.def < p.min || p.def > p.max) errs.push(`${at}: def must lie within min..max`);
    });
  }
  if (def.defaults != null) {
    if (typeof def.defaults !== 'object') errs.push('defaults: { cutoff?, space?, volume? }');
    else for (const [k, v] of Object.entries(def.defaults)) {
      const p = SOUND_PARAMS.find((s) => s.key === k);
      if (!p) errs.push(`defaults.${k}: only ${[...SHARED].join(', ')} have defaults here (declare your own params in params)`);
      else if (!fin(v) || v < p.min || v > p.max) errs.push(`defaults.${k}: a number within ${p.min}..${p.max}`);
    }
  }
  if (def.credit != null && !(typeof def.credit === 'string' && def.credit) && !(typeof def.credit === 'object' && typeof def.credit.text === 'string')) errs.push('credit: a string, or { text, url }');
  for (const k of ['gain', 'transpose', 'tail']) if (def[k] != null && !fin(def[k])) errs.push(`${k}: a number`);
  if (def.fallback != null && (typeof def.fallback !== 'string' || def.fallback === def.id)) errs.push('fallback: the id of another instrument');
  return errs;
}

/**
 * Add a sound to every picker on the page.
 * A duplicate id throws, unless you pass { replace: true } — swapping a built-in
 * (say, your own 'piano') is allowed, but only on purpose.
 */
export function registerInstrument(def, { replace = false } = {}) {
  const errs = validateInstrument(def);
  if (errs.length) throw new TypeError(`[sound] instrument ${JSON.stringify(def?.id)}: ${errs.join(' · ')}`);
  if (REG.defs.has(def.id) && !replace) throw new Error(`[sound] instrument "${def.id}" is already registered; pass { replace: true } to swap it on purpose`);
  REG.defs.set(def.id, def);
  notify({ type: 'register', id: def.id });
  return def;
}

/** Remove a sound (tests, hot reload). Returns whether it existed. */
export function unregisterInstrument(id) {
  const had = REG.defs.delete(id);
  if (had) notify({ type: 'unregister', id });
  return had;
}

export function getInstrument(id) { return REG.defs.get(id) || null; }

/** All registered sounds in registration order; { category } narrows to one group. */
export function listInstruments({ category = null } = {}) {
  const all = [...REG.defs.values()];
  return category ? all.filter((d) => d.category === category) : all;
}

/** Display name in a language ('en' | 'zh' …), falling back to English. */
export function instrumentName(def, lang = 'en') {
  if (!def) return '';
  if (typeof def.name === 'string') return def.name;
  return def.name[lang] || def.name[String(lang).slice(0, 2)] || def.name.en;
}

/** Picker data: [{ id, label, items: [def…] }] in CATEGORIES order, empty groups left out. */
export function instrumentGroups(lang = 'en', list = listInstruments()) {
  const order = (c) => { const i = CATEGORIES.findIndex((x) => x.id === c); return i < 0 ? CATEGORIES.length : i; };
  const cats = [...new Set(list.map((d) => d.category))].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  return cats.map((c) => {
    const known = CATEGORIES.find((x) => x.id === c);
    const label = known ? (known.name[lang] || known.name[String(lang).slice(0, 2)] || known.name.en) : c;
    return { id: c, label, items: list.filter((d) => d.category === c) };
  });
}

/** Called with { type: 'register' | 'unregister', id } — pickers refresh from it. */
export function onInstrumentsChange(cb) { REG.subs.add(cb); return () => REG.subs.delete(cb); }

function notify(ev) {
  for (const cb of REG.subs) { try { cb(ev); } catch (e) { console.error('[sound] registry listener', e); } }
}
