# @openav/remote

The phone / iPad end-node app and the show-side adapter.

**Phone**: open `http://<laptop-ip>:8080/packages/remote/?room=<name>` (`node serve.js` hosts the relay too).
Tabs — **感測** (tilt ball, accel, rotation, multi-touch pad, knock, light via front camera; iOS needs a tap on
開始 and HTTPS for motion/camera), **琴鍵** (landscape: one row of ~3 octaves; portrait: two stacked rows, upper
continues the range — not a shrunken piano), **控制台** (a surface). Query: `?tab=keys`, `?surface=<layout.json>`,
`?meta=<json with params>`, `?relay=ws://…`.

The 控制台 layout comes from, in order: `?surface=` → `?meta=` (autoSurface of its `params`) → whatever the show
publishes over the relay → a small generic panel.

**Show**: `createShow({ modules: { remote: true } })` (or `{ room, auto: {pairs, meters}, surface }`). It joins as
runner, pipes phone signals into `signals` (also as `phone/any/…`), publishes `world.surface` or
`autoSurface(world.params)`, adds the routes to the Mapper, echoes param values back as feedback, and shows a
join card (URL + connected phones). See `examples/08-remote-surface`.

**The show page itself on a phone** (no second device): `localSensors(signals)` → the phone's own tilt / accel /
rotation / knock as `phone/local/…` (mirrored to `phone/any/…`), same thresholds as the 感測 tab; call `.start()` from a
tap (iOS, HTTPS). Example 08 shows a "📱 this phone" button on touch devices; the lab's `motion` module is this.

Signals: [docs/signals.md](../../docs/signals.md#openavremote--openavsurface).
