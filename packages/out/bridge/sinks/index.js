import * as log from './log.js?v=2399f6b';
import * as udpJson from './udp-json.js?v=2399f6b';
import * as osc from './osc.js?v=2399f6b';
import * as ddp from './ddp.js?v=2399f6b';
import * as serial from './serial.js?v=2399f6b';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
