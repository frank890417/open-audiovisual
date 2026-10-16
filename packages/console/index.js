// @openav/console — the director's desk.
//
// One call mounts a full performance console around your stage:
//   transport (play/pause/seek/scene jump) · timeline scrubber with scene blocks ·
//   param sliders (override + clear + learn chip) · signal meters · MIDI log ·
//   performance mode (fullscreen teleprompter, key T)
//
// Zero dependencies, dark theme, keyboard-first:
//   Space play/pause (at a HOLD: release it) · ←/→ previous / next scene (→ at a HOLD: release it)
//   R reset (to the start; brings back switched-off segment modules) · T performance mode · F fullscreen
//   M the on-screen MIDI controller (app.midiPanel) · Esc stops the knob-mapping wizard, or leaves keyboard-piano capture
// While the on-screen piano captures the computer keyboard (the 'keyboard' box in the piano bar)
// the LETTERS belong to the piano — R/T/F/M are dead keys, because T and F are piano keys too. Space, the
// arrows and Esc always work, so you can play and run the show from one keyboard.
// They are only the defaults: mountConsole(el, app, { keys: { reset: 'F6', perf: 'F7' } }) moves them off the letters
// (src/keys.js has the key syntax), { keys: false } switches the shortcuts off.
//
// mountConsole(el, app) where app = { timeline, params, mapper, signals, stage, midi?, midiPanel?, score?, director? }
// With a score + director the desk gains the Director panel; scenes with cues/hold draw them on the scrubber.

import { css } from './src/theme.js?v=72212d8';
import { buildTransport } from './src/transport.js?v=72212d8';
import { buildParamPanel } from './src/params-panel.js?v=72212d8';
import { buildSignalPanel } from './src/signals-panel.js?v=72212d8';
import { buildSoundPanel } from './src/sound-panel.js?v=72212d8';
import { buildLayersPanel } from './src/layers-panel.js?v=72212d8';
import { buildInputPanel } from './src/input-panel.js?v=72212d8';
import { buildMappingPanel } from './src/mapping-panel.js?v=72212d8';
import { buildPerformanceMode } from './src/perf-mode.js?v=72212d8';
import { buildDirectorPanel } from './src/director-panel.js?v=72212d8';
import { resolveKeys, handleKey } from './src/keys.js?v=72212d8';

export { DEFAULT_KEYS, KEY_ACTIONS, resolveKeys, keyLabel } from './src/keys.js?v=72212d8';

// every .oav-panel header toggles its section — the universal collapsible
// panel convention all examples follow
function wireCollapsible(root) {
  root.addEventListener('click', (e) => {
    if (e.target.tagName === 'H3' && e.target.parentElement?.classList.contains('oav-panel'))
      e.target.parentElement.classList.toggle('closed');
  });
}

export function mountConsole(root, app, opts) {
  opts = opts || {};                                                  // createShow passes null when the show gave none
  if (!document.getElementById('openav-css')) {
    const style = document.createElement('style');
    style.id = 'openav-css';
    style.textContent = css;
    document.head.appendChild(style);
  }
  root.classList.add('oav-console');

  wireCollapsible(root);
  // layer-aligned side panel: overview → L1 → L2 → L3 → L4 → raw signals.
  // Every show gets the same structure — modules declared, never hand-wired.
  const keyMap = resolveKeys(opts.keys);                               // a typo in { keys } throws here, before anything is mounted
  const transport = buildTransport(root, app, keyMap);
  const directorPanel = app.score && app.director ? buildDirectorPanel(root, app, keyMap) : null;
  const layers = opts.layers === false ? null : buildLayersPanel(root, app);
  const inputPanel = buildInputPanel(root, app);
  const mappingPanel = buildMappingPanel(root, app, opts);
  const params = buildParamPanel(root, app);
  const soundPanel = app.sound ? buildSoundPanel(root, app) : null;
  const signalsPanel = opts.signals === false ? null : buildSignalPanel(root, app);
  const perf = buildPerformanceMode(app, keyMap);

  // keyboard
  const leaveCapture = () => {
    const k = app.keys;
    if (!k?.piano) return;
    k.piano.captureEnabled = false; k.piano.releaseAll();
    if (k.captureBox) k.captureBox.checked = false;
  };
  const { timeline } = app;
  const actions = {
    play: () => timeline.toggle(),                                                      // at a HOLD, play = release
    next: () => (timeline.next ? timeline.next() : timeline.jumpScene(1)),
    prev: () => (timeline.prev ? timeline.prev() : timeline.jumpScene(-1)),
    cancel: () => { if (mappingPanel.wizard?.active) mappingPanel.wizard.stop(); else leaveCapture(); },
    reset: () => timeline.reset(),
    perf: () => perf.toggle(),
    fullscreen: () => document.documentElement.requestFullscreen?.(),
    midi: () => app.midiPanel?.toggle(),
  };
  // the guards (text fields, a held key, ⌘ combos, the piano owning the letters) live in keys.js, where they are tested
  const onKey = (e) => { handleKey(e, keyMap, actions, { captured: () => !!app.keys?.piano?.captureEnabled }); };
  if (opts.keys !== false) window.addEventListener('keydown', onKey);

  return {
    /** Call once per frame after stage.frame(). */
    render(state) {
      transport.render();
      directorPanel?.render();
      layers?.render();
      inputPanel.render();
      mappingPanel.render();
      params.render(state);
      soundPanel?.render();
      signalsPanel?.render();
      perf.render();
    },
    perf,
    director: directorPanel,
    wizard: mappingPanel.wizard,
    /** The shortcuts in force: action → [{ spec, label, … }] (hints print `keys.play[0].label`, or keyLabel(keys, 'play')). */
    keys: keyMap,
    dispose() { window.removeEventListener('keydown', onKey); root.innerHTML = ''; },
  };
}
