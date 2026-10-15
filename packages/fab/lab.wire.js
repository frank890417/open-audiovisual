// lab.wire.js — @openav/fab in the cheyuwu-lab runtime (declared in package.json → "lab").
// Runs inside the generated runtime/modules/fab.js, with `lab` (window.lab) and every export of the declared files in scope.
//   lab.fab.check(x, opts)            manufacturability report
//   lab.fab.export(x, fmt, opts)      stl · obj · glb (any input) · step · dxf (smlibwasm Part / Shape)
//   lab.fab.save(x, fmt, {name,…})    export, then POST to /api/fab/<id> (dev server, local only); no saver → browser download
//   await lab.fab.smlib() / .manifold()   the kernels, imported on first use from window.__LAB__.vendor
// Draws no UI: the work or the workbench decides where the buttons go.
(() => {
  const fab = new Fab({
    urls: (typeof window !== 'undefined' && window.__LAB__ && window.__LAB__.vendor) || undefined,
    context: () => ({ id: lab.id, params: lab.params }),
  });
  fab.saver = async (bytes, info) => {
    try {
      let meta = { params: info.params, note: info.note, report: info.report };
      let head = encodeURIComponent(JSON.stringify(meta));
      if (head.length > 60000) head = encodeURIComponent(JSON.stringify({ note: info.note, report: info.report }));
      const res = await fetch('/api/fab/' + encodeURIComponent(info.id) + '?fmt=' + encodeURIComponent(info.ext) + '&name=' + encodeURIComponent(info.name || ''), {
        method: 'POST',
        headers: { 'Content-Type': info.mime || 'application/octet-stream', 'X-Fab-Info': head },
        body: bytes,
      });
      if (!res.ok) return null;   // 403 (public site / not local) · 404 (old dev server) → the caller falls back to a download
      return await res.json();
    } catch { return null; }
  };
  lab.fab = fab;
})();
