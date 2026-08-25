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
- [ ] mapping profile import/export UI (JSON file, not just localStorage)
- [ ] example: audio-reactive world driven by a live instrument (mic)

## v1.x — the show grows

- **Audience-device input**: QR code → phones join as sensors (touch, gyro, mic).
  The browser's unfair advantage: no native tool can hand every audience member
  a controller. Needs: a tiny room server + `phone/{id}/*` signal namespace.
- **Signal recording & replay**: record the full signal stream of a performance;
  replay it into any world. Rehearse without the performer; archive the gesture,
  not just the video.
- **npm publish** of `@openav/*` + a docs site that is itself built on the framework.
- **WebGPU world adapter** as WebGPU compute matures for particle/agent worlds.

## v2.x — the stage widens

- **NDI gateway**: headless-browser → NDI bridge so browser output enters
  professional video pipelines (research: WebRTC→NDI converters already exist).
- **Distributed performance**: multi-browser signal sync over WebRTC data
  channels — several machines, one signal space, geographically split ensembles.
- **Agent performers**: LLM-driven agents subscribing to signals and writing
  params — improvising alongside humans (lineage: The Last Input's autonomous
  city agents).

## Non-goals

- a node-based visual editor (cables.gl does this well; we are a library)
- audio synthesis (Tone.js is the neighbor; `audio.input()` accepts its nodes)
- being a platform: your show is your repo, not an account on our server
