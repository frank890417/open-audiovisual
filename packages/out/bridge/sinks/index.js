import * as log from './log.js?v=2b72f18a';
import * as udpJson from './udp-json.js?v=2b72f18a';
import * as osc from './osc.js?v=2b72f18a';
import * as ddp from './ddp.js?v=2b72f18a';
import * as serial from './serial.js?v=2b72f18a';
import * as artnet from './artnet.js?v=2b72f18a';
import * as sacn from './sacn.js?v=2b72f18a';
import * as enttec from './enttec.js?v=2b72f18a';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial, artnet, sacn, enttec };
