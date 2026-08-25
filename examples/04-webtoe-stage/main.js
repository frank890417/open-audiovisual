// 04 · webtoe stage — the sister-stack integration.
//
// The world here is not JavaScript: it's a WebToe patch (node-based dataflow,
// TouchDesigner-style) running in an iframe, driven through ext() bindings.
// WebToe is the engine, open-audiovisual is the show.

import { createShow } from '@openav/show';
import { webtoeWorld } from '@openav/world-webtoe';

const show = await createShow({
  world: webtoeWorld({
    name: 'garden-patch',
    project: new URL('./garden.webtoe.json', location.href).href,
    params: [
      { key: 'speed', label: 'LFO speed', min: 0, max: 1, def: 0.5 },
      { key: 'hue',   label: 'Hue',       min: 0, max: 360, def: 205 },
      { key: 'zoom',  label: 'Zoom',      min: 0, max: 1, def: 0.5 },
      { key: 'pulse', label: 'Pulse',     min: 0, max: 1, def: 0 },
    ],
  }),
  timeline: {
    total: 90,
    automation: {
      speed: [[0, 0.2], [30, 0.7], [70, 1.0], [90, 0.15]],
      hue:   [[0, 205], [45, 320], [90, 40]],
    },
    scenes: [
      { id: 'drift', t: 0,  title: 'Drift', note: 'sparse notes · let it breathe' },
      { id: 'swell', t: 30, title: 'Swell', note: 'chords welcome' },
      { id: 'spin',  t: 70, title: 'Spin',  note: 'full speed' },
    ],
  },
  routes: [{ source: 'env/pulse', target: 'pulse', smooth: 0.05 }],
  modules: { keys: { base: 48 }, sound: true },
  onFrame: (dt, s) => {          // note envelope shaped at the assembly layer
    s._env = Math.max(0, (s._env ?? 0) - dt * 2.2);
    s.signals.set('env/pulse', s._env);
  },
  hint: "the stage is a WebToe patch (sister project) — params flow in as ext('name')<br>play the piano, or tick \"simulate performance\" and watch it play itself",
});
show.signals.define('env/pulse', { description: 'note envelope' });
show.signals.on('midi/note/on', () => { show._env = 1; });
