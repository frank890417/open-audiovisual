// enttec sink — DMX out of an Enttec DMX USB Pro (or an interface that speaks its protocol) on a serial device.
// Channels dmx/<universe>/<address> of ONE universe ("universe", 1 by default) fill a 512-byte buffer; each frame is one
// "Output Only Send DMX" message (label 6) from @openav/dmx (protocol/enttec.js), 40 Hz while it changes, once a second while
// it does not. The widget itself keeps repeating the last frame on its DMX port, so the lights hold if the bridge stops.
//
// Opened the way the serial sink opens a device (macOS: `stty -f <dev> <baud> raw -echo`, then a non-blocking write handle).
// The Pro talks USB, so the baud rate does not set the DMX speed; it is only there for the tty. A missing or unplugged
// device is a status, never a crash: state "down", frames dropped (counted), retried every 2 s.
// Frames are binary, so a write that is cut short or told to wait (EAGAIN) finishes that frame before anything else is
// written: two half frames would make the widget lose the start of the next message. A slow port skips frames, the latest wins.
// An Enttec Open DMX (a bare FTDI chip with no processor, the computer timing the break itself) is not this protocol and
// is not supported.
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { encodeEnttecDmx } from '../../../dmx/protocol/enttec.js?v=7229c5d3';
import { DmxFrames, flashGuardOf } from './dmx-frames.js?v=7229c5d3';

export const RETRY_MS = 2000;

/** Write a whole buffer to a non-blocking fd: short writes continue, EAGAIN waits 2 ms and tries again. */
function writeAll(fd, buf, cb) {
  let off = 0;
  const step = () => fs.write(fd, buf, off, buf.length - off, null, (e, n) => {
    if (e && (e.code === 'EAGAIN' || e.code === 'EWOULDBLOCK')) return void setTimeout(step, 2);
    if (e) return cb(e);
    off += n;
    if (off < buf.length) return void setImmediate(step);
    cb(null);
  });
  step();
}

/** The default way to open the device: (path, baud, cb(err, { write(buf, cb), close() })). */
export function openSerialPort(path, baud, cb) {
  fs.access(path, fs.constants.W_OK, (e) => {
    if (e) return cb(new Error(`${path}: ${e.code || e.message}`));
    execFile('stty', [process.platform === 'linux' ? '-F' : '-f', path, String(baud), 'raw', '-echo'], { timeout: 3000 }, (e2) => {
      if (e2) return cb(new Error(`stty: ${e2.message.split('\n')[0]}`));
      fs.open(path, fs.constants.O_WRONLY | fs.constants.O_NOCTTY | fs.constants.O_NONBLOCK, (e3, fd) => {
        if (e3) return cb(new Error(`${path}: ${e3.code || e3.message}`));
        cb(null, { write: (buf, done) => writeAll(fd, buf, done), close: () => { try { fs.closeSync(fd); } catch {} } });
      });
    });
  });
}

/**
 * @param {object} cfg  { path, universe = 1, baud = 57600, retryMs = 2000 }
 * @param {object} ctx  { log }
 * @param {object} [deps]  { openPort } (tests hand in a fake port)
 */
export function create(cfg, ctx, { openPort = openSerialPort } = {}) {
  const path = cfg.path;
  if (!path) throw new Error('enttec sink 要設 path（例如 /dev/cu.usbserial-EN123456）');
  const universe = cfg.universe === undefined ? 1 : Number(cfg.universe);
  if (!(Number.isInteger(universe) && universe >= 0 && universe <= 63999)) throw new Error(`enttec universe 要是 0–63999 的整數（收到 ${cfg.universe}）`);
  const baud = Number(cfg.baud || 57600), retryMs = Number(cfg.retryMs || RETRY_MS);
  const flashGuard = flashGuardOf(cfg, 'enttec');   // on unless the route says "flashGuard": false (dmx-frames.js says what it holds); checked before any socket opens
  let state = 'down', port = null, closed = false, retry = null, writing = false, pending = null, error = null, written = 0, dropped = 0;

  const down = (why) => {
    error = why; state = 'down';
    if (port) { try { port.close(); } catch {} port = null; }
    writing = false; pending = null;
    if (!closed && !retry) { retry = setTimeout(() => { retry = null; open(); }, retryMs); retry.unref?.(); }
  };
  function open() {
    if (closed) return;
    openPort(path, baud, (e, p) => {
      if (closed) { if (p) try { p.close(); } catch {} return; }
      if (e) return down(e.message);
      port = p; state = 'up'; error = null; ctx.log(`[enttec] ${path} up (universe ${universe})`);
      // what the page last said, at once; nothing at all before the page has said anything (no dark frame that would also
      // send every moving head to pan 0 at each start or replug)
      if (frames.universes.includes(universe)) write(encodeEnttecDmx(frames.sent(universe)));
    });
  }
  const finish = () => { const p = port; port = null; state = 'down'; if (p) try { p.close(); } catch {} };
  function write(frame) {
    if (!port || state !== 'up') { dropped++; return; }
    if (writing) { pending = frame; return; }                  // the frame on its way finishes first; then only the newest
    writing = true;
    port.write(frame, (e) => {
      writing = false;
      if (e) { ctx.log(`[enttec] write: ${e.code || e.message}`); return down(`write: ${e.code || e.message}`); }
      written++;
      if (pending) { const next = pending; pending = null; return write(next); }
      if (closed) finish();                                      // the last frame (the safe values) has left: now let go
    });
  }
  const frames = new DmxFrames({
    flashGuard,
    accept: (u) => u === universe,
    onError: (e) => ctx.log(`[enttec] ${e.message}`),
    emit: (u, data) => write(encodeEnttecDmx(data)),
  });
  open();
  return {
    name: 'enttec',
    send(ch, v) { if (!closed && frames.set(ch, v)) frames.start(); },
    flush: () => frames.flush(),
    status: () => ({ state, path, universe, error, written, dropped, ...frames.stats() }),
    close() {
      if (closed) return;
      frames.flush(); frames.stop();
      closed = true; clearTimeout(retry);
      if (!writing) finish(); else { const t = setTimeout(finish, 200); t.unref?.(); }   // a frame on its way finishes first
    },
  };
}
