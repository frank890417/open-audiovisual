// @openav/align — one layout file drives the test patterns, the vendor's alignment chart and the real output mapping;
// a manual calibration (four corners, a mesh, feathered edges, masks, brightness) on top; and the pattern generator for
// camera-in-the-loop alignment (channel-separated Gray code). Pure ES modules, no dependencies; THREE is passed in.
//
//   import { computeMapping, drawPattern } from '@openav/align';
//   const M = computeMapping(layout);                      // layout: open-audiovisual/align@1 (art-align/v1 reads too)
//   drawPattern(canvas.getContext('2d'), M, 'tiles');      // the pattern the wall should show, tile by tile
//
// Automatic alignment is NOT here: no camera capture, no decoding of a photo, no solved mesh, no blend brightness field.
// What exists for it is the frame generator (graySequence, drawGrayFrame). The chapter's roadmap lists the rest.
// Docs: https://openaudiovisual.com/docs/align/

export { ALIGN_FORMAT, CONTRACT, LayoutError, validateLayout, normalizeLayout, findLayout, identityLayout, scaleArt } from './layout.js?v=7229c5d3';
export { computeMapping, blitPlan, composePlan, composeArtCanvas, artView, desktopToArt, artToDesktop, cellIdAt, analyzeOverlaps, blendWeight, vendorPlacements } from './mapping.js?v=7229c5d3';
export { rowLabel, cellSizeFor, cellAt, cellRect, eachCell } from './cells.js?v=7229c5d3';
export { ALIGN_PATTERNS, BAR_VARIANTS, drawPattern, withTile, highlightCell, drawOutputs } from './patterns.js?v=7229c5d3';
export { grayEncode, grayDecode, bitsFor, graySequence, grayBitAt, decodeGrayBits, grayRuns, channelPlan, drawGrayFrame, frameLabel } from './structured-light.js?v=7229c5d3';
export { normalizeAlignArgs } from './control.js?v=7229c5d3';
export { createBlitter } from './three-blit.js?v=7229c5d3';
export { CALIBRATION_FORMAT, CAL_CONTRACT, defaultZone, normalizeZone, normalizeCalibration, squareToQuad, warpPoint, featherAt, zoneGrid, rotateZone, quadOk } from './warp.js?v=7229c5d3';
export { createWarpRenderer } from './warp-gl.js?v=7229c5d3';
export { PATTERN_SOURCES, drawSource, createPatternTexture } from './pattern-texture.js?v=7229c5d3';
export { createCalStore } from './cal-store.js?v=7229c5d3';
export { createAlignUI } from './align-ui.js?v=7229c5d3';
export { drawChart } from './chart.js?v=7229c5d3';
export { drawIdent, drawIdentBase, drawIdentLive } from './ident.js?v=7229c5d3';
export { zoneToRoom, roomToZone, outputsFromAlign } from './bridge.js?v=7229c5d3';
