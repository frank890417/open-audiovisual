// @openav/console keyboard shortcuts — which key does what, and how a show moves them.
// The console used to hard-code Space ← → R T F (and createShow its own M); a show that plays the computer keyboard as a
// piano needs those letters back. mountConsole(el, app, { keys }) and createShow({ console: { keys } }) take a map
// action → key(s). The matching and the guards are pure functions here; the examples run them in a real page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_KEYS, KEY_ACTIONS, resolveKeys, parseKey, keyMatch, keyLabel, handleKey } from '../packages/console/src/keys.js';

const CODE = { ' ': 'Space', ArrowRight: 'ArrowRight', ArrowLeft: 'ArrowLeft', Escape: 'Escape' };
/** A KeyboardEvent as far as the shortcuts look at it. */
function ev(key, o = {}) {
  const { tag = 'BODY', ...rest } = o;
  const e = {
    key, code: CODE[key] ?? (key.length === 1 && /[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : key),
    repeat: false, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
    target: { tagName: tag, blurred: false, blur() { this.blurred = true; } },
    prevented: false, preventDefault() { this.prevented = true; }, ...rest,
  };
  return e;
}
/** Actions that just record their name. */
function rig(keys, { captured = false } = {}) {
  const calls = [];
  const actions = Object.fromEntries(KEY_ACTIONS.map((a) => [a, () => calls.push(a)]));
  const b = resolveKeys(keys);
  return { calls, press: (e) => handleKey(e, b, actions, { captured: () => captured }), b };
}

test('keys: the defaults are the shortcuts the console always had', () => {
  assert.deepEqual({ ...DEFAULT_KEYS }, { play: 'Space', next: 'ArrowRight', prev: 'ArrowLeft', reset: 'R', perf: 'T', fullscreen: 'F', midi: 'M', cancel: 'Escape', curves: 'C' });   // curves: the curve view (G6) came after the first eight
  assert.deepEqual(KEY_ACTIONS, Object.keys(DEFAULT_KEYS));
  assert.throws(() => { DEFAULT_KEYS.reset = 'x'; }, TypeError, 'frozen');
  const b = resolveKeys();
  for (const a of KEY_ACTIONS) assert.equal(b[a].length, 1, a);
  assert.equal(resolveKeys(undefined)[ 'reset' ][0].key, 'r');
  assert.deepEqual(resolveKeys({}).perf, resolveKeys().perf);
});

test('keys: resolveKeys — override one action, several keys for one, or switch one off; the rest stay', () => {
  const b = resolveKeys({ reset: 'F5', perf: ['F2', 'Shift+T'], fullscreen: false, midi: null, next: '' });
  assert.deepEqual(b.reset.map((p) => p.spec), ['F5']);
  assert.deepEqual(b.perf.map((p) => p.spec), ['F2', 'Shift+T']);
  assert.deepEqual([b.fullscreen, b.midi, b.next], [[], [], []]);
  assert.deepEqual(b.play.map((p) => p.spec), ['Space'], 'untouched');
  assert.deepEqual(b.cancel.map((p) => p.spec), ['Escape']);
});

test('keys: resolveKeys(false) switches every shortcut off', () => {
  const b = resolveKeys(false);
  for (const a of KEY_ACTIONS) assert.deepEqual(b[a], [], a);
  const { press, calls } = rig(false);
  for (const k of [' ', 'r', 't', 'f', 'm', 'ArrowRight', 'Escape']) assert.equal(press(ev(k)), false, k);
  assert.deepEqual(calls, []);
});

test('keys: a typo in an action name or a spec that is not a string throws, naming the culprit', () => {
  assert.throws(() => resolveKeys({ reet: 'x' }), /reet.*play, next, prev, reset, perf, fullscreen, midi, cancel/s);
  assert.throws(() => resolveKeys({ reset: 5 }), /reset/);
  assert.throws(() => resolveKeys({ reset: ['x', {}] }), /reset/);
  assert.throws(() => resolveKeys('R'), /keys/);
});

test('keys: parseKey — modifiers, aliases and the + key', () => {
  assert.deepEqual(parseKey('Shift+T'), { spec: 'Shift+T', key: 't', shift: true, ctrl: false, alt: false, meta: false, typing: true, label: 'Shift+T' });
  const c = parseKey('Cmd+Option+K');
  assert.deepEqual([c.key, c.meta, c.alt, c.ctrl, c.typing], ['k', true, true, false, false], 'a combo is not a piano key');
  assert.equal(parseKey('Control+x').ctrl, true);
  assert.equal(parseKey('+').key, '+');
  assert.equal(parseKey('Ctrl++').key, '+');
  assert.equal(parseKey('F5').typing, false);
  assert.equal(parseKey('Space').typing, false);
  assert.equal(parseKey('KeyR').typing, true);
  assert.equal(parseKey(';').typing, true, 'the piano has a ; key');
  assert.equal(parseKey('1').typing, false, 'digits pass through the piano');
  assert.throws(() => parseKey('Hyper+x'), /Hyper/);
  assert.throws(() => parseKey(''), /empty|spec/i);
});

test('keys: matching — a letter either case, a code for the physical key, F-keys and named keys', () => {
  const m = (keys, e) => keyMatch(e, resolveKeys(keys))?.action ?? null;
  assert.equal(m(undefined, ev('r')), 'reset');
  assert.equal(m(undefined, ev('R', { shiftKey: true })), 'reset', 'Caps / Shift do not matter for a plain letter');
  assert.equal(m(undefined, ev(' ')), 'play', 'Space by code');
  assert.equal(m(undefined, ev('ArrowLeft')), 'prev');
  assert.equal(m(undefined, ev('Escape')), 'cancel');
  // a Zhuyin / Cyrillic layout types other characters; KeyR is the physical key whatever it types
  assert.equal(m({ reset: 'KeyR' }, ev('ㄐ', { code: 'KeyR' })), 'reset');
  assert.equal(m(undefined, ev('ㄐ', { code: 'KeyR' })), null, 'the default R is the character, as before');
  assert.equal(m({ perf: 'F2' }, ev('F2')), 'perf');
  assert.equal(m({ perf: 'F2' }, ev('t')), null, 'T no longer opens performance mode');
  assert.equal(m({ perf: ['F2', 'Backquote'] }, ev('`', { code: 'Backquote' })), 'perf');
  assert.equal(m(undefined, ev('x')), null);
});

test('keys: matching — modifiers: Shift+T needs shift; a plain key never fires with Ctrl, Alt or Cmd (the browser owns those)', () => {
  const m = (keys, e) => keyMatch(e, resolveKeys(keys))?.action ?? null;
  assert.equal(m({ perf: 'Shift+T' }, ev('T', { shiftKey: true })), 'perf');
  assert.equal(m({ perf: 'Shift+T' }, ev('t')), null);
  for (const mod of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(m(undefined, ev('r', { [mod]: true })), null, mod + '+R is the browser\'s');
  assert.equal(m({ reset: 'Ctrl+R' }, ev('r', { ctrlKey: true })), 'reset', 'unless the show asks for it');
  assert.equal(m({ reset: 'Ctrl+R' }, ev('r')), null);
  assert.equal(m({ reset: 'Ctrl+R' }, ev('r', { ctrlKey: true, altKey: true })), null, 'exactly Ctrl');
});

test('keys: keyLabel — what the hints print (→ ← Esc for the named ones, the first binding, empty when off)', () => {
  const b = resolveKeys({ reset: ['F5', 'R'], fullscreen: false });
  assert.equal(keyLabel(b, 'play'), 'Space');
  assert.equal(keyLabel(b, 'next'), '→');
  assert.equal(keyLabel(b, 'prev'), '←');
  assert.equal(keyLabel(b, 'cancel'), 'Esc');
  assert.equal(keyLabel(b, 'reset'), 'F5');
  assert.equal(keyLabel(b, 'perf'), 'T');
  assert.equal(keyLabel(b, 'fullscreen'), '');
  assert.equal(keyLabel(b, 'nothing'), '');
});

// ───────────── handleKey: the guards that were in mountConsole's onKey, now testable ─────────────

test('handleKey: the defaults dispatch exactly as the old onKey did', () => {
  const { press, calls } = rig();
  const space = ev(' ');
  assert.equal(press(space), true);
  assert.equal(space.prevented, true, 'Space must not scroll the page');
  for (const k of ['ArrowRight', 'ArrowLeft', 'Escape', 'r', 'R', 't', 'f', 'm']) assert.equal(press(ev(k)), true, k);
  assert.deepEqual(calls, ['play', 'next', 'prev', 'cancel', 'reset', 'reset', 'perf', 'fullscreen', 'midi']);
  const arrow = ev('ArrowRight'); press(arrow);
  assert.equal(arrow.prevented, false, 'only Space is swallowed');
  assert.equal(press(ev('q')), false);
});

test('handleKey: ignored in text fields; in a <select> only the play key counts; a clicked button is blurred so Space plays', () => {
  const { press, calls } = rig();
  assert.equal(press(ev('r', { tag: 'INPUT' })), false);
  assert.equal(press(ev('t', { tag: 'TEXTAREA' })), false);
  assert.equal(press(ev('ArrowRight', { tag: 'SELECT' })), false, 'arrows choose an option');
  assert.equal(press(ev('r', { tag: 'SELECT' })), false);
  const selSpace = ev(' ', { tag: 'SELECT' });
  assert.equal(press(selSpace), true); assert.equal(selSpace.target.blurred, true);
  const btn = ev(' ', { tag: 'BUTTON' });
  assert.equal(press(btn), true); assert.equal(btn.target.blurred, true, 'the button gives up focus, so Space is PLAY not "click again"');
  assert.deepEqual(calls, ['play', 'play']);
});

test('handleKey: a held key fires once; ⌘/Ctrl/Alt combos are not ours', () => {
  const { press, calls } = rig();
  assert.equal(press(ev('r', { repeat: true })), false);
  assert.equal(press(ev(' ', { repeat: true })), false);
  for (const mod of ['metaKey', 'ctrlKey', 'altKey']) assert.equal(press(ev('r', { [mod]: true })), false);
  const cmd = ev('f', { metaKey: true, tag: 'BUTTON' });
  press(cmd); assert.equal(cmd.target.blurred, false, 'a browser shortcut does not even take focus off a button');
  assert.deepEqual(calls, []);
});

test('handleKey: while the piano captures the keyboard the letters are the piano\'s; Space, arrows, Esc and non-letter keys still work', () => {
  const { press, calls } = rig({ perf: 'F2', midi: 'KeyM' }, { captured: true });
  for (const k of ['r', 'f', 't', ';']) assert.equal(press(ev(k)), false, k);
  assert.equal(press(ev('m', { code: 'KeyM' })), false, 'a bound physical letter key is a piano key too');
  assert.equal(press(ev('t')), false);
  for (const k of [' ', 'ArrowRight', 'ArrowLeft', 'Escape', 'F2']) assert.equal(press(ev(k)), true, k);
  assert.deepEqual(calls, ['play', 'next', 'prev', 'cancel', 'perf']);
});

test('handleKey: the point of { keys } — move R T F M off the letters and the keyboard-piano loses none', () => {
  const keys = { reset: 'F6', perf: 'F7', fullscreen: 'F8', midi: 'F9' };
  const { press, calls } = rig(keys, { captured: true });
  for (const k of ['F6', 'F7', 'F8', 'F9']) assert.equal(press(ev(k)), true, k);
  assert.deepEqual(calls, ['reset', 'perf', 'fullscreen', 'midi']);
  const off = rig(keys, { captured: false });
  for (const k of ['r', 't', 'f', 'm']) assert.equal(off.press(ev(k)), false, k + ' is free now');
  assert.deepEqual(off.calls, []);
});

test('handleKey: an action with no handler, or one switched off, is simply not handled', () => {
  const calls = [];
  const b = resolveKeys({ fullscreen: false });
  const only = { reset: () => calls.push('reset') };
  assert.equal(handleKey(ev('t'), b, only), false, 'no perf handler');
  assert.equal(handleKey(ev('f'), b, { fullscreen: () => calls.push('fs') }), false, 'switched off');
  assert.equal(handleKey(ev('r'), b, only), true);
  assert.deepEqual(calls, ['reset']);
});

// ───────────── curves（G6）：曲線視圖的開關，和其他面板開關一樣走動作表 ─────────────

test('keys: curves — C opens the curve view by default; it moves with { keys }, takes a list, and can be switched off', () => {
  assert.equal(DEFAULT_KEYS.curves, 'C');
  assert.ok(KEY_ACTIONS.includes('curves'));
  assert.equal(KEY_ACTIONS[KEY_ACTIONS.length - 1], 'curves', 'after the first eight, so none of their priorities moved');
  const b = resolveKeys();
  assert.equal(b.curves[0].key, 'c');
  assert.equal(keyLabel(b, 'curves'), 'C');
  const on = rig();
  assert.equal(on.press(ev('c')), true); assert.equal(on.press(ev('C', { shiftKey: true })), true, 'either case');
  assert.deepEqual(on.calls, ['curves', 'curves']);
  const moved = rig({ curves: 'F4' });
  assert.equal(moved.press(ev('c')), false, 'C is free');
  assert.equal(moved.press(ev('F4')), true);
  assert.deepEqual(moved.calls, ['curves']);
  assert.equal(keyLabel(moved.b, 'curves'), 'F4');
  const several = rig({ curves: ['F4', 'Shift+C'] });
  assert.equal(several.press(ev('F4')), true); assert.equal(several.press(ev('C', { shiftKey: true })), true); assert.equal(several.press(ev('c')), false);
  const off = rig({ curves: false });
  assert.equal(off.press(ev('c')), false);
  assert.deepEqual(off.b.curves, []);
  assert.equal(keyLabel(off.b, 'curves'), '');
  assert.deepEqual(resolveKeys(false).curves, []);
  assert.deepEqual(resolveKeys({ curves: null }).curves, []);
  assert.throws(() => resolveKeys({ curves: 5 }), /keys\.curves/);
  assert.throws(() => resolveKeys({ curve: 'x' }), /curve.*curves/s, 'a typo names the real action');
});

test('keys: curves — C is a letter, so the piano keeps it while it captures the keyboard; an F-key still works through it', () => {
  assert.equal(resolveKeys().curves[0].typing, true);
  const { press, calls } = rig(undefined, { captured: true });
  assert.equal(press(ev('c')), false);
  const moved = rig({ curves: 'F4' }, { captured: true });
  assert.equal(moved.press(ev('F4')), true);
  assert.deepEqual([calls, moved.calls], [[], ['curves']]);
});
