import * as log from './log.js?v=af13a9f';
import * as udpJson from './udp-json.js?v=af13a9f';
import * as osc from './osc.js?v=af13a9f';
import * as ddp from './ddp.js?v=af13a9f';
import * as serial from './serial.js?v=af13a9f';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
