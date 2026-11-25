// @openav/output · page — the clean output page. createShow() loads this when the page address has ?output (see url.js):
// the stage alone, on black, filling the window, with the corners this browser saved for that output name, the crop and
// shape the address asks for, the output's blackout and brightness params, and the same keys as an output window
// (E corners, G test pattern, F fullscreen, B blackout, I help). The console was never shown: createShow hid it.

import { mountOutputView } from './view.js?v=7fe486df';
import { outputParams, outputKeys, paramReader } from './params.js?v=7fe486df';
import { loadRoom, saveRoom, defaultStorage } from './layout.js?v=7fe486df';

/**
 * @param {object} show  what createShow() built
 * @param {{ name:string, crop:object|null, aspect:number|null, fit:string, follow:string|null, via:true|string|null, play:boolean }} q  outputQuery()
 * @returns {object} { name, query, view, edit(on), pattern(on), room, set(partial), reset(o) }
 */
export function mountOutputPage(show, q, { storage = defaultStorage() } = {}) {
  const keys = outputKeys(q.name);
  if (!show.params.get(keys.blackout)) show.params.add(outputParams(q.name));
  const read = paramReader(show.params, show.timeline);
  let crop = q.crop || { x: 0, y: 0, w: 1, h: 1 }, aspect = q.aspect;
  const size = (box) => (aspect ? { w: Math.round(1000 * aspect), h: 1000 } : { w: box.w / crop.w, h: box.h / crop.h });
  const view = mountOutputView({
    doc: document, target: show.stage.container, name: q.name, room: loadRoom(q.name, storage), crop: q.crop, fit: q.fit,
    // the stage is drawn at the size this output needs: with a shape from the address, that shape; without one, exactly the
    // crop's share of the window (so the region the crop picks fills it at full resolution)
    sourceSize: size,
    read: (k) => read(keys[k]),
    onRoom: (room) => saveRoom(q.name, room, storage),
    // on a follower the leader's held values win the next frame: blackout belongs to the show page there
    onBlackout: q.follow ? () => view.say('This page follows the show page: blackout it there (or with its params).') : (on) => show.params.override(keys.blackout, on ? 1 : 0),
    card: false,
  });
  if (q.play && !q.follow) show.timeline.play();
  return {
    name: q.name, query: q, view,
    edit: (on) => view.edit(on),
    pattern: (on) => view.pattern(on),
    get room() { return view.room; },
    set: (partial) => view.set(partial),
    reset: (o) => view.reset(o),
    /**
     * What the show's code declared for this output (createOutputs does it): its crop, fit and the stage's shape, used where
     * the address says nothing, so ?output=left is the left half that the code calls "left".
     */
    declare({ crop: c = null, fit = null, aspect: a = null } = {}) {
      if (!q.crop && c) crop = c;
      if (!q.aspect && a) aspect = a;
      view.configure({ crop: q.crop || c || null, ...(!q.fit || q.fit === 'contain' ? (fit ? { fit } : {}) : {}), sourceSize: size });
    },
  };
}
