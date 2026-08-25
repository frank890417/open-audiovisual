# Design: multi-device MIDI + the Patch Bay

*Status: accepted design, implementation phased (P-map-1 → 3). 2026-08-25.*

A show may have many MIDI devices at once — two keyboards, a knob box, pads, a
pedal, two performers with their own gear. Three things are needed:

1. device-aware signals (two controllers' CC74 must not collide)
2. a visual patching surface: which device feeds which param, at a glance
3. per-route signal conditioning (curve · range · smooth · combine)

## The key call: a patch bay, not a node graph

90% of stage wiring is "this knob → that param, with a curve and a smooth" —
the shape of an Ableton MIDI map, not a Max patch. So we split by complexity:

| need | tool |
|---|---|
| wiring + per-route conditioning | **@openav/patchbay** (planned) — a patch-bay UI over the Mapper |
| complex signal logic (conditions, oscillators, math chains) | a **WebToe patch** (sister project) via `ext()` — the node graph already exists there |

The Mapper's route array **already is** the patch bay's data model. The patch
bay is a *view* over it — no second engine, no second source of truth.

## P-map-1 · device-aware foundation

- `Midi` goes multi-port: each input gets a **slug from its port name**
  (`Arturia MiniLab 3` → `minilab-3`, second identical unit → `minilab-3-2`);
  signals become `midi/minilab-3/cc/74`.
- Slug-by-name (not port id) means a device that drops and reconnects
  (Bluetooth MIDI, loose cables) **keeps its routes** — no re-learning at the
  worst possible moment.
- Opt-in via `new Midi({ deviceNamespace: true })`; default stays single-device
  (`midi/cc/74`) so existing works don't change.
- Mapper routes gain `enabled` (mute a wire), `combine: last|max|add|avg`
  (two performers driving one param), `label` ("Ade's fader").

## P-map-2 · the patch bay UI

- Fullscreen overlay on **M** — open during setup, away during the show.
- Three columns: **Sources** (one box per device, live-activity signals;
  chord/audio/pose groups) · bezier **wires** · **Targets** (params grouped
  world / sound/*).
- Click source, click target = wire. A chip mid-wire opens the route inspector
  (curve/range/smooth/invert/combine/mute/delete).
- **Live dots flow along wires with signal activity** — soundcheck becomes
  "look at the board": a dead device or unplugged cable is visibly dark.
- Profiles: existing mapper JSON + file export/import (carry your wiring
  between venues). Offline devices grey out; their routes persist.
- Demo without hardware: **SimDevice** — virtual MIDI devices (the SimPlayer
  idea, per-device) so the full flow is teachable on any laptop.

## Non-goals

- no node graph in openav (that's WebToe's ground)
- no hardware-level MIDI merge/thru (that's a MIDI hub's job)
- no second mapping engine — the patch bay renders and edits Mapper routes, period
