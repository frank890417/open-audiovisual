// @openav/dmx · protocol/sacn — the E1.31 (sACN) data packet that carries one universe. Pure bytes in, bytes out (no socket).
// Spec: ANSI E1.31 "Lightweight streaming protocol for transport of DMX512 using ACN", E1.31 Data Packet: Root Layer,
// E1.31 Framing Layer, DMP Layer. ESTA's PDF could not be read for this file (it refuses automated fetches), so every offset
// and constant below was checked against two independent implementations instead: ETCLabs/sACN (src/sacn/private/pdu.h)
// and hhromic/libe131 (src/e131.c). UDP port 5568; multicast group 239.255.<universe high byte>.<universe low byte>.

export const SACN_PORT = 5568;
const ACN_PID = [0x41, 0x53, 0x43, 0x2d, 0x45, 0x31, 0x2e, 0x31, 0x37, 0x00, 0x00, 0x00];   // "ASC-E1.17\0\0\0"
const VECTOR_ROOT_E131_DATA = 0x00000004;
const VECTOR_E131_DATA_PACKET = 0x00000002;
const VECTOR_DMP_SET_PROPERTY = 0x02;
const HEADER = 126;                       // octets before the first slot
const FRAMING = 38, DMP = 115;            // where the framing and DMP layers start
const OPT_PREVIEW = 0x80, OPT_TERMINATED = 0x40;
const flagsLength = (len) => 0x7000 | (len & 0x0fff);   // flags 0x7, then the length of this layer to the end of the packet

function checkInt(v, lo, hi, what) {
  if (!Number.isInteger(v) || v < lo || v > hi) throw new RangeError(`${what} must be an integer ${lo}–${hi} (got ${v})`);
}

/** UTF-8 of the source name, cut at a character boundary to fit 63 bytes (the 64th stays 0: null-terminated). */
function nameBytes(name) {
  const enc = new TextEncoder();
  let s = String(name);
  let b = enc.encode(s);
  while (b.length > 63) { s = [...s].slice(0, -1).join(''); b = enc.encode(s); }
  return b;
}

/**
 * One E1.31 data packet for 1..512 slots (start code 0).
 * @param {ArrayLike<number>} data  slot values 0..255 (slot 1 first)
 * @returns {Uint8Array}  126 + data.length bytes
 */
export function encodeSacn(data, { universe = 1, cid, source = 'open-audiovisual', priority = 100, sequence = 0, preview = false, terminated = false } = {}) {
  const n = data.length;
  if (n < 1 || n > 512) throw new RangeError(`an E1.31 packet carries 1–512 slots (got ${n})`);
  checkInt(universe, 1, 63999, 'sACN universe');
  checkInt(priority, 0, 200, 'sACN priority');
  checkInt(sequence, 0, 255, 'sequence');
  if (!cid || cid.length !== 16) throw new TypeError('cid is 16 bytes (a UUID that stays the same for one sender)');
  const total = HEADER + n;
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  // Root Layer
  v.setUint16(0, 0x0010);                                // Preamble Size
  v.setUint16(2, 0x0000);                                // Post-amble Size
  out.set(ACN_PID, 4);                                   // ACN Packet Identifier (12)
  v.setUint16(16, flagsLength(total - 16));              // Flags & Length, from here to the end
  v.setUint32(18, VECTOR_ROOT_E131_DATA);                // Vector
  for (let i = 0; i < 16; i++) { checkInt(cid[i], 0, 255, 'cid byte'); out[22 + i] = cid[i]; }   // CID (16)
  // E1.31 Framing Layer
  v.setUint16(FRAMING, flagsLength(total - FRAMING));    // Flags & Length
  v.setUint32(40, VECTOR_E131_DATA_PACKET);              // Vector
  out.set(nameBytes(source), 44);                        // Source Name (64, UTF-8, null-terminated)
  out[108] = priority;                                   // Priority (0–200, default 100)
  v.setUint16(109, 0);                                   // Synchronization Address (0: not synchronized)
  out[111] = sequence;                                   // Sequence Number
  out[112] = (preview ? OPT_PREVIEW : 0) | (terminated ? OPT_TERMINATED : 0);   // Options: bit 7 preview, bit 6 stream terminated
  v.setUint16(113, universe);                            // Universe (1–63999)
  // DMP Layer
  v.setUint16(DMP, flagsLength(total - DMP));            // Flags & Length
  out[117] = VECTOR_DMP_SET_PROPERTY;                    // Vector
  out[118] = 0xa1;                                       // Address Type & Data Type
  v.setUint16(119, 0x0000);                              // First Property Address
  v.setUint16(121, 0x0001);                              // Address Increment
  v.setUint16(123, n + 1);                               // Property value count: the start code plus the slots
  out[125] = 0x00;                                       // START Code (0: dimmer data)
  for (let i = 0; i < n; i++) { checkInt(data[i], 0, 255, `slot ${i + 1}`); out[HEADER + i] = data[i]; }
  return out;
}

/**
 * Read an E1.31 data packet: { universe, priority, sequence, source, cid, preview, terminated, startCode, data },
 * or null for anything else (another vector, a wrong identifier, layer lengths that do not match the packet).
 * @param {ArrayLike<number>} bytes
 */
export function decodeSacn(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  if (b.length < HEADER) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint16(0) !== 0x0010 || v.getUint16(2) !== 0) return null;
  for (let i = 0; i < 12; i++) if (b[4 + i] !== ACN_PID[i]) return null;
  if (v.getUint32(18) !== VECTOR_ROOT_E131_DATA || v.getUint32(40) !== VECTOR_E131_DATA_PACKET || b[117] !== VECTOR_DMP_SET_PROPERTY || b[118] !== 0xa1) return null;
  const count = v.getUint16(123);
  const total = HEADER - 1 + count;
  if (count < 1 || count > 513 || b.length < total) return null;
  for (const [at, from] of [[16, 16], [FRAMING, FRAMING], [DMP, DMP]]) if ((v.getUint16(at) & 0x0fff) !== total - from) return null;
  const name = b.subarray(44, 108);
  const end = name.indexOf(0);
  return {
    universe: v.getUint16(113),
    priority: b[108],
    sequence: b[111],
    source: new TextDecoder().decode(end < 0 ? name : name.subarray(0, end)),
    cid: b.slice(22, 38),
    preview: !!(b[112] & OPT_PREVIEW),
    terminated: !!(b[112] & OPT_TERMINATED),
    startCode: b[125],
    data: b.slice(HEADER, total),
  };
}

/** The multicast group a receiver joins for one universe: 239.255.<high byte>.<low byte>. */
export function sacnAddress(universe) {
  checkInt(universe, 1, 63999, 'sACN universe');
  return `239.255.${universe >> 8}.${universe & 0xff}`;
}
