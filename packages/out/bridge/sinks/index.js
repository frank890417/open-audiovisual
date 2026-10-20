import * as log from './log.js?v=b26b3a4';
import * as udpJson from './udp-json.js?v=b26b3a4';
import * as osc from './osc.js?v=b26b3a4';
import * as ddp from './ddp.js?v=b26b3a4';
import * as serial from './serial.js?v=b26b3a4';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
