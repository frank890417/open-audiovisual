// lab.wire.js — @openav/hw in the cheyuwu-lab runtime (declared in package.json → "lab").
// Runs inside the generated runtime/modules/hw.js, with `lab` (window.lab) and every export of the declared files in scope.
//   lab.hw.check(spec) · lab.hw.diagram(spec) · lab.hw.bom(spec) · lab.hw.parts
//   await lab.hw.load()   the work's own hardware.json (next to its index.html), or null when it has none
// Draws no UI: the workbench's 硬體 tab shows the same three things.
(() => {
  lab.hw = Object.assign({}, Hw, {
    async load(url) {
      try {
        const res = await fetch(url || 'hardware.json', { cache: 'no-store' });
        return res.ok ? await res.json() : null;
      } catch { return null; }
    },
  });
})();
