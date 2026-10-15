import * as log from './log.js?v=5e75007';
import * as udpJson from './udp-json.js?v=5e75007';
import * as osc from './osc.js?v=5e75007';
import * as ddp from './ddp.js?v=5e75007';
import * as serial from './serial.js?v=5e75007';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
