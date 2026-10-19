import * as log from './log.js?v=1a53afc';
import * as udpJson from './udp-json.js?v=1a53afc';
import * as osc from './osc.js?v=1a53afc';
import * as ddp from './ddp.js?v=1a53afc';
import * as serial from './serial.js?v=1a53afc';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
