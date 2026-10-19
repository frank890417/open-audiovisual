import * as log from './log.js?v=f3ec262';
import * as udpJson from './udp-json.js?v=f3ec262';
import * as osc from './osc.js?v=f3ec262';
import * as ddp from './ddp.js?v=f3ec262';
import * as serial from './serial.js?v=f3ec262';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
