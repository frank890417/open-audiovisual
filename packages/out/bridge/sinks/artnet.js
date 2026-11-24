// artnet sink — DMX over Art-Net (ArtDmx, UDP 6454), the most common way into a lighting node.
// Channels dmx/<universe>/<address> (0..1 → 0..255) fill one 512-byte buffer per universe (dmx-frames.js); each frame is one
// ArtDmx packet from @openav/dmx (protocol/artnet.js), sequence 1..255, 40 Hz while it changes, once a second while it does not.
//
// Universe numbering: dmx/1/… goes out as Port-Address 1 (Net 0, Sub-Net 0, Universe 1); dmx/N/… as Port-Address N, up to
// 32767 (Net · Sub-Net · Universe in one 15-bit number). Port-Address 0 is deprecated by Art-Net 4, but a node still set to it
// is reached with dmx/0/…. A desk that calls its first universe "1" and sends it as Port-Address 0 (some do) is one off from this.
//
// Unicast by default: Art-Net 4 says ArtDmx goes to the nodes that subscribe to the universe and is never broadcast, because a
// broadcast stream of 40 packets a second reaches every device on the network and floods slow nodes and Wi-Fi. "broadcast": true
// is there for an old node that only listens to broadcast, on a network that carries nothing else.
import dgram from 'node:dgram';
import { encodeArtDmx, ARTNET_PORT } from '../../../dmx/protocol/artnet.js?v=6c223527';
import { DmxFrames, udpSender, flashGuardOf } from './dmx-frames.js?v=6c223527';

export const MAX_PORT_ADDRESS = 0x7fff;

export function create(cfg, ctx) {
  const broadcast = cfg.broadcast === true;
  const hosts = [].concat(cfg.host ?? (broadcast ? '255.255.255.255' : [])).filter((h) => typeof h === 'string' && h);
  if (!hosts.length) throw new Error('artnet sink 要設 host（節點的 IP，Art-Net 4 規定 ArtDmx 用單播），或明確寫 "broadcast": true');
  const port = Number(cfg.port || ARTNET_PORT);
  const flashGuard = flashGuardOf(cfg, 'artnet');   // on unless the route says "flashGuard": false (dmx-frames.js says what it holds); checked before any socket opens
  if (!(Number.isInteger(port) && port > 0 && port < 65536)) throw new Error(`artnet port 要是 1–65535（收到 ${cfg.port}）`);
  let lastError = null;
  const onError = (e) => { lastError = e.message; ctx.log(`[artnet] ${e.message}`); };
  const udp = udpSender(dgram, { onError, setup: (s) => { if (broadcast) s.setBroadcast(true); } });
  if (broadcast) ctx.log(`[artnet] broadcasting ArtDmx to ${hosts.join(', ')}: Art-Net 4 asks for unicast to the nodes`);
  const frames = new DmxFrames({
    flashGuard,
    accept: (u) => u <= MAX_PORT_ADDRESS,
    onError,
    emit: (u, data, n) => {
      const p = encodeArtDmx(data, { universe: u, sequence: ((n - 1) % 255) + 1 });   // 1..255: 0 would mean "sequencing off"
      for (const h of hosts) udp.send(p, port, h);
    },
  });
  return {
    name: 'artnet',
    send(ch, v) { if (!udp.closed && frames.set(ch, v)) frames.start(); },
    flush: () => frames.flush(),
    status: () => ({ state: udp.closed ? 'down' : 'up', target: hosts.map((h) => `${h}:${port}`).join(', '), broadcast, ...frames.stats(), lastError }),
    close() { frames.flush(); frames.stop(); udp.close(); },
  };
}
