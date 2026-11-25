// @openav/align · bridge — @openav/output's four-corner pin and an align zone are one thing for the four-corner case.
//
// An output's room (open-audiovisual/output@1) pins the picture of ONE window: its corners are the window's physical
// corners in 0..1 of the window, relabelled by rotate and flips (cornerOrder). An align zone pins ONE tile: its corners are
// the segment's top-left, top-right, bottom-right, bottom-left in desktop px, the feed's turn baked into their order.
// When a tile fills its output exactly, the two are the same homography, and these functions convert one into the other.
//
// What a room cannot carry, a zone's mesh, feather, masks and gain, is never dropped quietly: it is listed in `dropped`.
// What a zone cannot carry, a room's overscan and soft edge, is listed the same way. Pure: no DOM.
import { cornerOrder } from '../output/pin.js?v=7229c5d3';
import { OUTPUT_FORMAT, NAME_RE, parseOutputLayout } from '../output/layout.js?v=7229c5d3';
import { computeMapping } from './mapping.js?v=7229c5d3';
import { defaultZone, normalizeCalibration, isCalibration, CALIBRATION_FORMAT } from './warp.js?v=7229c5d3';

const isMapping = (m) => !!m && Array.isArray(m.tiles) && !!m.desktop;
const fills = (t, o) => t.dst.x === o.x && t.dst.y === o.y && t.dst.w === o.w && t.dst.h === o.h;
const r12 = (v) => Math.round(v * 1e12) / 1e12, r6 = (v) => Math.round(v * 1e6) / 1e6;   // float noise off: a round trip gives the same numbers

function needsFill(tile, output) {
  if (!tile || !output) throw new Error('[align] bridge: needs the tile and the output it is fed to (from computeMapping)');
  if (tile.output !== output.id) throw new Error(`[align] bridge: tile ${tile.name} goes to output ${tile.output}, not ${output.id}`);
  if (!fills(tile, output)) throw new Error(`[align] bridge: tile ${tile.name} does not fill output ${output.id} (an output room pins a whole window): a room is only the four-corner case of one tile on one output`);
}

/** What a zone has that a room has not. */
function lostInRoom(zone) {
  const out = [];
  if (zone.mesh?.d?.some(([x, y]) => x !== 0 || y !== 0)) out.push('mesh');
  if (zone.feather && Object.values(zone.feather).some((v) => v > 0)) out.push('feather');
  if (zone.masks?.length) out.push('masks');
  if (zone.gain != null && zone.gain !== 1) out.push('gain');
  return out;
}

/**
 * An align zone → an output room (open-audiovisual/output@1's per-output object), for a tile that fills its output.
 * @param {object} zone    a zone of a normalized calibration
 * @param {object} tile    the tile (computeMapping()'s), which must fill its output
 * @param {object} output  that output (computeMapping()'s)
 * @returns {{room:object, dropped:string[]}}  dropped: 'mesh', 'feather', 'masks', 'gain' when the zone had them
 */
export function zoneToRoom(zone, tile, output) {
  needsFill(tile, output);
  const rotate = tile.rotate || 0;
  const order = cornerOrder({ rotate });   // the picture's corner i lands on the physical corner order[i]
  const corners = [];
  for (let i = 0; i < 4; i++) corners[order[i]] = [r12((zone.corners[i][0] - output.x) / output.w), r12((zone.corners[i][1] - output.y) / output.h)];
  return { room: { corners, flipX: false, flipY: false, rotate, overscan: 0, soft: 0 }, dropped: lostInRoom(zone) };
}

/**
 * An output room → an align zone for a tile that fills that output: the corners from the room, everything else from base.
 * @param {object} room    an output's room ({ corners, flipX, flipY, rotate, overscan, soft })
 * @param {object} tile
 * @param {object} output
 * @param {object} [base]  the zone to keep the mesh, feather, masks, gain and gamma of (default: the tile's default zone)
 * @returns {{zone:object, dropped:string[], mirrored:boolean}}  dropped: 'overscan', 'soft' when the room had them;
 *   mirrored: a flip makes the quad turn the other way, which createWarpRenderer draws and the align mode's editor refuses to move
 */
export function roomToZone(room, tile, output, base = defaultZone(tile)) {
  needsFill(tile, output);
  const order = cornerOrder({ rotate: room.rotate || 0, flipX: !!room.flipX, flipY: !!room.flipY });
  const corners = [0, 1, 2, 3].map((i) => { const [x, y] = room.corners[order[i]]; return [r6(output.x + x * output.w), r6(output.y + y * output.h)]; });
  const dropped = [];
  if (room.overscan > 0) dropped.push('overscan');
  if (room.soft > 0) dropped.push('soft');
  return { zone: { ...JSON.parse(JSON.stringify(base)), corners }, dropped, mirrored: !!room.flipX !== !!room.flipY };
}

/**
 * The outputs of an align layout as @openav/output declares them, and the conversions between the two files. Pass the
 * result to createOutputs(show, { align }) and its Import layout takes an align calibration too.
 * @param {object} layout  an align layout (or its mapping)
 * @returns {{ id:string, variant:string, aspect:number, outputs:{name:string, crop:object, fit:string}[], skipped:{output:string, why:string}[],
 *   toOutputLayout(calibration:object):object, fromOutputLayout(doc:object|string, base?:object):object, lost(calibration:object):Object<string,string[]> }}
 */
export function outputsFromAlign(layout, { variant } = {}) {
  const M = isMapping(layout) ? layout : computeMapping(layout);
  const v = variant ?? M.id;
  const A = M.art;
  const pairs = [], skipped = [];
  for (const o of M.outputs) {
    const ts = M.tiles.filter((t) => t.output === o.id);
    if (!NAME_RE.test(o.id)) { skipped.push({ output: o.id, why: 'an output name is 1–32 letters, digits, - or _' }); continue; }
    if (ts.length !== 1) { skipped.push({ output: o.id, why: `${ts.length} tiles go to it: an output window shows one picture` }); continue; }
    if (!fills(ts[0], o)) { skipped.push({ output: o.id, why: `tile ${ts[0].name} does not fill it` }); continue; }
    pairs.push({ o, t: ts[0] });
  }
  const crop = (t) => ({ x: t.src.x / A.w, y: t.src.y / A.h, w: t.src.w / A.w, h: t.src.h / A.h });
  const zonesOf = (cal) => normalizeCalibration(cal, M, v).variants[v].zones;
  return {
    id: M.id, variant: v,
    aspect: A.w / A.h,
    // stretch: a feed that scales (an LED processor) fills its window exactly as the layout says
    outputs: pairs.map(({ o, t }) => ({ name: o.id, crop: crop(t), fit: 'stretch' })),
    skipped,
    /** An align calibration (either format name) → an open-audiovisual/output@1 document, four corners per output. */
    toOutputLayout(calibration) {
      if (!isCalibration(calibration)) throw new Error(`[align] toOutputLayout: not a calibration (${CALIBRATION_FORMAT})`);
      const zones = zonesOf(calibration), outputs = {};
      for (const { o, t } of pairs) outputs[o.id] = zoneToRoom(zones[t.name], t, o).room;
      return { format: OUTPUT_FORMAT, ...(calibration.savedAt ? { saved: calibration.savedAt } : {}), outputs };
    },
    /** An output layout file → an align calibration: each output's corners into its tile's zone, the rest from base (or defaults). */
    fromOutputLayout(doc, base = null) {
      const d = parseOutputLayout(doc);
      const cal = normalizeCalibration(base, M, v), zones = cal.variants[v].zones;
      for (const { o, t } of pairs) if (d.outputs[o.id]) zones[t.name] = roomToZone(d.outputs[o.id], t, o, zones[t.name]).zone;
      return cal;
    },
    /** For each output, what its room cannot carry of the calibration: { name: ['mesh', 'feather', …] } (only outputs that lose something). */
    lost(calibration) {
      const zones = zonesOf(calibration), out = {};
      for (const { o, t } of pairs) { const l = lostInRoom(zones[t.name]); if (l.length) out[o.id] = l; }
      return out;
    },
  };
}
