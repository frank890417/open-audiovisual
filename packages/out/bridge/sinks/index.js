import * as log from './log.js?v=4369f537';
import * as udpJson from './udp-json.js?v=4369f537';
import * as osc from './osc.js?v=4369f537';
import * as ddp from './ddp.js?v=4369f537';
import * as serial from './serial.js?v=4369f537';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
