// @openav/midi · remote-tab — the phone / iPad as a MIDI controller for a work on another screen.
//
// Mounted by @openav/remote as the "MIDI" tab (declared in packages/midi/package.json → lab.remoteTab,
// so hosts that read the declaration — the lab — grow the tab without a hard-coded list).
//
// The controller LIVES on the phone here: touching the on-screen MiniLab publishes, over the
// relay, exactly what a MiniLab on the show machine would — midi/minilab3/… + the generic
// midi/note/on, midi/cc/… + `midi/virtual` (raw bytes, for Web MIDI sketches). The show echoes
// back what its own hardware does (feedback midi/<short>/<id>), so the phone's knobs follow a
// knob turned on the desk. Which device to show: the show's config "midi" ({profile}), unless
// the player picked one here.

import { MidiControllers } from './manager.js?v=35d96ac';
import { mountMidiPanel } from './panel.js?v=35d96ac';
import { PROFILES } from './profiles/index.js?v=35d96ac';

/**
 * @param {HTMLElement} el      the tab page
 * @param {object} ctx          from @openav/remote: { relay, sink, onFeedback(fn), onConfig(fn), config }
 */
export function mount(el, ctx) {
  let picked = null;
  try { picked = sessionStorage.getItem('oav.remote.midi.profile'); } catch { /* */ }
  const fromShow = ctx.config?.midi?.profile || null;
  const mcs = new MidiControllers({ profiles: PROFILES, sink: ctx.sink, midi: null, initial: picked || fromShow || 'arturia-minilab3' });
  const panel = mountMidiPanel(el, mcs, { mode: 'full' });
  mcs.onChange((e) => { if (e.type === 'select') { picked = mcs.current.id; try { sessionStorage.setItem('oav.remote.midi.profile', picked); } catch { /* */ } } });
  const offCfg = ctx.onConfig?.((key, data) => {
    if (key !== 'midi' || !data?.profile || picked) return;
    if (mcs.byId.has(data.profile) && mcs.current.id !== data.profile) { mcs.select(data.profile); picked = null; }
  });
  // feedback: the show's hardware moved a control → this phone's control follows (never fights a finger)
  const offFb = ctx.onFeedback?.((name, value) => {
    const m = /^midi\/([^/]+)\/([^/]+)$/.exec(name); if (!m) return;
    const c = [...mcs.controllers.values()].find((x) => x.short === m[1]);
    if (c && performance.now() - (c._touched?.[m[2]] || 0) > 600) c.mirror(m[2], value);
  });
  // remember the last local touch per control (the feedback guard above)
  const mark = (c) => c.onChange((id, st, info) => { if (id && info?.source === 'ui') (c._touched ||= {})[id] = performance.now(); });
  for (const c of mcs.controllers.values()) mark(c);
  const offSel = mcs.onChange((e) => { if (e.type === 'select' && !mcs.current._marked) { mcs.current._marked = true; mark(mcs.current); } });
  mcs.current._marked = true;
  return {
    controllers: mcs, panel,
    hide() { mcs.current.releaseAll(); },
    dispose() { offCfg?.(); offFb?.(); offSel(); panel.dispose(); },
  };
}
