# Writing a world

A world is the only part of the framework you *have* to write. Everything else
is assembly.

## The interface

```js
export const myWorld = {
  name: 'my-world',

  // params: what the world can be performed WITH.
  // These appear in the console, are automatable by the timeline,
  // and are mappable to any signal.
  params: [
    { key: 'energy', label: 'Energy', min: 0, max: 1, def: 0.3 },
    { key: 'mode',   label: 'Mode',   min: 0, max: 3, def: 0, step: 1 },  // step → hold, no interp
    { key: 'reset',  label: 'Reset',  pulse: true },                       // momentary trigger
  ],

  init(ctx) {
    // ctx = { container, signals, params }
    // build your renderer here: p5, three, or the built-in 2D helper:
    this.view = createCanvas(ctx.container);
    // discrete events may come straight from signals:
    this._unsub = ctx.signals.on('chord/event', (a) => this.onChord(a));
    ctx.params.onPulse('reset', () => this.reset());
  },

  update(dt, state, io) {
    // state = resolved param values. This is your ONLY continuous input.
    // io = { signals, midi?, osc? } for OUTPUT (sound triggers, spat positions)
  },

  render() { /* draw */ },

  dispose() { this._unsub?.(); this.view.dispose(); },
};
```

## The one rule people break

**Continuous control goes through params. Events may use signals.**

If your world reads `signals.get('midi/cc/74')` directly in `update()`, it still
works — today, with your controller. But it can no longer be driven by the
timeline, by a dancer, or by someone else's controller profile. You've welded
the performance to one input. Route it: declare a param, let the mapper connect
`midi/cc/74 → yourParam`, and the same world works for everyone.

Events are different: "a note was struck", "a chord resolved", "an onset hit" are
moments, not levels. Subscribing to those in `init()` is correct and encouraged —
that's what makes worlds *reactive* rather than just modulated.

## Sound output from a world

`update(dt, state, io)` receives `io.midi` and `io.osc` if the assembly passed
them to the Stage. Typical patterns:

```js
// trigger a sampler note when something happens in the simulation
io.midi?.noteOn(48 + creature.species * 12, 90, 2);   // channel 2

// stream a position to a spatializer
io.osc?.send(`/source/${i}/xyz`, [x, y, z]);
```

## Using p5 or three.js

The framework doesn't bundle renderers. In your example's `index.html`, add the
CDN import; in the world, create/destroy the renderer in `init`/`dispose`.
See `examples/03-pose-field` for a raw-canvas world; a three.js world holds its
`WebGLRenderer` on `this` and calls `renderer.dispose()` in `dispose()`.

## Checklist before a show

- [ ] every continuous control is a param (try performing your world with ONLY the timeline)
- [ ] `dispose()` releases GPU objects and event subscriptions (worlds get switched live)
- [ ] world survives `dt` spikes (the Loop clamps to 100ms, but don't assume 16ms)
- [ ] nothing in the world reads the clock directly — the timeline owns time
