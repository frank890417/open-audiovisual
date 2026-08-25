// 03 · pose field — the body as a controller.
//
// MediaPipe pose → pose/* signals → routes into world params THROUGH THE MAPPER
// (declared in code here, but a performer could rebind everything live with
// learn chips — try: click "learn" on Flow, then wave a hand).
//
// The world is a flow field. It never reads the camera. It reads params.

import { Signals, Params, Loop } from '@openav/core';
import { PoseTracker } from '@openav/pose';
import { Mapper } from '@openav/mapping';
import { Timeline } from '@openav/timeline';
import { Stage, createCanvas } from '@openav/stage';
import { mountConsole } from '@openav/console';
import { MonitorFeed, snapshotOf } from '@openav/monitor';

// ---------- world ----------
const fieldWorld = {
  name: 'field',
  params: [
    { key: 'energy',  label: 'Energy',   min: 0, max: 1,   def: 0.2 },
    { key: 'width',   label: 'Field width', min: 0.1, max: 1, def: 0.5 },
    { key: 'turb',    label: 'Turbulence', min: 0, max: 1,  def: 0.1 },
    { key: 'hue',     label: 'Hue',      min: 0, max: 360, def: 190 },
    { key: 'centerX', label: 'Center X', min: 0, max: 1,   def: 0.5 },
  ],
  init({ container }) {
    this.view = createCanvas(container);
    const { w, h } = this.view.fit();
    this.pts = Array.from({ length: 2200 }, () => ({ x: Math.random() * w, y: Math.random() * h, a: Math.random() * Math.PI * 2 }));
    this.t = 0;
  },
  update(dt, s) {
    this.s = s; this.t += dt;
    const { w, h } = this.view.fit();
    const cx = s.centerX * w;
    for (const p of this.pts) {
      // simple trig flow field; turbulence adds churn, energy adds speed
      const n = Math.sin(p.x * 0.004 + this.t * (0.3 + s.turb * 2)) + Math.cos(p.y * 0.004 - this.t * 0.2);
      p.a += n * 0.04 * (1 + s.turb * 5) * 60 * dt;
      const sp = (0.4 + s.energy * 3.6) * 60 * dt;
      p.x += Math.cos(p.a) * sp;
      p.y += Math.sin(p.a) * sp;
      // soft pull toward a vertical band around centerX with width
      const band = s.width * w * 0.5;
      if (Math.abs(p.x - cx) > band) p.a += (p.x > cx ? Math.PI : 0) * 0.02;
      if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
    }
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    ctx.fillStyle = 'rgba(0,0,2,0.14)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `hsla(${s.hue}, 85%, ${45 + s.energy * 25}%, 0.7)`;
    for (const p of this.pts) ctx.fillRect(p.x, p.y, 1.6, 1.6);
  },
  dispose() { this.view.dispose(); },
};

// ---------- assembly ----------
const signals = new Signals();
const params = new Params();
const stage = new Stage({ container: document.getElementById('stage'), params, signals });
stage.register(fieldWorld);
await stage.activate('field');

const timeline = new Timeline({
  params, total: 90,
  automation: { hue: [[0, 190], [45, 290], [90, 30]] },
  scenes: [
    { id: 'enter', t: 0,  title: 'Enter',  note: 'find your field' },
    { id: 'open',  t: 30, title: 'Open',   note: 'arms wide' },
    { id: 'burn',  t: 60, title: 'Burn',   note: 'move — fast' },
  ],
});

const mapper = new Mapper({ signals, params, profile: 'pose-field' });
// body → params, declared as data. A performer can rewire all of this live.
mapper.addRoute({ source: 'pose/hand/right/y', target: 'energy', curve: 'smooth', smooth: 0.15 });
mapper.addRoute({ source: 'pose/hands/spread', target: 'width',  curve: 'linear', smooth: 0.25 });
mapper.addRoute({ source: 'pose/hand/right/v', target: 'turb',   curve: 'exp',    smooth: 0.3 });
mapper.addRoute({ source: 'pose/hand/left/x',  target: 'centerX', smooth: 0.2 });

const pose = new PoseTracker({ signals });
document.getElementById('go').addEventListener('click', async () => {
  document.getElementById('go').textContent = 'loading model…';
  try {
    await pose.enable();
    document.getElementById('start').remove();
    timeline.play();
  } catch (e) {
    document.getElementById('go').textContent = 'camera/model failed — retry';
    console.error(e);
  }
});

const app = { timeline, params, mapper, signals, stage };
const consoleUI = mountConsole(document.getElementById('console'), app);
const monitor = new MonitorFeed({});
monitor.connect();

const loop = app.loop = new Loop((dt) => {
  timeline.advance(dt);
  mapper.update(dt);
  const state = stage.frame(dt, timeline.state());
  consoleUI.render(state);
  monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
});
loop.start();

// expose for devtools poking (and framework debugging) — harmless in production
window.openav = { signals, params, timeline, mapper, stage, loop };
