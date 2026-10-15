import * as log from './log.js?v=15b294a';
import * as udpJson from './udp-json.js?v=15b294a';
import * as osc from './osc.js?v=15b294a';
import * as ddp from './ddp.js?v=15b294a';
import * as serial from './serial.js?v=15b294a';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
