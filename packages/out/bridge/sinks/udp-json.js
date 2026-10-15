// udp-json sink — one UDP datagram per value: {"ch":"light/1/r","v":0.5}. Mostly for tests and debugging.
import dgram from 'node:dgram';

export function create(cfg, ctx) {
  const host = cfg.host || '127.0.0.1', port = Number(cfg.port);
  if (!port) throw new Error('udp-json sink 要設 port');
  const sock = dgram.createSocket('udp4');
  sock.on('error', (e) => ctx.log(`[udp-json] ${e.message}`));
  let sent = 0, closed = false;
  return {
    name: 'udp-json',
    send(ch, v) { if (closed) return; sock.send(JSON.stringify({ ch, v }), port, host); sent++; },
    status: () => ({ state: closed ? 'down' : 'up', target: `${host}:${port}`, sent }),
    close() { closed = true; try { sock.close(); } catch {} },
  };
}
