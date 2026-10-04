# Core concepts

Six words carry the whole framework: signal, param, route, world, timeline,
show. This chapter defines each one and the two rules that hold them together.

## Signals

A **signal** is a named value that says what is happening: a knob's position,
the loudness of the room, the height of a wrist, the consonance of the last
chord. Every input package publishes signals into one registry (`Signals` from
`@openav/core`) and does nothing else. Signals are the only currency of input.

There are two kinds:

| kind | holds | example | read it with |
|---|---|---|---|
| continuous | a current value, usually 0..1 | `midi/cc/74` = 0.42 | `signals.get(name)`, `signals.norm(name)` |
| pulse | the payload of the last event | `midi/note/on` → `{ note: 60, vel: 0.8, … }` | `signals.on(name, cb)` |

Names are paths, source first: `midi/cc/74`, `audio/band/low`,
`pose/hand/right/y`, `phone/ab12/tilt/x`, `surface/main/hue`. Ranges are
normalized where that makes performance sense, and y axes are flipped so that
1 means *raised*, never raw pixels.

A signal is declared with its range so that meters and *learn* can scale it:

```js
signals.define('breath/pressure', { min: 0, max: 1, source: 'breath' });
signals.set('breath/pressure', 0.37);               // continuous
signals.define('breath/sigh', { kind: 'pulse' });
signals.pulse('breath/sigh', { depth: 0.8 });       // pulse
```

`set()` on a name nobody declared defines it on the spot as continuous 0..1. If
your values live elsewhere (degrees, MIDI note numbers), declare the range first.

A knob, a raised hand and a chord's consonance are equal citizens in this
registry. That equality is what lets you mix them: a hand can do whatever a
knob does.

## Params

A **param** is a value the world listens to: `hue`, `bloom`, `gravity`. The
world declares its params; each one is a line of schema:

```js
{ key: 'energy', label: 'Energy', min: 0, max: 1, def: 0.3 }
{ key: 'mode', label: 'Mode', min: 0, max: 3, def: 0, step: 1 }   // stepped: snaps, holds on the timeline
{ key: 'burst', label: 'Burst!', pulse: true }                      // a trigger, not a level
```

Every frame each param resolves to one number:

```text
timeline automation at time t      (the score; def if the param has no automation)
  ⬑ overridden by → the latest override   (a slider, a mapped knob, a phone fader)
```

An override is *sticky*. Once a hand or a route has touched `bloom`, the
timeline stops moving it until the override is cleared (✕ in the console, or
`params.clearOverride('bloom')`). That matches the stage: when a human grabs a
control, the score yields.

The full field list is in [Writing a world](writing-a-world.md#params).

## Routes and mapping

A **route** connects one signal to one param. Routes are plain data:

```js
{ source: 'pose/hand/right/y', target: 'energy', curve: 'smooth', smooth: 0.15 }
```

The **mapper** (`@openav/mapping`) holds the routes and applies them: it reads
the signal, clamps it into a window (`inMin`..`inMax`), optionally inverts it,
bends it with a curve, scales it into the param's range and, if asked, smooths
it over time. One signal may drive several params and one param may listen to
several signals. *Learn* binds the next signal that moves, which works for a
knob and for a waving hand alike. Routes serialize to JSON, so a wiring is a
file you can carry to the next venue. Details: [Mapping](mapping.md).

## Worlds

A **world** is the piece: an object with a name, its params, and
`init` / `update` / `render` / `dispose`. It reads resolved params every frame
and may subscribe to signals for discrete events. It brings its own renderer:
2D canvas, p5, three.js, a WebToe patch, DOM, anything. The framework has no
opinion. Details: [Writing a world](writing-a-world.md).

## Timeline and scenes

The **timeline** (`@openav/timeline`) is the score: keyframed automation per
param, plus a list of scenes with titles and notes for the performer. It owns
time; worlds never read the clock. Scenes may start before zero for a pre-show
standby. Details: [Show control](show-control.md#timeline).

## The show

A **show** is a world plus one `createShow()` call (`@openav/show`). It builds
the signals registry, the params, the stage, the timeline, the mapper, the
inputs you ask for, sound, the console, the backstage feed and the frame loop,
and returns all of them. Every example is a world plus this call, so when the
framework grows a module, every show can have it by declaring it.

```js
const show = await createShow({
  world,
  timeline: { total: 120, automation, scenes },
  routes: [{ source: 'audio/rms', target: 'energy', smooth: 0.1 }],
  modules: { keys: { base: 48 }, chord: true, audio: true, sound: true },
});
```

## The two rules

Two rules make the framework composable. They come in two forms: one says how
the system is designed, the other says what that asks of anyone writing code
for it.

**1. Signals are the only currency of input. So: continuous control goes
through params; discrete events may use signals.**

A world that reads `signals.get('midi/cc/74')` inside `update()` still works,
today, with your controller. But it can no longer be driven by the timeline, by
a dancer's wrist, by a phone, or by someone else's controller. You have welded
the performance to one input. Declare a param instead and let a route connect
`midi/cc/74 → yourParam`. The same world then works for everyone, and the
console, the phone surface and *learn* all see the param.

Events are different. "A note was struck", "a chord resolved", "a kick hit" are
moments, not levels. Subscribing to them in `init()` is correct and encouraged;
it is what makes a world *react* rather than just drift.

**2. Worlds never know who is performing them. So: the shell never knows the
work.**

A world reads params, and whether a value came from the timeline, a MIDI knob, a
dancer or a slider is invisible to it. The same holds for the framework: never
edit `packages/*` to make one example look right. A framework change has to make
every work better. Switching works means swapping a world and its data; the
shell stays.
