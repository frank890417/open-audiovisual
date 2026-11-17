import * as log from './log.js?v=2c77357d';
import * as udpJson from './udp-json.js?v=2c77357d';
import * as osc from './osc.js?v=2c77357d';
import * as ddp from './ddp.js?v=2c77357d';
import * as serial from './serial.js?v=2c77357d';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
