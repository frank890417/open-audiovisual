// @openav/output — the stage on a projector or a second screen: an output window, four-corner correction, crops for
// several projectors, blackout and brightness as params, and a clean address for a kiosk browser, OBS or TouchDesigner.
//
//   import { createOutputs } from '@openav/output';
//   const outputs = createOutputs(show, { outputs: [{ name: 'front' }], aspect: 16 / 9 });   // params + an L4 · Output panel
//   button.onclick = () => outputs.open('front');                                            // from a click
//
// The world never knows: the output takes the stage's canvas as it is (mode 'mirror'), or runs the same page again at its
// clean address as a follower (mode 'page'). Docs: https://openaudiovisual.com/docs/output/
//
// Nothing here touches the page when it is imported: the pure parts (pin, crop, layout, url, params) run in node.

export { cornerPin, toMatrix3d } from './pin.js?v=9a90f849';
export { cropBox } from './crop.js?v=9a90f849';
export { OUTPUT_FORMAT, parseOutputLayout } from './layout.js?v=9a90f849';
export { outputParams } from './params.js?v=9a90f849';
export { outputQuery, outputUrl } from './url.js?v=9a90f849';
export { openOutput, createOutputs } from './window.js?v=9a90f849';
