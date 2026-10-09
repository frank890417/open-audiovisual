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
//   Esc stops the knob-mapping wizard, or leaves keyboard-piano capture
// While the on-screen piano captures the computer keyboard (the 'keyboard' box in the piano bar)
// the LETTERS belong to the piano — R/T/F are dead keys, because T and F are piano keys too. Space, the
// arrows and Esc always work, so you can play and run the show from one keyboard.
//
// mountConsole(el, app) where app = { timeline, params, mapper, signals, stage, midi?, score?, director? }
// With a score + director the desk gains the Director panel; scenes with cues/hold draw them on the scrubber.

import { css } from './src/theme.js?v=a8b6135';
import { buildTransport } from './src/transport.js?v=a8b6135';
import { buildParamPanel } from './src/params-panel.js?v=a8b6135';
import { buildSignalPanel } from './src/signals-panel.js?v=a8b6135';
import { buildSoundPanel } from './src/sound-panel.js?v=a8b6135';
import { buildLayersPanel } from './src/layers-panel.js?v=a8b6135';
import { buildInputPanel } from './src/input-panel.js?v=a8b6135';
import { buildMappingPanel } from './src/mapping-panel.js?v=a8b6135';
import { buildPerformanceMode } from './src/perf-mode.js?v=a8b6135';
import { buildDirectorPanel } from './src/director-panel.js?v=a8b6135';

// every .oav-panel header toggles its section — the universal collapsible
// panel convention all examples follow
function wireCollapsible(root) {
  root.addEventListener('click', (e) => {
    if (e.target.tagName === 'H3' && e.target.parentElement?.classList.contains('oav-panel'))
      e.target.parentElement.classList.toggle('closed');
  });
}

export function mountConsole(root, app, opts = {}) {
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
  const transport = buildTransport(root, app);
  const directorPanel = app.score && app.director ? buildDirectorPanel(root, app) : null;
  const layers = opts.layers === false ? null : buildLayersPanel(root, app);
  const inputPanel = buildInputPanel(root, app);
  const mappingPanel = buildMappingPanel(root, app, opts);
  const params = buildParamPanel(root, app);
  const soundPanel = app.sound ? buildSoundPanel(root, app) : null;
  const signalsPanel = opts.signals === false ? null : buildSignalPanel(root, app);
  const perf = buildPerformanceMode(app);

  // keyboard
  const leaveCapture = () => {
    const k = app.keys;
    if (!k?.piano) return;
    k.piano.captureEnabled = false; k.piano.releaseAll();
    if (k.captureBox) k.captureBox.checked = false;
  };
  const onKey = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.target.tagName === 'SELECT' && e.code !== 'Space') return;   // arrows and letters choose an option
    if (e.metaKey || e.ctrlKey || e.altKey) return;                     // browser shortcuts (⌘R, ⌘F …) are not ours
    // a clicked button keeps focus; Space must mean PLAY, not "click it again"
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') e.target.blur();
    if (e.repeat) return;                                               // a held key must not release a hold and pause again
    const { timeline } = app;
    if (e.code === 'Escape') { if (mappingPanel.wizard?.active) mappingPanel.wizard.stop(); else leaveCapture(); return; }
    if (e.code === 'Space') { e.preventDefault(); timeline.toggle(); return; }        // at a HOLD, play = release
    if (e.code === 'ArrowRight') { timeline.next ? timeline.next() : timeline.jumpScene(1); return; }
    if (e.code === 'ArrowLeft') { timeline.prev ? timeline.prev() : timeline.jumpScene(-1); return; }
    if (app.keys?.piano?.captureEnabled) return;                         // the piano owns the letters (T and F are piano keys)
    if (e.key === 'r' || e.key === 'R') timeline.reset();
    else if (e.key === 't' || e.key === 'T') perf.toggle();
    else if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.();
  };
  window.addEventListener('keydown', onKey);

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
    dispose() { window.removeEventListener('keydown', onKey); root.innerHTML = ''; },
  };
}
