// lab.wire.js — the runner (work page) side of the phone remote, in the cheyuwu-lab runtime.
// surface/… signals → lab.setParam (continuous control goes through params); lab.params → feedback to the phone.
// Layout: /s/<id>/surface.json (widget targets name params), else meta.params through autoSurface.
// (See packages/mapping/lab.wire.js for the wire contract.)
(async () => {
  const enc = lab.id.split('/').map(encodeURIComponent).join('/');
  let meta = {}; try { meta = await (await fetch('/s/' + enc + '/meta.json', { cache: 'no-store' })).json(); } catch (e) {}
  const specs = Array.isArray(meta.params) ? meta.params : [];
  let layout = null;
  try {   // 先看目錄清單（目錄 GET 永遠 200），避免沒有 surface.json 時在 console 留一條 404
    const dir = await (await fetch('/s/' + enc + '/', { cache: 'no-store' })).json();
    if (dir.files && dir.files.includes('surface.json')) layout = await (await fetch('/s/' + enc + '/surface.json', { cache: 'no-store' })).json();
  } catch (e) {}
  const by = new Map(specs.map((p) => [p.key, p]));
  let routes, bindings;
  if (layout) {
    routes = routesFromLayout(normalizeLayout(layout), specs);
    bindings = routes.filter((r) => by.has(r.target) && !by.get(r.target).pulse).map((r) => ({ param: r.target, name: r.source, min: by.get(r.target).min ?? 0, max: by.get(r.target).max ?? 1 }));
  } else ({ routes, bindings } = autoSurface(specs));
  for (const r of routes) {
    lab.signals.on(r.source, (v) => {
      const p = by.get(r.target); if (!p) return;
      if (p.pulse) { if (v > 0.5) { lab.setParam(r.target, 1); setTimeout(() => lab.setParam(r.target, 0), 60); } return; }
      let out = r.outMin + Math.min(1, Math.max(0, v)) * (r.outMax - r.outMin);
      if (p.step) out = r.outMin + Math.round((out - r.outMin) / p.step) * p.step;
      lab.setParam(r.target, out);
    });
  }
  const room = lab.room; // 預設＝作品 id（作品自己的房間）；?room= 覆蓋成共用房間
  const link = new RelayClient({ role: 'runner', room, id: 'lab:' + lab.id }).connect();
  let acc = 0;
  lab.frame((dt) => { acc += dt; if (acc < 0.1) return; acc = 0; for (const f of feedbackFor(lab.params, bindings)) link.feedback(f.name, f.value); });
  lab.remote = { routes, bindings, layout, link };
})();
