// @openav/console — the director's desk.
//
// One call mounts a full performance console around your stage:
//   transport (play/pause/seek/scene jump) · timeline scrubber with scene blocks ·
//   param sliders (override + clear + learn chip) · signal meters · MIDI log ·
//   performance mode (fullscreen teleprompter, key T)
//
// Zero dependencies, dark theme, keyboard-first:
//   Space play/pause · ←/→ scene jump · R reset · T performance mode · F fullscreen
//
// mountConsole(el, app) where app = { timeline, params, mapper, signals, stage, midi? }

import { css } from './src/theme.js';
import { buildTransport } from './src/transport.js';
import { buildParamPanel } from './src/params-panel.js';
import { buildSignalPanel } from './src/signals-panel.js';
import { buildSoundPanel } from './src/sound-panel.js';
import { buildLayersPanel } from './src/layers-panel.js';
import { buildPerformanceMode } from './src/perf-mode.js';

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
  const transport = buildTransport(root, app);
  const layers = opts.layers === false ? null : buildLayersPanel(root, app);
  const soundPanel = app.sound ? buildSoundPanel(root, app) : null;
  const params = buildParamPanel(root, app);
  const signalsPanel = opts.signals === false ? null : buildSignalPanel(root, app);
  const perf = buildPerformanceMode(app);

  // keyboard
  const onKey = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    // a clicked button keeps focus; Space must mean PLAY, not "click it again"
    if (e.target.tagName === 'BUTTON') e.target.blur();
    if (e.code === 'Space') { e.preventDefault(); app.timeline.toggle(); }
    else if (e.code === 'ArrowRight') app.timeline.jumpScene(1);
    else if (e.code === 'ArrowLeft') app.timeline.jumpScene(-1);
    else if (e.key === 'r' || e.key === 'R') { app.timeline.reset(); }
    else if (e.key === 't' || e.key === 'T') perf.toggle();
    else if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.();
  };
  window.addEventListener('keydown', onKey);

  return {
    /** Call once per frame after stage.frame(). */
    render(state) {
      transport.render();
      layers?.render();
      soundPanel?.render();
      params.render(state);
      signalsPanel?.render();
      perf.render();
    },
    perf,
    dispose() { window.removeEventListener('keydown', onKey); root.innerHTML = ''; },
  };
}
