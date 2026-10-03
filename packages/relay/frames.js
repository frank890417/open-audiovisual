// @openav/relay · frames — RFC 6455 WebSocket framing, hand-rolled, zero dependencies.
//
// Lineage: packages/monitor/server.js (the backstage relay) already carried a
// text-frame-only codec. The audience-device relay needs more of the protocol
// (fragmented messages, close codes, masked frames for tests/clients), so the
// codec moved here as pure functions — no sockets — which makes it testable
// without opening a port. Node-only (uses Buffer / crypto).

import crypto from 'node:crypto';

export const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const OP = { CONT: 0, TEXT: 1, BIN: 2, CLOSE: 8, PING: 9, PONG: 10 };

/** The Sec-WebSocket-Accept value for a client's Sec-WebSocket-Key. */
export function acceptKey(key) {
  return crypto.createHash('sha1').update(key + MAGIC).digest('base64');
}

/** The 101 response that completes the handshake. */
export function handshakeResponse(key) {
  return 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`;
}

/** Encode one frame. Servers send unmasked; pass {mask:true} to emulate a client. */
export function encodeFrame(payload, opcode = OP.TEXT, { mask = false, fin = true } = {}) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const len = data.length;
  const b0 = (fin ? 0x80 : 0) | opcode;
  const m = mask ? 0x80 : 0;
  let head;
  if (len < 126) head = Buffer.from([b0, m | len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = b0; head[1] = m | 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = b0; head[1] = m | 127; head.writeBigUInt64BE(BigInt(len), 2); }
  if (!mask) return Buffer.concat([head, data]);
  const key = crypto.randomBytes(4);
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i++) out[i] = data[i] ^ key[i % 4];
  return Buffer.concat([head, key, out]);
}

/** Parse ONE frame from the front of `buf`. Returns null until a whole frame is present. */
export function readFrame(buf) {
  if (buf.length < 2) return null;
  const fin = !!(buf[0] & 0x80);
  const opcode = buf[0] & 0x0f;
  const masked = !!(buf[1] & 0x80);
  let len = buf[1] & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  const maskLen = masked ? 4 : 0;
  if (buf.length < off + maskLen + len) return null;
  let payload = buf.subarray(off + maskLen, off + maskLen + len);
  if (masked) {
    const key = buf.subarray(off, off + 4);
    const un = Buffer.alloc(len);
    for (let i = 0; i < len; i++) un[i] = payload[i] ^ key[i % 4];
    payload = un;
  }
  return { fin, opcode, payload, consumed: off + maskLen + len };
}

/** Stream parser: feed it TCP chunks, get whole messages back.
 *  Reassembles fragmented messages; control frames (ping/pong/close) may
 *  interleave a fragmented message, exactly as the RFC allows.
 *  A payload over `maxBytes` throws — a phone on the LAN must not be able to
 *  make the stage laptop allocate gigabytes. */
export class FrameParser {
  constructor({ maxBytes = 1 << 20 } = {}) {
    this.buf = Buffer.alloc(0);
    this.maxBytes = maxBytes;
    this._frag = null;          // {opcode, parts[], size}
  }
  /** @returns {{opcode:number, payload:Buffer}[]} */
  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const out = [];
    for (;;) {
      const f = readFrame(this.buf);
      if (!f) break;
      if (f.payload.length > this.maxBytes) throw new Error('frame too large');
      this.buf = this.buf.subarray(f.consumed);
      if (f.opcode >= 8) { out.push({ opcode: f.opcode, payload: f.payload }); continue; }
      if (f.opcode !== OP.CONT) this._frag = { opcode: f.opcode, parts: [], size: 0 };
      if (!this._frag) continue;                 // stray continuation: ignore
      this._frag.parts.push(f.payload);
      this._frag.size += f.payload.length;
      if (this._frag.size > this.maxBytes) throw new Error('message too large');
      if (f.fin) {
        out.push({ opcode: this._frag.opcode, payload: Buffer.concat(this._frag.parts) });
        this._frag = null;
      }
    }
    return out;
  }
}
