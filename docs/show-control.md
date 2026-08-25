# Show control

The parts that turn a sketch into a performance.

## Timeline

```js
const timeline = new Timeline({
  params,
  total: 2400,                       // seconds
  automation: {
    growth: [[0, 0.2], [300, 1.0], [1200, 0.4]],   // [t, value] keyframes, linear
    mode:   [[0, 0], [600, 1], [1800, 2]],          // step params hold (no interp)
  },
  scenes: [
    { id: 'standby', t: -30, title: 'Standby', note: 'house lights · breathe' },
    { id: 'act1',    t: 0,   title: 'Act I',   note: 'single seeds only' },
    { id: 'act2',    t: 600, title: 'Act II',  note: 'full harmony' },
  ],
});
timeline.onSceneChange((i, scene) => { /* fire cues: sound, lights, OSC */ });
```

- negative scene times = pre-show standby (the clock shows -0:30)
- `jumpScene(±1)` (← → keys) is your emergency navigation — rehearse with it
- `timeline.rate` exists for rehearsal speed-through (`rate = 4`)

## The console (director's desk)

`mountConsole(el, { timeline, params, mapper, signals, midi })` gives you:
transport + scrubber with scene blocks, param sliders with override/learn chips,
live signal meters, MIDI log.

Keyboard: **Space** play/pause · **←/→** scenes · **R** reset · **T** performance
mode · **F** fullscreen.

Override semantics: touch a slider (or a mapped control) and that param leaves
the timeline's hands until you clear it (✕). Yellow label = overridden.

## Performance mode

**T** flips to a fullscreen teleprompter: current scene title + note in stage-
readable type, next scene preview, clock + scene countdown. This is for the
*performer*; the audience-facing window is your stage in fullscreen (**F**).
Two windows of the same page = one desk, one stage.

## Backstage monitor

```bash
node packages/monitor/server.js       # on the performance machine or any LAN box
# stage manager's phone/laptop: http://<machine-ip>:7457/
```

The performance page streams snapshots automatically if you added the two
monitor lines from the examples. Backstage shows clock/scene/world/FPS/overrides,
all signals and params live, and a red "stage feed lost" banner if the stage
stops sending for 4 s — which is exactly the moment a stage manager earns their
pay. Zero configuration, zero dependencies, reconnects itself.

## OSC output

```bash
node packages/osc/bridges/osc-bridge.js 7456 192.168.1.50 3456
#                       http port ↑    target host ↑   udp port ↑
```

```js
const osc = new OscOut();          // http://127.0.0.1:7456
await osc.enable();                // probes /health, fails gracefully
osc.send('/source/3/xyz', [x, y, z]);
osc.flush();                       // once per frame (batches, dedupes per address)
```

Numbers go out as OSC floats — what Spat, Reaper, and TouchDesigner expect.

## MIDI output & panic

`midi.noteOn/noteOff/cc/send` — and `midi.panic()` sends all-notes-off +
all-sound-off + sustain-off + per-note note-offs on all 16 channels, through the
same observable throat as everything else. Bind it to a pad you can find in the
dark. Every performer eventually needs it; ours is one call.

## Pre-show checklist

- [ ] Chrome, plugged in, screen-sleep off, notifications off (`chrome://settings`)
- [ ] WebMIDI permission granted for this origin (it's per-origin, per-port)
- [ ] mapping profile saved (mapper.save()) AND exported to a JSON file
- [ ] monitor relay running; stage manager's device on the same network
- [ ] rehearse the failure: kill the tab, restart, be performing again in <30 s
