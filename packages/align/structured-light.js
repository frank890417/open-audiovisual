// @openav/align · structured-light — the pattern generator for camera-in-the-loop alignment: Gray-code stripes, pure and tested.
//
// What this is: the frames to project and the arithmetic between bits and coordinates. Each axis needs ceil(log2 size)
// bits, one black-and-white stripe frame per bit, each with its inverse (a per-pixel threshold that copes with uneven
// light), plus one all-white and one all-black frame: 1920 × 1200 is 11 + 11 bits × 2 + 2 = 46 frames.
// Channel separation: each projector draws only in its own colour channel (R, G or B), so three projectors run at once
// and one photo measures all three; a camera that moves between shots cannot happen, the three come from one photo.
// The frames are drawn in projector (output) pixels, not on the art canvas: what is measured is which projector pixel
// lands where, so they are never warped.
//
// What this is NOT (the roadmap; nothing below is built): capturing the camera, thresholding each pixel, decoding a photo
// into a camera ↔ projector correspondence, solving a warp mesh from it, and the blend brightness field. decodeGrayBits
// is the bits → coordinate step only, for bits someone else has read.

/** Binary → Gray code. */
export const grayEncode = (n) => (n ^ (n >>> 1)) >>> 0;
/** Gray code → binary. */
export function grayDecode(g) {
  let n = g >>> 0;
  for (let s = n >>> 1; s; s >>>= 1) n ^= s;
  return n >>> 0;
}
/** How many bits 0 … size − 1 needs. */
export const bitsFor = (size) => Math.max(1, Math.ceil(Math.log2(Math.max(2, size))));

/**
 * @typedef {{kind:'white'|'black'} | {kind:'gray', axis:'x'|'y', bit:number, nbits:number, inverse:boolean}} GrayFrame
 * bit 0 is the highest bit (the widest stripes); nbits is the axis's number of bits
 */

/**
 * Every frame of one run, in shooting order.
 * @param {{w:number,h:number}} size  the projectors' resolution (with several sizes give the largest: a smaller one's high bits stay 0)
 * @returns {GrayFrame[]}
 */
export function graySequence(size, { inverse = true, refs = true, axes = ['x', 'y'] } = {}) {
  const frames = [];
  if (refs) frames.push({ kind: 'white' }, { kind: 'black' });
  for (const axis of axes) {
    const nbits = bitsFor(axis === 'x' ? size.w : size.h);
    for (let bit = 0; bit < nbits; bit++) {
      frames.push({ kind: 'gray', axis, bit, nbits, inverse: false });
      if (inverse) frames.push({ kind: 'gray', axis, bit, nbits, inverse: true });
    }
  }
  return frames;
}

/**
 * Whether a frame is lit (1) or dark (0) at projector coordinate coord along its axis.
 * @param {GrayFrame} frame
 * @param {number} coord
 * @returns {0|1}
 */
export function grayBitAt(frame, coord) {
  if (frame.kind === 'white') return 1;
  if (frame.kind === 'black') return 0;
  const v = (grayEncode(coord) >>> (frame.nbits - 1 - frame.bit)) & 1;
  return frame.inverse ? 1 - v : v;
}

/**
 * Bits read at one camera pixel, highest first, already 0 or 1 → the projector coordinate. The camera half is not built.
 * @param {Array<0|1|boolean>} bits
 * @returns {number}
 */
export function decodeGrayBits(bits) {
  let g = 0;
  for (const b of bits) g = (g << 1) | (b ? 1 : 0);
  return grayDecode(g);
}

/**
 * A frame's lit runs along its axis, [[start, end), …]: one fillRect each, so the finest bit is size / 4 rectangles.
 * @param {GrayFrame} frame
 * @param {number} size
 * @returns {number[][]}
 */
export function grayRuns(frame, size) {
  const runs = [];
  let start = -1;
  for (let i = 0; i <= size; i++) {
    const on = i < size && grayBitAt(frame, i) === 1;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { runs.push([start, i]); start = -1; }
  }
  return runs;
}

export const CHANNEL_COLORS = { r: '#ff0000', g: '#00ff00', b: '#0000ff', w: '#ffffff' };

/**
 * One colour channel per output (projector), three to a pass (R, G, B); more than three outputs take more passes.
 * @param {object} mapping
 * @returns {Array<Record<string, 'r'|'g'|'b'>>}  each pass: { output id: channel }
 */
export function channelPlan(mapping, { channels = ['r', 'g', 'b'] } = {}) {
  const passes = [];
  mapping.outputs.forEach((o, i) => {
    const p = Math.floor(i / channels.length);
    (passes[p] ||= {})[o.id] = channels[i % channels.length];
  });
  return passes;
}

/**
 * Draw one Gray-code frame over the desktop: each output in its own pixels and its own channel, an output with no channel
 * black. Without assign it draws channelPlan's first pass only.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} mapping
 * @param {GrayFrame} frame
 */
export function drawGrayFrame(ctx, mapping, frame, { assign = channelPlan(mapping)[0], view = { k: 1, x: 0, y: 0 } } = {}) {
  ctx.save();
  ctx.setTransform(view.k, 0, 0, view.k, view.x, view.y);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, mapping.desktop.w, mapping.desktop.h);
  for (const o of mapping.outputs) {
    const ch = assign?.[o.id];
    if (!ch) continue;
    ctx.fillStyle = CHANNEL_COLORS[ch] ?? '#fff';
    if (frame.kind === 'white') { ctx.fillRect(o.x, o.y, o.w, o.h); continue; }
    if (frame.kind === 'black') continue;
    const size = frame.axis === 'x' ? o.w : o.h;
    for (const [a, b] of grayRuns(frame, size)) {
      if (frame.axis === 'x') ctx.fillRect(o.x + a, o.y, b - a, o.h);
      else ctx.fillRect(o.x, o.y + a, o.w, b - a);
    }
  }
  ctx.restore();
}

/**
 * A frame's name for a person: 'X bit 3 of 11 (inverse)'; lang 'zh' gives 'X 位元 3／11（反相）'.
 * @param {GrayFrame} frame
 * @param {'en'|'zh'} [lang]
 * @returns {string}
 */
export function frameLabel(frame, lang = 'en') {
  const zh = lang === 'zh';
  if (frame.kind !== 'gray') return frame.kind === 'white' ? (zh ? '全白（曝光基準）' : 'white (the exposure reference)') : (zh ? '全黑（環境光）' : 'black (the room\'s own light)');
  return zh
    ? `${frame.axis.toUpperCase()} 位元 ${frame.bit + 1}／${frame.nbits}${frame.inverse ? '（反相）' : ''}`
    : `${frame.axis.toUpperCase()} bit ${frame.bit + 1} of ${frame.nbits}${frame.inverse ? ' (inverse)' : ''}`;
}

// ---------------------------------------------------------------- shapes reserved for the camera half (not implemented)
/**
 * @typedef {object} Correspondence  camera pixel ↔ projector pixel, what decoding a photo would give
 * @property {string} output        which output (projector)
 * @property {{w:number,h:number}} camera  the camera image's size
 * @property {Int32Array} px        camera.w × camera.h: projector x, −1 where the camera sees none
 * @property {Int32Array} py        the same, projector y
 *
 * @typedef {object} CalibrationResult  one measured calibration, saved to be loaded again
 * @property {string} layout        layout id
 * @property {'viewer'|'surface'} truth  what "right" means: right for the viewer, or evenly spread on the surface (an artistic choice)
 * @property {Record<string,{mesh:Float32Array, blend:Float32Array|null, black:Float32Array|null}>} outputs  each output's mesh, blend, black level
 * @property {{K:number[], dist:number[]}} camera  the camera's intrinsics and distortion
 * @property {number[]} crosstalk   3×3 channel crosstalk matrix
 * @property {number} residualRms   the residual in camera px: the stop condition
 * @property {string} at            ISO time
 */
