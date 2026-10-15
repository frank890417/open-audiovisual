// Lazy loading of the CAD kernels. They are NOT bundled (OAV has no runtime dependencies and no build step):
// the first time something needs smlibwasm or manifold, the page `import()`s it from a URL.
// URL order: opts.urls[kind] > window.__LAB__.vendor[kind] > the unpkg default.

export const DEFAULT_URLS = {
  smlib: 'https://unpkg.com/@classcad/smlibwasm@0.3.0/dist/index.js',
  manifold: 'https://unpkg.com/manifold-3d@3.5.4/manifold.js',
};

export function candidateUrls(kind, opts = {}) {
  const fromGlobal = typeof window !== 'undefined' && window.__LAB__ && window.__LAB__.vendor ? window.__LAB__.vendor[kind] : null;
  const list = [].concat(opts.urls && opts.urls[kind] || [], fromGlobal || [], DEFAULT_URLS[kind]).filter(Boolean);
  return [...new Set(list)];
}

// Try each URL in order; the error names every URL it tried.
export async function loadKernel(kind, opts = {}) {
  const importer = opts.importer || ((u) => import(/* @vite-ignore */ u));
  const tried = [];
  for (const url of candidateUrls(kind, opts)) {
    try {
      const mod = await importer(url);
      return kind === 'manifold' ? await initManifold(mod) : mod;
    } catch (e) {
      tried.push(`${url}（${(e && e.message) || e}）`);
    }
  }
  throw new Error(`fab：載不到 ${kind === 'smlib' ? 'smlibwasm' : 'manifold-3d'}。試過：${tried.join('；') || '（沒有可用的網址）'}`);
}

async function initManifold(mod) {
  const factory = mod.default || mod.Module || mod;
  const wasm = await (typeof factory === 'function' ? factory() : factory);
  if (wasm && typeof wasm.setup === 'function') wasm.setup();
  return wasm;
}
