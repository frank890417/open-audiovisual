// @openav/output · follow — an output that is a second page running the same world (mode 'page').
//
// The page at the clean address with `&follow=<channel>` is a @openav/sync follower: its timeline chases the show page's,
// and it takes no input of its own. Time alone is not the whole picture, so the leader this file makes also sends the
// values held by a hand or a route on the show page (params.overrides: a console slider, a MIDI knob, a blackout), and the
// follower holds the same ones. What still does not travel: signals (a note that launches particles), randomness, and
// anything a world integrates over dt. That is the trade-off against the mirror; docs/output.md has the table.

export const PARAMS_EXTRA = 'oav/params';
const leaders = new WeakMap();                                 // show → its output leader (one per show and channel)

/**
 * Hold on this page what the leader holds: every key of `snap` the page knows is held as `{ kind: 'route', label: 'leader' }`;
 * a key this function held before and the leader no longer holds is released. `mine` remembers which keys it holds.
 * @param {import('../core/src/params.js?v=2b72f18a').Params} params
 * @param {Object<string,number>|undefined} snap
 * @param {Set<string>} mine
 */
export function adoptOverrides(params, snap, mine) {
  if (!params || !snap || typeof snap !== 'object' || Array.isArray(snap)) return;
  for (const [k, v] of Object.entries(snap)) {
    if (!Number.isFinite(v) || !params.get(k)) continue;
    if (!(params.isOverridden(k) && params.overrides[k] === v)) params.hold(k, v, { kind: 'route', label: 'leader', source: 'sync' });
    mine.add(k);
  }
  for (const k of [...mine]) if (!(k in snap)) { params.clearOverride(k); mine.delete(k); }
}

/**
 * Make this show the leader that output pages follow (idempotent per show and channel). It sends the clock and the held
 * values every frame of the show, also while this page is hidden (it rides the show's own loop, which a Worker keeps going).
 * @param {object} show  what createShow() returned
 * @param {{ channel?:string, via?:true|string|null }} [o]
 * @returns {Promise<object>} the SyncLeader
 */
export async function leadOutputs(show, { channel = 'oav-output', via = null } = {}) {
  let byChannel = leaders.get(show);
  if (!byChannel) leaders.set(show, (byChannel = new Map()));
  if (byChannel.has(channel)) return byChannel.get(channel);
  const pending = (async () => {
    const { createSync } = await import('../sync/index.js?v=2b72f18a');
    const leader = createSync({
      role: 'leader', channel, url: via ?? null, timeline: show.timeline, score: show.score,
      extra: () => ({ [PARAMS_EXTRA]: { ...show.params.overrides } }),
    });
    const loop = show.loop, frame = loop.onFrame;
    loop.onFrame = (dt, now) => { frame.call(loop, dt, now); leader.frame(); };
    return leader;
  })();
  byChannel.set(channel, pending);
  return pending;
}
