# @openav/osc

L4 output · OSC from the browser. A browser cannot send UDP, so `OscOut` batches
messages per frame and posts them to a small zero-dependency Node bridge, which
sends them as OSC packets over UDP (Spat, Reaper, TouchDesigner, …).

```bash
node packages/osc/bridges/osc-bridge.js 7456 192.168.1.50 3456   # http port, target host, udp port
```

```js
import { OscOut } from '@openav/osc';
const osc = new OscOut();             // http://127.0.0.1:7456
await osc.enable();                   // probes /health; false if the bridge is not running
osc.send('/source/3/xyz', [x, y, z]);
osc.flush();                          // once per frame
```

`createShow()` does not create one. Add it yourself (and `"@openav/osc"` to the import map):

```js
const show = await createShow({ world, onFrame: () => osc.flush() });
show.app.osc = osc;                   // the Layers panel shows OSC traffic
show.stage.io.osc = osc;              // worlds can send from update(dt, state, io)
```

## Exports

| export | signature |
|---|---|
| `OscOut` | `new OscOut(url = 'http://127.0.0.1:7456')` · `enable()` → Promise<boolean> · `disable()` · `send(addr, args)` (queued) · `flush()` once per frame; only the latest message per address is sent · `rate()` → messages sent since the last call · `enabled` · hooks `onStatus(ok, info)`, `onMsg(addr, args)` |
| bridge | `node packages/osc/bridges/osc-bridge.js [httpPort=7456] [targetHost=127.0.0.1] [targetPort=3456]` (`npm run bridge`) · `POST /osc`, `GET /health` → `{ ok, udp, sent }` |

Numbers go out as OSC floats, anything else as strings. If the bridge disappears,
`onStatus(false, 'bridge lost')` fires and `OscOut` disables itself after 30-odd failed flushes in a row.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-osc)
