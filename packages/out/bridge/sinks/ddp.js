// ddp sink — WLED's DDP (Distributed Display Protocol) over UDP, port 4048.
// Channels light/<i>/r|g|b (0..1, i = pixel index from 0 unless cfg.base says otherwise) fill an RGB buffer;
// the buffer goes out at most 60 times a second, only while something changed. WLED itself falls back to its
// own effect ~2.5 s after the last packet, which is a second safety net on top of the bridge's watchdog.
import dgram from 'node:dgram';

export const DDP_MAX_DATA = 1440;   // bytes of pixel data per packet (DDP's own convention)

/**
 * One DDP packet: 10-byte header + data. Pure.
 *   byte 0  flags: 0x40 = version 1, 0x01 = push (show the frame)
 *   byte 1  sequence (low nibble, 0 = none)
 *   byte 2  data type (0x01 = RGB)    byte 3  destination id (1 = default output)
 *   bytes 4–7  offset (uint32 BE)     bytes 8–9  data length (uint16 BE)
 */
export function encodeDdp(data, { offset = 0, seq = 0, push = true } = {}) {
  const d = Buffer.from(data);
  if (d.length > 0xffff) throw new Error('DDP 單包資料太長');
  const out = Buffer.alloc(10 + d.length);
  out[0] = 0x40 | (push ? 0x01 : 0);
  out[1] = seq & 0x0f;
  out[2] = 0x01;
  out[3] = 0x01;
  out.writeUInt32BE(offset, 4);
  out.writeUInt16BE(d.length, 8);
  d.copy(out, 10);
  return out;
}

/** A whole frame as 1+ packets (only the last carries the push flag). */
export function ddpFrame(buf, seq = 1) {
  const packets = [];
  for (let off = 0; ; off += DDP_MAX_DATA) {
    const last = off + DDP_MAX_DATA >= buf.length;
    packets.push(encodeDdp(buf.subarray(off, off + DDP_MAX_DATA), { offset: off, seq, push: last }));
    if (last) break;
  }
  return packets;
}

const CH = /^light\/(\d+)\/([rgb])$/;

export function create(cfg, ctx) {
  const host = cfg.host, port = Number(cfg.port || 4048), pixels = Number(cfg.pixels || 60), base = Number(cfg.base || 0);
  if (!host) throw new Error('ddp sink 要設 host');
  if (!(pixels >= 1 && pixels <= 10000)) throw new Error('ddp pixels 要在 1–10000');
  if ((cfg.map || 'rgb-index') !== 'rgb-index') throw new Error(`ddp 只有 map: "rgb-index"（收到 ${cfg.map}）`);
  const buf = Buffer.alloc(pixels * 3);
  const sock = dgram.createSocket('udp4');
  sock.on('error', (e) => ctx.log(`[ddp] ${e.message}`));
  let seq = 0, timer = null, closed = false, frames = 0, ignored = 0;
  const MIN_MS = 1000 / 60;
  let lastFlush = 0;

  function flush() {
    clearTimeout(timer); timer = null;
    if (closed) return;
    seq = (seq % 15) + 1;
    for (const p of ddpFrame(buf, seq)) sock.send(p, port, host);
    frames++; lastFlush = Date.now();
  }
  return {
    name: 'ddp',
    send(ch, v) {
      const m = CH.exec(ch);
      if (!m) { ignored++; return; }
      const i = Number(m[1]) - base;
      if (i < 0 || i >= pixels) { ignored++; return; }
      buf[i * 3 + 'rgb'.indexOf(m[2])] = Math.round(Math.min(1, Math.max(0, v)) * 255);
      if (!timer && !closed) timer = setTimeout(flush, Math.max(0, MIN_MS - (Date.now() - lastFlush)));
    },
    flush,
    status: () => ({ state: closed ? 'down' : 'up', target: `${host}:${port}`, pixels, frames, ignored }),
    close() { clearTimeout(timer); closed = true; try { sock.close(); } catch {} },
  };
}
