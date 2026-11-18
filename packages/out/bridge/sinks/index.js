import * as log from './log.js?v=eade73f6';
import * as udpJson from './udp-json.js?v=eade73f6';
import * as osc from './osc.js?v=eade73f6';
import * as ddp from './ddp.js?v=eade73f6';
import * as serial from './serial.js?v=eade73f6';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial };
