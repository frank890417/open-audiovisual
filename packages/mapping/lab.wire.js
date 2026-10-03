// lab.wire.js — how @openav/mapping plugs into the cheyuwu-lab runtime (declared in package.json → "lab").
// Runs inside the lab's generated runtime/modules/mapping.js with `lab` (the page's window.lab) and
// this package's exports in scope. Not an ES module: no import/export, no top-level return.
if (!lab.params) lab.params = new OpenAV.Params([]);
lab.mapper = new Mapper({ signals: lab.signals, params: lab.params });
lab.frame((dt) => lab.mapper.update(dt));
