// @openav/score — the score and the director: a show's structure as segment lengths,
// and the modules that perform each segment. Pure logic, no DOM, no dependencies.
//
//   import { Score, Director } from '@openav/score';
//   const score = new Score({ cuts, cut: 'full' });
//   const director = new Director({ score, modules, api });
//   // per frame: director.update(timeline.t, dt, { holding: timeline.holding, playing: timeline.playing })
//
// createShow({ score: { cuts, modules } }) does all of this wiring for you. Docs: docs/score.md.

export { Score, ScoreError } from './score.js?v=0cfcfd4';
export { Director } from './director.js?v=0cfcfd4';
