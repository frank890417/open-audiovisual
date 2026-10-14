// 14 · timeline — the show, declared as data. No DOM and no bare imports, so tests/example-timeline.test.js
// can check it in Node: params, scenes (with cues) and one lane of keyframes per automated param.
//
// What @openav/timeline does with a lane: it reads `[[t, value, curve?], …]` and interpolates between keyframes.
// The third item names how the segment ENDING at that keyframe gets there: 'linear' (the default), 'ease',
// 'in', 'out' or 'step' (hold the old value, then jump). The lane below keeps the few anchors a human would place;
// compile() only hands them over in the timeline's format.

export const TOTAL = 40;

export const PARAMS = [
  { key: 'hue',     label: 'Hue',     min: 0,   max: 420,  def: 200 },    // 0..420 so a lane can keep rising through red; the world wraps it
  { key: 'speed',   label: 'Speed',   min: 0,   max: 4,    def: 0.3 },
  { key: 'density', label: 'Density', min: 30,  max: 900,  def: 60 },
  { key: 'zoom',    label: 'Zoom',    min: 0.5, max: 2,    def: 0.7 },     // the camera
  { key: 'shape',   label: 'Shape',   min: 0,   max: 3,    def: 0, step: 1 },   // 0 circle · 1 triangle · 2 square · 3 hexagon
  { key: 'flash',   label: 'Flash!',  pulse: true },
  { key: 'ripple',  label: 'Ripple!', pulse: true },
];

// scenes: where the show changes character. `cues` are one-shot events inside a scene: the console
// scrubber draws scene.cues ({name, t}) as ticks, and the timeline fires them when the playhead PLAYS over them (onCue).
export const SCENES = [
  { id: 'dawn',      t: 0,  title: 'Dawn',      note: 'a slow circle, almost still' },
  { id: 'swell',     t: 8,  title: 'Swell',     note: 'it learns corners and speeds up', cues: [{ name: 'ripple', t: 8 }, { name: 'ripple', t: 14 }] },
  { id: 'drop',      t: 20, title: 'Drop',      note: 'everything jumps at once',        cues: [{ name: 'flash', t: 20 }, { name: 'flash', t: 25 }] },
  { id: 'afterglow', t: 30, title: 'Afterglow', note: 'it falls back to a circle',       cues: [{ name: 'ripple', t: 32 }] },
];

// one lane per automated param. [time, value, curve the segment ENDING here uses]
export const LANES = [
  { key: 'hue',     tag: 'ease',          anchors: [[0, 200], [12, 262, 'ease'], [20, 330, 'ease'], [30, 395, 'ease'], [40, 215, 'ease']] },
  { key: 'speed',   tag: 'linear · in · step · out', anchors: [[0, 0.3], [8, 0.3], [16, 1.6, 'in'], [20, 3.4, 'step'], [25, 3.4], [30, 0.8, 'out'], [40, 0.2, 'linear']] },
  { key: 'density', tag: 'in · out · ease', anchors: [[0, 60], [8, 120], [20, 420, 'in'], [24, 800, 'out'], [30, 800], [40, 120, 'ease']] },
  { key: 'zoom',    tag: 'ease · in · step', anchors: [[0, 0.7], [10, 0.85, 'ease'], [19.5, 1.1, 'in'], [20, 1.9, 'step'], [30, 1.0, 'out'], [40, 0.7, 'ease']] },
  { key: 'shape',   tag: 'step',          anchors: [[0, 0], [8, 1], [14, 2], [20, 3], [30, 0]] },
];

/** lanes → the `automation` object the Timeline wants: { key: [[t, value, curve?], …] } (copies, so a recording never edits the declaration) */
export function compile(lanes) {
  return Object.fromEntries(lanes.map(({ key, anchors }) => [key, anchors.map((a) => [...a])]));
}

/** every cue of every scene, with its scene id, in time order */
export function cues(scenes = SCENES) {
  return scenes.flatMap((s) => (s.cues || []).map((c) => ({ ...c, scene: s.id }))).sort((a, b) => a.t - b.t);
}
