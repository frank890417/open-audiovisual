// @openav/dmx — Art-Net (ArtDmx), sACN (E1.31 data packet) and the Enttec DMX USB Pro "send DMX" frame, byte for byte.
// The expected bytes are written out field by field from the published layouts (Art-Net 4 "ArtDmx packet definition";
// E1.31 Root, Framing and DMP layers, checked against ETCLabs/sACN and libe131; ENTTEC "DMX USB Pro – API" label 6),
// not produced by the encoders. Then every encoder is read back by its decoder, and through a real UDP socket for the two
// network protocols, the way a node or a monitor would receive them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { encodeArtDmx, decodeArtDmx, ARTNET_PORT } from '../packages/dmx/protocol/artnet.js';
import { encodeSacn, decodeSacn, sacnAddress, SACN_PORT } from '../packages/dmx/protocol/sacn.js';
import { encodeEnttecDmx, decodeEnttecDmx } from '../packages/dmx/protocol/enttec.js';

const hex = (b) => Buffer.from(b).toString('hex');
const CID = Uint8Array.from({ length: 16 }, (_, i) => 0xa0 + i);

// ---------------------------------------------------------------------------- Art-Net
test('ArtDmx: header, opcode low byte first, protocol 14, 15-bit Port-Address, even big-endian length', () => {
  // Port-Address 0x0123 = Net 1, Sub-Net 2, Universe 3 → SubUni 0x23, Net 0x01; three channels padded to four
  const p = encodeArtDmx([255, 128, 0], { universe: 0x0123, sequence: 1, physical: 2 });
  assert.equal(hex(p),
    '4172742d4e657400' +   // ID "Art-Net\0"
    '0050' +               // OpCode 0x5000, low byte first
    '000e' +               // ProtVerHi 0, ProtVerLo 14
    '01' + '02' +          // Sequence, Physical
    '23' + '01' +          // SubUni, Net
    '0004' +               // LengthHi, Length: 3 → 4 (even)
    'ff800000');
  assert.equal(ARTNET_PORT, 6454);
  const full = encodeArtDmx(new Uint8Array(512).fill(7), { universe: 0x7fff });
  assert.equal(full.length, 18 + 512);
  assert.equal(hex(full.subarray(14, 18)), 'ff7f' + '0200', 'top Port-Address 32767: SubUni 0xff, Net 0x7f; length 512 = 0x0200');
  assert.equal(hex(encodeArtDmx([], {}).subarray(16)), '00020000', 'nothing to send still sends the shortest legal packet (2)');
  assert.throws(() => encodeArtDmx([1], { universe: 0x8000 }), /Port-Address/);
  assert.throws(() => encodeArtDmx(new Array(513).fill(0)), /at most 512/);
  assert.throws(() => encodeArtDmx([256]), /channel 1/);
  assert.throws(() => encodeArtDmx([1], { sequence: 256 }), /sequence/);
});

test('ArtDmx: encode → decode gives back the universe, the sequence and the values; anything else is null', () => {
  const data = Uint8Array.from({ length: 512 }, (_, i) => (i * 7) & 255);
  const d = decodeArtDmx(encodeArtDmx(data, { universe: 300, sequence: 200, physical: 1 }));
  assert.deepEqual({ ...d, data: [...d.data] }, { universe: 300, sequence: 200, physical: 1, version: 14, data: [...data] });
  assert.deepEqual([...decodeArtDmx(encodeArtDmx([1, 2, 3])).data], [1, 2, 3, 0], 'the padding byte comes back');
  const poll = Uint8Array.from([...Buffer.from('Art-Net\0'), 0x00, 0x20, 0, 14, 0, 0]);   // ArtPoll (0x2000)
  assert.equal(decodeArtDmx(poll), null);
  assert.equal(decodeArtDmx(encodeArtDmx([1, 2]).subarray(0, 19)), null, 'cut short');
  assert.equal(decodeArtDmx(Uint8Array.from(Buffer.from('not art-net at all'))), null);
});

// ---------------------------------------------------------------------------- sACN
/** The 126-byte header of an E1.31 data packet with `n` slots, written out field by field. */
function sacnHeader({ n, universe, priority, sequence, options = 0, source }) {
  const u16 = (v) => v.toString(16).padStart(4, '0'), u8 = (v) => v.toString(16).padStart(2, '0');
  const name = Buffer.alloc(64); name.write(source, 'utf8');
  const total = 126 + n;
  return '0010' + '0000' + '4153432d45312e3137000000' +          // preamble, post-amble, "ASC-E1.17\0\0\0"
    u16(0x7000 | (total - 16)) + '00000004' + hex(CID) +           // root: flags & length (from octet 16), VECTOR_ROOT_E131_DATA, CID
    u16(0x7000 | (total - 38)) + '00000002' + name.toString('hex') +   // framing: flags & length (from 38), VECTOR_E131_DATA_PACKET, source name
    u8(priority) + '0000' + u8(sequence) + u8(options) + u16(universe) +   // priority, sync address, sequence, options, universe
    u16(0x7000 | (total - 115)) + '02' + 'a1' + '0000' + '0001' + u16(n + 1) + '00';   // DMP: flags & length (from 115), vector, type, first, increment, count, start code
}

test('sACN: the three layers and their flags & length fields, priority, sequence, universe, start code 0', () => {
  const data = Uint8Array.from({ length: 512 }, (_, i) => i & 255);
  const p = encodeSacn(data, { universe: 1, cid: CID, source: 'OAV test', priority: 150, sequence: 9 });
  assert.equal(p.length, 638);
  assert.equal(hex(p.subarray(0, 126)), sacnHeader({ n: 512, universe: 1, priority: 150, sequence: 9, source: 'OAV test' }));
  assert.deepEqual([...p.subarray(126)], [...data]);
  // the well-known numbers for a full universe
  assert.equal(hex(p.subarray(16, 18)), '726e'); assert.equal(hex(p.subarray(38, 40)), '7258'); assert.equal(hex(p.subarray(115, 117)), '720b');
  assert.equal(hex(p.subarray(123, 125)), '0201', '513 property values: the start code and 512 slots');
  // a short packet, a high universe, the option bits
  const s = encodeSacn([1, 2, 3], { universe: 0x1234, cid: CID, source: 'x', sequence: 255, preview: true, terminated: true });
  assert.equal(hex(s), sacnHeader({ n: 3, universe: 0x1234, priority: 100, sequence: 255, options: 0xc0, source: 'x' }) + '010203');
  assert.equal(SACN_PORT, 5568);
  assert.throws(() => encodeSacn([1], { universe: 0, cid: CID }), /universe/);
  assert.throws(() => encodeSacn([1], { universe: 64000, cid: CID }), /universe/);
  assert.throws(() => encodeSacn([1], { priority: 201, cid: CID }), /priority/);
  assert.throws(() => encodeSacn([1]), /cid is 16 bytes/);
  assert.throws(() => encodeSacn([], { cid: CID }), /1–512 slots/);
});

test('sACN: the source name is UTF-8, cut at a character to fit 63 bytes, null-terminated', () => {
  const long = '燈'.repeat(30);                       // 3 bytes each: 90 bytes → 21 characters (63 bytes)
  const p = encodeSacn([0], { cid: CID, source: long });
  assert.equal(p[44 + 63], 0, 'the 64th byte stays 0');
  assert.equal(decodeSacn(p).source, '燈'.repeat(21));
});

test('sACN: encode → decode, and the multicast group of a universe', () => {
  const data = Uint8Array.from({ length: 200 }, (_, i) => 255 - i);
  const d = decodeSacn(encodeSacn(data, { universe: 7, cid: CID, source: '舞台 left', priority: 120, sequence: 42, preview: true }));
  assert.deepEqual({ ...d, cid: [...d.cid], data: [...d.data] }, { universe: 7, priority: 120, sequence: 42, source: '舞台 left', cid: [...CID], preview: true, terminated: false, startCode: 0, data: [...data] });
  const bad = encodeSacn([1, 2], { cid: CID }); bad[17] ^= 1;
  assert.equal(decodeSacn(bad), null, 'a root length that does not match the packet');
  const other = encodeSacn([1, 2], { cid: CID }); other[21] = 8;   // VECTOR_ROOT_E131_EXTENDED (sync, discovery)
  assert.equal(decodeSacn(other), null);
  assert.equal(decodeSacn(new Uint8Array(100)), null);
  assert.equal(sacnAddress(1), '239.255.0.1');
  assert.equal(sacnAddress(0x1234), '239.255.18.52');
  assert.equal(sacnAddress(63999), '239.255.249.255');
  assert.throws(() => sacnAddress(0), /universe/);
});

// ---------------------------------------------------------------------------- Enttec DMX USB Pro
test('Enttec DMX USB Pro: label 6 frame, length LSB first, start code, at least 24 channels, 0xE7', () => {
  const f = encodeEnttecDmx([1, 2, 3]);
  assert.equal(hex(f), '7e' + '06' + '1900' + '00' + '010203' + '00'.repeat(21) + 'e7', '25 data bytes: the API\'s smallest');
  const full = encodeEnttecDmx(new Uint8Array(512).fill(9));
  assert.equal(full.length, 518);
  assert.equal(hex(full.subarray(0, 5)), '7e06010200', '513 = 0x0201, LSB first, then the start code');
  assert.equal(full[517], 0xe7);
  assert.equal(encodeEnttecDmx(new Uint8Array(24)).length, 30);
  assert.throws(() => encodeEnttecDmx(new Array(513).fill(0)), /at most 512/);
  assert.throws(() => encodeEnttecDmx([300]), /channel 1/);
  const d = decodeEnttecDmx(encodeEnttecDmx(Uint8Array.from({ length: 100 }, (_, i) => i)));
  assert.equal(d.startCode, 0); assert.deepEqual([...d.data], Array.from({ length: 100 }, (_, i) => i));
  assert.equal(decodeEnttecDmx(Uint8Array.from([0x7e, 0x03, 0x00, 0x00, 0xe7])), null, 'another label');
  const broken = encodeEnttecDmx([1]); broken[broken.length - 1] = 0;
  assert.equal(decodeEnttecDmx(broken), null, 'no end delimiter');
});

// ---------------------------------------------------------------------------- over a real socket
async function receiveOne(send) {
  const sock = dgram.createSocket('udp4');
  await new Promise((ok) => sock.bind(0, '127.0.0.1', ok));
  const got = new Promise((ok, no) => { sock.once('message', (m) => ok(m)); setTimeout(() => no(new Error('no packet')), 2000); });
  const out = dgram.createSocket('udp4');
  out.send(send, sock.address().port, '127.0.0.1');
  try { return await got; } finally { out.close(); sock.close(); }
}

test('Art-Net and sACN packets survive a UDP round trip on loopback and decode to the same 512 values', async () => {
  const data = Uint8Array.from({ length: 512 }, (_, i) => (i * 31 + 5) & 255);
  const a = decodeArtDmx(await receiveOne(encodeArtDmx(data, { universe: 1, sequence: 3 })));
  assert.deepEqual([...a.data], [...data]); assert.equal(a.universe, 1);
  const s = decodeSacn(await receiveOne(encodeSacn(data, { universe: 1, cid: CID, sequence: 3 })));
  assert.deepEqual([...s.data], [...data]); assert.equal(s.universe, 1);
});
