# Roadmap

Guiding rule: the framework only grows features that a real show demanded.
(This is how the core was born — every module here drove an actual performance
before it was generalized.)

## v0.x — the chassis (now)

- [x] four layers: input (midi/audio/chord/pose) → mapping → world → output
- [x] timeline with scenes, negative standby time, cue hook
- [x] director's console + performance mode
- [x] backstage monitor (zero-dep WS relay, LAN devices)
- [x] OSC bridge; MIDI out with observable throat + panic
- [x] tests for all pure logic (chord, timeline, mapping, params)
- [x] mapping profile import/export UI (JSON file, drag-and-drop, `?map=<url>`, remembered per world)
- [x] example: audio-reactive world driven by a live instrument (mic) — `06-cylinder-earth`
- [x] drum machine with analyzer-shaped signals (`@openav/drums`)
- [x] on-screen MIDI controllers that mirror real hardware (`@openav/midi`, example 09)
- [x] a documentation site: [openaudiovisual.com/docs](https://openaudiovisual.com/docs/)
- [x] oav-p5: one line for any p5.js sketch, with controllers, a phone, the microphone, sound, a drum machine you can
  write as one line of rhythm, bars and cues, and video recording; versioned on its own ([changelog](https://openaudiovisual.com/changelog/))
- [x] one line of rhythm, TidalCycles/Strudel-style mini-notation (`@openav/pattern`)
- [x] values over time as TouchDesigner's CHOPs shape them: lag, envelope, speed, spring, trail (`@openav/chop`)
- [x] next to Strudel: what a program plays into OAV Virtual MIDI, an external MIDI clock, and `link=<room>` across
  tabs and computers ([With Strudel](strudel.md))
- [x] the whole show's automation as curves on the desk, curves written per segment of the score, automation saved and
  loaded as JSON, a timeline anchored to the wall clock ([Show control](show-control.md))
- [x] a route that trims the timeline or waits for pickup, and gives the param back (`@openav/mapping`)
- [x] several pages, one show: a leader and its followers, in one browser or across machines (`@openav/sync`)
- [x] a version for the whole framework and an address that never changes; a show in one file, with no clone
  ([Pin a version](getting-started.md#pin-a-version))
- [x] [Made with](https://openaudiovisual.com/made-with/): the works that run on it, each added by the person who made it

## So that nobody rebuilds this layer

The aim is that a performance on the web starts from here the way a website starts from a server someone else
already runs. A layer earns that when people can build on it without asking. What that takes, and where each part stands:

| part | there now | next |
|---|---|---|
| a version to depend on | 0.9.0, a pinned address, a changelog | 1.0: the World contract, the signal names and the profile format stop changing without a major version |
| a way in without the repository | one file and one `import` | the same for a controller page and a phone remote |
| formats others can read | controller profiles with a JSON Schema, exports to QLC+ and Mixxx, map files, the score | each format with its own version number; the profile format as something other tools adopt |
| controllers you can trust | 55 profiles, every number with its source, a page that checks a unit by hand | the first profiles checked on hardware; more from the people who own them |
| recipes for the room | OSC to TouchDesigner, lights and spatial audio | the picture into TouchDesigner, OBS and a projector; a venue checklist (a kiosk iPad, no network) |
| proof | the shows it came from | works by other people on [Made with](https://openaudiovisual.com/made-with/) |
| a place to ask | issues, a form to ask for a controller, a form to add a work | answers within days |

## v1.x — the show grows

- **Audience-device input** — *classic controller shipped* (`@openav/relay`, `@openav/surface`,
  `@openav/remote`): a zero-dep room server, `phone/{id}/*` sensors, a TouchOSC-style widget set,
  layout JSON, `autoSurface(params)`, feedback to the phone. Next:
  - [x] QR code on the join card (`@openav/remote/qr`, a ~150-line zero-dep encoder) — and on static hosts the show uses the public relay with a random room, so the examples on openaudiovisual.com take phones too
  - [ ] *experimental* surfaces: gesture/physics widgets, shared multi-user surfaces, audience-mode (many phones → aggregate signals like `crowd/tilt/mean`)
  - [ ] mic as a phone sensor; per-device profiles; layout editor / import-export UI
- **Score & Director** — *shipped* (`@openav/score`): cuts as segment lengths, derived versions, cues, `hold`, segment modules that fail alone, the prompter's acts, score → MIDI markers. Next:
  - [x] MIDI clock in: `MidiClock` (`@openav/midi`) follows start, stop and song position, and oav-p5's drum machine and `drumPhase` follow it (0.7)
  - [ ] the score on an external clock, and clock and transport out, so a DAW can be the master clock of the score, or follow it
  - [ ] a `clocks` table in the cut, only if a show needs engines on two different time lines (see [Score & Director](score.md#clocks-why-there-are-none))
  - [ ] a score editor on the desk: drag a segment's length, see every cue move
- **Signal recording & replay** — *MIDI takes shipped* (`@openav/record`: `TakeRecorder`,
  `TakePlayer`, `.mid` in and out; `EventLog` already records any signal beside a video). Next:
  replay the full signal stream (hands, body, audio analysis) into any world. Rehearse without
  the performer; archive the gesture, not just the video.
- **npm publish** of `@openav/*`, once 1.0 says what stays put (until then: [pin a version](getting-started.md#pin-a-version)),
  and docs pages that are themselves performable with the framework.
- **WebGPU world adapter** as WebGPU compute matures for particle/agent worlds.

## v2.x — the stage widens

- **The picture into video pipelines**: first as recipes with tools that exist (OBS Browser Source with NDI out,
  TouchDesigner's Web Render TOP). A gateway of our own (headless browser → NDI) only if a show needs what
  those cannot do.
- **Distributed performance**: multi-browser signal sync over WebRTC data
  channels — several machines, one signal space, geographically split ensembles.
  The clock half shipped: several pages perform one show, the followers chasing a leader's
  timeline over a BroadcastChannel or the room relay (`@openav/sync`). Signals still stay on
  the page that took them.
- **Agent performers**: LLM-driven agents subscribing to signals and writing
  params — improvising alongside humans (lineage: The Last Input's autonomous
  city agents).

## Non-goals

- a node-based visual editor (cables.gl does this well; we are a library)
- a synthesis toolkit of our own (Tone.js is the neighbor: `@openav/sound` wraps it
  behind a small engine contract, and `audio.input()` accepts its nodes)
- being a platform: your show is your repo, not an account on our server
