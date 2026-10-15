import * as log from './log.js?v=472707a';
import * as udpJson from './udp-json.js?v=472707a';
import * as osc from './osc.js?v=472707a';
import * as ddp from './ddp.js?v=472707a';
import * as serial from './serial.js?v=472707a';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
