import * as log from './log.js?v=6b091ec6';
import * as udpJson from './udp-json.js?v=6b091ec6';
import * as osc from './osc.js?v=6b091ec6';
import * as ddp from './ddp.js?v=6b091ec6';
import * as serial from './serial.js?v=6b091ec6';
import * as artnet from './artnet.js?v=6b091ec6';
import * as sacn from './sacn.js?v=6b091ec6';
import * as enttec from './enttec.js?v=6b091ec6';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial, artnet, sacn, enttec };
