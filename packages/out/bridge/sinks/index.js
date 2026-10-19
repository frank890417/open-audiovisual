import * as log from './log.js?v=7994140';
import * as udpJson from './udp-json.js?v=7994140';
import * as osc from './osc.js?v=7994140';
import * as ddp from './ddp.js?v=7994140';
import * as serial from './serial.js?v=7994140';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
