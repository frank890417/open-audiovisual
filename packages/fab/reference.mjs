// @openav/fab reference: manufacturability checks and file export for meshes made in the browser. Read by
// tools/build-reference.mjs (see AGENTS.md, "Documenting a public name"). Everything here is pure and runs headless on a
// hand-built mesh: a tetrahedron (4 vertices, 4 triangles) with 10 mm edges along x, y and z, so every number is easy to check.
// The CAD kernels (smlibwasm, manifold-3d) are loaded from a URL on demand: examples that need them use a stand-in importer.
// The warnings and error messages of this package are written in Chinese: the examples print the numbers, not the sentences.

export default {
  Fab: {
    group: 'fab',
    summary: {
      en: 'Checks a shape for 3D printing and exports it as STL, OBJ, GLB, STEP or DXF; takes a mesh, a three.js object or a smlibwasm solid.',
      zh: '檢查一個形狀能不能 3D 列印，並輸出成 STL、OBJ、GLB、STEP 或 DXF，吃網格、three.js 物件或 smlibwasm 的實體。',
    },
    params: [
      { name: 'opts', type: 'Object', en: '`{ scale, urls, importer, download, context }`, all optional. `scale` is millimetres per unit for a three.js object (`10` means one three.js unit is 10 mm). `urls` is `{ smlib, manifold }`, a URL or a list of them, to load the CAD kernels from. `importer(url)` replaces the dynamic `import()` that loads a kernel. `download(bytes, info)` replaces the browser download that `save()` falls back to. `context()` returns `{ id, params }` for `save()` to put in `info`.', zh: '`{ scale, urls, importer, download, context }`，每一項都可省略。`scale` 是 three.js 物件每個單位多少毫米（`10` 表示 three.js 的一個單位是 10 毫米）。`urls` 是 `{ smlib, manifold }`，一個網址或一串網址，用來載入 CAD 核心。`importer(url)` 取代載入核心用的動態 `import()`。`download(bytes, info)` 取代 `save()` 退而求其次用的瀏覽器下載。`context()` 回傳 `{ id, params }`，讓 `save()` 放進 `info`。' },
    ],
    description: [
      {
        en: 'Make one `Fab` and hand it whatever you made: `fab.check(x)` returns a manufacturability report (is it closed, how much material, how much overhang, how thin is the thinnest wall, how many grams), and `await fab.export(x, \'stl\')` returns the file as bytes. `x` can be a plain triangle mesh `{ vertices, triangles }`, a three.js `Mesh`, `Object3D` or `BufferGeometry` (recognised by its shape, three.js is never imported), or a smlibwasm `Part` or `Shape`. [`meshOf()`](#meshOf) says exactly what is accepted.',
        zh: '做一個 `Fab`，把你做出來的東西交給它：`fab.check(x)` 回傳製造性報告（封不封閉、用了多少材料、有多少懸空、最薄的壁多薄、幾公克），`await fab.export(x, \'stl\')` 以位元組回傳檔案。`x` 可以是單純的三角形網格 `{ vertices, triangles }`、three.js 的 `Mesh`、`Object3D` 或 `BufferGeometry`（靠形狀辨認，從不 import three.js），或 smlibwasm 的 `Part` 或 `Shape`。[`meshOf()`](#meshOf) 說明了到底接受什麼。',
      },
      {
        en: 'Formats: `stl`, `obj` and `glb` work for any input; `step` only for a smlibwasm `Part`, and `dxf` only for a smlibwasm `Shape` or `Sketch`, because a mesh has no curved-surface information. The CAD kernels are not bundled: the first time one is needed, `fab.smlib()` or `fab.manifold()` imports it from a URL (unpkg by default) and remembers it.',
        zh: '格式：`stl`、`obj`、`glb` 任何輸入都行。`step` 只能從 smlibwasm 的 `Part` 輸出，`dxf` 只能從 smlibwasm 的 `Shape` 或 `Sketch` 輸出，因為網格沒有曲面資訊。CAD 核心沒有打包在裡面：第一次需要時，`fab.smlib()` 或 `fab.manifold()` 才從網址（預設是 unpkg）import 進來，並且記住。',
      },
      {
        en: '`fab.save()` writes the file through `fab.saver` if you set one (the lab\'s dev server does), and otherwise as a browser download. Zero runtime dependencies: nothing is fetched until you ask for a kernel.',
        zh: '`fab.save()` 如果你設了 `fab.saver`（實驗室的開發伺服器就會設）就透過它寫檔，沒有的話就當成瀏覽器下載。沒有任何執行期相依套件：在你要求核心之前，不會抓任何東西。',
      },
    ],
    needs: {
      en: 'Nothing for meshes and three.js objects. A smlibwasm `Part` has to be tessellated by the kernel: call `await fab.smlib()` once before the synchronous `check()`, or use `checkAsync()`, `meshOfAsync()` and `export()`, which load it for you. Loading needs a network, or `urls` / `window.__LAB__.vendor` pointing somewhere that has the kernel.',
      zh: '網格和 three.js 物件不需要任何前置動作。smlibwasm 的 `Part` 要由核心來切成網格：在同步的 `check()` 之前先 `await fab.smlib()` 一次，或改用會自動載入的 `checkAsync()`、`meshOfAsync()` 和 `export()`。載入需要網路，或是 `urls`、`window.__LAB__.vendor` 指向有這個核心的地方。',
    },
    members: {
      smlib: { en: '`smlib()`: a promise of the smlibwasm module, imported on the first call and remembered (the same promise comes back). A failed load is forgotten, so the next call tries again.', zh: '`smlib()`：smlibwasm 模組的 promise，第一次呼叫時 import 並記住（之後拿到同一個 promise）。載入失敗不會被記住，所以下次呼叫會再試一次。' },
      manifold: { en: '`manifold()`: the same for manifold-3d. The WebAssembly is initialised for you (`setup()` is called), and the result is the ready-to-use module.', zh: '`manifold()`：manifold-3d 也一樣。WebAssembly 會替你初始化（呼叫 `setup()`），結果是可以直接用的模組。' },
      meshOf: { en: '`meshOf(x, opts?)`: the same as [`meshOf()`](#meshOf), with this `Fab`\'s `scale` and, once `smlib()` has loaded, the kernel\'s tessellator.', zh: '`meshOf(x, opts?)`：跟 [`meshOf()`](#meshOf) 一樣，另外帶上這個 `Fab` 的 `scale`，以及 `smlib()` 載入之後核心的切網格函式。' },
      meshOfAsync: { en: '`meshOfAsync(x, opts?)`: the same as [`meshOfAsync()`](#meshOfAsync), and it loads the smlib kernel when it needs it.', zh: '`meshOfAsync(x, opts?)`：跟 [`meshOfAsync()`](#meshOfAsync) 一樣，需要時會自己載入 smlib 核心。' },
      check: { en: '`check(x, opts?)`: synchronous. `meshOf(x)` then [`checkMesh()`](#checkMesh): returns the report. `opts` are the options of both (`scale`, `angle`, `minWall`, `bed` …).', zh: '`check(x, opts?)`：同步。先 `meshOf(x)` 再 [`checkMesh()`](#checkMesh)：回傳報告。`opts` 是兩者的選項合在一起（`scale`、`angle`、`minWall`、`bed` …）。' },
      checkAsync: { en: '`checkAsync(x, opts?)`: the same through `meshOfAsync`, so a smlibwasm `Part` works without loading the kernel first. Returns a promise of the report.', zh: '`checkAsync(x, opts?)`：同樣的事，但透過 `meshOfAsync`，所以 smlibwasm 的 `Part` 不用先載入核心也能用。回傳報告的 promise。' },
      export: { en: '`export(x, fmt, opts?)`: a promise of `{ bytes, mime, ext, report }`; see [`exportAs()`](#exportAs). It uses this `Fab`\'s `scale` and loads the kernel for `step`, `dxf` and the `glb` of a `Part`.', zh: '`export(x, fmt, opts?)`：`{ bytes, mime, ext, report }` 的 promise，見 [`exportAs()`](#exportAs)。它會用這個 `Fab` 的 `scale`，`step`、`dxf` 和 `Part` 的 `glb` 需要時會載入核心。' },
      save: { en: '`save(x, fmt, { name, params, note, … }?)`: export, then hand the bytes to `fab.saver(bytes, info)` if it is a function; `info` is `{ id, fmt, ext, mime, name, params, note, report }`. If the saver is missing, throws, or returns nothing, the file is downloaded instead, through `opts.download` or an `<a download>` click. Returns what the saver returned, or `{ downloaded: true, file }`, plus `report`.', zh: '`save(x, fmt, { name, params, note, … }?)`：先輸出，然後如果 `fab.saver` 是函式，就把位元組交給 `fab.saver(bytes, info)`，`info` 是 `{ id, fmt, ext, mime, name, params, note, report }`。saver 不存在、丟出錯誤、或什麼都沒回傳的話，就改成下載，透過 `opts.download` 或點一個 `<a download>`。回傳 saver 回傳的東西，或 `{ downloaded: true, file }`，另外附上 `report`。' },
    },
    notes: [
      {
        en: 'Public fields: `opts` and `saver` (set it to `async (bytes, info) => ({ file, … })`; it starts as `null`). The file name for `save()` is `name`, else the `id` from `context()`, else `fab`.',
        zh: '公開的欄位有 `opts` 和 `saver`（設成 `async (bytes, info) => ({ file, … })`，一開始是 `null`）。`save()` 的檔名是 `name`，沒有的話是 `context()` 給的 `id`，再沒有就是 `fab`。',
      },
    ],
    tbd: [
      {
        en: 'The STEP and DXF export, and the tessellation of a real smlibwasm `Part`, were not run for this entry: they need the real kernel from unpkg. The examples use a stand-in kernel to show the routing.',
        zh: '這一條沒有實際跑過 STEP 和 DXF 輸出，以及真正的 smlibwasm `Part` 切網格：它們需要 unpkg 上的真正核心。範例用一個替身核心來示範流程。',
      },
    ],
    examples: [
      {
        code: `import { Fab } from '@openav/fab';

// a tetrahedron: three 10 mm edges meeting at the origin (x, y, z), counter-clockwise faces seen from outside
const mesh = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
  units: 'mm',
};
const report = new Fab().check(mesh);
document.getElementById('app').innerHTML = [
  'watertight: ' + report.watertight,
  'volume: ' + report.volume.toFixed(1) + ' mm³',
  'PETG: ' + report.grams.PETG + ' g',
  'overhang: ' + Math.round(report.overhang.ratio * 100) + '%',
  'warnings: ' + report.warnings.length,
].join('<br>');`,
        caption: { en: 'Prints watertight: true, volume 166.7 mm³ (10 × 10 × 10 ÷ 6), 0.212 g of PETG, no overhang and no warnings.', zh: '印出 watertight: true、體積 166.7 mm³（10 × 10 × 10 ÷ 6）、PETG 0.212 公克、沒有懸空、沒有警告。' },
      },
      {
        code: `import { Fab } from '@openav/fab';

const mesh = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
  units: 'mm',
};
const fab = new Fab();
const stl = await fab.export(mesh, 'stl');
const obj = await fab.export(mesh, 'obj', { name: 'tetra' });
document.getElementById('app').innerHTML = [
  stl.ext + ' (' + stl.mime + '): ' + stl.bytes.length + ' bytes',
  obj.ext + ' (' + obj.mime + '): ' + new TextDecoder().decode(obj.bytes).split('\\n').slice(0, 4).join(' | '),
].join('<br>');`,
        caption: { en: 'Prints the STL as 284 bytes (84 + 50 × 4) and the first lines of the OBJ: a comment, "o tetra" and the first two vertices.', zh: '印出 STL 是 284 位元組（84 + 50 × 4），以及 OBJ 的前幾行：註解、「o tetra」和前兩個頂點。' },
      },
      {
        code: `import { Fab } from '@openav/fab';

const mesh = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
  units: 'mm',
};
const seen = [];
const fab = new Fab({ download: (bytes, info) => seen.push('download ' + info.name + '.' + info.ext + ' (' + bytes.length + ' bytes)') });

const first = await fab.save(mesh, 'stl', { name: 'tetra' });          // no saver: a download
fab.saver = async (bytes, info) => ({ file: info.name + '.' + info.ext, n: 1 });   // e.g. the lab's /api/fab
const second = await fab.save(mesh, 'obj', { name: 'tetra' });         // the saver wins
seen.push('first: ' + JSON.stringify({ downloaded: first.downloaded, file: first.file }));
seen.push('second: ' + JSON.stringify({ file: second.file, n: second.n }));
document.getElementById('app').innerHTML = seen.join('<br>');`,
        caption: { en: 'Prints the download of tetra.stl (the stand-in `download` replaces the browser\'s), then the saver\'s answer for tetra.obj.', zh: '印出 tetra.stl 的下載（替身 `download` 取代了瀏覽器的下載），然後是 saver 對 tetra.obj 的回答。' },
      },
    ],
    related: ['checkMesh', 'exportAs', 'meshOf', 'loadKernel', 'toStlBytes'],
    keywords: {
      en: ['fab', '3d print', 'manufacturability', 'export stl', 'export obj', 'export glb', 'step', 'dxf', 'three.js', 'smlibwasm', 'manifold', 'check mesh', 'save file'],
      zh: ['數位製造', '3d 列印', '可製造性', '輸出 stl', '輸出 obj', '輸出 glb', 'step', 'dxf', 'three.js', 'smlibwasm', 'manifold', '檢查網格', '存檔'],
    },
  },

  checkMesh: {
    group: 'fab',
    summary: {
      en: 'Measures a triangle mesh for 3D printing: closed or not, volume, mass, overhang, thinnest wall, fit on the bed, with a plain warning for each problem.',
      zh: '替三角形網格量 3D 列印要看的數字：封不封閉、體積、重量、懸空、最薄的壁、放不放得進列印床，每個問題有一句白話警告。',
    },
    params: [
      { name: 'input', type: 'TriMesh', en: 'A mesh `{ vertices, triangles, units? }`: `vertices` a `Float32Array` or `Float64Array` of x, y, z, x, y, z …, `triangles` a `Uint32Array` with three vertex numbers per face, counter-clockwise seen from outside, Z up, in millimetres. Use [`meshOf()`](#meshOf) to get one from something else.', zh: '網格 `{ vertices, triangles, units? }`：`vertices` 是 x, y, z, x, y, z … 的 `Float32Array` 或 `Float64Array`，`triangles` 是每個面三個頂點編號的 `Uint32Array`，從外面看逆時針，Z 向上，單位毫米。要從別的東西得到網格，用 [`meshOf()`](#meshOf)。' },
      { name: 'opts', type: 'Object', optional: true, en: '`angle` (45): the overhang angle in degrees. `minWall` (1.2): the thinnest wall allowed, in mm. `bed` (`[320, 320, 325]`): the size of the print bed in mm. `wallSamples` (2000): how many faces to measure the wall from; fewer is faster. `overhangWarn` (0.15): the share of overhanging area that earns a warning. `weld` (`true`): merge duplicate vertices first; `false` skips it.', zh: '`angle`（45）：懸空角度，單位度。`minWall`（1.2）：允許的最薄壁，單位毫米。`bed`（`[320, 320, 325]`）：列印床的大小，單位毫米。`wallSamples`（2000）：量壁厚時取樣的面數，少一點比較快。`overhangWarn`（0.15）：懸空面積佔多少比例才警告。`weld`（`true`）：先把重複的頂點合併，`false` 就跳過。' },
    ],
    returns: { type: 'Object', en: '`{ units, triangles, bbox, volume, watertight, openEdges, nonManifoldEdges, inconsistentEdges, overhang, minWall, grams, warnings }`. See the description.', zh: '`{ units, triangles, bbox, volume, watertight, openEdges, nonManifoldEdges, inconsistentEdges, overhang, minWall, grams, warnings }`。見說明。' },
    description: [
      {
        en: 'Pure and synchronous, with no DOM. Duplicate vertices are merged first (within 1e-6 of the bounding-box diagonal), because without that every un-indexed mesh (three.js `toNonIndexed()`, an STL, any triangle soup) reads as open. In the report: `triangles` (after merging; a face that collapses is dropped), `bbox` as `{ min, max, size }` in mm, `volume` in mm³ (always positive; a mesh wound inside out is measured the right way round), `watertight` (every edge used by exactly two faces, in opposite directions) with the counts `openEdges`, `nonManifoldEdges` and `inconsistentEdges` behind it, and `grams`: `{ PETG, PLA }`, the weight of the volume as solid plastic (1.27 and 1.24 g/cm³).',
        zh: '純函式、同步，不碰 DOM。重複的頂點會先合併（距離在包圍盒對角線的 1e-6 以內），因為不這樣做，每個沒有索引的網格（three.js 的 `toNonIndexed()`、STL、任何三角形湯）都會被看成有開口。報告裡有：`triangles`（合併之後的數量，塌掉的面會被丟掉）、`bbox`（`{ min, max, size }`，單位毫米）、`volume`（單位 mm³，一定是正的，繞法反了的網格也會用正確的方向去量）、`watertight`（每條邊剛好被兩個面用到、而且方向相反），背後是 `openEdges`、`nonManifoldEdges`、`inconsistentEdges` 三個計數，還有 `grams`：`{ PETG, PLA }`，把體積當成實心塑膠算出的重量（1.27 和 1.24 g/cm³）。',
      },
      {
        en: '`overhang` is `{ angle, area, ratio }`: the area (mm²) of faces that look down steeper than `angle` allows, and its share of the whole surface. Faces that rest on the lowest 0.2 mm (the bed) do not count. `minWall` is `{ value, min, median, samples }` or `null`: rays are shot into the part from sampled faces, and `value` is the 5th percentile of the thicknesses found, which is how thin most of the wall is. `min` is the single thinnest sample, which on a part with holes drilled at an angle is a knife edge and says little about the wall, so it has its own milder note.',
        zh: '`overhang` 是 `{ angle, area, ratio }`：朝下的程度超過 `angle` 容許範圍的面的面積（mm²），以及它佔整個表面的比例。貼在最低 0.2 毫米內（也就是貼在床上）的面不算。`minWall` 是 `{ value, min, median, samples }` 或 `null`：從取樣的面朝零件裡面射線，`value` 是量到的厚度的第 5 百分位，也就是大部分壁有多薄。`min` 是單一最薄的樣本，在有斜著鑽孔的零件上，它會是刀口，對壁厚說不了什麼，所以另外有比較溫和的提示。',
      },
      {
        en: '`warnings` is a list of one sentence each, in Chinese: not watertight (with the three counts), overhang above `overhangWarn`, a wall thinner than `minWall`, a knife edge thinner than half of it, and a size beyond `bed`. An empty list means nothing to report. `fab.check(x)` is `checkMesh(meshOf(x), opts)`.',
        zh: '`warnings` 是一串警告，每項一句話：網格不水密（附三個計數）、懸空超過 `overhangWarn`、壁比 `minWall` 薄、刀口比它的一半還薄、尺寸超出 `bed`。清單是空的就表示沒有要回報的事。`fab.check(x)` 就是 `checkMesh(meshOf(x), opts)`。',
      },
    ],
    notes: [
      {
        en: '`grams` is the weight of a solid part: it does not know about infill or wall count, so a sliced print weighs less.',
        zh: '`grams` 是實心零件的重量：它不知道填充率或外殼層數，所以切片列印出來的會比較輕。',
      },
    ],
    examples: [
      {
        code: `import { checkMesh } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
  units: 'mm',
};
const r = checkMesh(tetra);
document.getElementById('app').innerHTML = [
  'closed: ' + r.watertight + ' (open edges ' + r.openEdges + ')',
  'size: ' + r.bbox.size.join(' x ') + ' mm',
  'volume: ' + r.volume.toFixed(2) + ' mm³, PLA ' + r.grams.PLA + ' g',
  'thinnest wall (5th percentile): ' + r.minWall.value.toFixed(2) + ' mm',
].join('<br>');`,
        caption: { en: 'Prints closed: true, size 10 x 10 x 10 mm, volume 166.67 mm³, PLA 0.207 g and a wall of 3.33 mm.', zh: '印出 closed: true、尺寸 10 x 10 x 10 mm、體積 166.67 mm³、PLA 0.207 公克，壁厚 3.33 mm。' },
      },
      {
        code: `import { checkMesh } from '@openav/fab';

// the same tetrahedron with its bottom face left out: a hole in the mesh
const open = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 1, 3, 0, 3, 2, 1, 2, 3]),
  units: 'mm',
};
const r = checkMesh(open, { bed: [5, 5, 5] });   // and a printer bed that is too small
document.getElementById('app').innerHTML = [
  'watertight: ' + r.watertight + ', open edges: ' + r.openEdges,
  'warnings: ' + r.warnings.length,
].join('<br>');`,
        caption: { en: 'Prints watertight: false with 3 open edges, and 2 warnings: the open mesh and the 10 mm part that does not fit a 5 mm bed.', zh: '印出 watertight: false、3 條開放邊，以及 2 個警告：網格有開口，以及 10 毫米的零件放不進 5 毫米的床。' },
      },
      {
        code: `import { checkMesh } from '@openav/fab';

// the same tetrahedron, but with every triangle listed again for each corner: 12 vertices, none shared (a "triangle soup")
const tetra = [0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10];
const faces = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];
const soup = {
  vertices: Float64Array.from(faces.flatMap((f) => f.flatMap((i) => tetra.slice(i * 3, i * 3 + 3)))),
  triangles: Uint32Array.from({ length: 12 }, (_, i) => i),
  units: 'mm',
};
document.getElementById('app').innerHTML = [
  'merged first (default): ' + checkMesh(soup).watertight,
  'weld: false: ' + checkMesh(soup, { weld: false }).watertight,
].join('<br>');`,
        caption: { en: 'Prints true with the default merge and false with weld: false: a soup of loose triangles looks open until its vertices are merged.', zh: '預設會合併，印出 true，用 weld: false 印出 false：一堆散的三角形，在頂點合併之前看起來是開的。' },
      },
    ],
    related: ['Fab', 'weldMesh', 'meshOf', 'toStlBytes'],
    keywords: {
      en: ['check mesh', 'watertight', 'manifold', 'volume', 'weight', 'grams', 'overhang', 'wall thickness', 'print bed', '3d print', 'report', 'mesh quality'],
      zh: ['檢查網格', '水密', '流形', '體積', '重量', '公克', '懸空', '壁厚', '列印床', '3d 列印', '報告', '網格品質'],
    },
  },

  weldMesh: {
    group: 'fab',
    summary: {
      en: 'Merges vertices that sit closer together than a tolerance and drops the faces that collapse; returns a new mesh with shared vertices.',
      zh: '把靠得比容差還近的頂點合併，並丟掉塌掉的面，回傳一個頂點有共用的新網格。',
    },
    params: [
      { name: 'mesh', type: 'TriMesh', en: 'A mesh `{ vertices, triangles }`. It is not changed.', zh: '網格 `{ vertices, triangles }`。不會被改動。' },
      { name: 'tolerance', type: 'Number', optional: true, en: 'Vertices closer than this (in each of x, y and z) become one, in the mesh\'s units. Left out: 1e-6 times the diagonal of the bounding box.', zh: '距離（x、y、z 各自）小於這個值的頂點會變成一個，單位跟網格一樣。不給的話是包圍盒對角線的 1e-6 倍。' },
    ],
    returns: { type: 'TriMesh', en: '`{ vertices: Float64Array, triangles: Uint32Array, units }` with each position once, and no face that has two corners on the same vertex.', zh: '`{ vertices: Float64Array, triangles: Uint32Array, units }`，每個位置只出現一次，也沒有任何一個面有兩個角落在同一個頂點上。' },
    description: [
      {
        en: 'A triangle soup, where every face has three vertices of its own (what an STL file or three.js `toNonIndexed()` gives), has no neighbours as far as topology goes: every edge looks open. Welding gives the faces shared vertices, so [`checkMesh()`](#checkMesh) can see that they join. [`checkMesh()`](#checkMesh), [`toObjText()`](#toObjText) and [`toGlbBytes()`](#toGlbBytes) call it themselves; [`toStlBytes()`](#toStlBytes) does not need it.',
        zh: '三角形湯，也就是每個面都有自己的三個頂點（STL 檔或 three.js 的 `toNonIndexed()` 給的就是這樣），在拓撲上沒有鄰居：每條邊都看起來是開的。合併頂點讓面共用頂點，[`checkMesh()`](#checkMesh) 才看得出它們是接在一起的。[`checkMesh()`](#checkMesh)、[`toObjText()`](#toObjText) 和 [`toGlbBytes()`](#toGlbBytes) 會自己呼叫它，[`toStlBytes()`](#toStlBytes) 用不到。',
      },
    ],
    examples: [
      {
        code: `import { weldMesh, fromStlBytes, toStlBytes } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
const soup = fromStlBytes(toStlBytes(tetra));   // reading an STL gives every face its own vertices
const welded = weldMesh(soup);
document.getElementById('app').textContent =
  'soup: ' + soup.vertices.length / 3 + ' vertices, welded: ' + welded.vertices.length / 3 + ' vertices, ' + welded.triangles.length / 3 + ' faces';`,
        caption: { en: 'Prints "soup: 12 vertices, welded: 4 vertices, 4 faces".', zh: '印出「soup: 12 vertices, welded: 4 vertices, 4 faces」。' },
      },
    ],
    related: ['checkMesh', 'fromStlBytes', 'toObjText', 'toGlbBytes'],
    keywords: {
      en: ['weld', 'merge vertices', 'triangle soup', 'dedupe', 'shared vertices', 'tolerance', 'stl'],
      zh: ['合併頂點', '焊接', '三角形湯', '去重複', '共用頂點', '容差', 'stl'],
    },
  },

  meshOf: {
    group: 'fab',
    summary: {
      en: 'Turns whatever you made into a triangle mesh `{ vertices, triangles, units }`: a mesh, a three.js object, a mesh-like object or a smlibwasm shape.',
      zh: '把你做的東西變成三角形網格 `{ vertices, triangles, units }`：網格、three.js 物件、像網格的物件，或 smlibwasm 的形狀。',
    },
    params: [
      { name: 'x', type: 'Object', en: 'The thing to convert. Accepted, tried in this order: a mesh `{ vertices, triangles }` (returned as it is); a three.js `Mesh`, `Object3D` (every visible mesh below it) or `BufferGeometry`; anything with a `tessellate()` method; an object with `positions` / `vertices` / `points` and, optionally, `indices` / `triangles` / `faces` / `index`; a smlibwasm solid or shape (given `opts.tessellator`).', zh: '要轉換的東西。接受的類型，依這個順序比對：網格 `{ vertices, triangles }`（原樣傳回），three.js 的 `Mesh`、`Object3D`（底下每個看得見的網格）或 `BufferGeometry`，任何有 `tessellate()` 方法的東西，有 `positions`／`vertices`／`points`，以及可有可無的 `indices`／`triangles`／`faces`／`index` 的物件，smlibwasm 的實體或形狀（要給 `opts.tessellator`）。' },
      { name: 'opts', type: 'Object', optional: true, en: '`scale`: millimetres per unit for a three.js or mesh-like input (default 1). A mesh `{ vertices, triangles }` is never scaled. `tessellator(shape)`: a function that turns a smlibwasm shape into a mesh (the `Fab` class passes the kernel\'s once it is loaded). `tessellate`: an argument passed on to the shape\'s own `tessellate()`.', zh: '`scale`：three.js 或像網格的輸入，每個單位多少毫米（預設 1）。`{ vertices, triangles }` 的網格不會被縮放。`tessellator(shape)`：把 smlibwasm 形狀變成網格的函式（`Fab` 類別在核心載入後會傳入核心的那個）。`tessellate`：傳給形狀自己的 `tessellate()` 的參數。' },
    ],
    returns: { type: 'TriMesh', en: '`{ vertices, triangles, units }`: counter-clockwise faces seen from outside, Z up, millimetres.', zh: '`{ vertices, triangles, units }`：從外面看逆時針的面，Z 向上，單位毫米。' },
    description: [
      {
        en: 'Everything is recognised by its shape and nothing is imported, so three.js and smlibwasm are never loaded for you. A three.js object has its `matrixWorld` applied (a mirrored object keeps its faces facing outward), indexed or not, and Y up is turned into Z up as `(x, y, z) → (x, −z, y)`, then everything is multiplied by `scale`. A missing input, or something it cannot read, throws an `Error` whose message (in Chinese) says what to do.',
        zh: '每種東西都靠形狀辨認，什麼都不 import，所以 three.js 和 smlibwasm 絕對不會被替你載入。three.js 物件會套用它的 `matrixWorld`（鏡射的物件仍會讓面朝外），有沒有索引都行，Y 向上會換成 Z 向上，換法是 `(x, y, z) → (x, −z, y)`，然後全部乘上 `scale`。沒有給輸入、或它讀不懂的東西，會丟出 `Error`，訊息（中文）會說明該怎麼辦。',
      },
      {
        en: 'It is synchronous, so it cannot wait for a kernel: a smlibwasm solid without `opts.tessellator` throws a message that tells you to load the kernel first, and a `tessellate()` that returns a promise throws too. Use [`meshOfAsync()`](#meshOfAsync) for those.',
        zh: '它是同步的，所以不能等核心：沒有 `opts.tessellator` 的 smlibwasm 實體會丟出一則叫你先載入核心的訊息，`tessellate()` 回傳 promise 也會丟出錯誤。這些情況請用 [`meshOfAsync()`](#meshOfAsync)。',
      },
    ],
    examples: [
      {
        code: `import { meshOf } from '@openav/fab';

// what a three.js Mesh looks like to fab: a triangle in the XY plane, no index, an identity matrixWorld
const threeLike = {
  isMesh: true,
  geometry: { attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), itemSize: 3, count: 3 } }, index: null },
  matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
};
const m = meshOf(threeLike, { scale: 10 });   // one three.js unit is 10 mm
document.getElementById('app').textContent = 'vertices: ' + [...m.vertices].join(', ') + ' (' + m.units + ')';`,
        caption: { en: 'Prints "vertices: 0, 0, 0, 10, 0, 0, 0, 0, 10 (mm)": scaled by 10, and three.js\'s up (y = 1) became fab\'s up (z = 10).', zh: '印出「vertices: 0, 0, 0, 10, 0, 0, 0, 0, 10 (mm)」：乘上 10，three.js 的向上（y = 1）變成 fab 的向上（z = 10）。' },
      },
      {
        code: `import { meshOf } from '@openav/fab';

// a mesh-like object: nested points and faces, as some libraries hand them out
const m = meshOf({ points: [[0, 0, 0], [20, 0, 0], [0, 20, 0]], faces: [[0, 1, 2]] });
// the vertices come back flat, as numbers: x, y, z, x, y, z …
document.getElementById('app').textContent = [...m.vertices].join(' ') + ' | faces: ' + [...m.triangles].join(' ');`,
        caption: { en: 'Prints the nine numbers of the three corners and the face "0 1 2": nested arrays are flattened.', zh: '印出三個角的九個數字，以及面「0 1 2」：巢狀陣列會被攤平。' },
      },
    ],
    related: ['meshOfAsync', 'fromMeshLike', 'checkMesh', 'Fab'],
    keywords: {
      en: ['mesh of', 'convert to mesh', 'three.js', 'BufferGeometry', 'Object3D', 'tessellate', 'triangle mesh', 'y up z up', 'scale'],
      zh: ['轉成網格', 'three.js', 'BufferGeometry', 'Object3D', '切網格', '三角形網格', 'y 向上 z 向上', '縮放'],
    },
  },

  meshOfAsync: {
    group: 'fab',
    summary: {
      en: 'Like `meshOf()`, but it waits for a `tessellate()` that returns a promise, and can load the smlibwasm kernel to tessellate a solid.',
      zh: '跟 `meshOf()` 一樣，但它會等回傳 promise 的 `tessellate()`，也能載入 smlibwasm 核心來切實體。',
    },
    params: [
      { name: 'x', type: 'Object', en: 'The thing to convert; see [`meshOf()`](#meshOf).', zh: '要轉換的東西，見 [`meshOf()`](#meshOf)。' },
      { name: 'opts', type: 'Object', optional: true, en: 'The options of [`meshOf()`](#meshOf), and `kernel`: `{ smlib: () => Promise<module> }`, where to get the smlibwasm module from when a solid has to be tessellated and no `tessellator` was given.', zh: '[`meshOf()`](#meshOf) 的選項，另外有 `kernel`：`{ smlib: () => Promise<module> }`，遇到實體要切、又沒給 `tessellator` 時，從哪裡拿 smlibwasm 模組。' },
    ],
    returns: { type: 'Promise<TriMesh>', en: 'The same mesh [`meshOf()`](#meshOf) would give.', zh: '跟 [`meshOf()`](#meshOf) 會給的一樣的網格。' },
    description: [
      {
        en: 'Use it where the conversion may have to wait: a shape whose `tessellate()` is asynchronous, or a smlibwasm `Part` when the kernel is not loaded yet. With `opts.kernel.smlib` it awaits the module and uses its `tessellate(part)`; an error says so if the module has none. Everything else is passed on to [`meshOf()`](#meshOf). `fab.meshOfAsync()` fills in `kernel` for you.',
        zh: '轉換可能得等的時候用它：`tessellate()` 是非同步的形狀，或核心還沒載入的 smlibwasm `Part`。有給 `opts.kernel.smlib` 的話，它會等模組載好，用它的 `tessellate(part)`。模組沒有這個函式的話會丟出說明的錯誤。其他東西都交給 [`meshOf()`](#meshOf)。`fab.meshOfAsync()` 會替你填好 `kernel`。',
      },
    ],
    examples: [
      {
        code: `import { meshOfAsync } from '@openav/fab';

// a shape whose tessellate() answers later, the way a kernel running in a worker would
const shape = { tessellate: async () => ({ positions: [0, 0, 0, 5, 0, 0, 0, 5, 0], indices: [0, 1, 2] }) };
const mesh = await meshOfAsync(shape);
document.getElementById('app').textContent = mesh.vertices.length / 3 + ' vertices, ' + mesh.triangles.length / 3 + ' face';`,
        caption: { en: 'Prints "3 vertices, 1 face": the promise was awaited and the result turned into a mesh.', zh: '印出「3 vertices, 1 face」：promise 被等到了，結果也轉成了網格。' },
      },
      {
        code: `import { meshOfAsync } from '@openav/fab';

// a stand-in for the smlibwasm module: a solid has no tessellate() of its own, the module's function cuts it
const part = { faces: () => [], bbox: () => ({}) };
const kernel = { smlib: async () => ({ tessellate: (p) => ({ vertices: [0, 0, 0, 5, 0, 0, 0, 5, 0], triangles: [0, 1, 2] }) }) };
const mesh = await meshOfAsync(part, { kernel });
document.getElementById('app').textContent = 'tessellated by the kernel: ' + mesh.triangles.length / 3 + ' face';`,
        caption: { en: 'Prints "tessellated by the kernel: 1 face": the module was fetched through `kernel.smlib()` and its `tessellate` did the work.', zh: '印出「tessellated by the kernel: 1 face」：透過 `kernel.smlib()` 取得模組，由它的 `tessellate` 完成。' },
      },
    ],
    related: ['meshOf', 'Fab', 'loadKernel'],
    keywords: {
      en: ['async mesh', 'tessellate', 'smlibwasm', 'promise', 'kernel', 'load on demand', 'worker'],
      zh: ['非同步網格', '切網格', 'smlibwasm', 'promise', '核心', '需要時載入', 'worker'],
    },
  },

  fromMeshLike: {
    group: 'fab',
    summary: {
      en: 'Turns a mesh-like object (positions and indices under any of the usual names) into a triangle mesh, multiplying the positions by `scale`.',
      zh: '把像網格的物件（位置和索引用常見的任何名稱）變成三角形網格，位置會乘上 `scale`。',
    },
    params: [
      { name: 'm', type: 'Object', en: 'An object with the points under `positions`, `vertices`, `points` or `position`, and the faces under `indices`, `triangles`, `faces`, `index` or `triVerts`. Points may be flat numbers, nested arrays (`[[x, y, z], …]`) or objects (`{ x, y, z }`). Without faces, every three points are one triangle. `m.units` is kept (default `\'mm\'`).', zh: '一個物件，點放在 `positions`、`vertices`、`points` 或 `position` 底下，面放在 `indices`、`triangles`、`faces`、`index` 或 `triVerts` 底下。點可以是攤平的數字、巢狀陣列（`[[x, y, z], …]`）或物件（`{ x, y, z }`）。沒有面的話，每三個點是一個三角形。`m.units` 會保留（預設 `\'mm\'`）。' },
      { name: 'scale', type: 'Number', optional: true, en: 'Multiplies every position, for example millimetres per unit.', zh: '乘在每個位置上，例如每個單位多少毫米。' },
    ],
    returns: { type: 'TriMesh', en: '`{ vertices: Float64Array, triangles: Uint32Array, units }`.', zh: '回傳 `{ vertices: Float64Array, triangles: Uint32Array, units }`。' },
    description: [
      {
        en: 'This is what [`meshOf()`](#meshOf) uses for a kernel\'s tessellation result, whichever way the kernel spells it. It throws an `Error` (in Chinese) when `m` is empty or has no positions. It does not check that the faces point outward or that the mesh is closed: that is [`checkMesh()`](#checkMesh).',
        zh: '[`meshOf()`](#meshOf) 處理核心的切網格結果時用的就是它，不管核心怎麼拼那些名稱。`m` 是空的、或沒有位置的話，會丟出 `Error`（中文訊息）。它不檢查面是不是朝外、網格有沒有封閉：那是 [`checkMesh()`](#checkMesh) 的工作。',
      },
    ],
    examples: [
      {
        code: `import { fromMeshLike } from '@openav/fab';

// no faces given: every three points are one triangle; positions in centimetres, scaled to millimetres
const mesh = fromMeshLike({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }, 10);
document.getElementById('app').textContent =
  'vertices: ' + [...mesh.vertices].join(', ') + ' | triangles: ' + [...mesh.triangles].join(', ') + ' | ' + mesh.units;`,
        caption: { en: 'Prints "vertices: 0, 0, 0, 10, 0, 0, 0, 10, 0 | triangles: 0, 1, 2 | mm".', zh: '印出「vertices: 0, 0, 0, 10, 0, 0, 0, 10, 0 | triangles: 0, 1, 2 | mm」。' },
      },
    ],
    related: ['meshOf', 'meshOfAsync', 'checkMesh'],
    keywords: {
      en: ['mesh like', 'positions indices', 'convert mesh', 'flatten', 'scale', 'kernel mesh'],
      zh: ['像網格', '位置 索引', '轉換網格', '攤平', '縮放', '核心網格'],
    },
  },

  toStlBytes: {
    group: 'fab',
    summary: {
      en: 'Writes a triangle mesh as a binary STL file: 84 + 50 bytes per face, with a normal worked out for every face.',
      zh: '把三角形網格寫成二進位 STL 檔：84 位元組加上每個面 50 位元組，每個面的法線都會算出來。',
    },
    params: [
      { name: 'mesh', type: 'TriMesh', en: 'A mesh `{ vertices, triangles }`, in millimetres.', zh: '網格 `{ vertices, triangles }`，單位毫米。' },
    ],
    returns: { type: 'Uint8Array', en: 'The file: an 80-byte header (the text `open-audiovisual fab STL (mm)`), the face count as a little-endian 32-bit integer, then per face the normal and three corners as 32-bit floats and two zero bytes.', zh: '檔案內容：80 位元組的檔頭（文字 `open-audiovisual fab STL (mm)`）、面數（小端序的 32 位元整數），然後每個面是法線和三個角（32 位元浮點數）加上兩個零位元組。' },
    description: [
      {
        en: 'Every face becomes its own 50 bytes: STL has no shared vertices. The normal comes from the order of the corners (right-hand rule), so counter-clockwise faces seen from outside give outward normals. Positions are written as they are, as float32: nothing is converted to millimetres, so give it a mesh that is already in mm. `await fab.export(x, \'stl\')` is the same thing with the conversions and the check done for you.',
        zh: '每個面各自佔 50 位元組：STL 沒有共用頂點。法線是從角的順序（右手定則）算出來的，所以從外面看逆時針的面，法線就朝外。位置原樣寫成 float32，不會換算成毫米，所以請給它已經是毫米的網格。`await fab.export(x, \'stl\')` 是同一件事，並且替你做了轉換和檢查。',
      },
    ],
    examples: [
      {
        code: `import { toStlBytes } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
const bytes = toStlBytes(tetra);
const faces = new DataView(bytes.buffer).getUint32(80, true);
document.getElementById('app').textContent =
  bytes.length + ' bytes = 84 + 50 × ' + faces + ' faces, header "' + new TextDecoder().decode(bytes.subarray(0, 29)) + '"';`,
        caption: { en: 'Prints 284 bytes = 84 + 50 × 4 faces, and the header text.', zh: '印出 284 位元組 = 84 + 50 × 4 個面，以及檔頭文字。' },
      },
      {
        code: `import { toStlBytes } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
const bytes = toStlBytes(tetra);
const link = document.createElement('a');
link.href = URL.createObjectURL(new Blob([bytes], { type: 'model/stl' }));
link.download = 'tetra.stl';
link.textContent = 'download tetra.stl (' + bytes.length + ' bytes)';
document.getElementById('app').append(link);`,
        caption: { en: 'A link that downloads the file: open it in a slicer or a 3D viewer to see a small pyramid with a right-angle corner.', zh: '一個下載檔案的連結：用切片軟體或 3D 檢視器打開，會看到一個有直角的小金字塔。' },
      },
    ],
    related: ['fromStlBytes', 'exportAs', 'toObjText', 'toGlbBytes', 'Fab'],
    keywords: {
      en: ['stl', 'binary stl', 'export stl', '3d print file', 'slicer', 'write stl', 'bytes'],
      zh: ['stl', '二進位 stl', '輸出 stl', '3d 列印檔', '切片軟體', '寫出 stl', '位元組'],
    },
  },

  fromStlBytes: {
    group: 'fab',
    summary: {
      en: 'Reads a binary STL file back into a triangle mesh: every face has its own three vertices, in 32-bit floats.',
      zh: '把二進位 STL 檔讀回三角形網格：每個面有自己的三個頂點，32 位元浮點數。',
    },
    params: [
      { name: 'bytes', type: 'Uint8Array', en: 'The contents of a binary STL file. The face count is read from the header; the file\'s length is not checked against it.', zh: '二進位 STL 檔的內容。面數從檔頭讀，不會拿檔案長度去對照。' },
    ],
    returns: { type: 'TriMesh', en: '`{ vertices: Float32Array (9 per face), triangles: Uint32Array (0, 1, 2, 3, 4, 5 …), units: \'mm\' }`.', zh: '`{ vertices: Float32Array（每個面 9 個）, triangles: Uint32Array（0, 1, 2, 3, 4, 5 …）, units: \'mm\' }`。' },
    description: [
      {
        en: 'It reads what [`toStlBytes()`](#toStlBytes) writes, or any binary STL: the normals and the two attribute bytes are skipped, and the result is a triangle soup. Give it to [`checkMesh()`](#checkMesh), which merges the vertices itself, or to [`weldMesh()`](#weldMesh). The text (ASCII) form of STL, which starts with `solid`, is not supported and would read as garbage.',
        zh: '它讀的是 [`toStlBytes()`](#toStlBytes) 寫出的東西，或任何二進位 STL：法線和兩個屬性位元組會跳過，結果是一堆三角形湯。把它交給會自己合併頂點的 [`checkMesh()`](#checkMesh)，或交給 [`weldMesh()`](#weldMesh)。以 `solid` 開頭的文字（ASCII）格式 STL 不支援，讀進來會是亂碼。',
      },
    ],
    examples: [
      {
        code: `import { toStlBytes, fromStlBytes, checkMesh } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
const back = fromStlBytes(toStlBytes(tetra));   // a round trip through the file format
document.getElementById('app').innerHTML = [
  'faces: ' + back.triangles.length / 3 + ', vertices: ' + back.vertices.length / 3,
  'still closed after the check merges them: ' + checkMesh(back).watertight,
].join('<br>');`,
        caption: { en: 'Prints 4 faces and 12 vertices (no sharing), and "true": the check welds them and finds the shape closed.', zh: '印出 4 個面和 12 個頂點（沒有共用），以及「true」：檢查時把它們合併後，發現形狀是封閉的。' },
      },
    ],
    related: ['toStlBytes', 'weldMesh', 'checkMesh'],
    keywords: {
      en: ['read stl', 'load stl', 'parse stl', 'binary stl', 'triangle soup', 'import stl'],
      zh: ['讀取 stl', '載入 stl', '解析 stl', '二進位 stl', '三角形湯', '匯入 stl'],
    },
  },

  toObjText: {
    group: 'fab',
    summary: {
      en: 'Writes a triangle mesh as OBJ text: welded vertices (`v x y z`), then faces (`f a b c`), one object, in millimetres.',
      zh: '把三角形網格寫成 OBJ 文字：先合併頂點（`v x y z`），再寫面（`f a b c`），一個物件，單位毫米。',
    },
    params: [
      { name: 'mesh', type: 'TriMesh', en: 'A mesh `{ vertices, triangles }`, in millimetres.', zh: '網格 `{ vertices, triangles }`，單位毫米。' },
      { name: 'name', type: 'String', optional: true, en: 'The object name on the `o` line. Spaces become underscores.', zh: '`o` 那一行的物件名稱。空格會變成底線。' },
    ],
    returns: { type: 'String', en: 'The text: a comment line, `o <name>`, one `v` line per welded vertex (6 decimals at most) and one `f` line per face, vertex numbers counting from 1.', zh: '文字內容：一行註解、`o <name>`、每個合併後的頂點一行 `v`（最多 6 位小數）、每個面一行 `f`，頂點編號從 1 開始。' },
    description: [
      {
        en: 'Vertices are welded first with [`weldMesh()`](#weldMesh), so a triangle soup comes out with shared vertices and a small file. There are no normals, no texture coordinates and no materials. `await fab.export(x, \'obj\', { name })` is the same thing with the conversions done for you.',
        zh: '頂點會先用 [`weldMesh()`](#weldMesh) 合併，所以三角形湯寫出來有共用的頂點，檔案也小。沒有法線、沒有貼圖座標、沒有材質。`await fab.export(x, \'obj\', { name })` 是同一件事，並且替你做了轉換。',
      },
    ],
    examples: [
      {
        code: `import { toObjText } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
document.getElementById('app').innerHTML = toObjText(tetra, 'my part').trim().split('\\n').join('<br>');`,
        caption: { en: 'Prints the comment, "o my_part", four v lines and four f lines: "f 1 3 2" is the first face.', zh: '印出註解、「o my_part」、四行 v 和四行 f：「f 1 3 2」是第一個面。' },
      },
    ],
    related: ['toStlBytes', 'toGlbBytes', 'exportAs', 'weldMesh'],
    keywords: {
      en: ['obj', 'wavefront', 'export obj', 'text mesh', 'write obj'],
      zh: ['obj', 'wavefront', '輸出 obj', '文字網格', '寫出 obj'],
    },
  },

  toGlbBytes: {
    group: 'fab',
    summary: {
      en: 'Writes a triangle mesh as a minimal binary glTF (`.glb`): one mesh with welded positions and indices, in millimetres.',
      zh: '把三角形網格寫成最精簡的二進位 glTF（`.glb`）：一個網格，位置已合併並帶索引，單位毫米。',
    },
    params: [
      { name: 'mesh', type: 'TriMesh', en: 'A mesh `{ vertices, triangles }`, in millimetres.', zh: '網格 `{ vertices, triangles }`，單位毫米。' },
    ],
    returns: { type: 'Uint8Array', en: 'A glTF 2.0 binary: the `glTF` header, one JSON chunk, one binary chunk with 32-bit float positions and 32-bit indices. The length is a multiple of 4.', zh: 'glTF 2.0 二進位檔：`glTF` 檔頭、一個 JSON 區塊、一個放 32 位元浮點數位置和 32 位元索引的二進位區塊。長度是 4 的倍數。' },
    description: [
      {
        en: 'Vertices are welded first with [`weldMesh()`](#weldMesh). The file has `POSITION` and indices only: no normals, no materials, no colours, so a viewer shades it flat or works the normals out itself. The positions stay in millimetres and Z up, and `asset.extras` says `{ units: \'mm\', up: \'Z\' }`. glTF itself assumes Y up, so a viewer that does not read the extras shows the part lying on its side.',
        zh: '頂點會先用 [`weldMesh()`](#weldMesh) 合併。檔案裡只有 `POSITION` 和索引：沒有法線、材質、顏色，所以檢視器會用平面著色，或自己算法線。位置維持毫米、Z 向上，`asset.extras` 寫著 `{ units: \'mm\', up: \'Z\' }`。glTF 本身假設 Y 向上，所以不讀 extras 的檢視器會把零件顯示成躺在側面。',
      },
      {
        en: '`await fab.export(part, \'glb\')` of a smlibwasm `Part` uses the kernel\'s own `toGlb` when it has one, and this function otherwise.',
        zh: 'smlibwasm 的 `Part` 用 `await fab.export(part, \'glb\')` 的話，核心有自己的 `toGlb` 就用它，沒有才用這個函式。',
      },
    ],
    examples: [
      {
        code: `import { toGlbBytes } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
const glb = toGlbBytes(tetra);
const dv = new DataView(glb.buffer);
const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + dv.getUint32(12, true))));
document.getElementById('app').innerHTML = [
  'magic: ' + new TextDecoder().decode(glb.subarray(0, 4)) + ', ' + glb.length + ' bytes',
  'vertices: ' + json.accessors[0].count + ', indices: ' + json.accessors[1].count,
  'bounds: ' + json.accessors[0].max.join(' x '),
].join('<br>');`,
        caption: { en: 'Prints the magic "glTF" and the size, 4 vertices with 12 indices, and the bounds 10 x 10 x 10.', zh: '印出魔術字串「glTF」和大小、4 個頂點配 12 個索引，以及範圍 10 x 10 x 10。' },
      },
    ],
    related: ['toStlBytes', 'toObjText', 'exportAs', 'weldMesh'],
    keywords: {
      en: ['glb', 'gltf', 'export glb', 'binary gltf', '3d viewer', 'web 3d', 'write glb'],
      zh: ['glb', 'gltf', '輸出 glb', '二進位 gltf', '3d 檢視器', '網頁 3d', '寫出 glb'],
    },
  },

  MIME: {
    group: 'fab',
    summary: {
      en: 'The media type of each export format: `MIME.stl` is `\'model/stl\'`, and `obj`, `step`, `dxf` and `glb` the same way.',
      zh: '每種輸出格式的媒體類型：`MIME.stl` 是 `\'model/stl\'`，`obj`、`step`、`dxf`、`glb` 也一樣。',
    },
    value: {
      type: 'Object',
      en: '`{ stl: \'model/stl\', obj: \'model/obj\', step: \'model/step\', dxf: \'image/vnd.dxf\', glb: \'model/gltf-binary\' }`. Its keys are the formats [`exportAs()`](#exportAs) accepts.',
      zh: '`{ stl: \'model/stl\', obj: \'model/obj\', step: \'model/step\', dxf: \'image/vnd.dxf\', glb: \'model/gltf-binary\' }`。它的鍵就是 [`exportAs()`](#exportAs) 接受的格式。',
    },
    description: [
      {
        en: 'For the `type` of a `Blob` or the `Content-Type` of an upload when you handle the bytes yourself: `new Blob([bytes], { type: MIME.stl })`. [`exportAs()`](#exportAs) already puts the right one in its result.',
        zh: '自己處理位元組的時候，拿來當 `Blob` 的 `type` 或上傳的 `Content-Type`：`new Blob([bytes], { type: MIME.stl })`。[`exportAs()`](#exportAs) 的結果裡已經附上正確的那一個。',
      },
    ],
    examples: [
      {
        code: `import { MIME, toStlBytes } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
const blob = new Blob([toStlBytes(tetra)], { type: MIME.stl });
document.getElementById('app').textContent = Object.keys(MIME).join(', ') + ' | blob: ' + blob.type + ', ' + blob.size + ' bytes';`,
        caption: { en: 'Prints the five formats and a blob of type model/stl, 284 bytes.', zh: '印出五種格式，以及一個類型是 model/stl、284 位元組的 blob。' },
      },
    ],
    related: ['exportAs', 'toStlBytes', 'Fab'],
    keywords: {
      en: ['mime', 'media type', 'content type', 'blob type', 'model/stl', 'gltf-binary'],
      zh: ['mime', '媒體類型', 'content type', 'blob 類型', 'model/stl', 'gltf-binary'],
    },
  },

  exportAs: {
    group: 'fab',
    summary: {
      en: 'Exports a shape as STL, OBJ, GLB, STEP or DXF and resolves to `{ bytes, mime, ext, report }`: the same as `fab.export()`, without the `Fab` class.',
      zh: '把形狀輸出成 STL、OBJ、GLB、STEP 或 DXF，結果是 `{ bytes, mime, ext, report }`：跟 `fab.export()` 一樣，只是不用 `Fab` 類別。',
    },
    params: [
      { name: 'x', type: 'Object', en: 'The shape: anything [`meshOf()`](#meshOf) accepts, and for `step` a smlibwasm `Part`, for `dxf` a smlibwasm `Shape` or `Sketch`.', zh: '形狀：[`meshOf()`](#meshOf) 接受的任何東西。`step` 要用 smlibwasm 的 `Part`，`dxf` 要用 smlibwasm 的 `Shape` 或 `Sketch`。' },
      { name: 'fmt', type: 'String', en: '`\'stl\'`, `\'obj\'`, `\'step\'`, `\'dxf\'` or `\'glb\'`, in any case. `\'stp\'` means step and `\'gltf\'` means glb. Another word throws an `Error` that lists the formats.', zh: '`\'stl\'`、`\'obj\'`、`\'step\'`、`\'dxf\'` 或 `\'glb\'`，大小寫都可以。`\'stp\'` 等於 step，`\'gltf\'` 等於 glb。其他的字會丟出列出可用格式的 `Error`。' },
      { name: 'opts', type: 'Object', optional: true, en: 'The options of [`meshOf()`](#meshOf) (`scale`, `tessellator`) and of [`checkMesh()`](#checkMesh) (`angle`, `minWall`, `bed` …), and `name`, the object name of an OBJ file.', zh: '[`meshOf()`](#meshOf) 的選項（`scale`、`tessellator`）、[`checkMesh()`](#checkMesh) 的選項（`angle`、`minWall`、`bed` …），以及 `name`，也就是 OBJ 檔裡的物件名稱。' },
      { name: 'kernel', type: '{ smlib }', optional: true, en: '`{ smlib: () => Promise<module> }`, where to get the smlibwasm module for `step`, `dxf`, and the `glb` of a `Part`. `fab.export()` passes its own.', zh: '`{ smlib: () => Promise<module> }`，`step`、`dxf` 和 `Part` 的 `glb` 要從哪裡拿 smlibwasm 模組。`fab.export()` 會傳它自己的。' },
    ],
    returns: { type: 'Promise<Object>', en: '`bytes` is a `Uint8Array`, `mime` is from [`MIME`](#MIME), `ext` is the extension without the dot (`\'step\'` even if you asked for `\'stp\'`), and `report` is the [`checkMesh()`](#checkMesh) report of the mesh (for `step` and `dxf` it can be `null` when the shape cannot be meshed, such as a 2D sketch).', zh: '`bytes` 是 `Uint8Array`，`mime` 來自 [`MIME`](#MIME)，`ext` 是不含點的副檔名（就算你要的是 `\'stp\'` 也是 `\'step\'`），`report` 是這個網格的 [`checkMesh()`](#checkMesh) 報告（`step` 和 `dxf` 在形狀切不成網格，例如 2D 草圖時，可能是 `null`）。' },
    description: [
      {
        en: '`stl`, `obj` and `glb` come from the mesh: [`toStlBytes()`](#toStlBytes), [`toObjText()`](#toObjText), [`toGlbBytes()`](#toGlbBytes). `step` and `dxf` come straight from the smlibwasm kernel (`toStep`, `toDxf`) and are refused for anything that is not a kernel shape, because a mesh has no curved surfaces to write; an error says so. A kernel solid\'s `glb` uses the kernel\'s `toGlb` when it has one. The report is made on the way, so a file and its check always agree.',
        zh: '`stl`、`obj`、`glb` 由網格產生：[`toStlBytes()`](#toStlBytes)、[`toObjText()`](#toObjText)、[`toGlbBytes()`](#toGlbBytes)。`step` 和 `dxf` 直接來自 smlibwasm 核心（`toStep`、`toDxf`），不是核心形狀的東西會被拒絕，因為網格沒有曲面可以寫，錯誤訊息會這樣說。核心實體的 `glb` 在核心有 `toGlb` 的時候會用它。報告是順便做出來的，所以檔案和它的檢查結果一定一致。',
      },
    ],
    examples: [
      {
        code: `import { exportAs } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
const rows = [];
for (const fmt of ['STL', 'obj', 'gltf']) {
  const out = await exportAs(tetra, fmt);
  rows.push(fmt + ' → ' + out.ext + ', ' + out.mime + ', ' + out.bytes.length + ' bytes, watertight ' + out.report.watertight);
}
document.getElementById('app').innerHTML = rows.join('<br>');`,
        caption: { en: 'Prints three exports: STL as stl (284 bytes), obj, and the alias gltf as glb, each with the report\'s verdict.', zh: '印出三個輸出：STL 變成 stl（284 位元組）、obj，以及別名 gltf 變成 glb，每個都附上報告的結論。' },
      },
      {
        code: `import { exportAs } from '@openav/fab';

const tetra = {
  vertices: new Float64Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
let step, xyz;
try { await exportAs(tetra, 'step'); } catch (e) { step = e.message; }
try { await exportAs(tetra, 'xyz'); } catch (e) { xyz = e.message; }
document.getElementById('app').innerHTML = [step, xyz].join('<br>');`,
        caption: { en: 'Two refusals, each with a message in Chinese: a mesh cannot become STEP (it has no curved surfaces), and "xyz" is not a format.', zh: '兩個拒絕，各有一則中文訊息：網格不能變成 STEP（它沒有曲面），「xyz」也不是格式。' },
      },
      {
        code: `import { exportAs } from '@openav/fab';

// a stand-in for the smlibwasm kernel: STEP only works for a kernel solid, and the kernel writes it
const solid = { faces: () => [], bbox: () => ({}), tessellate: () => ({ positions: [0, 0, 0, 10, 0, 0, 0, 10, 0], indices: [0, 1, 2] }) };
const kernel = { smlib: async () => ({ toStep: () => 'ISO-10303-21;' }) };
const out = await exportAs(solid, 'stp', {}, kernel);
document.getElementById('app').textContent = out.ext + ' (' + out.mime + '): ' + new TextDecoder().decode(out.bytes);`,
        caption: { en: 'Prints "step (model/step): ISO-10303-21;": the alias stp was understood and the bytes came from the kernel\'s toStep.', zh: '印出「step (model/step): ISO-10303-21;」：別名 stp 被認得了，位元組來自核心的 toStep。' },
      },
    ],
    related: ['Fab', 'MIME', 'toStlBytes', 'toObjText', 'toGlbBytes', 'checkMesh', 'loadKernel'],
    keywords: {
      en: ['export', 'export as', 'stl', 'obj', 'glb', 'step', 'dxf', 'format', 'bytes', 'mime', 'cad export'],
      zh: ['輸出', '匯出', 'stl', 'obj', 'glb', 'step', 'dxf', '格式', '位元組', 'mime', 'cad 輸出'],
    },
  },

  loadKernel: {
    group: 'fab',
    summary: {
      en: 'Imports a CAD kernel (smlibwasm or manifold-3d) from the first URL that works, and resolves to the ready module.',
      zh: '從第一個能用的網址 import CAD 核心（smlibwasm 或 manifold-3d），結果是可以直接用的模組。',
    },
    params: [
      { name: 'kind', type: "'smlib' | 'manifold'", en: 'Which kernel: `\'smlib\'` for smlibwasm (solid modelling, STEP and DXF) or `\'manifold\'` for manifold-3d (fast mesh booleans).', zh: '哪一個核心：`\'smlib\'` 是 smlibwasm（實體建模、STEP 和 DXF），`\'manifold\'` 是 manifold-3d（快速的網格布林運算）。' },
      { name: 'opts', type: 'Object', optional: true, en: '`urls`: `{ smlib, manifold }`, a URL or a list of URLs for each kernel. `importer`: `async (url) => module`, to use instead of the dynamic `import()`.', zh: '`urls`：`{ smlib, manifold }`，每個核心一個網址或一串網址。`importer`：`async (url) => module`，用來取代動態的 `import()`。' },
    ],
    returns: { type: 'Promise<Object>', en: 'The smlibwasm module as it came, or the manifold-3d module with its WebAssembly started (`setup()` called).', zh: 'smlibwasm 模組原樣，或已經把 WebAssembly 啟動（呼叫過 `setup()`）的 manifold-3d 模組。' },
    description: [
      {
        en: 'The kernels are not bundled, because open-audiovisual has no dependencies and no build step: the first time a page needs one, it is imported from a URL. The order is [`candidateUrls()`](#candidateUrls): `opts.urls[kind]`, then `window.__LAB__.vendor[kind]`, then unpkg ([`DEFAULT_URLS`](#DEFAULT_URLS)). If every URL fails it rejects with an `Error` (in Chinese) that names each URL and why it failed. It does not remember anything: `fab.smlib()` and `fab.manifold()` keep the promise for you, so call those unless you want to manage it yourself.',
        zh: '核心沒有打包，因為 open-audiovisual 沒有相依套件、也沒有建置步驟：頁面第一次需要的時候，才從網址 import 進來。順序是 [`candidateUrls()`](#candidateUrls)：`opts.urls[kind]`，然後 `window.__LAB__.vendor[kind]`，最後是 unpkg（[`DEFAULT_URLS`](#DEFAULT_URLS)）。每個網址都失敗的話，它會用 `Error`（中文）reject，訊息列出每個網址和失敗原因。它自己什麼都不記：`fab.smlib()` 和 `fab.manifold()` 會替你留著 promise，除非你想自己管理，不然呼叫那兩個。',
      },
    ],
    needs: {
      en: 'A network, or `urls` pointing at a place that serves the kernel (the lab uses `window.__LAB__.vendor`), or an `importer` that returns one.',
      zh: '要有網路，或是 `urls` 指向有提供核心的地方（實驗室用的是 `window.__LAB__.vendor`），或是一個會回傳核心的 `importer`。',
    },
    examples: [
      {
        code: `import { loadKernel } from '@openav/fab';

const tried = [];
// a stand-in importer so nothing is fetched: the first URL fails, the second one works
const importer = async (url) => {
  tried.push(url);
  if (url.includes('mirror-down')) throw new Error('503');
  return { name: 'manifold stand-in', default: async () => ({ setup() { tried.push('setup() called'); } }) };
};
const wasm = await loadKernel('manifold', { urls: { manifold: ['https://mirror-down.example/m.js', 'https://mirror.example/m.js'] }, importer });
document.getElementById('app').innerHTML = tried.join('<br>') + '<br>result has setup: ' + (typeof wasm.setup);`,
        caption: { en: 'Prints the two URLs in the order they were tried, then "setup() called": manifold\'s WebAssembly is started for you.', zh: '依嘗試的順序印出兩個網址，然後是「setup() called」：manifold 的 WebAssembly 會替你啟動。' },
      },
      {
        code: `import { loadKernel } from '@openav/fab';

let message;
try {
  await loadKernel('smlib', { urls: { smlib: 'https://nowhere.example/a.js' }, importer: async () => { throw new Error('no network'); } });
} catch (e) { message = e.message; }
document.getElementById('app').textContent = message;`,
        caption: { en: 'When every URL fails the error names each one, yours first and then the unpkg default, with the reason (in a Chinese sentence).', zh: '每個網址都失敗的時候，錯誤訊息會一個一個列出來，你的在前、unpkg 預設的在後，並附上原因（用中文寫的句子）。' },
      },
    ],
    related: ['candidateUrls', 'DEFAULT_URLS', 'Fab', 'meshOfAsync'],
    keywords: {
      en: ['load kernel', 'smlibwasm', 'manifold-3d', 'wasm', 'import', 'cad kernel', 'lazy load', 'unpkg', 'cdn'],
      zh: ['載入核心', 'smlibwasm', 'manifold-3d', 'wasm', 'import', 'cad 核心', '延遲載入', 'unpkg', 'cdn'],
    },
  },

  candidateUrls: {
    group: 'fab',
    summary: {
      en: 'The list of URLs [`loadKernel()`](#loadKernel) tries for a kernel, in order: your `urls`, then `window.__LAB__.vendor`, then the unpkg default.',
      zh: '[`loadKernel()`](#loadKernel) 載入核心時依序嘗試的網址清單：你給的 `urls`、`window.__LAB__.vendor`、最後是 unpkg 預設的。',
    },
    params: [
      { name: 'kind', type: "'smlib' | 'manifold'", en: 'Which kernel.', zh: '哪一個核心。' },
      { name: 'opts', type: 'Object', optional: true, en: '`urls`: `{ smlib, manifold }`, each a URL or a list of URLs.', zh: '`urls`：`{ smlib, manifold }`，每一項是一個網址或一串網址。' },
    ],
    returns: { type: 'string[]', en: 'The URLs, first to try first, without repeats.', zh: '網址清單，最先要試的排最前面，沒有重複。' },
    description: [
      {
        en: 'The order lets a page choose where its kernels come from without touching the code that uses them: pass `urls` for one page, set `window.__LAB__.vendor` for a whole host (the lab does, to serve the kernels itself), and the unpkg default is the last resort. Calling it yourself is useful to see where a page would look.',
        zh: '這個順序讓頁面可以決定核心從哪裡來，而不用動到使用它們的程式：單一頁面傳 `urls`，整個主機就設 `window.__LAB__.vendor`（實驗室就是這樣做，自己提供核心），unpkg 預設是最後的辦法。自己呼叫它，可以看出一個頁面會去哪些地方找。',
      },
    ],
    examples: [
      {
        code: `import { candidateUrls } from '@openav/fab';

window.__LAB__ = { vendor: { smlib: 'https://lab.example/vendor/smlib.js' } };   // what a host may set
const rows = [
  'mine first: ' + candidateUrls('smlib', { urls: { smlib: 'https://mine.example/smlib.js' } }).join('  →  '),
  'manifold: ' + candidateUrls('manifold').join('  →  '),
];
delete window.__LAB__;
document.getElementById('app').innerHTML = rows.join('<br>');`,
        caption: { en: 'Prints three smlib URLs in order (yours, the host\'s, unpkg) and only the unpkg URL for manifold, which nobody configured.', zh: '依序印出 smlib 的三個網址（你的、主機的、unpkg），以及 manifold 只有 unpkg 的網址，因為沒有人設定它。' },
      },
    ],
    related: ['loadKernel', 'DEFAULT_URLS', 'Fab'],
    keywords: {
      en: ['kernel urls', 'candidate urls', 'vendor', '__LAB__', 'where to load', 'unpkg', 'cdn'],
      zh: ['核心網址', '候選網址', 'vendor', '__LAB__', '從哪載入', 'unpkg', 'cdn'],
    },
  },

  DEFAULT_URLS: {
    group: 'fab',
    summary: {
      en: 'Where the CAD kernels are loaded from when nothing else says so: smlibwasm 0.3.0 and manifold-3d 3.5.4, both from unpkg.',
      zh: '沒有別的指定時，CAD 核心從哪裡載入：smlibwasm 0.3.0 和 manifold-3d 3.5.4，都是從 unpkg。',
    },
    value: {
      type: 'Object',
      en: '`{ smlib: \'https://unpkg.com/@classcad/smlibwasm@0.3.0/dist/index.js\', manifold: \'https://unpkg.com/manifold-3d@3.5.4/manifold.js\' }`.',
      zh: '兩個網址：`{ smlib: \'https://unpkg.com/@classcad/smlibwasm@0.3.0/dist/index.js\', manifold: \'https://unpkg.com/manifold-3d@3.5.4/manifold.js\' }`。',
    },
    description: [
      {
        en: 'The last entry of [`candidateUrls()`](#candidateUrls). Versions are pinned, so the kernels a page gets do not change under it. To use another copy, pass `urls` to [`Fab`](#Fab) or [`loadKernel()`](#loadKernel) rather than changing this object.',
        zh: '[`candidateUrls()`](#candidateUrls) 的最後一項。版本是釘死的，所以頁面拿到的核心不會在它底下悄悄改變。要用別的副本，請把 `urls` 傳給 [`Fab`](#Fab) 或 [`loadKernel()`](#loadKernel)，不要去改這個物件。',
      },
    ],
    examples: [
      {
        code: `import { DEFAULT_URLS } from '@openav/fab';

document.getElementById('app').innerHTML = Object.entries(DEFAULT_URLS).map(([kind, url]) => kind + ': ' + url).join('<br>');`,
        caption: { en: 'Prints the two unpkg addresses, with the versions in them.', zh: '印出兩個 unpkg 位址，位址裡有版本號。' },
      },
    ],
    related: ['candidateUrls', 'loadKernel', 'Fab'],
    keywords: {
      en: ['default urls', 'unpkg', 'smlibwasm version', 'manifold version', 'cdn', 'kernel location'],
      zh: ['預設網址', 'unpkg', 'smlibwasm 版本', 'manifold 版本', 'cdn', '核心位置'],
    },
  },
};
