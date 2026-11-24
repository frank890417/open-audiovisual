// @openav/dmx · protocol/enttec — the frame that makes an Enttec DMX USB Pro (and the interfaces that copy its protocol)
// send one universe out of its DMX port. Pure bytes in, bytes out (no serial port).
// Spec: ENTTEC "DMX USB Pro – API" (v1.44), "Application Message Format" and message 8,
// "Output Only Send DMX Packet Request (Label=6)": data is the start code and the channels, 25 to 513 bytes, and its size
// also sets how many channels the widget sends.

const SOM = 0x7e, EOM = 0xe7;
export const LABEL_SEND_DMX = 6;
const MIN_CHANNELS = 24;                 // 25 data bytes with the start code: the API's smallest packet

/**
 * One "send DMX" frame: 0x7E, label 6, data length (LSB, MSB), start code 0 and the channels, 0xE7.
 * Fewer than 24 channels are padded with zeros to 24.
 * @param {ArrayLike<number>} data  channel values 0..255 (channel 1 first), at most 512
 * @returns {Uint8Array}
 */
export function encodeEnttecDmx(data) {
  const n = data.length;
  if (n > 512) throw new RangeError(`one frame carries at most 512 channels (got ${n})`);
  const channels = Math.max(MIN_CHANNELS, n);
  const len = channels + 1;
  const out = new Uint8Array(len + 5);
  out[0] = SOM;                          // start of message delimiter
  out[1] = LABEL_SEND_DMX;               // label
  out[2] = len & 0xff;                   // data length LSB
  out[3] = len >> 8;                     // data length MSB
  out[4] = 0x00;                         // DMX start code
  for (let i = 0; i < n; i++) {
    const x = data[i];
    if (!Number.isInteger(x) || x < 0 || x > 255) throw new RangeError(`channel ${i + 1} must be an integer 0–255 (got ${x})`);
    out[5 + i] = x;
  }
  out[len + 4] = EOM;                    // end of message delimiter
  return out;
}

/**
 * Read a "send DMX" frame: { startCode, data } with data the channels, or null for another label or a broken frame.
 * @param {ArrayLike<number>} bytes
 */
export function decodeEnttecDmx(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  if (b.length < 6 || b[0] !== SOM || b[1] !== LABEL_SEND_DMX) return null;
  const len = b[2] | (b[3] << 8);
  if (len < 1 || len > 513 || b.length < len + 5 || b[len + 4] !== EOM) return null;
  return { startCode: b[4], data: b.slice(5, 4 + len) };
}
