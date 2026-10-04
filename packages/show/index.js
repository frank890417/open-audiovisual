// @openav/show — createShow(): the one-call assembly factory.
//
// Before this existed, every example hand-wired ~40 lines of shell (signals,
// params, midi, keys, sound, console, monitor, loop) — and every new framework
// feature meant editing every example. Now the shell is DECLARED:
//
//   const show = await createShow({
//     world: myWorld,
//     timeline: { total, automation, scenes },
//     routes: [{ source: 'audio/kick/env', target: 'pump' }],
//     modules: { keys: { base: 48 }, sound: true, audio: 'mic', hands: true, pose: true,
//                remote: { room: 'main' },     // phones/iPads become controllers (packages/remote)
//                midi: { controllers: { profile: 'arturia-minilab3' } } },  // on-screen MIDI controller (packages/midi)
//     artwork: { title: '3D Cylinder Earth', artist: 'Che-Yu Wu 吳哲宇', year: 2020 },
//   });
//
// One factory, so every work evolves together: add a module to the framework,
// declare it, and all shows have it. The side panel is generated layer-aligned
// (Layers → L1 Input → L2 Mapping → L3 Params → L4 Output → Signals), and
// artwork credits render automatically (artist demos stay strictly attributed).
//
// createShow returns { signals, params, stage, timeline, mapper, midi, keys,
// sound, audio, hands, pose, remote, loop, console } — every part reachable, nothing
// hidden. It also sets window.openav for devtools.

import { Signals, Params, Loop } from '../core/index.js?v=2cd2e50';
import { Midi } from '../midi/index.js?v=2cd2e50';
import { mountKeys } from '../keys/index.js?v=2cd2e50';
import { AudioAnalyzer } from '../audio/index.js?v=2cd2e50';
import { ChordDetector } from '../chord/index.js?v=2cd2e50';
import { mountDrums } from '../drums/index.js?v=2cd2e50';
import { PoseTracker, HandTracker } from '../pose/index.js?v=2cd2e50';
import { Mapper } from '../mapping/index.js?v=2cd2e50';
import { Timeline } from '../timeline/index.js?v=2cd2e50';
import { Stage } from '../stage/index.js?v=2cd2e50';
import { mountConsole } from '../console/index.js?v=2cd2e50';
import { MonitorFeed, snapshotOf } from '../monitor/index.js?v=2cd2e50';
import { track } from '../midi/telemetry.js?v=2cd2e50';

const SHELL_CSS = `
  body { margin: 0; background: #000; height: 100vh; display: grid;
    grid-template-columns: minmax(0, 1fr) 340px; overflow: hidden; }
  .oav-stage { position: relative; min-width: 0; overflow: hidden; }
  .oav-side { height: 100vh; display: flex; flex-direction: column; min-width: 0; }
  .oav-keys-slot { padding: 8px 10px; background: #0d1017; border-bottom: 1px solid #1c2334; overflow-x: auto; flex: none; }
  .oav-desk { flex: 1; overflow-y: auto; min-height: 0; }
  .oav-hint { position: absolute; left: 12px; bottom: 10px; color: #445; z-index: 2;
    font: 11px ui-monospace, monospace; pointer-events: none; }
  .oav-credit { position: absolute; right: 12px; bottom: 10px; color: #556; z-index: 2;
    font: 10px ui-monospace, monospace; text-align: right; pointer-events: none; }
  .oav-credit b { color: #8892a8; }
`;

export async function createShow({
  world = null,
  worlds = [],
  timeline: timelineCfg = { total: 120 },
  routes = [],
  modules = {},
  artwork = null,
  hint = '',
  profile = null,
  onFrame = null,          // (dt, show) per-frame hook — assembly-layer logic (envelopes…)
  mount = null,            // { stage, side } elements/selectors; omitted = generated layout
  telemetry = true,        // one anonymous oav_show_start hit per page (packages/midi/telemetry.js); false = none
} = {}) {
  track('oav_show_start', { oav_kind: 'show' }, { enabled: telemetry !== false });
  // ---------- DOM shell (fix the layout once, every show is fixed) ----------
  if (!document.getElementById('openav-shell-css')) {
    const st = document.createElement('style');
    st.id = 'openav-shell-css';
    st.textContent = SHELL_CSS;
    document.head.appendChild(st);
  }
  const el = (x) => typeof x === 'string' ? document.querySelector(x) : x;
  let stageEl = mount?.stage ? el(mount.stage) : null;
  let sideEl = mount?.side ? el(mount.side) : null;
  if (!stageEl) { stageEl = document.createElement('div'); document.body.appendChild(stageEl); }
  if (!sideEl) { sideEl = document.createElement('div'); document.body.appendChild(sideEl); }
  stageEl.classList.add('oav-stage');
  sideEl.classList.add('oav-side');
  const keysSlot = document.createElement('div');
  keysSlot.className = 'oav-keys-slot';
  const desk = document.createElement('div');
  desk.className = 'oav-desk';
  sideEl.append(keysSlot, desk);
  if (hint) {
    const h = document.createElement('div');
    h.className = 'oav-hint';
    h.innerHTML = hint;
    stageEl.appendChild(h);
  }
  if (artwork) {
    const c = document.createElement('div');
    c.className = 'oav-credit';
    c.innerHTML = `artwork © <b>${artwork.artist}</b>${artwork.year ? ' · ' + artwork.year : ''}` +
      `<br>${artwork.title ? '“' + artwork.title + '” · ' : ''}${artwork.note || 'integrated as a demo — all rights reserved for the artwork'}`;
    stageEl.appendChild(c);
    const meta = document.createElement('meta');
    meta.name = 'artwork';
    meta.content = `${artwork.title || ''} — ${artwork.artist}${artwork.year ? ', ' + artwork.year : ''}`;
    document.head.appendChild(meta);
  }

  // ---------- core ----------
  const signals = new Signals();
  const params = new Params();
  const stage = new Stage({ container: stageEl, params, signals });
  const allWorlds = world ? [world, ...worlds] : worlds;
  for (const w of allWorlds) stage.register(w);
  if (allWorlds.length) await stage.activate(allWorlds[0].name);

  const timeline = new Timeline({ params, ...timelineCfg });
  const mapper = new Mapper({ signals, params, profile: profile || allWorlds[0]?.name || 'show' });
  const loaded = profile !== false && mapper.load();
  if (!loaded) {
    for (const r of routes) mapper.addRoute(r);
  } else {
    // merge: a saved profile keeps the user's edits, but newly DECLARED routes
    // must still arrive — otherwise code updates lose to yesterday's localStorage
    const have = new Set(mapper.routes.map(r => r.source + '→' + r.target));
    for (const r of routes) if (!have.has(r.source + '→' + r.target)) mapper.addRoute(r);
  }
  setInterval(() => mapper.save(), 3000);

  // ---------- L1 modules ----------
  const midi = modules.midi === false ? null : new Midi({ signals });
  midi?.enable();
  // on-screen MIDI controllers: plug a known device in and it appears on screen and moves; no device → play it here.
  // Its signals (midi/<device>/<control>) reach params through `routes` — controllerRoutes() writes them.
  let controllers = null, midiPanel = null;
  const ctlCfg = modules.midi && typeof modules.midi === 'object' ? modules.midi.controllers : null;
  if (ctlCfg) {
    const { MidiControllers, mountMidiPanel, PROFILES } = await import('../midi/index.js?v=2cd2e50');
    const o = typeof ctlCfg === 'object' ? ctlCfg : {};
    controllers = new MidiControllers({ profiles: o.profiles || PROFILES, signals, midi, initial: new URLSearchParams(location.search).get('profile') || o.profile });
    midiPanel = mountMidiPanel(stageEl, controllers, { mode: 'dock', contained: true, open: o.open !== false, id: 'oav-midi' });
    const btn = document.createElement('button');
    btn.textContent = '🎹 MIDI'; btn.title = 'on-screen MIDI controller (M)';
    btn.style.cssText = 'position:absolute;right:12px;top:12px;z-index:6;padding:6px 12px;border-radius:10px;border:1px solid #283044;background:rgba(10,12,17,.8);color:#cfd6e4;font:600 12px system-ui;cursor:pointer';
    btn.onclick = () => midiPanel.toggle();
    stageEl.appendChild(btn);
    addEventListener('keydown', (e) => { if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !/^(input|select|textarea)$/i.test(e.target?.tagName || '')) midiPanel.toggle(); });
  }
  const keys = modules.keys === false ? null
    : mountKeys(keysSlot, { signals, base: 48, octaves: 2, ...(typeof modules.keys === 'object' ? modules.keys : {}) });
  // drum machine: the drum sibling of the simulated performer — publishes
  // drum/* signals in the analyzer's shape, synthesizes its own kit (L4)
  const drums = modules.drums
    ? mountDrums(keysSlot, { signals, ...(typeof modules.drums === 'object' ? modules.drums : {}) })
    : null;
  if (!keys && !drums) keysSlot.remove();

  const audio = modules.audio ? new AudioAnalyzer({ signals }) : null;
  // chord is an ANALYZER (L1.5): it subscribes to signals and publishes richer
  // signals — the canonical middle level between raw sources and mapping
  let chord = null;
  if (modules.chord) {
    chord = new ChordDetector({ signals, ...(typeof modules.chord === 'object' ? modules.chord : {}) });
    signals.on('midi/note/on', ({ note, vel }) => chord.noteOn(note, vel ?? 0.8));
    signals.on('midi/note/off', ({ note }) => chord.noteOff(note));
  }
  const hands = modules.hands ? new HandTracker({ signals }) : null;
  const pose = modules.pose ? new PoseTracker({ signals }) : null;

  // ---------- audience devices: phones/iPads as controllers (relay + surface) ----------
  // Loaded lazily so shows that don't declare it pay nothing. The World stays
  // ignorant: its params become the phone's control panel (surface/autoSurface).
  let remote = null;
  if (modules.remote) {
    const { mountRemoteHost, mountJoinCard } = await import('../remote/host.js?v=2cd2e50');
    const o = typeof modules.remote === 'object' ? modules.remote : {};
    const room = o.room || new URLSearchParams(location.search).get('room') || 'default';
    remote = mountRemoteHost({ signals, params, mapper, world: allWorlds[0], ...o, room, controllers });
    mountJoinCard(stageEl, remote);
    remote.connect();
  }

  // ---------- L4 audio branch ----------
  // loaded only when declared, so shows without sound never fetch the instrument library.
  // modules.sound: true · 'piano' · { instrument, remember, picker, engine, …toneEngine options }
  let sound = null;
  if (modules.sound) {
    const { Sound, toneEngine, soundOptions } = await import('../sound/index.js?v=2cd2e50');
    const o = soundOptions(modules.sound);
    // samples come from this copy of the framework (the published default is openaudiovisual.com)
    const engine = o.engine || toneEngine({ baseUrl: new URL('../sound/samples/', import.meta.url).href, ...o.engineOptions });
    sound = new Sound({ signals, params, engine, instrument: o.instrument, remember: o.remember, picker: o.picker });
  }

  // ---------- desk + backstage ----------
  const app = { timeline, params, mapper, signals, midi, controllers, sound, stage, keys, drums, audio, hands, pose, chord, remote, artwork };
  const consoleUI = mountConsole(desk, app);
  const monitor = new MonitorFeed({});
  monitor.connect();

  const show = { signals, params, stage, timeline, mapper, midi, controllers, midiPanel, keys, drums, sound, audio, hands, pose, chord, remote, console: consoleUI, app, loop: null };
  const loop = app.loop = new Loop((dt) => {
    keys?.update(dt);
    drums?.update(dt);
    audio?.update();
    onFrame?.(dt, show);
    timeline.advance(dt);
    mapper.update(dt);
    const state = stage.frame(dt, timeline.state());
    sound?.update(state);
    remote?.frame(dt, state);
    consoleUI.render(state);
    monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
  });
  show.loop = loop;
  loop.start();
  window.openav = show;
  return show;
}
