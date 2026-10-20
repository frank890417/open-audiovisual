import * as log from './log.js?v=a4419ca';
import * as udpJson from './udp-json.js?v=a4419ca';
import * as osc from './osc.js?v=a4419ca';
import * as ddp from './ddp.js?v=a4419ca';
import * as serial from './serial.js?v=a4419ca';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
