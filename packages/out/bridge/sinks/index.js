import * as log from './log.js?v=77a4e4f';
import * as udpJson from './udp-json.js?v=77a4e4f';
import * as osc from './osc.js?v=77a4e4f';
import * as ddp from './ddp.js?v=77a4e4f';
import * as serial from './serial.js?v=77a4e4f';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
