import * as log from './log.js?v=1f11cf5e';
import * as udpJson from './udp-json.js?v=1f11cf5e';
import * as osc from './osc.js?v=1f11cf5e';
import * as ddp from './ddp.js?v=1f11cf5e';
import * as serial from './serial.js?v=1f11cf5e';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
