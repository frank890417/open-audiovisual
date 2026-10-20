import * as log from './log.js?v=c772c1d';
import * as udpJson from './udp-json.js?v=c772c1d';
import * as osc from './osc.js?v=c772c1d';
import * as ddp from './ddp.js?v=c772c1d';
import * as serial from './serial.js?v=c772c1d';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
