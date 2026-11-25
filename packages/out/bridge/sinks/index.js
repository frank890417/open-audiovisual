import * as log from './log.js?v=4d84c85b';
import * as udpJson from './udp-json.js?v=4d84c85b';
import * as osc from './osc.js?v=4d84c85b';
import * as ddp from './ddp.js?v=4d84c85b';
import * as serial from './serial.js?v=4d84c85b';
import * as artnet from './artnet.js?v=4d84c85b';
import * as sacn from './sacn.js?v=4d84c85b';
import * as enttec from './enttec.js?v=4d84c85b';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial, artnet, sacn, enttec };
