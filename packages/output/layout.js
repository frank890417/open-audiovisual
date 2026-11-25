// @openav/output · layout — what the room did to each output, as data: corners, flip, rotation, overscan, soft edge.
// Pure, except the two functions that take a storage you hand them.
//
// The file is the room, the code is the show. What an output SHOWS (its crop of the stage, how it fits) is written in the
// show's code. Where the projector THROWS it (the four corners on the wall, a mirror for rear projection, a quarter turn,
// a black border) is measured in the venue, saved in this browser per output name, and written to a file you can carry:
//
//   { "format": "open-audiovisual/output@1",
//     "outputs": {
//       "front": { "corners": [[0.02, 0.01], [0.97, 0.03], [0.99, 0.98], [0.01, 0.96]],
//                  "flipX": false, "flipY": false, "rotate": 0, "overscan": 0, "soft": 0 } } }
//
// corners   top-left, top-right, bottom-right, bottom-left of the picture, as 0..1 of the output window (a corner may sit a
//           little outside it: -0.5 … 1.5), convex
// flipX     mirror left–right (rear projection)       flipY   mirror top–bottom
// rotate    0, 90, 180 or 270, clockwise              overscan  0 … 0.45: a black border, as a fraction of each side
// soft      0 … 0.5: the picture's edges fade to black over this fraction of each side (not edge blending)

import { checkQuad } from './pin.js?v=cedb93fa';

export const OUTPUT_FORMAT = 'open-audiovisual/output@1';
export const NAME_RE = /^[\w-]{1,32}$/;
const ROOM_KEYS = ['corners', 'flipX', 'flipY', 'rotate', 'overscan', 'soft'];
const STORE_PREFIX = 'oav-output:';

/** The room of an output nobody has touched: the picture fills the window. */
export function defaultRoom() {
  return { corners: [[0, 0], [1, 0], [1, 1], [0, 1]], flipX: false, flipY: false, rotate: 0, overscan: 0, soft: 0 };
}

/** One output's room, filled in and checked: [room, problems]. Missing keys take the defaults; unknown keys are problems. */
export function checkRoom(input, where = 'output') {
  const problems = [];
  const room = defaultRoom();
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return [room, [`${where}: must be an object { corners, flipX, flipY, rotate, overscan, soft }`]];
  for (const k of Object.keys(input)) if (!ROOM_KEYS.includes(k)) problems.push(`${where}.${k}: not a key of an output (${ROOM_KEYS.join(', ')})`);
  if (input.corners !== undefined) {
    const why = checkQuad(input.corners);
    if (why) problems.push(`${where}.corners: ${why}`);
    else if (input.corners.some(([x, y]) => x < -0.5 || x > 1.5 || y < -0.5 || y > 1.5)) problems.push(`${where}.corners: every x and y must lie between -0.5 and 1.5 (0..1 is the window)`);
    else room.corners = input.corners.map(([x, y]) => [x, y]);
  }
  for (const k of ['flipX', 'flipY']) {
    if (input[k] === undefined) continue;
    if (typeof input[k] !== 'boolean') problems.push(`${where}.${k}: must be true or false, got ${JSON.stringify(input[k])}`);
    else room[k] = input[k];
  }
  if (input.rotate !== undefined) {
    if (![0, 90, 180, 270].includes(input.rotate)) problems.push(`${where}.rotate: must be 0, 90, 180 or 270, got ${JSON.stringify(input.rotate)}`);
    else room.rotate = input.rotate;
  }
  for (const [k, max] of [['overscan', 0.45], ['soft', 0.5]]) {
    if (input[k] === undefined) continue;
    if (!Number.isFinite(input[k]) || input[k] < 0 || input[k] > max) problems.push(`${where}.${k}: must be a number from 0 to ${max}, got ${JSON.stringify(input[k])}`);
    else room[k] = input[k];
  }
  return [room, problems];
}

/**
 * Read a layout file (`open-audiovisual/output@1`), as text or as an object, and give it back filled in and checked.
 * Throws one Error that lists every problem, so a file from the venue is fixed in one go.
 * @param {string|object} doc
 * @returns {{ format:string, outputs:Object<string,object> }}
 */
export function parseOutputLayout(doc) {
  let d = doc;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch (e) { throw new Error(`[output] the layout is not JSON: ${e.message}`); }
  }
  if (d === null || typeof d !== 'object' || Array.isArray(d)) throw new Error('[output] a layout is an object { format, outputs }');
  const problems = [];
  if (d.format !== OUTPUT_FORMAT) problems.push(`format: must be "${OUTPUT_FORMAT}", got ${JSON.stringify(d.format)}`);
  for (const k of Object.keys(d)) if (!['format', 'outputs', 'saved'].includes(k)) problems.push(`${k}: not a key of a layout (format, outputs, saved)`);
  const outputs = {};
  if (d.outputs === null || typeof d.outputs !== 'object' || Array.isArray(d.outputs)) problems.push('outputs: must be an object { name: { corners, … } }');
  else {
    for (const [name, room] of Object.entries(d.outputs)) {
      if (!NAME_RE.test(name)) { problems.push(`outputs.${name}: a name is 1–32 letters, digits, - or _`); continue; }
      const [r, p] = checkRoom(room, `outputs.${name}`);
      problems.push(...p);
      outputs[name] = r;
    }
  }
  if (problems.length) throw new Error(`[output] this layout has ${problems.length} problem${problems.length > 1 ? 's' : ''}:\n  ${problems.join('\n  ')}`);
  return { format: OUTPUT_FORMAT, outputs };
}

/** { name: room } → the document a layout file holds. */
export function layoutDoc(rooms, saved = null) {
  const outputs = {};
  for (const [name, room] of Object.entries(rooms)) outputs[name] = checkRoom(room, `outputs.${name}`)[0];
  return { format: OUTPUT_FORMAT, ...(saved ? { saved } : {}), outputs };
}

/** The saved room of one output, or the default when nothing (or nothing readable) was saved. Never throws. */
export function loadRoom(name, storage) {
  let raw = null;
  try { raw = storage?.getItem(STORE_PREFIX + name) ?? null; } catch { /* storage blocked */ }
  if (!raw) return defaultRoom();
  try {
    const [room, problems] = checkRoom(JSON.parse(raw), name);
    if (problems.length) console.warn(`[output] the saved layout of "${name}" is partly unreadable, using defaults for: ${problems.join('; ')}`);
    return room;
  } catch { return defaultRoom(); }
}

/** Save one output's room in this browser (localStorage), under `oav-output:<name>`. Returns false when it could not. */
export function saveRoom(name, room, storage) {
  try { storage?.setItem(STORE_PREFIX + name, JSON.stringify(checkRoom(room, name)[0])); return !!storage; } catch { return false; }
}

/** The browser's localStorage, or null where it is blocked. */
export function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
