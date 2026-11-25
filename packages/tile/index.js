// @openav/tile — one picture across several screens lying on a table.
//
//   tile/join     a screen joins a relay room: fullscreen + wake lock on the first tap, its id and pixels, the shared clock
//   tile/marker   the screen covered in ArUco markers that say "screen #n, cell #k"; a param switches markers / show
//   tile/solve    marker corners (screen px ↔ photo px) → each screen's similarity on one canvas → layout.json   (pure)
//   tile/clock    ping/pong → the offset of the quickest round trip                                               (pure)
//   tile/view     the piece of the canvas this screen draws: setTransform for 2D, applyMatrix for p5               (pure)
//   tile/detect   OpenCV.js ArUco, loaded from the CDN by the camera page only
//   camera page   packages/tile/?room=<name>: take the photo, detect, solve, send the layout
//
// Full guide: packages/tile/README.md. Example: examples/30-tile-dot.

export { joinTile, TileLink, tileId, helloName, HELLO_RE, TILE_KEYS, TILE_PARAMS, TILE_ROUTES } from './join.js?v=7229c5d3';
export { tileWorld } from './world.js?v=7229c5d3';
export { tileView, soloView } from './view.js?v=7229c5d3';
export { ClockSync, clockSample, estimateOffset } from './clock.js?v=7229c5d3';
export { markerGrid, markerId, decodeMarkerId, correspondences, drawMarkers, GRID_DEFAULTS, PER_DEVICE, MAX_DEVICES } from './marker.js?v=7229c5d3';
export {
  solveLayout, validateLayout, homography, fitSimilarity, similarityMatrix, similarityOf, similarityScale, similarityAngle,
  mul3, inv3, apply3, det3, rmsError, LAYOUT_VERSION,
} from './solve.js?v=7229c5d3';
export { DICT_NAME, markerBits, markerCode } from './dict.js?v=7229c5d3';
