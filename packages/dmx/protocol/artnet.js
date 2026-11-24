// @openav/dmx · protocol/artnet — ArtDmx, the Art-Net packet that carries one universe. Pure bytes in, bytes out (no socket).
// Spec: "Art-Net 4 Specification" (Artistic Licence, Protocol Release V1.4, Document Revision 1.4dp 23/10/2025),
// section "ArtDmx" → "ArtDmx packet definition" (p. 63), and "Port-Address" (p. 8). Art-Net™ Designed by and Copyright Artistic Licence.
// UDP port 6454 (0x1936). Unicast to the nodes that subscribe to the universe: the spec allows no broadcast of ArtDmx.

export const ARTNET_PORT = 6454;
const ID = [0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00];   // 'A' 'r' 't' '-' 'N' 'e' 't' 0x00
const OP_DMX = 0x5000;                                          // OpOutput / OpDmx
const PROT_VER = 14;
const HEADER = 18;

function checkInt(v, lo, hi, what) {
  if (!Number.isInteger(v) || v < lo || v > hi) throw new RangeError(`${what} must be an integer ${lo}–${hi} (got ${v})`);
}

/**
 * One ArtDmx packet for up to 512 channel values.
 * @param {ArrayLike<number>} data  channel values 0..255 (channel 1 first); an odd count gets one 0 added, as the length must be even
 * @returns {Uint8Array}
 */
export function encodeArtDmx(data, { universe = 0, sequence = 0, physical = 0 } = {}) {
  const n = data.length;
  if (n > 512) throw new RangeError(`ArtDmx carries at most 512 channels (got ${n})`);
  checkInt(universe, 0, 0x7fff, 'Art-Net Port-Address');          // 15 bits: Net (7) · Sub-Net (4) · Universe (4)
  checkInt(sequence, 0, 255, 'sequence');                          // 0 = sequencing off; a sender counts 1..255
  checkInt(physical, 0, 255, 'physical');
  const length = Math.max(2, n + (n & 1));                         // "an even number in the range 2 – 512"
  const out = new Uint8Array(HEADER + length);
  // ArtDmx packet definition, field by field:
  out.set(ID, 0);                                                  // 1  ID[8]
  out[8] = OP_DMX & 0xff; out[9] = OP_DMX >> 8;                    // 2  OpCode, low byte first
  out[10] = 0; out[11] = PROT_VER;                                 // 3–4  ProtVerHi, ProtVerLo (14)
  out[12] = sequence;                                              // 5  Sequence
  out[13] = physical;                                              // 6  Physical
  out[14] = universe & 0xff;                                       // 7  SubUni: low byte of the Port-Address (Sub-Net · Universe)
  out[15] = (universe >> 8) & 0x7f;                                // 8  Net: top 7 bits
  out[16] = length >> 8; out[17] = length & 0xff;                  // 9–10  LengthHi, Length (high byte first)
  for (let i = 0; i < n; i++) { checkInt(data[i], 0, 255, `channel ${i + 1}`); out[HEADER + i] = data[i]; }   // 11  Data[Length]
  return out;
}

/**
 * Read an ArtDmx packet: { universe, sequence, physical, version, data } with data a copy of its channel values,
 * or null for anything else (another opcode, a short or inconsistent packet).
 * @param {ArrayLike<number>} bytes
 */
export function decodeArtDmx(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  if (b.length < HEADER) return null;
  for (let i = 0; i < 8; i++) if (b[i] !== ID[i]) return null;
  if ((b[8] | (b[9] << 8)) !== OP_DMX) return null;
  const length = (b[16] << 8) | b[17];
  if (length < 1 || length > 512 || b.length < HEADER + length) return null;
  return {
    universe: ((b[15] & 0x7f) << 8) | b[14],
    sequence: b[12],
    physical: b[13],
    version: (b[10] << 8) | b[11],
    data: b.slice(HEADER, HEADER + length),
  };
}
