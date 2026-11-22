// open-audiovisual in one address — for a page that lives outside this repository.
//
//   import { createShow, createCanvas } from 'https://cdn.jsdelivr.net/gh/frank890417/open-audiovisual@v0.9.0/packages/openav.js';
//
// A page inside the repository uses an import map (every example does). A page of your own has no map and no
// clone: it imports this one file, and the file pulls in the rest from beside itself. Pin the version in the
// address (@v0.9.0) and the show you rehearsed is the show you play, whatever the framework does next
// (docs/getting-started.md, "Pin a version"). https://openaudiovisual.com/packages/openav.js is the same file,
// always the newest.
//
// Import everything you need from THIS address, not from a second one: two addresses are two copies of the
// framework in one page, and a Signals made by one is not the Signals of the other.
//
// What is here is what a show is written with. The inputs, the console, sound and the rest are assembled by
// createShow() and reached through what it returns (show.midi, show.timeline, show.signals …).

export { createShow } from './show/index.js?v=dcdb1a44';
export { Stage, createCanvas } from './stage/index.js?v=dcdb1a44';
export { Bus, Signals, Params, Loop, VERSION, sign } from './core/index.js?v=dcdb1a44';
