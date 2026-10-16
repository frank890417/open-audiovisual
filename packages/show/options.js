// createShow options that are plain data, turned into what the parts they configure take. Pure (no DOM), so it is tested
// in node: tests/show-options.test.js.

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
