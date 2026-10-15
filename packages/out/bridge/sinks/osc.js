// osc sink — OSC 1.0 over UDP, hand-encoded. address = "/" + channel, one float32 argument.
import dgram from 'node:dgram';

const pad4 = (n) => (n + 4) & ~3;   // string length + at least one NUL, rounded up to a multiple of 4

/** Encode one OSC message with float32 args. encodeOsc('/light/1/r', 0.5) → Buffer. Pure. */
export function encodeOsc(address, ...args) {
  if (typeof address !== 'string' || address[0] !== '/') throw new Error('OSC 位址要以 / 開頭');
  const aLen = pad4(Buffer.byteLength(address));
  const tags = ',' + 'f'.repeat(args.length);
  const tLen = pad4(tags.length);
  const out = Buffer.alloc(aLen + tLen + 4 * args.length);   // zero-filled → the NUL padding comes free
  out.write(address, 0, 'utf8');
  out.write(tags, aLen, 'latin1');
  args.forEach((v, i) => out.writeFloatBE(Number(v), aLen + tLen + 4 * i));
  return out;
}

export function create(cfg, ctx) {
  const host = cfg.host || '127.0.0.1', port = Number(cfg.port || 9000);
  const sock = dgram.createSocket('udp4');
  sock.on('error', (e) => ctx.log(`[osc] ${e.message}`));
  let sent = 0, closed = false;
  return {
    name: 'osc',
    send(ch, v) { if (closed) return; sock.send(encodeOsc('/' + ch, v), port, host); sent++; },
    status: () => ({ state: closed ? 'down' : 'up', target: `${host}:${port}`, sent }),
    close() { closed = true; try { sock.close(); } catch {} },
  };
}
