#!/usr/bin/env node
// @openav/relay · server — the room relay. Zero dependencies: Node's `http` plus
// the hand-rolled RFC 6455 codec in frames.js.
//
//   node packages/relay/server.js [port=7458]       standalone
//   import { attachRelay } from '@openav/relay/server'   inside an existing http.Server
//                                                    (serve.js does this, so
//                                                     `node serve.js` is the whole
//                                                     show-night setup)
//
// Clients connect to  ws://host:port/relay?role=controller|runner|monitor&room=<name>&id=<device>
// Wire format and routing rules: see hub.js.

import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { RoomHub } from './hub.js';
import { FrameParser, OP, encodeFrame, handshakeResponse } from './frames.js';

/** Attach the relay to an http.Server. Returns { hub, close() }. */
export function attachRelay(server, { path = '/relay', log = () => {}, heartbeatMs = 20000 } = {}) {
  const hub = new RoomHub();
  const sockets = new Set();

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url || '/', 'http://x');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key) return socket.destroy();
    socket.write(handshakeResponse(key));
    socket.setNoDelay(true);                 // a fader move is 30 bytes; never wait to coalesce it
    sockets.add(socket);

    const parser = new FrameParser();
    let alive = true;
    const peer = hub.join({
      room: url.searchParams.get('room'), role: url.searchParams.get('role'), id: url.searchParams.get('id') || '',
      send: (s) => { if (!socket.destroyed) socket.write(encodeFrame(s)); },
    });
    log(`+ ${peer.role} ${peer.id || '-'} @${peer.room}`);

    socket.on('data', (chunk) => {
      let msgs;
      try { msgs = parser.push(chunk); } catch { return socket.destroy(); }
      for (const f of msgs) {
        if (f.opcode === OP.CLOSE) { socket.end(encodeFrame(Buffer.alloc(0), OP.CLOSE)); return; }
        if (f.opcode === OP.PING) { socket.write(encodeFrame(f.payload, OP.PONG)); continue; }
        if (f.opcode === OP.PONG) { alive = true; continue; }
        if (f.opcode === OP.TEXT) hub.message(peer, f.payload.toString('utf8'));
      }
    });
    const hb = setInterval(() => {
      if (!alive) return socket.destroy();   // half-open phone (screen locked, wifi gone): drop it
      alive = false;
      try { socket.write(encodeFrame(Buffer.alloc(0), OP.PING)); } catch {}
    }, heartbeatMs);
    hb.unref?.();
    const drop = () => { clearInterval(hb); if (sockets.delete(socket)) { hub.leave(peer); log(`- ${peer.role} ${peer.id || '-'} @${peer.room}`); } };
    socket.on('close', drop);
    socket.on('error', drop);
  });

  return {
    hub,
    close() { for (const s of sockets) s.destroy(); sockets.clear(); },
  };
}

// ---- standalone ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = Number(process.argv[2] || 7458);
  const HOST = process.env.RELAY_HOST || undefined;   // RELAY_HOST=127.0.0.1 behind a reverse proxy (TLS, rate limits)
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, rooms: [...relay.hub.rooms.keys()] }));
    }
    res.writeHead(404); res.end();
  });
  const relay = attachRelay(server, { log: (s) => console.log('[relay]', s) });
  server.listen(PORT, HOST, () => console.log(`[relay] ws on ${HOST || '*'}:${PORT}/relay  (health: /health)`));
}
