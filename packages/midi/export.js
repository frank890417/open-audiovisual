// @openav/midi · export — one profile as files other software reads.
//
// The point of keeping a controller as data: it can leave this project. toQxi() writes a QLC+ input profile (.qxi),
// toMixxx() a Mixxx mapping (.midi.xml plus a small .js). Pure text out, no DOM, no Web MIDI; tools/export-controller.mjs is
// the command line, and the site writes the same files next to each device page.
//
// What the two formats can hold differs from a profile. QLC+ has no faceplate, and Mixxx is not a description of a device at all:
// it binds controls to decks. So a .qxi is a faithful copy of the messages and LED values, and a .midi.xml is a starting point
// that gives every control something to do, for someone to remap in Mixxx's own Learning Wizard.

import { sysexBytes, sysexMessage } from './sysex.js?v=2adcbf3d';
import { normalizeProfile } from './profiles.js?v=2adcbf3d';
import { evidenceOf } from './verify.js?v=2adcbf3d';

const SITE = 'https://openaudiovisual.com/';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (n) => NOTE[n % 12] + (Math.floor(n / 12) - 1);
const hex = (n) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');
const labelOf = (c) => c.label && c.label !== c.id ? c.label : c.id;

// ------------------------------------------------------------------ QLC+
// How QLC+ numbers an input (plugins/midi/src/common/midiprotocol.h): CC 0–127, notes 128–255, note aftertouch 256–383,
// program change 384–511, channel aftertouch 512, pitch wheel 513. With the input's MIDI channel on Omni, the channel sits above
// bit 12. Values in a .qxi are 8-bit: MIDI value × 2, with 127 → 255 (MIDI2DMX in the same file).
const QLC_NOTE = 128, QLC_PROGRAM = 384, QLC_CHANAT = 512, QLC_BEND = 513;
const toDmx = (v) => (v === 127 ? 255 : v << 1);

/** Which channel number QLC+ gives one message. `omni` keeps the MIDI channel in the number. */
export function qlcChannel({ msg, ch = 1, cc, note, value = 0 }, { omni = true } = {}) {
  const n = msg === 'cc' ? cc : msg === 'note' ? QLC_NOTE + note : msg === 'program' ? QLC_PROGRAM + value : msg === 'chanat' ? QLC_CHANAT : QLC_BEND;
  return omni ? ((ch - 1) << 12) | n : n;
}

const QLC_TYPE = { knob: 'Knob', fader: 'Slider', wheel: 'Slider', strip: 'Slider', pad: 'Button', button: 'Button' };

function qlcEntries(p, omni) {
  const out = [];
  for (const c of p.controls) {
    if (c.type === 'keys') {
      for (let n = c.from; n <= c.to; n++) out.push({ number: qlcChannel({ msg: 'note', ch: c.ch, note: n }, { omni }), name: `${labelOf(c)} ${noteName(n)}`, type: 'Button' });
      continue;
    }
    const type = c.type === 'encoder' ? (c.relative ? 'Encoder' : 'Knob') : QLC_TYPE[c.type] || 'Button';
    const e = { number: qlcChannel(c, { omni }), name: labelOf(c), type };
    const L = c.led;
    // a .qxi lights a control through its own number, so an LED on another note or CC cannot be written
    if (L && (L.msg === c.msg) && (L.note ?? c.note) === c.note && (L.cc ?? c.cc) === c.cc) e.feedback = { low: toDmx(L.off ?? 0), high: toDmx(L.on ?? 127), ch: L.ch && L.ch !== c.ch ? L.ch - 1 : null };
    out.push(e);
  }
  return out.sort((a, b) => a.number - b.number);
}

/**
 * A profile as a QLC+ input profile. Controls on one channel other than 1, or on several, are numbered for an input whose MIDI
 * channel is set to Omni, the way QLC+'s own APC40 file does.
 * @param {object} profile
 * @param {{version?:string}} [o]   what goes in <Version>
 * @returns {string} the .qxi file
 */
export function toQxi(profile, { version = '1' } = {}) {
  const p = normalizeProfile(profile);
  const chans = new Set(p.controls.map((c) => c.ch)), omni = chans.size > 1 || !chans.has(1);
  const L = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE InputProfile>',
    `<!-- ${esc(p.name)}: generated from ${SITE}controllers/${p.id}/ . ${omni ? 'Set the MIDI channel of this input to Omni in QLC+.' : ''} -->`.replace(/ \. *-->/, ' -->').replace(/ \. /, '. '),
    '<InputProfile xmlns="http://www.qlcplus.org/InputProfile">',
    ' <Creator>', '  <Name>Open Audiovisual</Name>', `  <Version>${esc(version)}</Version>`, `  <Author>${esc(p.origin?.author || 'openaudiovisual.com')}</Author>`, ' </Creator>',
    ` <Manufacturer>${esc(p.maker || 'Generic')}</Manufacturer>`,
    ` <Model>${esc(modelOf(p))}</Model>`,
    ' <Type>MIDI</Type>',
  ];
  for (const e of qlcEntries(p, omni)) {
    L.push(` <Channel Number="${e.number}">`, `  <Name>${esc(e.name)}</Name>`, `  <Type>${e.type}</Type>`);
    if (e.type === 'Encoder') L.push('  <Movement Sensitivity="1"/>');
    if (e.feedback) L.push(`  <Feedback LowerValue="${e.feedback.low}" UpperValue="${e.feedback.high}"${e.feedback.ch !== null ? ` MidiChannel="${e.feedback.ch}"` : ''}/>`);
    L.push(' </Channel>');
  }
  if (p.palette) {
    L.push(' <ColorTable>');
    for (const c of p.palette.colors) L.push(`  <Color Value="${c.value * 2}" Label="${esc(c.name || c.rgb)}" RGB="${esc(c.rgb.toLowerCase())}"/>`);
    L.push(' </ColorTable>');
    if (p.palette.channels?.length) {
      L.push(' <MidiChannelTable>');
      for (const c of p.palette.channels) L.push(`  <Channel Value="${c.ch - 1}" Label="${esc(c.name)}"/>`);
      L.push(' </MidiChannelTable>');
    }
  }
  L.push('</InputProfile>', '');
  return L.join('\n');
}

/** The model without the maker's name in front of it. */
function modelOf(p) {
  const name = p.name, maker = String(p.maker || '');
  for (const lead of [maker, maker.split(/\s+/)[0]]) if (lead && name.toLowerCase().startsWith(lead.toLowerCase() + ' ')) return name.slice(lead.length).trim();
  return name;
}

// ------------------------------------------------------------------ Mixxx
const DECKS = ['[Channel1]', '[Channel2]', '[Channel3]', '[Channel4]'];
const EQ = (deck, n) => ({ group: `[EqualizerRack1_${DECKS[deck]}_Effect1]`, key: `parameter${n}` });
/** Words on a button that say what it should do. Otherwise it takes the next job in line. */
const BUTTON_WORDS = [[/play|start/i, 'play', 'play_indicator'], [/cue/i, 'cue_default', 'cue_indicator'], [/sync/i, 'beatsync', 'sync_enabled'], [/loop/i, 'beatloop_4_toggle', 'loop_enabled']];
const BUTTON_JOBS = [['play', 'play_indicator'], ['cue_default', 'cue_indicator'], ['beatsync', 'sync_enabled'], ['pfl', 'pfl'], ['beatloop_4_toggle', 'loop_enabled'], ['keylock', 'keylock']];

/** What each control does in the mapping: [{ control, group, key, led? }]; controls with no job here are left out. */
export function mixxxBindings(profile) {
  const p = normalizeProfile(profile), out = [];
  const take = (control, group, key, led) => out.push({ control, group, key, ...(led ? { led } : {}) });
  const of = (t) => p.controls.filter((c) => c.type === t && c.msg !== 'pitchbend');
  const faders = [...of('fader'), ...of('strip'), ...of('wheel')];
  faders.forEach((c, i) => {
    if (/cross/i.test(labelOf(c))) take(c, '[Master]', 'crossfader');
    else if (/master|main/i.test(labelOf(c))) take(c, '[Master]', 'gain');
    else if (i < DECKS.length) take(c, DECKS[i], 'volume');
  });
  of('knob').concat(of('encoder').filter((c) => !c.relative)).slice(0, 8).forEach((c, i) => { const e = EQ(Math.floor(i / 3) % 2, 3 - (i % 3)); take(c, e.group, e.key); });
  of('encoder').filter((c) => c.relative).forEach((c, i) => { if (i === 0) take(c, '[Library]', 'MoveVertical'); else if (i <= 2) take(c, DECKS[i - 1], 'pregain'); });
  const pads = of('pad'), half = Math.ceil(pads.length / 2);
  pads.slice(0, 16).forEach((c, i) => { const deck = pads.length > 8 ? (i < 8 ? 0 : 1) : i < half ? 0 : 1, n = (pads.length > 8 ? i % 8 : i % half) + 1; take(c, DECKS[deck], `hotcue_${n}_activate`, `hotcue_${n}_enabled`); });
  let job = 0;
  for (const c of of('button')) {
    const said = BUTTON_WORDS.find(([re]) => re.test(labelOf(c)));
    const [key, led] = said ? said.slice(1) : BUTTON_JOBS[job % BUTTON_JOBS.length];
    if (!said) { if (job >= BUTTON_JOBS.length * 2) continue; job++; }
    take(c, DECKS[said ? 0 : Math.floor((job - 1) / BUTTON_JOBS.length)], key, led);
  }
  return out;
}

const statusOf = (c) => (c.msg === 'cc' ? 0xb0 : 0x90) | (c.ch - 1);
const midinoOf = (c) => (c.msg === 'cc' ? c.cc : c.note);
const safeName = (s) => s.replace(/[^A-Za-z0-9]+/g, '_');

/**
 * A profile as a Mixxx mapping: a starting point that gives each control a job, for someone to remap in Mixxx.
 * Relative encoders go through a small script, which also sends the profile's `sysex.connect` when Mixxx opens the device
 * and their `undo` when it closes it.
 * @param {object} profile
 * @returns {{xml:string, js:string, xmlName:string, jsName:string}}
 */
export function toMixxx(profile) {
  const p = normalizeProfile(profile), prefix = 'OAV_' + safeName(p.short);
  const jsName = `${p.id}.scripts.js`, xmlName = `${p.id}.midi.xml`;
  const bindings = mixxxBindings(p);
  const checked = p.controls.filter((c) => evidenceOf(c) === 'hardware').length;
  const left = p.controls.filter((c) => !bindings.some((b) => b.control.id === c.id)).map((c) => c.id);
  const encoders = bindings.filter((b) => b.control.type === 'encoder' && b.control.relative);
  const X = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<!-- Generated from ${SITE}controllers/${p.id}/ . A starting point: remap it with the Learning Wizard in Mixxx. -->`,
    ...(left.length ? [`<!-- Controls with no job here: ${left.join(' ')} -->`] : []),
    '<MixxxControllerPreset mixxxVersion="2.4+" schemaVersion="1">',
    '  <info>',
    `    <name>${esc(p.name)} (Open Audiovisual)</name>`,
    '    <author>openaudiovisual.com</author>',
    `    <description>Generated from the open profile of this controller, not hand-made. ${checked} of ${p.controls.length} controls checked on a real unit.</description>`,
    `    <forums>${SITE}controllers/${p.id}/</forums>`,
    '  </info>',
    `  <controller id="${esc(p.name)}">`,
    '    <scriptfiles>',
    `      <file functionprefix="${prefix}" filename="${esc(jsName)}"/>`,
    '    </scriptfiles>',
    '    <controls>',
  ];
  const control = (group, key, status, midino, option) => X.push('      <control>', `        <group>${esc(group)}</group>`, `        <key>${esc(key)}</key>`, `        <status>${hex(status)}</status>`, `        <midino>${hex(midino)}</midino>`, `        <options><${option}/></options>`, '      </control>');
  for (const b of bindings) {
    const c = b.control, status = statusOf(c), mid = midinoOf(c);
    if (encoders.includes(b)) { control('[Master]', `${prefix}.turn`, status, mid, 'script-binding'); continue; }
    control(b.group, b.key, status, mid, 'normal');
    if (c.msg === 'note') control(b.group, b.key, 0x80 | (c.ch - 1), mid, 'normal');   // a release: not every device says it with velocity 0
  }
  X.push('    </controls>', '    <outputs>');
  for (const b of bindings) {
    const L = b.control.led; if (!L || !b.led) continue;
    const ch = (L.ch ?? b.control.ch) - 1, status = (L.msg === 'cc' ? 0xb0 : 0x90) | ch, mid = L.msg === 'cc' ? L.cc ?? b.control.cc : L.note ?? b.control.note;
    X.push('      <output>', `        <group>${esc(b.group)}</group>`, `        <key>${esc(b.led)}</key>`, `        <status>${hex(status)}</status>`, `        <midino>${hex(mid)}</midino>`, `        <on>${hex(L.on ?? 127)}</on>`, `        <off>${hex(L.off ?? 0)}</off>`, '        <minimum>0.5</minimum>', '        <maximum>1</maximum>', '      </output>');
  }
  X.push('    </outputs>', '  </controller>', '</MixxxControllerPreset>', '');

  const connect = (p.sysex?.connect || []).map((id) => sysexMessage(p, id));
  const undo = connect.map((m) => m.undo && sysexMessage(p, m.undo)).filter((m) => m && (m.args || []).every((a) => a.default !== undefined));
  const list = (ms) => JSON.stringify(ms.map((m) => sysexBytes(m)));
  const targets = Object.fromEntries(encoders.map((b) => [`${statusOf(b.control)}:${midinoOf(b.control)}`, { group: b.group, key: b.key, mode: b.control.relative }]));
  const J = `// ${p.name}: generated from ${SITE}controllers/${p.id}/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var ${prefix} = {};

${prefix}.setup = ${list(connect)};
${prefix}.goodbye = ${list(undo)};
${prefix}.encoders = ${JSON.stringify(targets)};

${prefix}.init = function (id, debugging) {
    ${prefix}.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

${prefix}.shutdown = function () {
    ${prefix}.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

${prefix}.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

${prefix}.turn = function (channel, control, value, status, group) {
    var target = ${prefix}.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = ${prefix}.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
`;
  return { xml: X.join('\n').replace(/ \. A starting/, '. A starting'), js: J, xmlName, jsName };
}
