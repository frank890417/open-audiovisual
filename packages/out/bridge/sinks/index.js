import * as log from './log.js?v=02aa19c';
import * as udpJson from './udp-json.js?v=02aa19c';
import * as osc from './osc.js?v=02aa19c';
import * as ddp from './ddp.js?v=02aa19c';
import * as serial from './serial.js?v=02aa19c';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
