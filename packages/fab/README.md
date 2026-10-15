# @openav/fab

Manufacturability check and export for things made in the browser: a 3D-print report (watertight, volume, overhang, thinnest wall, grams of PETG / PLA) and STL / OBJ / GLB files, plus STEP / DXF when the shape comes from [smlibwasm](https://www.npmjs.com/package/@classcad/smlibwasm). Zero runtime dependencies: the CAD kernels are `import()`ed from a URL the first time they are needed.

```js
import { Fab } from '@openav/fab';
const fab = new Fab({ scale: 10 });                 // one three.js unit = 10 mm
const report = fab.check(threeMesh);                // sync
const { bytes } = await fab.export(threeMesh, 'stl');
await fab.save(part, 'step', { name: 'bracket' });  // saver, or a browser download
```

## Mesh format

`TriMesh = { vertices: Float32Array|Float64Array (x,y,z…), triangles: Uint32Array, units: 'mm' }`, faces counter-clockwise seen from outside, Z up.

`meshOf(x, { scale })` accepts a TriMesh, a smlibwasm `Part` / `Shape` (anything with `.tessellate()`), a smlibwasm mesh (`positions`/`vertices` + `indices`/`triangles`), or a three.js `Mesh` / `Object3D` / `BufferGeometry` (duck-typed, three is never imported; `matrixWorld` applied, indexed or not, Y up converted to Z up as `(x, y, z) -> (x, -z, y)`, `scale` = mm per unit).

## check(x, opts) → report

`{ units, triangles, bbox, volume, watertight, openEdges, nonManifoldEdges, inconsistentEdges, overhang:{angle,area,ratio}, minWall:{value,samples}|null, grams:{PETG,PLA}, warnings[] }`

Duplicate vertices are merged first (tolerance 1e-6 × bbox diagonal); without that every un-indexed mesh reads as open. `opts`: `angle` 45, `minWall` 1.2, `bed` [320,320,325], `wallSamples` 2000, `overhangWarn` 0.15. Faces lying on the lowest 0.2 mm do not count as overhang. Warnings are one Chinese sentence each.

## export(x, fmt, opts) → { bytes, mime, ext, report }

| fmt | from |
|---|---|
| `stl` | any input (binary, 84 + 50n bytes) |
| `obj` | any input (text, welded) |
| `glb` | any input (minimal glTF 2.0, mm, Z up); a smlibwasm Part goes through `smlib.toGlb` |
| `step` | smlibwasm Part only (`smlib.toStep`) |
| `dxf` | smlibwasm Shape / Sketch only (`smlib.toDxf`) |

## Kernels

`await fab.smlib()` and `await fab.manifold()` import once and cache the promise. URL order: `opts.urls.{smlib,manifold}`, then `window.__LAB__.vendor`, then unpkg (`@classcad/smlibwasm@0.3.0`, `manifold-3d@3.5.4`). A failure rejects with every URL it tried.

## In the lab

`"modules": ["fab"]` gives `lab.fab`; `lab.fab.save()` POSTs to the dev server's `/api/fab/<id>` (local only) and falls back to a browser download on the public site. See [docs/lab-integration.md](../../docs/lab-integration.md).
