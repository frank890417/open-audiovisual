# Introduction

open-audiovisual (OAV) is a JavaScript framework for live audiovisual
performance that runs in the browser. It is plain ES modules: no build step, no
dependencies, no account. You clone the repository, run one file, and open a
page.

It handles the part every show rebuilds from scratch: MIDI plumbing, turning
inputs into parameters, a timeline with scenes, a director's console, a
performance mode for the performer, and a backstage page for the stage manager.
You write the *world*, the piece itself. The pitch, a live instrument and the
nine example works are on the [homepage](https://openaudiovisual.com/).

## Who it is for

- **Performers** play the examples with a MIDI keyboard, a microphone, a camera,
  a phone, or the on-screen piano, and drive a show from the console.
- **Coders** write a world in about twenty lines and get inputs, mapping,
  timeline, console, sound and backstage from one `createShow()` call.
- **AI agents** read [AGENTS.md](../AGENTS.md), connect to the bundled MCP
  server, and write worlds inside a chassis that already works. See
  [For AI agents](agents.md).

## Four layers and two spines

```text
L1 INPUT     "what is happening"       midi · audio · chord · pose · keys · drums · phones
               → every input publishes named SIGNALS: midi/cc/74, chord/consonance, audio/rms
L2 MAPPING   "what it means"           routes: signal → param, with curve, range, smoothing, learn
L3 WORLD     "how the system behaves"  your piece; reads PARAMS, never inputs; any renderer
L4 OUTPUT    "how it leaves"           screen · in-browser sound · MIDI out · OSC to UDP

spines       timeline (automation, scenes, cues) · monitor (backstage over WebSocket)
around them  console (the director's desk) · relay, surface, remote (phones as controllers)
```

Each layer has one job and a written contract ([Architecture](architecture.md)),
so any layer can be replaced without touching the others. Two rules keep it that
way; they are explained in [Core concepts](concepts.md#the-two-rules).

## Where it comes from

The core was extracted from **The Last Input** (Che-Yu Wu, 2026), a performance
for piano and a living digital world at the IRCAM residency × C-LAB Taiwan Sound
Lab in Taipei, played on a 49.4-channel speaker dome. The timeline, the chord
semantics, many-to-many MIDI learn and OSC batching all ran a real fourteen-scene
show before they were generalized here. The rule since then: the framework only
grows features that a real show asked for.

The mapping layer's ideas descend from [libmapper](http://libmapper.github.io/)'s
research on signal namespaces. The sister project
[WebToe](https://github.com/frank890417/WebToe) is a node-based dataflow engine
that imports TouchDesigner projects; WebToe is the engine, open-audiovisual is
the show.

## How to read this handbook

- New here: [Quick start](getting-started.md), then [Core concepts](concepts.md),
  then [Writing a world](writing-a-world.md).
- Building a show: [Inputs](inputs.md), [Mapping](mapping.md),
  [Show control](show-control.md), [Phones, relay & surfaces](remote.md).
- Looking something up: [Signals reference](signals.md) and
  [Package reference](packages.md).
- Something is wrong: [Troubleshooting](troubleshooting.md).

Everything here is checked against the source in
[packages/](../packages/). When this page and the code disagree, the code is
right and this page is a bug: please open an issue.
