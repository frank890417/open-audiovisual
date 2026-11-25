import * as log from './log.js?v=cedb93fa';
import * as udpJson from './udp-json.js?v=cedb93fa';
import * as osc from './osc.js?v=cedb93fa';
import * as ddp from './ddp.js?v=cedb93fa';
import * as serial from './serial.js?v=cedb93fa';
import * as artnet from './artnet.js?v=cedb93fa';
import * as sacn from './sacn.js?v=cedb93fa';
import * as enttec from './enttec.js?v=cedb93fa';

/** sink name (as written in the config) → module with create(cfg, ctx) */
export const SINKS = { log, 'udp-json': udpJson, osc, ddp, serial, artnet, sacn, enttec };
