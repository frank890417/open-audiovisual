import * as log from './log.js?v=dcdb1a44';
import * as udpJson from './udp-json.js?v=dcdb1a44';
import * as osc from './osc.js?v=dcdb1a44';
import * as ddp from './ddp.js?v=dcdb1a44';
import * as serial from './serial.js?v=dcdb1a44';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
