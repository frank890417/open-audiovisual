import * as log from './log.js?v=abbbd06';
import * as udpJson from './udp-json.js?v=abbbd06';
import * as osc from './osc.js?v=abbbd06';
import * as ddp from './ddp.js?v=abbbd06';
import * as serial from './serial.js?v=abbbd06';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
