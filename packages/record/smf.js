// smf.js — takes ⇄ Standard MIDI Files. Pure, unit-tested.
//
// toMidiFile writes a type-0 file (one track) that any DAW opens: note on/off
// with velocity, controllers (the sustain pedal is CC 64), pitch bend, channel
// and poly aftertouch, each on its own channel — channel 10 stays the drums.
// The tempo is the take's meta.bpm (else 120); times are kept to the
// millisecond whatever the tempo, so the file plays exactly like the take.
//
// fromMidiFile reads type 0 and type 1 (tracks merged), running status, tempo
// changes and SMPTE time division, and returns a take whose events are the
// signals a keyboard playing that file would have published.

import { normalizeTake, midiEventsOf, signalsOfMidi } from './take.js?v=0cfcfd4';

const vlq = (n) => {
  n = Math.max(0, Math.round(n));
  const out = [n & 0x7f];
  while ((n = Math.floor(n / 128)) > 0) out.unshift((n & 0x7f) | 0x80);
  return out;
};
const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n) => [(n >>> 8) & 0xff, n & 0xff];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const utf8 = (s) => Array.from(new TextEncoder().encode(s));
const b7 = (v) => Math.max(0, Math.min(127, Math.round(v)));

function bytesOf(e) {
  const c = (Math.max(1, Math.min(16, e.ch || 1)) - 1) & 0x0f;
  switch (e.type) {
    case 'noteon': return [0x90 | c, b7(e.note), Math.max(1, b7(e.vel))];
    case 'noteoff': return [0x80 | c, b7(e.note), 0];
    case 'cc': return [0xb0 | c, b7(e.cc), b7(e.value)];
    case 'pitchbend': { const v = Math.max(0, Math.min(16383, Math.round(e.value))); return [0xe0 | c, v & 0x7f, (v >> 7) & 0x7f]; }
    case 'chanat': return [0xd0 | c, b7(e.value)];
    case 'polyat': return [0xa0 | c, b7(e.note), b7(e.value)];
  }
  return null;
}

/**
 * A take → a Standard MIDI File (type 0).
 * @param {object} take
 * @param {{ ppq?: number, bpm?: number }} [opts] ticks per quarter (default 960); tempo (default meta.bpm, else 120)
 * @returns {Uint8Array} the .mid bytes
 */
export function toMidiFile(take, { ppq = 960, bpm } = {}) {
  const t = normalizeTake(take);
  const tempo = bpm || t.meta.bpm || 120;
  const usPerQ = Math.max(1, Math.min(0xffffff, Math.round(60e6 / tempo)));
  const perMs = (ppq * 1000) / usPerQ;
  const evs = midiEventsOf(t).map((e, i) => ({ ...e, tick: Math.round(e.t * perMs), i }));
  // a note shorter than one tick must still end after it starts, or a DAW holds it forever
  const onAt = new Map();
  for (const e of evs) {
    const k = `${e.ch}:${e.note}`;
    if (e.type === 'noteon') onAt.set(k, e.tick);
    else if (e.type === 'noteoff' && onAt.has(k) && e.tick <= onAt.get(k)) e.tick = onAt.get(k) + 1;
  }
  const rank = { noteoff: 0, noteon: 2 };   // same tick: releases first, so a re-struck key re-sounds
  evs.sort((a, b) => a.tick - b.tick || (rank[a.type] ?? 1) - (rank[b.type] ?? 1) || a.i - b.i);

  const trk = [];
  if (t.name) { const n = utf8(t.name); trk.push(0, 0xff, 0x03, ...vlq(n.length), ...n); }
  trk.push(0, 0xff, 0x51, 0x03, (usPerQ >> 16) & 0xff, (usPerQ >> 8) & 0xff, usPerQ & 0xff);
  trk.push(0, 0xff, 0x58, 0x04, 4, 2, 24, 8);   // 4/4 — only so a DAW's grid looks sane
  let last = 0;
  for (const e of evs) {
    const b = bytesOf(e);
    if (!b) continue;
    trk.push(...vlq(e.tick - last), ...b);
    last = e.tick;
  }
  const end = Math.max(last, Math.round(t.durationMs * perMs));
  trk.push(...vlq(end - last), 0xff, 0x2f, 0x00);
  return new Uint8Array([...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(ppq & 0x7fff),
    ...ascii('MTrk'), ...u32(trk.length), ...trk]);
}

/**
 * A Standard MIDI File → a take.
 * @param {Uint8Array|ArrayBuffer|number[]} bytes
 * @param {{ name?: string, families?: 'both'|'legacy'|'channel' }} [opts] which signal spellings to produce (default both, like hardware)
 * @returns {object} a take (meta.bpm = the file's first tempo)
 */
export function fromMidiFile(bytes, { name, families = 'both' } = {}) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let p = 0;
  const need = (n) => { if (p + n > u8.length) throw new RangeError('fromMidiFile: file ends early'); };
  const rd32 = () => { need(4); const v = ((u8[p] << 24) >>> 0) + (u8[p + 1] << 16) + (u8[p + 2] << 8) + u8[p + 3]; p += 4; return v; };
  const rd16 = () => { need(2); const v = (u8[p] << 8) | u8[p + 1]; p += 2; return v; };
  const rdVlq = () => { let v = 0, b, n = 0; do { need(1); b = u8[p++]; v = v * 128 + (b & 0x7f); } while (b & 0x80 && ++n < 4); return v; };
  const tag = () => { need(4); const s = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]); p += 4; return s; };

  if (tag() !== 'MThd') throw new TypeError('fromMidiFile: not a MIDI file (no MThd)');
  const hlen = rd32(), hstart = p;
  rd16(); const ntrks = rd16(), division = rd16();
  p = hstart + hlen;

  const events = [], tempos = [];
  let trackName = null, endTick = 0, order = 0;
  for (let tr = 0; tr < ntrks && p < u8.length; tr++) {
    const id = tag(), len = rd32(), stop = p + len;
    if (id !== 'MTrk') { p = stop; tr--; continue; }
    let tick = 0, status = 0;
    while (p < stop) {
      tick += rdVlq();
      need(1);
      let b = u8[p];
      if (b === 0xff) {                                     // meta
        const type = u8[p + 1]; p += 2;
        const l = rdVlq(); need(l);
        const data = u8.subarray(p, p + l); p += l;
        if (type === 0x51 && l === 3) tempos.push({ tick, us: (data[0] << 16) | (data[1] << 8) | data[2] });
        else if (type === 0x03 && trackName === null && l) trackName = new TextDecoder().decode(data);
        else if (type === 0x2f) { endTick = Math.max(endTick, tick); break; }
        continue;
      }
      if (b === 0xf0 || b === 0xf7) { p++; const l = rdVlq(); need(l); p += l; continue; }   // sysex: skipped
      if (b & 0x80) { status = b; p++; } else if (!status) throw new TypeError('fromMidiFile: data byte without a status');
      const type = status & 0xf0, ch = (status & 0x0f) + 1;
      const two = type !== 0xc0 && type !== 0xd0;
      need(two ? 2 : 1);
      const d1 = u8[p++] & 0x7f, d2 = two ? u8[p++] & 0x7f : 0;
      let ev = null;
      if (type === 0x90 && d2 > 0) ev = { type: 'noteon', ch, note: d1, vel: d2 };
      else if (type === 0x90 || type === 0x80) ev = { type: 'noteoff', ch, note: d1, vel: 0 };
      else if (type === 0xb0) ev = { type: 'cc', ch, cc: d1, value: d2 };
      else if (type === 0xe0) ev = { type: 'pitchbend', ch, value: (d2 << 7) | d1 };
      else if (type === 0xd0) ev = { type: 'chanat', ch, value: d1 };
      else if (type === 0xa0) ev = { type: 'polyat', ch, note: d1, value: d2 };
      if (ev) events.push({ ...ev, tick, order: order++ });
      endTick = Math.max(endTick, tick);
    }
    p = stop;
  }

  // ticks → ms
  let toMs;
  if (division & 0x8000) {
    const fps = 256 - (division >> 8), tpf = division & 0xff;     // SMPTE: -fps in the high byte
    toMs = (tick) => (tick * 1000) / (fps * tpf);
  } else {
    const ppq = division || 480;
    const map = [{ tick: 0, us: 500000, ms: 0 }];
    for (const tp of tempos.sort((a, b) => a.tick - b.tick)) {
      const prev = map[map.length - 1];
      const ms = prev.ms + ((tp.tick - prev.tick) * prev.us) / ppq / 1000;
      if (tp.tick === prev.tick) prev.us = tp.us; else map.push({ tick: tp.tick, us: tp.us, ms });
    }
    toMs = (tick) => {
      let seg = map[0];
      for (const s of map) { if (s.tick <= tick) seg = s; else break; }
      return seg.ms + ((tick - seg.tick) * seg.us) / ppq / 1000;
    };
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const out = [];
  for (const e of events) {
    const t = Math.round(toMs(e.tick) * 10) / 10;
    for (const s of signalsOfMidi(e, { families })) out.push({ t, ...s });
  }
  const meta = {};
  if (!(division & 0x8000)) meta.bpm = Math.round((60e6 / (tempos.length ? tempos[0].us : 500000)) * 100) / 100;
  return normalizeTake({ v: 1, name: name || trackName || 'take', createdAt: null, durationMs: toMs(endTick), events: out, meta });
}
