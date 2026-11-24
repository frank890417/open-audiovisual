// @openav/dmx — DMX lighting from a web page: fixture profiles, a patch, an engine that renders every light at any moment,
// and the bytes of Art-Net, sACN (E1.31) and the Enttec DMX USB Pro. Plain ES modules, no dependencies, no socket of their own:
// the same files run in a browser and in Node (only the monitor touches the DOM, and only when you mount it). The UDP itself
// leaves from the out-bridge (packages/out/bridge: the artnet, sacn and enttec sinks); Web Serial from the page.
//   const patch = new Patch(); patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1, groups: ['front'] });
//   const engine = new DmxEngine(patch);
//   engine.scene('warm', { front: { dimmer: 1, color: [1, 0.6, 0.2] } }).base('warm');
//   engine.render(t).bytes(1)                → the 512 bytes of universe 1
//   encodeArtDmx(bytes, { universe: 1 })     → one UDP payload for port 6454
// and, to give it to people:
//   dmxTransport('sim' | 'bridge' | 'serial')   where the bytes go each frame (memory, the out-bridge, Web Serial)
//   mountDmxMonitor(el, { patch })                  the channels and the fixtures on the page, no light needed
//   dmxParams(engine, { groups, effects, chases })  the engine's control points as params (MIDI, the timeline, the mic drive them)
export { Universe, Universes } from './universe.js?v=e62939c4';
export { validateFixture, loadFixture } from './fixture.js?v=e62939c4';
export { rgbToChannels } from './color.js?v=e62939c4';
export { Patch } from './patch.js?v=e62939c4';
export { DmxEngine } from './engine.js?v=e62939c4';
export { encodeArtDmx, decodeArtDmx } from './protocol/artnet.js?v=e62939c4';
export { encodeSacn, decodeSacn, sacnAddress } from './protocol/sacn.js?v=e62939c4';
export { encodeEnttecDmx, decodeEnttecDmx } from './protocol/enttec.js?v=e62939c4';
export { FIXTURES, fixtureById } from './fixtures/index.js?v=e62939c4';
export { dmxTransport } from './transport.js?v=e62939c4';
export { mountDmxMonitor } from './monitor.js?v=e62939c4';
export { dmxParams } from './params.js?v=e62939c4';
