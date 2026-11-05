import * as log from './log.js?v=288eccc';
import * as udpJson from './udp-json.js?v=288eccc';
import * as osc from './osc.js?v=288eccc';
import * as ddp from './ddp.js?v=288eccc';
import * as serial from './serial.js?v=288eccc';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
