// @openav/tile · world — any world, played across the screens on the table.
//
//   const show = await createShow({ world: tileWorld(myWorld, tile), routes: [...TILE_ROUTES], onFrame: (dt) => tile.syncTimeline(show.timeline, dt) });
//
// What it adds, and nothing else:
//   • the param `tileMarkers` (0 show · 1 markers): the marker layer follows it, so the timeline, a mapped signal or the
//     console can call for markers like any other param — TILE_ROUTES routes the camera page's mode (tile/markers) to it;
//   • `io.tile` in update() and `ctx.tile` in init(): the view (which piece of the canvas this screen draws), the shared
//     time and the seed.
// The world draws in canvas units through tile.view (view.apply2d / view.applyP5) and computes from io.tile.time()
// and io.tile.seed, not from a sum of its own dt: two phones that started a second apart, or dropped a frame, must
// still draw the same instant. That is the one place a tiled world reads a clock, and it is the shared one.

import { TILE_PARAMS } from './join.js';

export function tileWorld(world, tile) {
  const own = world.params || [];
  return {
    name: world.name,
    params: [...own, ...TILE_PARAMS.filter((p) => !own.some((o) => o.key === p.key))],
    ...(world.surface ? { surface: world.surface } : {}),
    async init(ctx) {
      tile.driven = true;
      await world.init?.call(world, { ...ctx, tile });
    },
    update(dt, state, io) {
      tile.markers(state.tileMarkers >= 0.5);
      world.update?.call(world, dt, state, { ...io, tile });
    },
    render() { world.render?.call(world); },
    dispose() { tile.driven = false; tile.markers(tile.mode === 'markers'); world.dispose?.call(world); },
    inner: world,
  };
}
