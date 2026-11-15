// Console keyboard shortcuts: which key does what, and the guards around them.
//
// The desk answers to a handful of single keys. They are a map action → key(s) so a show can move them:
//
//   play      Space        play / pause (at a HOLD: release it)
//   next      ArrowRight   next scene (at a HOLD: release it)
//   prev      ArrowLeft    previous scene
//   reset     R            back to the start (brings back switched-off segment modules)
//   perf      T            performance mode
//   fullscreen F           fullscreen
//   midi      M            the on-screen MIDI controller panel (createShow with modules.midi.controllers)
//   cancel    Escape       stops the mapping wizard, or leaves keyboard-piano capture
//   curves    C            opens / closes the Curves panel (the automation of every param across the whole show)
//
// Why movable: a show that plays the computer keyboard as a piano wants its letters. While the piano captures the
// keyboard every letter key (a–z, ;) belongs to it, so R / T / F / M are dead then. Move the console to keys the piano
// does not use — `{ keys: { reset: 'F6', perf: 'F7', fullscreen: 'F8', midi: 'F9' } }` — and nobody gives up a note.
//
// A key is written as a string, and matches either the character typed or the physical key:
//   'r'  'R'          the character r (either case; Shift is ignored unless the spec says Shift+)
//   'KeyR'            the physical R key, whatever layout is active (a Zhuyin keyboard types ㄐ there)
//   'Space' 'F6' 'Backquote' 'ArrowUp' 'Enter'     KeyboardEvent.code or key names, case does not matter
//   'Shift+T' 'Ctrl+R'  modifiers: Shift, Ctrl/Control, Alt/Option, Meta/Cmd/Command
// Without Ctrl, Alt or Meta in the spec those must NOT be held: ⌘R, Ctrl+F belong to the browser.

/** The shortcuts the console has always had. */
export const DEFAULT_KEYS = Object.freeze({
  play: 'Space', next: 'ArrowRight', prev: 'ArrowLeft', reset: 'R', perf: 'T', fullscreen: 'F', midi: 'M', cancel: 'Escape', curves: 'C',
});
export const KEY_ACTIONS = Object.keys(DEFAULT_KEYS);

const MODS = { shift: 'shift', ctrl: 'ctrl', control: 'ctrl', alt: 'alt', option: 'alt', meta: 'meta', cmd: 'meta', command: 'meta' };
const SHOWN = { ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' };

/**
 * 'Shift+T' → { spec, key: 't', shift: true, ctrl: false, alt: false, meta: false, typing: true, label: 'Shift+T' }.
 * `typing`: the piano would swallow this key while it captures the keyboard (a letter or ;, no Ctrl/Alt/Meta).
 * `label`: what a hint prints ('→' for ArrowRight, 'Esc' for Escape).
 */
export function parseKey(spec) {
  if (typeof spec !== 'string' || !spec.length) throw new Error(`key spec must be a non-empty string, got ${JSON.stringify(spec)}`);
  const out = { spec, key: '', shift: false, ctrl: false, alt: false, meta: false, typing: false, label: '' };
  let rest = spec;
  while (rest.length > 1) {
    const i = rest.indexOf('+', 1);                                           // a '+' in front is the plus key itself
    if (i < 0) break;
    const mod = MODS[rest.slice(0, i).toLowerCase()];
    if (!mod) throw new Error(`key spec "${spec}": unknown modifier "${rest.slice(0, i)}" (Shift, Ctrl, Alt, Meta)`);
    out[mod] = true;
    rest = rest.slice(i + 1);
  }
  if (!rest.length) throw new Error(`key spec "${spec}" has no key`);
  out.key = rest.toLowerCase();
  out.typing = !out.ctrl && !out.alt && !out.meta && (/^[a-z;]$/.test(out.key) || /^key[a-z]$/.test(out.key));
  out.label = spec.slice(0, spec.length - rest.length) + (SHOWN[rest] || rest);
  return out;
}

/**
 * The map the console runs on: action → [parsed keys]. `keys` is `{ action: 'key' | ['key', …] | false }` laid over the
 * defaults (false, null or '' switch that action off); `false` instead of the object switches every shortcut off.
 */
export function resolveKeys(keys) {
  if (keys === false) return Object.freeze(Object.fromEntries(KEY_ACTIONS.map((a) => [a, Object.freeze([])])));
  if (keys != null && (typeof keys !== 'object' || Array.isArray(keys))) throw new Error('keys must be an object { action: key } or false');
  for (const a of Object.keys(keys || {})) if (!KEY_ACTIONS.includes(a)) throw new Error(`unknown key action "${a}" (${KEY_ACTIONS.join(', ')})`);
  const out = {};
  for (const a of KEY_ACTIONS) {
    const v = keys && a in keys ? keys[a] : DEFAULT_KEYS[a];
    const list = v === false || v == null || v === '' ? [] : Array.isArray(v) ? v : [v];
    try { out[a] = Object.freeze(list.map(parseKey)); } catch (e) { throw new Error(`keys.${a}: ${e.message}`); }
  }
  return Object.freeze(out);
}

function matches(e, p) {
  if (!!e.ctrlKey !== p.ctrl || !!e.altKey !== p.alt || !!e.metaKey !== p.meta) return false;
  if (p.shift && !e.shiftKey) return false;
  return p.key === String(e.code || '').toLowerCase() || p.key === String(e.key ?? '').toLowerCase();
}

/** Which action this key event is, or null: `{ action, binding }`. The first action in KEY_ACTIONS order wins a shared key. */
export function keyMatch(e, bindings) {
  for (const action of KEY_ACTIONS) for (const binding of bindings[action] || []) if (matches(e, binding)) return { action, binding };
  return null;
}

/** What to print in a hint for an action: its first key ('Space', 'R', '→', 'Esc'), or '' when it is switched off. */
export function keyLabel(bindings, action) {
  return bindings[action]?.[0]?.label || '';
}

/**
 * One keydown. Returns true when an action ran.
 * @param {KeyboardEvent} e
 * @param {object} bindings   from resolveKeys()
 * @param {Record<string,()=>void>} actions   a function per action name; actions it lacks are not handled
 * @param {{ captured?: ()=>boolean }} [o]    captured(): the on-screen piano owns the letters right now
 */
export function handleKey(e, bindings, actions, { captured = () => false } = {}) {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
  const hit = keyMatch(e, bindings);
  const action = hit?.action;
  if (tag === 'SELECT' && action !== 'play') return false;                   // arrows and letters choose an option
  if ((e.metaKey || e.ctrlKey || e.altKey) && !hit) return false;            // browser shortcuts (⌘R, ⌘F …) are not ours
  // a clicked button keeps focus; Space must mean PLAY, not "click it again"
  if (tag === 'BUTTON' || tag === 'SELECT') e.target.blur?.();
  if (!hit) return false;
  if (e.repeat) return false;                                                // a held key must not release a hold and pause again
  if (typeof actions[action] !== 'function') return false;
  if (hit.binding.typing && captured()) return false;                        // the piano owns the letters (T and F are piano keys)
  if (action === 'play') e.preventDefault?.();
  actions[action]();
  return true;
}
