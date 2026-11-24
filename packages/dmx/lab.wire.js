// lab.wire.js — @openav/dmx in the cheyuwu-lab runtime (declared in package.json → "lab").
// Runs inside the lab's generated runtime/modules/dmx.js, with `lab` (window.lab) and the package's exports in scope.
// Not an ES module: no import/export, no top-level return, no import.meta.
//
// What a work gets from `"modules": ["dmx"]` (add "out" before it to reach the out-bridge):
//   lab.dmx.patch, lab.dmx.engine   a Patch from meta.dmx.patch (open-audiovisual/patch@1 JSON, or empty) and its DmxEngine
//                                   (meta.dmx.engine: { maxFlashHz, bpm })
//   lab.dmx.out                     where the bytes go: sim by default · ?dmx=bridge (or meta.dmx.out: "bridge") through lab.out
//                                   to the out-bridge · ?dmx=serial an Enttec DMX USB Pro by Web Serial (lab.dmx.out.connect()
//                                   from a click)
//   lab.dmx.frame(t)                render every light at t seconds, send what changed, update the monitor; returns the universes
//   lab.dmx.monitor(el)             mount the monitor (fixture swatches + the channel grid) in el (default: the page's body)
//   lab.dmx.params(options)         dmxParams(engine, options): the engine's control points as params
// The engine reads no signal: drive it through params (lab.dmx.params) or engine.set(), as any OAV work does.
(() => {
  const cfg = (lab.meta && typeof lab.meta.dmx === 'object' && lab.meta.dmx) || {};
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('dmx') : null;
  const patch = cfg.patch ? Patch.fromJSON(cfg.patch) : new Patch();
  const engine = new DmxEngine(patch, cfg.engine && typeof cfg.engine === 'object' ? cfg.engine : {});
  const want = q || cfg.out || 'sim';
  let out;
  if (want === 'serial') out = dmxTransport('serial', { universe: Number(cfg.universe) || 1 });
  else if (want === 'bridge' && lab.out) out = dmxTransport('bridge', { client: lab.out });
  else {
    if (want === 'bridge') console.warn('[dmx] ?dmx=bridge needs the "out" module (lab.out): add "out" to meta.modules. Simulating.');
    out = dmxTransport('sim');
  }
  let mon = null;
  lab.dmx = {
    patch, engine, out,
    frame(t) {
      const U = engine.render(t);
      out.send(U);
      if (mon) mon.update(U);
      return U;
    },
    monitor(el) {
      if (mon) mon.dispose();
      mon = mountDmxMonitor(el || document.body, { patch, transport: out });
      return mon;
    },
    params: (options) => dmxParams(engine, options),
  };
})();
