import * as log from './log.js?v=a5bef502';
import * as udpJson from './udp-json.js?v=a5bef502';
import * as osc from './osc.js?v=a5bef502';
import * as ddp from './ddp.js?v=a5bef502';
import * as serial from './serial.js?v=a5bef502';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
