// createShow options that are plain data, turned into what the parts they configure take. Pure (no DOM), so it is tested
// in node: tests/show-options.test.js.

/**
 * `loop`: who drives the frames.
 *   undefined | 'auto'   the page's requestAnimationFrame (and the hidden-tab Worker): what a show always did
 *   'manual'             nothing runs by itself: call show.loop.step(dt) once per frame (a recorder, a test, a headless night)
 *   { clock, raf, maxDt, heartbeat, manual }   the options of `new Loop(fn, …)` as they are, e.g. a fake clock and raf
 * @returns {object} the options for `new Loop(frame, …)`
 */
export function loopOptions(loop) {
  if (loop == null || loop === 'auto') return {};
  if (loop === 'manual') return { manual: true };
  if (typeof loop === 'object' && !Array.isArray(loop)) return { ...loop };
  throw new Error(`createShow: loop must be 'auto', 'manual' or { clock, raf, maxDt, manual, heartbeat }, got ${JSON.stringify(loop)}`);
}

/**
 * `monitor`: the backstage feed (@openav/monitor).
 *   undefined | true     the default feed: this machine's relay on port 7457 (none on an https page)
 *   false                no feed: the page never opens a socket to a relay
 *   { url, hz }          the relay's address (ws://host:7457, wss://… behind TLS; `null` = a feed that never connects) and how
 *                        often a snapshot goes out (default 15)
 * @returns {object|null} the options for `new MonitorFeed(…)`, or null for no feed
 */
export function monitorOptions(monitor) {
  if (monitor === false) return null;
  if (monitor == null || monitor === true) return {};
  if (typeof monitor !== 'object' || Array.isArray(monitor)) throw new Error(`createShow: monitor must be false, true or { url, hz }, got ${JSON.stringify(monitor)}`);
  const { url, hz } = monitor;
  if (url !== undefined && url !== null && (typeof url !== 'string' || !/^(wss?:\/\/|\/)/.test(url))) {
    throw new Error(`createShow: monitor.url must be a ws:// or wss:// address (or null for none), got ${JSON.stringify(url)}`);
  }
  if (hz !== undefined && !(Number.isFinite(hz) && hz > 0)) throw new Error(`createShow: monitor.hz must be a number above 0, got ${JSON.stringify(hz)}`);
  return { ...(url !== undefined ? { url } : {}), ...(hz !== undefined ? { hz } : {}) };
}
