#!/usr/bin/env node
// monitor server — WebSocket relay for backstage monitoring. Zero dependencies:
// the WebSocket server (RFC 6455, text frames) is hand-rolled on Node built-ins,
// so a stage manager's laptop needs nothing but `node server.js`.
//
//   node server.js [port=7457]
//
// Roles: the performance page connects as ?role=stage and streams JSON snapshots;
// any number of backstage pages connect as ?role=monitor and receive them.
// Also serves backstage.html on plain HTTP at the same port.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || 7457);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const clients = new Set();   // {socket, role}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/' || req.url === '/backstage' || req.url === '/backstage.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'backstage.html')));
  }
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, clients: clients.size }));
  }
  res.writeHead(404); res.end();
});

// ---- minimal RFC6455 ----
const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + MAGIC).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const role = /role=stage/.test(req.url || '') ? 'stage' : 'monitor';
  const client = { socket, role };
  clients.add(client);
  console.log(`[monitor] + ${role} (${clients.size} connected)`);

  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const frame = readFrame(buf);
      if (!frame) break;
      buf = buf.subarray(frame.consumed);
      if (frame.opcode === 8) { socket.end(); return; }       // close
      if (frame.opcode === 9) { socket.write(encodeFrame(frame.payload, 10)); continue; } // ping→pong
      if (frame.opcode === 1 && role === 'stage') broadcast(frame.payload, client);
    }
  });
  const drop = () => { clients.delete(client); console.log(`[monitor] - ${role} (${clients.size})`); };
  socket.on('close', drop);
  socket.on('error', drop);
});

function broadcast(payload, from) {
  const frame = encodeFrame(payload);
  for (const c of clients) {
    if (c === from || c.role !== 'monitor') continue;
    try { c.socket.write(frame); } catch (e) {}
  }
}

/** Parse one client→server frame (masked). Returns {opcode, payload, consumed} or null. */
function readFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = !!(buf[1] & 0x80);
  let len = buf[1] & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  const maskLen = masked ? 4 : 0;
  if (buf.length < off + maskLen + len) return null;
  let payload = buf.subarray(off + maskLen, off + maskLen + len);
  if (masked) {
    const mask = buf.subarray(off, off + 4);
    const un = Buffer.alloc(len);
    for (let i = 0; i < len; i++) un[i] = payload[i] ^ mask[i % 4];
    payload = un;
  }
  return { opcode, payload, consumed: off + maskLen + len };
}

/** Encode a server→client frame (unmasked). */
function encodeFrame(payload, opcode = 1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const len = data.length;
  let head;
  if (len < 126) { head = Buffer.from([0x80 | opcode, len]); }
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, data]);
}

server.listen(PORT, () => {
  console.log(`[monitor] ws+http on :${PORT} — backstage page: http://localhost:${PORT}/`);
  console.log(`[monitor] LAN devices: http://<this-machine-ip>:${PORT}/`);
});
