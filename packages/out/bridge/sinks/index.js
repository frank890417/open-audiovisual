import * as log from './log.js?v=dd4a4d59';
import * as udpJson from './udp-json.js?v=dd4a4d59';
import * as osc from './osc.js?v=dd4a4d59';
import * as ddp from './ddp.js?v=dd4a4d59';
import * as serial from './serial.js?v=dd4a4d59';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
