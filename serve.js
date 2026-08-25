#!/usr/bin/env node
// dev server — no-cache static file server, zero dependencies.
//
//   node serve.js [port=8080]
//
// Then open http://localhost:8080 (Chrome recommended: WebMIDI + camera).
// Optional companions, each in its own terminal:
//   node packages/monitor/server.js          # backstage monitor relay (:7457)
//   node packages/osc/bridges/osc-bridge.js  # OSC → UDP bridge (:7456)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || 8080);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm', '.md': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  // '/' serves the real landing page (same as GitHub Pages); the generated
  // example list is a fallback for stripped-down checkouts
  if (urlPath === '/') {
    if (fs.existsSync(path.join(ROOT, 'index.html'))) urlPath = '/index.html';
    else return landing(res);
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.join(ROOT, path.normalize(urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404 ' + urlPath); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',   // performance dev: stale code on stage is a nightmare
      'Access-Control-Allow-Origin': '*',   // hosted WebToe fetches local patch files in dev
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`[openav] http://localhost:${PORT} — use Chrome for WebMIDI`));

function landing(res) {
  const dirs = fs.readdirSync(path.join(ROOT, 'examples'), { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name).sort();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!DOCTYPE html><meta charset="utf-8"><title>open-audiovisual</title>
<body style="margin:0;background:#0d1017;color:#cfd6e4;font:15px/1.7 ui-monospace,monospace;padding:40px">
<h1 style="color:#fff">open-audiovisual</h1>
<p>a web-native framework for audiovisual performance — input → mapping → world → output, with a timeline and a backstage.</p>
<ul>${dirs.map(d => `<li><a style="color:#7ea6ff" href="/examples/${d}/">${d}</a></li>`).join('')}</ul>
<p style="color:#667">backstage monitor: <code>node packages/monitor/server.js</code> → <a style="color:#7ea6ff" href="http://localhost:7457">:7457</a>
· osc bridge: <code>node packages/osc/bridges/osc-bridge.js</code></p>
</body>`);
}
