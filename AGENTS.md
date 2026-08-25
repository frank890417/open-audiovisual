# AGENTS.md — for AI coding agents working in this repo

> Worlds are visual code. Agents are good at code. This framework is the bridge:
> a human describes a performance ("a jellyfish world that blooms on consonant
> chords"), you write a World inside a chassis that already handles MIDI, mapping,
> timeline, console, and backstage. (Positioning inspired by
> [open-slide](https://github.com/1weiho/open-slide), which does this for slides.)

## What this is

A zero-build, zero-dependency ESM framework for audiovisual performance.
Four layers + two spines — the contracts are in [docs/architecture.md](docs/architecture.md):

- **Input** (`packages/midi`, `audio`, `chord`, `pose`) → publishes named **signals**
- **Mapping** (`packages/mapping`) → routes signals to **params** (curves, smoothing, live learn)
- **World** (`packages/stage`) → algorithmic system that reads params, renders anything
- **Output** (`packages/osc`, MIDI out) + **Timeline** + **Console** + **Monitor**

## The two rules you must not break

1. **Continuous control goes through params; discrete events may use signals.**
   A world that reads `signals.get('midi/cc/74')` in `update()` is welded to one
   controller and can no longer be driven by the timeline or a dancer. Declare a
   param, let the mapper route to it.
2. **The shell never knows the work.** Never edit `packages/*` to make one
   example look right. Framework changes must make every example better.

## How to create a new work (the common request)

1. Copy `examples/01-hello-particles/` to `examples/<nn>-<name>/`.
2. Write the World object in `main.js` — the full contract is
   [docs/writing-a-world.md](docs/writing-a-world.md); it fits in ~20 lines minimum.
3. Declare params (what the piece is performed WITH), scenes and automation
   (what the timeline does), and any `signals.on(...)` event reactions.
4. Update the import map in `index.html` only if you use extra packages
   (`@openav/chord`, `@openav/pose`…). Signal names: [docs/signals.md](docs/signals.md).
5. Verify: `node serve.js` → open `http://localhost:8080/examples/<nn>-<name>/` —
   QWERTY keys A–L are the no-hardware MIDI fallback; Space plays the timeline.

## Verifying changes

- `npm test` — pure-logic tests (chord analysis, timeline, mapping). Add cases
  for any logic you touch; browser-only code is exercised via the examples.
- Manual smoke: every example must load with zero console errors (the
  `ws://…7457` monitor reconnect warning is expected when no relay runs).
- `window.openav` is exposed in every example for devtools/scripted poking.

## Conventions

- Vanilla ESM + JSDoc. No TypeScript, no build step, no runtime dependencies —
  a `<script type="module">` must be enough. This is a hard constraint, not taste.
- Comments explain *performance reasoning* (why a knob feels right), not syntax.
- New signals: path-style, source-first (`breath/pressure`), declared with
  `signals.define(name, {min, max})` so meters work.
- Keep the dark console theme; stage-readable contrast beats pretty.
