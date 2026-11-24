import * as log from './log.js?v=e62939c4';
import * as udpJson from './udp-json.js?v=e62939c4';
import * as osc from './osc.js?v=e62939c4';
import * as ddp from './ddp.js?v=e62939c4';
import * as serial from './serial.js?v=e62939c4';
import * as artnet from './artnet.js?v=e62939c4';
import * as sacn from './sacn.js?v=e62939c4';
import * as enttec from './enttec.js?v=e62939c4';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial, artnet, sacn, enttec };
