import * as log from './log.js?v=cfa5659';
import * as udpJson from './udp-json.js?v=cfa5659';
import * as osc from './osc.js?v=cfa5659';
import * as ddp from './ddp.js?v=cfa5659';
import * as serial from './serial.js?v=cfa5659';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
