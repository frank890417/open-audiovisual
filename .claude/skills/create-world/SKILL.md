---
name: create-world
description: Scaffold a new open-audiovisual work (a World + example page) from a natural-language description of the performance. Use when the user asks to "create a world", "make a new work/piece/visual", or describes an audiovisual idea they want performable (e.g. "a jellyfish world that blooms on consonant chords").
---

# create-world

Turn a described performance idea into a runnable example. The chassis (MIDI,
mapping, timeline, console, monitor) already exists — you only write the World.

## Steps

1. **Extract the performance design from the description** (ask only if truly ambiguous):
   - What *inputs* matter? (chords → `@openav/chord`, body → `@openav/pose`,
     loudness/onsets → `@openav/audio`, knobs/keys → `@openav/midi`)
   - What are the *performable params*? (3–6 is right; each must audibly/visibly matter)
   - What *events* trigger discrete reactions? (note-on, chord/event, audio/onset)
   - Does it have *acts*? → scenes + automation keyframes.

2. **Scaffold**: copy `examples/01-hello-particles/` → `examples/<nn>-<slug>/`
   (next free number). For chord-driven works, `02-chord-garden` is the better donor;
   for camera-driven, `03-pose-field`.

3. **Write the World** per [docs/writing-a-world.md](../../../docs/writing-a-world.md):
   - continuous control ONLY via params (the mapper/timeline drive them)
   - discrete reactions via `signals.on(...)` in `init`
   - `dispose()` must release everything (worlds get hot-swapped)
   - renderer: default to the built-in 2D `createCanvas`; use three.js via CDN
     import map only when 3D is essential.

4. **Wire the assembly** in `main.js`: params → timeline (scenes with performer
   notes — they show in the teleprompter) → mapper routes as data (declared
   defaults; the performer can re-learn live) → console + monitor lines verbatim
   from the donor example.

5. **Verify before handing back**:
   - `node serve.js` → the page loads with zero console errors
   - QWERTY fallback produces visible reaction (never require hardware for a demo)
   - Space plays the timeline and something evolves over time
   - `npm test` still green if you touched any package logic (avoid — see AGENTS.md rule 2)

6. **Hand back**: URL path, the param list (what to map to knobs), the scene list
   (what the timeline does), and which signals it reacts to.
