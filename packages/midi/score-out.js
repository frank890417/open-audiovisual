// @openav/midi · score-out — tell external software where the show is.
//
// The score knows when a segment starts and when a cue passes. An external program (a DAW, a
// lighting desk, a video server) that should follow the show cannot read the score, but it can
// read MIDI: launch a clip on a note, jump a scene on a CC. ScoreMidi turns those two events
// into notes and CCs on a channel of your choosing. It is OFF unless you create it.
//
//   const out = new ScoreMidi({ midi, channel: 15,
//     segment: { note: 36, cc: 20 },       // segment i → note 36 + i, and CC 20 = i
//     cue:     { note: 84, notes: { 'dusk.glow': 90 }, cc: 21 } });   // every cue → note 84 (or its own note), CC 21 = cue number
//   out.segment({ index: 2, cause: 'play' });          // createShow calls these two for you
//   out.cue({ name: 'dusk.glow', n: 4 });
//
// Markers go out only while the show PLAYS (or is released from a hold): dragging the scrubber
// does not launch clips in the DAW, unless `scrub: true`. Everything goes through the Midi
// engine's own noteOn/noteOff/cc, so the MIDI OUT meter shows it and panic() can silence it.
// A marker note is a trigger: its note-off follows `length` seconds later.
//
// This file does not import the score package: it reads plain events, so it works for any cue source.

const clamp7 = (n) => Math.max(0, Math.min(127, Math.round(n)));

export class ScoreMidi {
  /**
   * @param {object} o
   * @param {{noteOn:Function,noteOff:Function,cc:Function}} o.midi   a @openav/midi Midi (anything with those three)
   * @param {number} [o.channel=15]            1..16
   * @param {false|{note?:number|null,cc?:number|null,velocity?:number}} [o.segment]   segment i → note (note + i) and/or CC value i. false = no segment markers
   * @param {false|{note?:number|null,notes?:Object<string,number>,cc?:number|null,velocity?:number}} [o.cue]   cue → note (notes[name] ?? note) and/or CC value n (its order in the cut)
   * @param {number} [o.length=0.15]           seconds before a marker note's note-off
   * @param {boolean} [o.scrub=false]          also mark when the playhead is moved by hand
   * @param {boolean} [o.enabled=true]
   * @param {(fn:Function, ms:number)=>any} [o.timer]   setTimeout, replaceable in tests
   */
  constructor({ midi, channel = 15, segment = { note: 36 }, cue = { note: 84 }, length = 0.15, scrub = false, enabled = true, timer = (fn, ms) => setTimeout(fn, ms) } = {}) {
    if (!midi) throw new Error('ScoreMidi needs a Midi to send through');
    if (!(channel >= 1 && channel <= 16)) throw new Error('ScoreMidi channel must be 1..16');
    this.midi = midi;
    this.channel = channel;
    this.segmentOpts = segment === false ? null : { note: 36, cc: null, velocity: 100, ...segment };
    this.cueOpts = cue === false ? null : { note: 84, notes: {}, cc: null, velocity: 100, ...cue };
    this.length = length;
    this.scrub = scrub;
    this.enabled = enabled;
    this._timer = timer;
  }

  /** What a segment change sends: [{ type:'note'|'cc', number, value }] (also the unit-test surface). */
  segmentMessages(evt) {
    const o = this.segmentOpts;
    if (!o || !this._allowed(evt)) return [];
    const out = [];
    if (o.note != null) out.push({ type: 'note', number: clamp7(o.note + evt.index), value: clamp7(o.velocity) });
    if (o.cc != null) out.push({ type: 'cc', number: clamp7(o.cc), value: clamp7(evt.index) });
    return out;
  }
  /** What a cue sends. */
  cueMessages(evt) {
    const o = this.cueOpts;
    if (!o || !this._allowed(evt)) return [];
    const out = [];
    const note = o.notes && o.notes[evt.name] != null ? o.notes[evt.name] : o.note;
    if (note != null) out.push({ type: 'note', number: clamp7(note), value: clamp7(o.velocity) });
    if (o.cc != null) out.push({ type: 'cc', number: clamp7(o.cc), value: clamp7(evt.n ?? 0) });
    return out;
  }
  _allowed(evt) {
    if (!this.enabled) return false;
    const cause = evt.cause || 'play';
    if (cause === 'reset') return false;
    if (cause === 'seek' || cause === 'jump') return this.scrub;
    return true;
  }

  /** A segment began. evt: { index, cause? } (cause from Timeline.onSceneChange: play | release | seek | jump | reset). */
  segment(evt) { return this._send(this.segmentMessages(evt)); }
  /** A cue was passed. evt: { name, n } */
  cue(evt) { return this._send(this.cueMessages(evt)); }

  _send(msgs) {
    for (const m of msgs) {
      if (m.type === 'cc') this.midi.cc(m.number, m.value, this.channel);
      else {
        this.midi.noteOn(m.number, m.value, this.channel);
        this._timer(() => this.midi.noteOff(m.number, this.channel), this.length * 1000);
      }
    }
    return msgs;
  }
}
