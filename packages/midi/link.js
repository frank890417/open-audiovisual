// @openav/midi · link — on-screen controllers ⇄ phones, over the room relay.
// Used by @openav/remote's show-side host and by the lab's midi module (same behaviour in both).

/** MIDI controllers ⇄ phones. A phone's MIDI tab publishes the device's signals itself (the controller lives
 *  there); this side only (1) tells phones which device is on screen, (2) echoes what THIS machine's
 *  hardware or panel did, so the phone's knobs follow, and (3) mirrors the phone's plays on this screen
 *  (`midi/virtual` → state + view only — nothing is published twice). Shared with the lab's midi module. */
/** @param {{config:Function, feedback:Function}} relay   a runner RelayClient
 *  @param {import('../core/src/signals.js?v=a8b6135').Signals} signals
 *  @param {import('./manager.js?v=a8b6135').MidiControllers} controllers */
export function linkControllers(relay, signals, controllers) {
  const dirty = new Map();
  const watched = new Set();
  const watch = (c) => { if (watched.has(c)) return; watched.add(c); c.onChange((id, st, info) => {
    if (!id || (info?.source !== 'hw' && info?.source !== 'ui')) return;
    const t = c.control(id)?.type;
    if (t === 'knob' || t === 'fader' || t === 'encoder' || t === 'wheel' || t === 'strip' || (t === 'button' && c.control(id).mode === 'toggle')) dirty.set(`midi/${c.short}/${id}`, st.value);
  }); };
  for (const c of controllers.controllers.values()) watch(c);
  const offSel = controllers.onChange((e) => { if (e.type === 'select') { watch(controllers.current); relay.config('midi', { profile: controllers.current.id }); } });
  const own = (src) => [...controllers.controllers.values()].some((c) => c.uid === src);
  const offSig = signals.on('midi/virtual', (v) => {
    if (!v || !Array.isArray(v.data) || own(v.src)) return;
    const c = [...controllers.controllers.values()].find((x) => x.short === v.device);
    c?.ingest(v.data, { source: 'mirror' });
  });
  return {
    flush() { for (const [n, v] of dirty) relay.feedback(n, v); dirty.clear(); },
    dispose() { offSel(); offSig(); },
  };
}

