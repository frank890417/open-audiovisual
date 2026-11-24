// @openav/dmx — DMX lighting from a web page: fixture profiles, a patch, an engine that renders every light at any moment,
// and the bytes of Art-Net, sACN (E1.31) and the Enttec DMX USB Pro. Pure ES modules, no DOM, no sockets, no dependencies:
// the same files run in a browser and in Node. Sending the bytes (the out-bridge, Web Serial) is another layer.
//   const patch = new Patch(); patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1, groups: ['front'] });
//   const engine = new DmxEngine(patch);
//   engine.scene('warm', { front: { dimmer: 1, color: [1, 0.6, 0.2] } }).base('warm');
//   engine.render(t).bytes(1)                → the 512 bytes of universe 1
//   encodeArtDmx(bytes, { universe: 1 })     → one UDP payload for port 6454
export { Universe, Universes } from './universe.js?v=e62939c4';
export { validateFixture, loadFixture } from './fixture.js?v=e62939c4';
export { rgbToChannels } from './color.js?v=e62939c4';
export { Patch } from './patch.js?v=e62939c4';
export { DmxEngine } from './engine.js?v=e62939c4';
export { encodeArtDmx, decodeArtDmx } from './protocol/artnet.js?v=e62939c4';
export { encodeSacn, decodeSacn, sacnAddress } from './protocol/sacn.js?v=e62939c4';
export { encodeEnttecDmx, decodeEnttecDmx } from './protocol/enttec.js?v=e62939c4';
export { FIXTURES, fixtureById } from './fixtures/index.js?v=e62939c4';
