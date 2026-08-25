#!/usr/bin/env node
// osc-bridge — HTTP → UDP OSC relay. Zero dependencies (Node built-ins only).
//
//   node osc-bridge.js [httpPort=7456] [targetHost=127.0.0.1] [targetPort=3456]
//
// Browser POSTs {messages: [{addr, args}]} to /osc; each message is encoded as
// a standard OSC packet (floats by default, ints kept as 'i', strings as 's')
// and fired at the target over UDP. GET /health reports the UDP target.

import http from 'node:http';
import dgram from 'node:dgram';

const [httpPort = 7456, host = '127.0.0.1', udpPort = 3456] = process.argv.slice(2);
const sock = dgram.createSocket('udp4');

function pad4(buf) {
  const rem = buf.length % 4;
  return rem === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - rem)]);
}
function oscString(s) { return pad4(Buffer.concat([Buffer.from(String(s), 'utf8'), Buffer.alloc(1)])); }

// Numbers are sent as floats ('f'), strings as 's'. Audio targets (Spat, Reaper,
// TouchDesigner) expect floats for continuous controls; a float-typed 3 is always
// safe, an int-typed 0.5 is impossible — so floats win. Keep it boring.
function encodeOSC(addr, args = []) {
  const tags = [','];
  const parts = [];
  for (const a of args) {
    if (typeof a === 'number') {
      tags.push('f'); const b = Buffer.alloc(4); b.writeFloatBE(a); parts.push(b);
    } else {
      tags.push('s'); parts.push(oscString(a));
    }
  }
  return Buffer.concat([oscString(addr), oscString(tags.join('')), ...parts]);
}

let sent = 0;
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, udp: `${host}:${udpPort}`, sent }));
  }
  if (req.method === 'POST' && req.url === '/osc') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const { messages = [] } = JSON.parse(body || '{}');
        for (const m of messages) {
          const pkt = encodeOSC(m.addr, m.args || []);
          sock.send(pkt, Number(udpPort), host);
          sent++;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, n: messages.length }));
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(Number(httpPort), () => {
  console.log(`[osc-bridge] http :${httpPort} → udp ${host}:${udpPort}`);
});
