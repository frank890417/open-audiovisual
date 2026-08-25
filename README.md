# open-audiovisual

> **A web-native framework for audiovisual performance.**
> Input (MIDI · audio · chords · body) → Mapping → algorithmic worlds → Output —
> with a timeline, a director's console, and a backstage monitor.
>
> Hydra gives you improvisation. cables gives you a platform. Tone gives you sound.
> **open-audiovisual gives you a *show*.**

Everything TouchDesigner-class tools do on a desktop, the browser can now do with a URL:
WebGL/WebGPU rendering, Web MIDI, realtime audio analysis, on-device pose tracking.
What's been missing is the *chassis* — the part everyone rebuilds for every performance:
MIDI plumbing, signal-to-parameter mapping, a timeline with scenes and cues, a
performance mode, a backstage view. This repo is that chassis.

**Zero build step. Zero dependencies.** Clone it, run one file, you're on stage:

```bash
git clone https://github.com/frank890417/open-audiovisual.git
cd open-audiovisual
node serve.js          # → http://localhost:8080  (Chrome: WebMIDI + camera)
```

Optional companions (each ~100 dependency-free lines, run in their own terminal):

```bash
node packages/monitor/server.js           # backstage monitor for the stage manager (:7457)
node packages/osc/bridges/osc-bridge.js   # OSC → UDP bridge (Spat, Reaper, TD, lights…)
```

## The architecture (4 layers + 2 spines)

```
┌────────────────────────────────────────────────────────────┐
│ L1 INPUT — "what is happening"                             │
│   @openav/midi   @openav/audio   @openav/chord  @openav/pose│
│   → all publish named, normalized SIGNALS                  │
│     midi/cc/74 · chord/consonance · audio/rms · pose/hand/…│
├────────────────────────────────────────────────────────────┤
│ L2 MAPPING — "what it means"            @openav/mapping    │
│   signal → param routes: curve · range · smooth ·          │
│   many-to-many · live LEARN (works for knobs AND hands)    │
├────────────────────────────────────────────────────────────┤
│ L3 WORLD — "how the system behaves"     @openav/stage      │
│   a World sees params, never inputs. p5 / three / canvas / │
│   anything. Swap works; keep the shell.                    │
├────────────────────────────────────────────────────────────┤
│ L4 OUTPUT — "how it leaves the browser" (video ∥ audio)    │
│   video: screen · future NDI                               │
│   audio: @openav/midi out · @openav/sound (Tone.js engine) │
│          · @openav/osc → UDP bridge                        │
├────────────────────────────────────────────────────────────┤
│ ⏱ @openav/timeline — param automation + scenes/cues        │
│ 📟 @openav/monitor — backstage: clock, scene, signals, FPS  │
│ 🎛 @openav/console — desk · Layers live view · perf mode     │
└────────────────────────────────────────────────────────────┘
```

Two rules make the whole thing composable:

1. **Signals are the only currency of input.** A knob, a raised hand, and a chord's
   consonance are equal citizens with names. That equality *is* input fusion.
2. **Worlds never know who is performing them.** A world reads params. Whether a
   param came from the timeline, a MIDI knob, a dancer's wrist, or a slider is
   invisible to it — so the same world can be played by a pianist, a dancer,
   or an automation curve.

## Examples

| | what it teaches |
|---|---|
| [`01-hello-particles`](examples/01-hello-particles/) | the smallest complete app — read `main.js` top-to-bottom and you know the framework |
| [`02-chord-garden`](examples/02-chord-garden/) | performance semantics: triads bloom, clusters decay (lineage: *The Last Input*, IRCAM 2026) |
| [`03-pose-field`](examples/03-pose-field/) | the body as controller: MediaPipe pose → mapper → flow field |
| [`04-webtoe-stage`](examples/04-webtoe-stage/) | the sister stack: a WebToe node patch performed as a World (`ext()` bindings) |
| [`05-prebiotic-flake`](examples/05-prebiotic-flake/) | a 2023 MIDI daily sketch replayed through the chassis — with the L4 audio branch singing (Tone.js) |
| [`06-cylinder-earth`](examples/06-cylinder-earth/) | voice-controlled WEBGL towers (2020) — the mic analyzer's bands & drum onsets (kick/snare/hat) as instruments |
| [`07-firework-festival`](examples/07-firework-festival/) | fireworks launched by closing a finger pinch (2021, PoseNet-era) — 21-landmark hands, four precise controllers |

All examples run without MIDI hardware — every stage ships an on-screen piano
(@openav/keys: QWERTY capture, Z/X octave) and a **simulated performer** that
plays the piece hands-free. 01/02 run fully offline. Keys: **Space** play · **←/→** scene jump · **T** performance mode · **F** fullscreen.

Examples are assembled with **`createShow()`** (`@openav/show`) — a World plus one
declarative call; the layer-aligned side panel, inputs, sound, and backstage all
come from the factory, so every work evolves together when the framework grows.

**Artwork attribution**: examples 05–07 integrate original artworks by
**Che-Yu Wu 吳哲宇** (2020–2023), used here strictly as demos — the framework is
MIT, the artworks remain © the artist, all rights reserved.

## Agent-native

Worlds are visual code, and coding agents are good at code — so this repo ships
agent-ready: [`AGENTS.md`](AGENTS.md) gives any AI coding agent the layer
contracts and conventions, and the bundled `/create-world` skill
([.claude/skills/create-world](.claude/skills/create-world/SKILL.md)) scaffolds a
runnable work from a natural-language description ("a jellyfish world that blooms
on consonant chords"). Describe the performance; the agent writes the World; the
chassis does the rest. An **MCP server** ships in the box (`.mcp.json`,
zero-dependency stdio): `list_examples` · `read_doc` · `scaffold_world` ·
`run_checks` — connect any MCP-capable agent and it can inspect, scaffold, and
verify a performance. (Positioning kin: [open-slide](https://github.com/1weiho/open-slide),
which does this for slide decks.)

## A world in 20 lines

```js
export const myWorld = {
  name: 'pulse',
  params: [{ key: 'rate', min: 0, max: 10, def: 2, label: 'Rate' }],
  init({ container, signals }) {
    this.view = createCanvas(container);
    this.r = 0;
    signals.on('midi/note/on', ({ vel }) => { this.r = 100 * vel; });
  },
  update(dt, state) { this.r = Math.max(0, this.r - dt * 60); this.rate = state.rate; },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 20 + this.r, 0, 7); ctx.fill();
  },
  dispose() { this.view.dispose(); },
};
```

Register it on a `Stage`, feed it a `Timeline`, mount the `Console` — see
[`examples/01-hello-particles/main.js`](examples/01-hello-particles/main.js) for
the ~40 lines of assembly.

## Design lineage

The core of this framework was extracted from **The Last Input** (Che-Yu Wu, 2026 —
C-LAB Taiwan Sound Lab / IRCAM residency, performed on a 49.4-channel speaker dome).
The timeline, chord semantics, many-to-many MIDI-learn, and OSC batching all drove a
real 14-scene show before they were generalized here. The mapping-layer philosophy
descends from [libmapper](http://libmapper.github.io/)'s signal-namespace research.

## Docs

- [Architecture](docs/architecture.md) — the layer contracts, in detail
- [Writing a world](docs/writing-a-world.md)
- [Signals reference](docs/signals.md) — names published by each input package
- [Show control](docs/show-control.md) — timeline, scenes, performance mode, monitor, OSC

## Sister project: WebToe

[**WebToe**](https://github.com/frank890417/WebToe) is a web-native, node-based
dataflow engine (TouchDesigner-style, imports real `.toe` projects). The two are
halves of one stack: **WebToe is the engine, open-audiovisual is the show** —
a WebToe network can become an openav World, and openav's inputs (MIDI, chords,
pose) map naturally onto CHOP channels. Integration adapter is on the roadmap.

## Status & roadmap

`v0.1` — four layers (with the L4 video/audio split) + timeline + console +
monitor + on-screen piano & simulated performer + 5 examples (including the
WebToe sister-stack world and a Tone.js-voiced 2023 sketch), tests green.
Planned: audience-device inputs (phones as sensors via QR), signal recording/replay,
more sound engines behind the @openav/sound contract, WebGPU world adapter,
NDI gateway research. See [docs/roadmap.md](docs/roadmap.md).

## License

MIT — build shows, teach classes, fork worlds. Attribution appreciated, not required.
