#!/usr/bin/env node
// leap-bridge — the one Leap Motion bridge on this machine. Zero dependencies (Node built-ins +
// the hand-rolled RFC 6455 codec in packages/relay/frames.js).
//
//   node packages/leap/bridge/leap-bridge.mjs            real sensor (compiles leap-stream on first run)
//   node packages/leap/bridge/leap-bridge.mjs --mock     two animated hands, no sensor needed
//   options: --port 6437 (0 = any free port) · --hz 60 · --bin <leap-stream> · --quiet
//   env:     LEAP_BRIDGE_PORT, LEAP_SDK (another LeapSDK folder)
//
// Endpoints, all on 127.0.0.1 only (loopback — hand data never leaves the machine):
//   ws://127.0.0.1:6437/v6.json   LeapJS protocol (also /v7.json → answered as v6, /v1–v5.json as asked):
//                                 header {serviceVersion, version, bridge}, device events, frames.
//                                 Every 2014–2021 browser sketch built on leap.js connects here by itself.
//   ws://127.0.0.1:6437/raw       The Last Input's raw lines, verbatim: {"t":"status",…} and {"t":"f",…}
//   GET /raw, GET /hands          the same lines as Server-Sent Events (TLI's hand-bridge.js served /hands)
//   GET /health                   JSON: source, service, device, fps, hands, clients, reader
//
// Latest frame only, at most --hz per second: a slow client skips frames, it never queues them.
// Port 7457 belongs to The Last Input (and OAV's monitor) — the bridge refuses it.

import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { FrameParser, OP, encodeFrame, handshakeResponse } from '../../relay/frames.js';
import { V6Converter, v6Header, deviceEvent, protocolOfPath } from '../frame.js';
import { mockFrame } from '../mock.js';
import { ensureBinary } from './build.mjs';

export const DEFAULT_PORT = 6437;
export const RESERVED_PORTS = [7457];
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
const VERSION = '1.0.0';

/**
 * Start a bridge. Resolves once listening: { port, close(), state }.
 * @param {object} o
 * @param {number} [o.port=6437]   0 = any free port (tests)
 * @param {string} [o.host='127.0.0.1']  loopback only
 * @param {boolean} [o.mock=false]
 * @param {number} [o.hz=60]
 * @param {string} [o.bin]         leap-stream binary (default: build.mjs's cached build)
 * @param {(s:string)=>void} [o.log]
 */
export function startBridge({ port = DEFAULT_PORT, host = '127.0.0.1', mock = false, hz = 60, bin = null, log = () => {} } = {}) {
  if (RESERVED_PORTS.includes(Number(port))) throw new Error(`port ${port} belongs to The Last Input — the Leap bridge lives on ${DEFAULT_PORT}`);
  if (!LOOPBACK.has(host)) throw new Error(`the Leap bridge binds loopback only (got ${host})`);
  const started = Date.now();
  const state = {
    source: mock ? 'mock' : 'leap',
    service: mock ? true : null,        // null = not heard from the reader yet
    device: mock ? 'mock' : null,
    serviceVersion: mock ? 'mock' : null,
    fps: 0, hands: 0, frames: 0, lastFrameAt: 0,
    reader: { pid: null, restarts: 0, binary: null, error: null },
  };
  const clients = { v6: new Set(), raw: new Set(), sse: new Set() };
  const conv = new V6Converter();
  let latest = null, latestLine = null;
  let child = null, closing = false, restartTimer = null, statusTimer = null, backoff = 500;

  // ---------------------------------------------------------------- reader lines
  const statusLine = () => JSON.stringify({ t: 'status', service: state.service !== false, device: state.device });
  const devEvent = () => JSON.stringify(deviceEvent({ device: state.device, service: state.service !== false }));
  function onStatusChange() {
    const line = statusLine(), ev = devEvent();
    for (const c of clients.raw) send(c, line);
    for (const res of clients.sse) res.write(`data: ${line}\n\n`);
    for (const c of clients.v6) if (c.version >= 5) send(c, ev);
  }
  function onLine(line) {
    if (!line) return;
    let msg; try { msg = JSON.parse(line); } catch { return; }
    if (msg.t === 'f') {
      latest = msg; latestLine = line;
      state.fps = msg.fps; state.hands = msg.hands.length; state.frames++; state.lastFrameAt = Date.now();
      if (state.service !== true) { state.service = true; onStatusChange(); }
    } else if (msg.t === 'status') {
      const was = statusLine();
      state.service = msg.service;
      if (msg.device !== undefined) state.device = msg.device;
      if (!msg.service) { state.device = null; latest = null; state.hands = 0; }
      if (statusLine() !== was) { onStatusChange(); log(`[leap] status service=${state.service} device=${state.device}`); }
    } else if (msg.t === 'info') {
      state.serviceVersion = msg.server || state.serviceVersion;
    }
  }

  function startReader() {
    if (closing) return;
    let binary = bin;
    if (!binary) {
      try { binary = ensureBinary({ log }); } catch (e) {
        state.reader.error = e.message; state.service = false; onStatusChange();
        log(`[leap] ${e.message} — retrying in 30 s`);
        restartTimer = setTimeout(startReader, 30000);
        return;
      }
    }
    state.reader.binary = binary;
    const t0 = Date.now();
    child = spawn(binary, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    state.reader.pid = child.pid; state.reader.error = null;
    let buf = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
    });
    child.stderr.on('data', (d) => log(`[leap-stream] ${String(d).trim()}`));
    // no word from the service within 3 s → it is not running (LeapC just keeps waiting)
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { if (state.service == null) { state.service = false; onStatusChange(); log('[leap] no tracking service answered (is Ultraleap Hand Tracking running?)'); } }, 3000);
    child.on('error', (e) => { state.reader.error = e.message; log(`[leap] cannot start ${binary}: ${e.message}`); });
    child.on('exit', (code, sig) => {
      child = null; state.reader.pid = null;
      if (closing) return;
      state.reader.restarts++;
      if (Date.now() - t0 > 10000) backoff = 500;           // it ran fine for a while: restart quickly
      log(`[leap] leap-stream exited (${code ?? sig}); restarting in ${backoff} ms`);
      state.service = null; state.device = null; latest = null; state.hands = 0; onStatusChange();
      restartTimer = setTimeout(startReader, backoff);
      backoff = Math.min(10000, backoff * 2);
    });
  }

  function startMock() {
    const t0 = Date.now();
    let id = 0;
    const timer = setInterval(() => {
      const f = mockFrame((Date.now() - t0) / 1000, ++id);
      onLine(JSON.stringify(f));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }

  // ---------------------------------------------------------------- fan-out (latest only)
  function send(c, text) {
    if (c.socket.destroyed) return;
    if (c.socket.writableLength > 1 << 20) return;              // a stuck client skips frames
    try { c.socket.write(encodeFrame(text)); } catch {}
  }
  // each client remembers the last frame id it got, so a frame is never sent twice (a new client
  // already got the current one on connect) and v6 is converted once per frame for everyone
  let v6Text = null, v6Id = null;
  const v6Of = () => { if (v6Id !== latest.id) { v6Id = latest.id; v6Text = JSON.stringify(conv.convert(latest)); } return v6Text; };
  const tick = setInterval(() => {
    if (!latest) return;
    const id = latest.id;
    for (const c of clients.raw) if (c.lastId !== id) { c.lastId = id; send(c, latestLine); }
    for (const res of clients.sse) if (res.lastId !== id) { res.lastId = id; res.write(`data: ${latestLine}\n\n`); }
    for (const c of clients.v6) if (c.lastId !== id) { c.lastId = id; send(c, v6Of()); }
  }, 1000 / Math.max(1, Math.min(120, hz)));

  // ---------------------------------------------------------------- HTTP
  const health = () => ({
    ok: true, bridge: 'open-audiovisual leap-bridge', version: VERSION, source: state.source, port: actualPort,
    service: state.service, device: state.device, serviceVersion: state.serviceVersion,
    fps: state.fps, hands: state.hands, frames: state.frames,
    lastFrameAgoMs: state.lastFrameAt ? Date.now() - state.lastFrameAt : null,
    clients: { v6: clients.v6.size, raw: clients.raw.size, sse: clients.sse.size },
    reader: state.reader, uptimeS: Math.round((Date.now() - started) / 1000),
  });
  const server = http.createServer((req, res) => {
    // any origin may read (as the original Leap service allowed); Chrome's local-network preflight answered yes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' });
      return res.end();
    }
    const url = new URL(req.url || '/', 'http://x');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(health()));
    }
    if (url.pathname === '/raw' || url.pathname === '/hands') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`data: ${statusLine()}\n\n`);
      clients.sse.add(res);
      req.on('close', () => clients.sse.delete(res));
      return;
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`open-audiovisual leap-bridge ${VERSION} (${state.source})\n\n` +
        `ws://127.0.0.1:${actualPort}/v6.json   LeapJS protocol (legacy leap.js sketches, @openav/leap LeapInput)\n` +
        `ws://127.0.0.1:${actualPort}/raw       raw hand lines (The Last Input format)\n` +
        `GET /raw, /hands                    the same raw lines as Server-Sent Events\n` +
        `GET /health                         status JSON\n`);
    }
    res.writeHead(404); res.end();
  });

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url || '/', 'http://x');
    const key = req.headers['sec-websocket-key'];
    const asked = protocolOfPath(url.pathname);
    const kind = url.pathname === '/raw' ? 'raw' : asked != null ? 'v6' : null;
    if (!key || !kind) { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
    socket.write(handshakeResponse(key));
    socket.setNoDelay(true);
    const c = { socket, kind, version: asked ? Math.min(6, Math.max(1, asked)) : null, opts: {} };
    clients[kind].add(c);
    log(`[leap] + ${kind}${c.version ? ' v' + c.version : ''} (${clients.v6.size + clients.raw.size} ws)`);
    if (kind === 'v6') {
      send(c, JSON.stringify({ ...v6Header(state.serviceVersion || 'unknown', c.version), bridge: 'open-audiovisual' }));
      if (c.version >= 5) send(c, devEvent());
    } else send(c, statusLine());
    if (latest) {                                            // a new client sees hands right away
      c.lastId = latest.id;
      send(c, kind === 'raw' ? latestLine : v6Of());
    }
    const parser = new FrameParser({ maxBytes: 64 * 1024 });
    let alive = true;
    socket.on('data', (chunk) => {
      let msgs;
      try { msgs = parser.push(chunk); } catch { return socket.destroy(); }
      for (const f of msgs) {
        if (f.opcode === OP.CLOSE) { try { socket.end(encodeFrame(Buffer.alloc(0), OP.CLOSE)); } catch {} return; }
        if (f.opcode === OP.PING) { try { socket.write(encodeFrame(f.payload, OP.PONG)); } catch {} continue; }
        if (f.opcode === OP.PONG) { alive = true; continue; }
        if (f.opcode === OP.TEXT) {
          // LeapJS says {enableGestures}, {background}, {focused}, {optimizeHMD}: accepted, remembered, never an error
          try { const m = JSON.parse(f.payload.toString('utf8')); if (m && typeof m === 'object') Object.assign(c.opts, m); } catch {}
        }
      }
    });
    const hb = setInterval(() => {
      if (!alive) return socket.destroy();
      alive = false;
      try { socket.write(encodeFrame(Buffer.alloc(0), OP.PING)); } catch {}
    }, 20000);
    hb.unref?.();
    const drop = () => { clearInterval(hb); if (clients[kind].delete(c)) log(`[leap] - ${kind}`); };
    socket.on('close', drop);
    socket.on('error', drop);
  });

  let actualPort = port;
  let stopMock = null;
  return new Promise((resolve, reject) => {
    server.once('error', (e) => {
      clearInterval(tick);
      reject(e.code === 'EADDRINUSE' ? new Error(`port ${port} is already in use — another leap-bridge (or the old Leap service) is running: curl http://127.0.0.1:${port}/health`) : e);
    });
    server.listen(port, host, () => {
      actualPort = server.address().port;
      if (mock) stopMock = startMock(); else startReader();
      resolve({
        port: actualPort, state, health,
        close() {
          closing = true;
          clearInterval(tick); clearTimeout(restartTimer); clearTimeout(statusTimer);
          stopMock?.();
          if (child) child.kill();
          for (const set of [clients.v6, clients.raw]) for (const c of set) c.socket.destroy();
          for (const res of clients.sse) res.end();
          return new Promise((r) => server.close(() => r()));
        },
      });
    });
  });
}

// ---------------------------------------------------------------- CLI
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const quiet = argv.includes('--quiet');
  const log = (s) => { if (!quiet) console.log(`${new Date().toISOString()} ${s}`); };
  const opts = {
    port: Number(arg('--port', process.env.LEAP_BRIDGE_PORT || DEFAULT_PORT)),
    mock: argv.includes('--mock'),
    hz: Number(arg('--hz', 60)),
    bin: arg('--bin', null),
    log,
  };
  try {
    const b = await startBridge(opts);
    // first stdout line is JSON for programs (tests spawn with --port 0 and read the port)
    console.log(JSON.stringify({ ready: true, port: b.port, source: b.state.source }));
    log(`✋ leap-bridge ${opts.mock ? '(mock) ' : ''}ws://127.0.0.1:${b.port}/v6.json · /raw · /health`);
    const stop = async () => { await b.close(); process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (e) {
    console.error(`✗ leap-bridge: ${e.message}`);
    process.exit(1);
  }
}
