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

/** The modules that make input. A follower page takes none of its own (the leader is the only one that plays), so `sync` switches these off for it. */
export const SYNC_INPUT_MODULES = ['midi', 'keys', 'drums', 'audio', 'hands', 'pose', 'leap', 'remote'];
const SYNC_KEYS = ['role', 'channel', 'url', 'input', 'id', 'now', 'follow', 'extra', 'state', 'hz', 'onHello', 'info', 'accept', 'onFrame', 'onState', 'onGap', 'resync', 'helloEvery', 'takeoverAfter', 'resyncAfter'];
const SYNC_FUNCTIONS = ['now', 'extra', 'state', 'onHello', 'accept', 'onFrame', 'onState', 'onGap'];

/**
 * `sync`: this page is one of several that perform the same show (@openav/sync).
 *   undefined | null | false   no sync: the page runs alone, exactly as before
 *   { role: 'leader' | 'follower', channel: 'name', url?, input?, … }
 *       role     the leader runs the show and says where it is every frame; a follower's timeline chases it
 *       channel  the BroadcastChannel name and the relay room (1–32 letters, digits, - or _)
 *       url      none: a BroadcastChannel (pages of one browser on one machine). true: this page's own /relay (`node serve.js`).
 *                'ws://host:port/relay': a relay on another machine
 *       input    whether this page takes input of its own (keyboard piano, MIDI, microphone, camera, phones). Default: the leader
 *                does, a follower does not (SYNC_INPUT_MODULES are switched off for it)
 *       extra, state, hz, onHello          leader: data that travels with the clock; see SyncLeader
 *       info, accept, onFrame, onState, onGap, resync, helloEvery, takeoverAfter, resyncAfter   follower: see SyncFollower
 *       follow   { nudge, deadband, jump, lostAfter, latency, onFollow }: Timeline.follow()'s options
 *       id, now  the peer id and the clock (a test's fake clock)
 * @returns {object|null} the options for createSync() (plus `input`), or null for no sync
 */
export function syncOptions(sync) {
  if (sync === undefined || sync === null || sync === false) return null;
  if (typeof sync !== 'object' || Array.isArray(sync)) throw new Error(`createShow: sync must be false or { role, channel, url, … }, got ${JSON.stringify(sync)}`);
  for (const k of Object.keys(sync)) {
    if (!SYNC_KEYS.includes(k)) throw new Error(`createShow: sync.${k} is not an option (allowed: ${SYNC_KEYS.join(', ')})`);
  }
  const { role, channel, url, input } = sync;
  if (role !== 'leader' && role !== 'follower') throw new Error(`createShow: sync.role must be 'leader' or 'follower', got ${JSON.stringify(role)}`);
  if (typeof channel !== 'string' || !/^[\w-]{1,32}$/.test(channel)) throw new Error(`createShow: sync.channel must be a name of 1–32 letters, digits, - or _ (the BroadcastChannel and the relay room), got ${JSON.stringify(channel)}`);
  if (url !== undefined && url !== null && url !== true && !(typeof url === 'string' && /^wss?:\/\//.test(url))) {
    throw new Error(`createShow: sync.url must be a ws:// or wss:// relay address, true (this page's own /relay) or nothing (a BroadcastChannel), got ${JSON.stringify(url)}`);
  }
  if (input !== undefined && typeof input !== 'boolean') throw new Error(`createShow: sync.input must be true or false, got ${JSON.stringify(input)}`);
  if (sync.hz !== undefined && !(Number.isFinite(sync.hz) && sync.hz >= 0)) throw new Error(`createShow: sync.hz must be a number of frames per second ≥ 0, got ${JSON.stringify(sync.hz)}`);
  for (const k of SYNC_FUNCTIONS) {
    if (sync[k] !== undefined && sync[k] !== null && typeof sync[k] !== 'function') throw new Error(`createShow: sync.${k} must be a function, got ${JSON.stringify(sync[k])}`);
  }
  if (sync.follow !== undefined && (sync.follow === null || typeof sync.follow !== 'object' || Array.isArray(sync.follow))) {
    throw new Error(`createShow: sync.follow must be an object of Timeline.follow() options, got ${JSON.stringify(sync.follow)}`);
  }
  return { ...sync, url: url ?? null, input: input ?? role === 'leader' };
}

/** The `modules` a show gets under `sync`: unchanged for a page that takes input; for one that does not, every input module is off. */
export function syncModules(modules, sync) {
  if (!sync || sync.input) return modules;
  const out = { ...modules };
  for (const k of SYNC_INPUT_MODULES) out[k] = false;
  return out;
}
