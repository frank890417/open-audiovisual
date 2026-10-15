#!/usr/bin/env node
// out-bridge — web-page parameters → physical hardware, through one local process. Zero dependencies
// (Node built-ins + the hand-rolled RFC 6455 codec in packages/relay/frames.js).
//
//   node packages/out/bridge/out-bridge.mjs --config out.json
//   options: --port 6450 (0 = any free port) · --config <json> · --no-watchdog · --quiet
//   env:     OUT_BRIDGE_PORT
//
// Endpoints, loopback only (127.0.0.1):
//   ws://127.0.0.1:6450/out   in : {"type":"hello","id":"<work id>"} · {"type":"set","ch":"light/1/r","v":0.5}
//                                  · {"type":"batch","items":[{"ch":"…","v":…},…]} · {"type":"status"}
//                             out: {"type":"status", …} (on connect, on hello, on request)
//   GET /health               sinks, channel count, clients, time since the last value
//
// Channels are routed by the config's "channels" (first matching glob wins) to a sink: log, udp-json,
// osc, ddp (WLED), serial. Watchdog: a channel that gets no value for "timeoutMs" is sent its "safe"
// value once (only channels with a safe value); when the last client disconnects, every known channel
// with a safe value gets it at once; so does a clean shutdown. Port 7457 belongs to The Last Input.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FrameParser, OP, encodeFrame, handshakeResponse } from '../../relay/frames.js';
import { SINKS } from './sinks/index.js';

export const DEFAULT_PORT = 6450;
export const RESERVED_PORTS = [7457];
export const DEFAULT_TIMEOUT_MS = 500;
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
const VERSION = '1.0.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_CHANNELS = 4096;
const CH_RE = /^[A-Za-z0-9_\-./]{1,128}$/;

/** "light/*" → /^light\/.*$/ (only * is special, and it also crosses slashes). */
export function globToRegExp(glob) {
  return new RegExp('^' + String(glob).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('.*') + '$');
}

export function loadConfig(file) {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`讀不到設定檔 ${file}：${e.message}`); }
  return cfg;
}

/**
 * Start a bridge. Resolves once listening: { port, close(), health(), state }.
 * @param {object} o
 * @param {number} [o.port=6450]        0 = any free port (tests)
 * @param {string} [o.host='127.0.0.1'] loopback only
 * @param {object} [o.config]           { channels, safe, timeoutMs, allowOrigins }
 * @param {boolean} [o.watchdog=true]   false = never send safe values (tests prove the watchdog by turning it off)
 * @param {(s:string)=>void} [o.log]    diagnostics
 * @param {(s:string)=>void} [o.print]  what the "log" sink prints (default stdout)
 */
export function startBridge({ port = DEFAULT_PORT, host = '127.0.0.1', config = null, watchdog = true, log = () => {}, print = (s) => console.log(s) } = {}) {
  if (RESERVED_PORTS.includes(Number(port))) throw new Error(`port ${port} 是 The Last Input 的，輸出橋接用 ${DEFAULT_PORT}`);
  if (!LOOPBACK.has(host)) throw new Error(`輸出橋接只綁 loopback（收到 ${host}）`);
  const cfg = config || { channels: [{ match: '*', sink: 'log' }] };
  if (!Array.isArray(cfg.channels) || !cfg.channels.length) throw new Error('設定檔要有 channels 陣列');
  const timeoutMs = Number(cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!(timeoutMs >= 20)) throw new Error('timeoutMs 至少 20');
  const allowOrigins = Array.isArray(cfg.allowOrigins) ? cfg.allowOrigins : null;

  const ctx = { log, print };
  const routes = cfg.channels.map((r, i) => {
    const mod = SINKS[r.sink];
    if (!r.match || !mod) throw new Error(`channels[${i}]：sink 要是 ${Object.keys(SINKS).join(' / ')}（收到 ${r.sink}），也要有 match`);
    return { re: globToRegExp(r.match), match: r.match, sink: mod.create(r, ctx), label: `${i}:${r.sink}` };
  });
  const safeRules = Object.entries(cfg.safe || {}).map(([g, v]) => {
    if (!Number.isFinite(v)) throw new Error(`safe["${g}"] 要是數字`);
    return { re: globToRegExp(g), v };
  });
  const routeOf = (ch) => routes.find((r) => r.re.test(ch)) || null;
  const safeOf = (ch) => { const s = safeRules.find((r) => r.re.test(ch)); return s ? s.v : null; };

  const started = Date.now();
  const clients = new Set();
  const chans = new Map();          // ch → { v, at, route, safe, safeSent }
  const state = { received: 0, rejected: 0, unrouted: 0, lastAt: 0, safeSent: 0 };

  function put(ch, v) {
    let c = chans.get(ch);
    if (!c) {
      if (chans.size >= MAX_CHANNELS) { state.rejected++; return false; }
      c = { route: routeOf(ch), safe: safeOf(ch), v: null, at: 0, safeSent: false };
      chans.set(ch, c);
    }
    if (!c.route) { state.unrouted++; return true; }
    c.v = v; c.at = Date.now(); c.safeSent = false;
    state.received++; state.lastAt = c.at;
    try { c.route.sink.send(ch, v); } catch (e) { log(`[out] ${c.route.label}: ${e.message}`); }
    return true;
  }
  const flushAll = () => { for (const r of routes) try { r.sink.flush?.(); } catch {} };

  function sendSafe(ch, c, why) {
    if (c.safe == null || !c.route || c.safeSent) return;
    c.safeSent = true; state.safeSent++;
    try { c.route.sink.send(ch, c.safe); } catch (e) { log(`[out] ${c.route.label}: ${e.message}`); }
    log(`[out] safe ${ch}=${c.safe} (${why})`);
  }
  function allSafe(why) {
    for (const [ch, c] of chans) sendSafe(ch, c, why);
    flushAll();
  }
  const wd = watchdog ? setInterval(() => {
    const now = Date.now();
    let any = false;
    for (const [ch, c] of chans) if (c.at && now - c.at > timeoutMs && !c.safeSent && c.safe != null) { sendSafe(ch, c, `${timeoutMs} ms 沒收到值`); any = true; }
    if (any) flushAll();
  }, Math.max(10, Math.min(100, timeoutMs / 4))) : null;

  // ---------------------------------------------------------------- messages
  function statusMsg() {
    return { type: 'status', ok: true, bridge: 'open-audiovisual out-bridge', version: VERSION, timeoutMs, watchdog,
      sinks: Object.fromEntries(routes.map((r) => [r.label, r.sink.status()])), channels: chans.size, clients: clients.size };
  }
  const health = () => ({ ...statusMsg(), type: undefined, port: actualPort, lastReceivedAgoMs: state.lastAt ? Date.now() - state.lastAt : null,
    received: state.received, rejected: state.rejected, unrouted: state.unrouted, safeSent: state.safeSent, uptimeS: Math.round((Date.now() - started) / 1000) });
  function send(c, obj) {
    if (c.socket.destroyed || c.socket.writableLength > 1 << 20) return;
    try { c.socket.write(encodeFrame(JSON.stringify(obj))); } catch {}
  }
  const okValue = (ch, v) => typeof ch === 'string' && CH_RE.test(ch) && typeof v === 'number' && Number.isFinite(v);
  function onMessage(c, text) {
    let m; try { m = JSON.parse(text); } catch { return send(c, { type: 'error', msg: '不是 JSON' }); }
    if (!m || typeof m !== 'object') return;
    if (m.type === 'set') {
      if (!okValue(m.ch, m.v)) { state.rejected++; return send(c, { type: 'error', msg: 'set 要有 ch（a-z0-9_-./）與有限的數字 v' }); }
      put(m.ch, m.v);
    } else if (m.type === 'batch') {
      if (!Array.isArray(m.items)) return send(c, { type: 'error', msg: 'batch 要有 items 陣列' });
      for (const it of m.items.slice(0, 1024)) {
        const [ch, v] = Array.isArray(it) ? it : [it && it.ch, it && it.v];
        if (okValue(ch, v)) put(ch, v); else state.rejected++;
      }
    } else if (m.type === 'hello') {
      c.id = typeof m.id === 'string' ? m.id.slice(0, 80) : null;
      log(`[out] hello ${c.id || '?'}`);
      send(c, statusMsg());
    } else if (m.type === 'status') send(c, statusMsg());
  }

  // ---------------------------------------------------------------- HTTP + WebSocket
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' }); return res.end(); }
    const url = new URL(req.url || '/', 'http://x');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(health()));
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`open-audiovisual out-bridge ${VERSION}\n\nws://127.0.0.1:${actualPort}/out   set / batch / hello\nGET /health   status JSON\n`);
    }
    res.writeHead(404); res.end();
  });
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url || '/', 'http://x');
    const key = req.headers['sec-websocket-key'];
    const origin = req.headers.origin;
    if (!key || url.pathname !== '/out') { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
    if (allowOrigins && origin && !allowOrigins.includes(origin)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); log(`[out] refused origin ${origin}`); return; }
    socket.write(handshakeResponse(key));
    socket.setNoDelay(true);
    const c = { socket, id: null };
    clients.add(c);
    log(`[out] + client (${clients.size})`);
    send(c, statusMsg());
    const parser = new FrameParser({ maxBytes: 256 * 1024 });
    let alive = true;
    socket.on('data', (chunk) => {
      let msgs;
      try { msgs = parser.push(chunk); } catch { return socket.destroy(); }
      for (const f of msgs) {
        if (f.opcode === OP.CLOSE) { try { socket.end(encodeFrame(Buffer.alloc(0), OP.CLOSE)); } catch {} return; }
        if (f.opcode === OP.PING) { try { socket.write(encodeFrame(f.payload, OP.PONG)); } catch {} continue; }
        if (f.opcode === OP.PONG) { alive = true; continue; }
        if (f.opcode === OP.TEXT) onMessage(c, f.payload.toString('utf8'));
      }
    });
    // a page that froze without closing the socket: a ping that is never answered ends the client (→ safe values)
    const hb = setInterval(() => {
      if (!alive) return socket.destroy();
      alive = false;
      try { socket.write(encodeFrame(Buffer.alloc(0), OP.PING)); } catch {}
    }, 10000);
    hb.unref?.();
    const drop = () => {
      clearInterval(hb);
      if (!clients.delete(c)) return;
      log(`[out] - client (${clients.size})`);
      if (!clients.size && watchdog) allSafe('最後一個 client 斷線');
    };
    socket.on('close', drop);
    socket.on('error', drop);
  });

  let actualPort = port;
  return new Promise((resolve, reject) => {
    server.once('error', (e) => {
      clearInterval(wd);
      for (const r of routes) try { r.sink.close(); } catch {}
      reject(e.code === 'EADDRINUSE' ? new Error(`port ${port} 已被佔用——是不是已經有一支 out-bridge 在跑：curl http://127.0.0.1:${port}/health`) : e);
    });
    server.listen(port, host, () => {
      actualPort = server.address().port;
      resolve({
        port: actualPort, state, health,
        close() {
          clearInterval(wd);
          if (watchdog) allSafe('橋接關閉');       // a clean stop leaves the hardware safe
          const closed = new Promise((r) => server.close(() => r()));   // stop accepting first, so nobody reconnects mid-close
          for (const c of clients) c.socket.destroy();
          clients.clear();
          server.closeAllConnections?.();
          // let the sinks' UDP packets for the safe values leave before the sockets close
          return closed.then(() => sleep(30)).then(() => { for (const x of routes) try { x.sink.close(); } catch {} });
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
  try {
    const file = arg('--config', null);
    const b = await startBridge({
      port: Number(arg('--port', process.env.OUT_BRIDGE_PORT || DEFAULT_PORT)),
      config: file ? loadConfig(file) : null,
      watchdog: !argv.includes('--no-watchdog'),
      log,
    });
    // first stdout line is JSON for programs
    console.log(JSON.stringify({ ready: true, port: b.port, config: file || null }));
    log(`out-bridge ws://127.0.0.1:${b.port}/out · /health`);
    const stop = async () => { await b.close(); process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (e) {
    console.error(`✗ out-bridge: ${e.message}`);
    process.exit(1);
  }
}
