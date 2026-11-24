import * as log from './log.js?v=c6e958d9';
import * as udpJson from './udp-json.js?v=c6e958d9';
import * as osc from './osc.js?v=c6e958d9';
import * as ddp from './ddp.js?v=c6e958d9';
import * as serial from './serial.js?v=c6e958d9';
import * as artnet from './artnet.js?v=c6e958d9';
import * as sacn from './sacn.js?v=c6e958d9';
import * as enttec from './enttec.js?v=c6e958d9';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial, artnet, sacn, enttec };
