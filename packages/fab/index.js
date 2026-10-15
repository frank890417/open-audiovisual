// @openav/fab — manufacturability check + 3D-print / factory export for anything you can make in the browser.
//   const fab = new Fab();
//   fab.check(threeMesh, { scale: 10 })            → report (watertight, volume, overhang, thinnest wall, grams, warnings)
//   await fab.export(part, 'stl')                  → { bytes, mime, ext, report }
//   await fab.save(part, 'step', { name: 'bracket' }) → through fab.saver (the lab's /api/fab) or a browser download
import { checkMesh, weldMesh } from './checks.js';
import { meshOf, meshOfAsync, fromMeshLike } from './mesh.js';
import { exportAs, toStlBytes, fromStlBytes, toObjText, toGlbBytes, MIME } from './export.js';
import { loadKernel } from './kernel.js';

export { checkMesh, weldMesh } from './checks.js';
export { meshOf, meshOfAsync, fromMeshLike } from './mesh.js';
export { exportAs, toStlBytes, fromStlBytes, toObjText, toGlbBytes, MIME } from './export.js';
export { loadKernel, candidateUrls, DEFAULT_URLS } from './kernel.js';

export class Fab {
  // opts: { urls: { smlib, manifold }, importer(url), download(bytes, info), context() → { id, params }, scale }
  constructor(opts = {}) {
    this.opts = opts;
    this.saver = null;   // async (bytes, info) → { n, file, path, … } | null  (null → browser download)
    this._k = {};
  }
  _kernel(kind) {
    if (!this._k[kind]) {
      this._k[kind] = loadKernel(kind, this.opts);
      this._k[kind].catch(() => { delete this._k[kind]; });   // a failed load can be retried
    }
    return this._k[kind];
  }
  smlib() { return this._kernel('smlib'); }
  manifold() { return this._kernel('manifold'); }

  meshOf(x, opts = {}) { return meshOf(x, { scale: this.opts.scale, ...opts }); }
  meshOfAsync(x, opts = {}) { return meshOfAsync(x, { scale: this.opts.scale, ...opts }); }
  check(x, opts = {}) { return checkMesh(this.meshOf(x, opts), opts); }

  async export(x, fmt, opts = {}) {
    return exportAs(x, fmt, { scale: this.opts.scale, ...opts }, { smlib: () => this.smlib() });
  }

  async save(x, fmt, { name, params, note, ...rest } = {}) {
    const out = await this.export(x, fmt, { name, ...rest });
    const ctx = (this.opts.context && this.opts.context()) || {};
    const info = { id: ctx.id, fmt: out.ext, ext: out.ext, mime: out.mime, name: name || ctx.id || 'fab', params: params !== undefined ? params : ctx.params, note, report: out.report };
    let saved = null;
    if (typeof this.saver === 'function') {
      try { saved = await this.saver(out.bytes, info); } catch { saved = null; }
    }
    if (saved) return { ...saved, report: out.report };
    const download = this.opts.download || browserDownload;
    download(out.bytes, info);
    return { downloaded: true, file: `${info.name}.${out.ext}`, report: out.report };
  }
}

function browserDownload(bytes, info) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) throw new Error('fab：這裡沒有 saver、也不是瀏覽器，沒辦法存檔。');
  const url = URL.createObjectURL(new Blob([bytes], { type: info.mime }));
  const a = document.createElement('a');
  a.href = url; a.download = `${info.name}.${info.ext}`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
