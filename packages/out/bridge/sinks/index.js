import * as log from './log.js';
import * as udpJson from './udp-json.js';
import * as osc from './osc.js';
import * as ddp from './ddp.js';
import * as serial from './serial.js';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
