import * as log from './log.js?v=b10fa0c';
import * as udpJson from './udp-json.js?v=b10fa0c';
import * as osc from './osc.js?v=b10fa0c';
import * as ddp from './ddp.js?v=b10fa0c';
import * as serial from './serial.js?v=b10fa0c';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
