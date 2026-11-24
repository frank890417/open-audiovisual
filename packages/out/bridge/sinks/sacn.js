// sacn sink — DMX over sACN (ANSI E1.31, UDP 5568), what most consoles and newer nodes speak.
// Channels dmx/<universe>/<address> (0..1 → 0..255) fill one 512-byte buffer per universe (dmx-frames.js); each frame is one
// E1.31 data packet from @openav/dmx (protocol/sacn.js), sequence 0..255, 40 Hz while it changes, once a second while it does not.
//
// Universe numbering: dmx/N/… is sACN universe N, 1..63999 (sACN has no universe 0: dmx/0/… is ignored and counted).
// Where it goes: by default the universe's multicast group 239.255.<N high byte>.<N low byte> (receivers join the groups they
// want, nothing to configure); with "host" every universe is unicast to that address instead. "interface" picks the network
// card multicast leaves from (its IPv4 address) on a machine with Wi-Fi and a wired lighting network.
// One CID (the source's identity, a UUID) per bridge run, so a receiver sees one source for as long as the bridge runs.
// On a clean stop, after the safe values, each universe sends three "stream terminated" packets as E1.31 asks: receivers
// drop this source at once instead of waiting out their 2.5 s loss timer.
import dgram from 'node:dgram';
import crypto from 'node:crypto';
import { encodeSacn, sacnAddress, SACN_PORT } from '../../../dmx/protocol/sacn.js?v=4d1326b1';
import { DmxFrames, udpSender, flashGuardOf } from './dmx-frames.js?v=4d1326b1';

/** This process's CID: the same for every sacn route and every universe while the bridge runs, new on the next run. */
export const CID = Uint8Array.from(Buffer.from(crypto.randomUUID().replace(/-/g, ''), 'hex'));

/** Where a universe's packets go: the unicast host when there is one, else its multicast group 239.255.<hi>.<lo>. */
export const targetOf = (universe, host = null) => host || sacnAddress(universe);

export function create(cfg, ctx) {
  const host = typeof cfg.host === 'string' && cfg.host ? cfg.host : null;
  const port = Number(cfg.port || SACN_PORT);
  const flashGuard = flashGuardOf(cfg, 'sacn');   // on unless the route says "flashGuard": false (dmx-frames.js says what it holds); checked before any socket opens
  if (!(Number.isInteger(port) && port > 0 && port < 65536)) throw new Error(`sacn port 要是 1–65535（收到 ${cfg.port}）`);
  const priority = cfg.priority === undefined ? 100 : Number(cfg.priority);
  if (!(Number.isInteger(priority) && priority >= 0 && priority <= 200)) throw new Error(`sacn priority 要是 0–200 的整數（收到 ${cfg.priority}，預設 100）`);
  const source = typeof cfg.source === 'string' && cfg.source ? cfg.source : 'open-audiovisual';
  const iface = typeof cfg.interface === 'string' && cfg.interface ? cfg.interface : null;
  const target = (u) => targetOf(u, host);
  let lastError = null;
  const onError = (e) => { lastError = e.message; ctx.log(`[sacn] ${e.message}`); };
  const udp = udpSender(dgram, { onError, setup: (s) => { if (iface && !host) s.setMulticastInterface(iface); } });
  const packet = (u, data, sequence, terminated = false) => encodeSacn(data, { universe: u, cid: CID, source, priority, sequence, terminated });
  const seq = new Map();
  const frames = new DmxFrames({
    flashGuard,
    accept: (u) => u >= 1 && u <= 63999,
    onError,
    emit: (u, data, n) => { seq.set(u, n & 0xff); udp.send(packet(u, data, n & 0xff), port, target(u)); },
  });
  return {
    name: 'sacn',
    send(ch, v) { if (!udp.closed && frames.set(ch, v)) frames.start(); },
    flush: () => frames.flush(),
    status: () => ({
      state: udp.closed ? 'down' : 'up', target: host ? `${host}:${port}` : `multicast 239.255.x.y:${port}`,
      targets: Object.fromEntries(frames.universes.map((u) => [u, `${target(u)}:${port}`])), priority, source, ...frames.stats(), lastError,
    }),
    close() {
      frames.flush(); frames.stop();
      for (const [u, data] of frames.entries()) for (let i = 1; i <= 3; i++) {
        try { udp.send(packet(u, data, ((seq.get(u) || 0) + i) & 0xff, true), port, target(u)); } catch (e) { onError(e); }
      }
      udp.close();
    },
  };
}
