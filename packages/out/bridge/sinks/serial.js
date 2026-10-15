// serial sink — writes "ch value\n" lines to a /dev/cu.* device (motor boards, Arduino…).
// macOS: the baud rate is set with `stty -f <dev> <baud> raw -echo` before opening. A missing device
// is a status, not an error: state "down", retried every 2 s, the bridge keeps running.
import fs from 'node:fs';
import { execFile } from 'node:child_process';

export const RETRY_MS = 2000;
const fmt = (v) => String(Math.round(v * 1e6) / 1e6);

export function create(cfg, ctx) {
  const path = cfg.path, baud = Number(cfg.baud || 115200), format = cfg.format || 'line';
  if (!path) throw new Error('serial sink 要設 path');
  if (!['line', 'json'].includes(format)) throw new Error(`serial format 只有 line / json（收到 ${format}）`);
  const retryMs = Number(cfg.retryMs || RETRY_MS);
  let state = 'down', fd = null, closed = false, retry = null, writing = false, error = null, written = 0, dropped = 0;
  const pending = new Map();          // ch → latest value; a slow board skips values, never queues them

  const line = (ch, v) => (format === 'json' ? JSON.stringify({ ch, v }) : `${ch} ${fmt(v)}`) + '\n';
  const down = (why) => {
    error = why; state = 'down';
    if (fd != null) { try { fs.closeSync(fd); } catch {} fd = null; }
    writing = false;
    if (!closed && !retry) retry = setTimeout(() => { retry = null; open(); }, retryMs), retry.unref?.();
  };
  function open() {
    if (closed) return;
    fs.access(path, fs.constants.W_OK, (e) => {
      if (e) return down(`${path}: ${e.code || e.message}`);
      execFile('stty', ['-f', path, String(baud), 'raw', '-echo'], { timeout: 3000 }, (e2) => {
        if (closed) return;
        if (e2) return down(`stty: ${e2.message.split('\n')[0]}`);
        fs.open(path, fs.constants.O_WRONLY | fs.constants.O_NOCTTY | fs.constants.O_NONBLOCK, (e3, h) => {
          if (closed) { if (!e3) fs.close(h, () => {}); return; }
          if (e3) return down(`${path}: ${e3.code || e3.message}`);
          fd = h; state = 'up'; error = null; ctx.log(`[serial] ${path} @${baud} up`);
          drain();
        });
      });
    });
  }
  function drain() {
    if (writing || fd == null || !pending.size) return;
    const data = Buffer.from([...pending].map(([c, v]) => line(c, v)).join(''));
    pending.clear(); writing = true;
    fs.write(fd, data, (e, n) => {
      writing = false;
      if (e) { ctx.log(`[serial] write: ${e.code || e.message}`); return down(`write: ${e.code || e.message}`); }
      written += n; drain();
    });
  }
  open();
  return {
    name: 'serial',
    send(ch, v) {
      if (state !== 'up') { dropped++; return; }
      pending.set(ch, v); drain();
    },
    flush: drain,
    status: () => ({ state, path, baud, error, written, dropped }),
    close() { closed = true; clearTimeout(retry); if (fd != null) { try { fs.closeSync(fd); } catch {} fd = null; } },
  };
}
