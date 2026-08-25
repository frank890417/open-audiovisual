// 04 · webtoe stage — the sister-stack integration.
//
// The world here is not JavaScript: it's a WebToe patch (node-based dataflow,
// TouchDesigner-style) running in an iframe. openav drives it exactly like any
// other world — params in, nothing else. Inside the patch, parameters written
// as ext('speed'), ext('hue'), ext('zoom'), ext('pulse') listen.
//
// Play the on-screen piano (or a MIDI keyboard, or tick "simulate performance")
// → notes feed an envelope → the mapper routes it into the patch. The pipeline
// is the whole point: WebToe is the engine, open-audiovisual is the show.

import { Signals, Params, Loop } from '@openav/core';
import { Midi } from '@openav/midi';
import { mountKeys } from '@openav/keys';
import { Sound, toneEngine } from '@openav/sound';
import { Mapper } from '@openav/mapping';
import { Timeline } from '@openav/timeline';
import { Stage } from '@openav/stage';
import { mountConsole } from '@openav/console';
import { MonitorFeed, snapshotOf } from '@openav/monitor';
import { webtoeWorld } from '@openav/world-webtoe';

const signals = new Signals();
const params = new Params();

// ---------- the world: a WebToe patch ----------
const stage = new Stage({ container: document.getElementById('stage'), params, signals });
stage.register(webtoeWorld({
  name: 'garden-patch',
  project: new URL('./garden.webtoe.json', location.href).href,
  params: [
    { key: 'speed', label: 'LFO speed', min: 0, max: 1, def: 0.5 },
    { key: 'hue',   label: 'Hue',       min: 0, max: 360, def: 205 },
    { key: 'zoom',  label: 'Zoom',      min: 0, max: 1, def: 0.5 },
    { key: 'pulse', label: 'Pulse',     min: 0, max: 1, def: 0 },
  ],
}));
await stage.activate('garden-patch');

const timeline = new Timeline({
  params, total: 90,
  automation: {
    speed: [[0, 0.2], [30, 0.7], [70, 1.0], [90, 0.15]],
    hue:   [[0, 205], [45, 320], [90, 40]],
  },
  scenes: [
    { id: 'drift', t: 0,  title: 'Drift',  note: 'sparse notes · let it breathe' },
    { id: 'swell', t: 30, title: 'Swell',  note: 'chords welcome' },
    { id: 'spin',  t: 70, title: 'Spin',   note: 'full speed' },
  ],
});

const mapper = new Mapper({ signals, params, profile: 'webtoe-stage' });
mapper.addRoute({ source: 'env/pulse', target: 'pulse', smooth: 0.05 });

// ---------- input: piano (screen/QWERTY/sim) + real MIDI + note envelope ----------
const midi = new Midi({ signals });
midi.enable();
const keys = mountKeys(document.getElementById('keys'), { signals, base: 48, octaves: 2 });

// note-on → envelope signal (attack 1, exponential decay) — a tiny example of
// shaping a pulse into a continuous signal at the assembly layer
let env = 0;
signals.on('midi/note/on', () => { env = 1; });
signals.define('env/pulse', { description: 'note envelope' });

// L4 audio branch — enable from the Sound section in the side panel
const sound = new Sound({ signals, params, engine: toneEngine() });

const app = { timeline, params, mapper, signals, midi, sound, stage };
const consoleUI = mountConsole(document.getElementById('desk'), app);
const monitor = new MonitorFeed({});
monitor.connect();

const loop = app.loop = new Loop((dt) => {
  keys.update(dt);                        // simulated performer (when ticked)
  env = Math.max(0, env - dt * 2.2);
  signals.set('env/pulse', env);
  timeline.advance(dt);
  mapper.update(dt);
  const state = stage.frame(dt, timeline.state());
  sound.update(state);
  consoleUI.render(state);
  monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
});
loop.start();

window.openav = { signals, params, timeline, mapper, stage, loop, keys, sound };
