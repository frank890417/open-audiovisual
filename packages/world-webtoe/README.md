# @openav/world-webtoe

L3 world · performs a [WebToe](https://github.com/frank890417/WebToe) node patch
as a world. The patch runs in an iframe; whenever a resolved param changes, the
values are posted into it (`{ type: 'webtoe:ext', values }`), and every patch
parameter written as `ext('name', fallback)` follows.

```js
import { createShow } from '@openav/show';
import { webtoeWorld } from '@openav/world-webtoe';

const world = webtoeWorld({
  name: 'garden-patch',
  project: new URL('./garden.webtoe.json', location.href).href,   // the app fetches it: CORS must allow it
  params: [
    { key: 'speed', min: 0, max: 1, def: 0.5 },
    { key: 'hue', min: 0, max: 360, def: 205 },
  ],
  extra: (state, out) => { out.hueRad = state.hue * Math.PI / 180; },   // derive more ext() values
});
const show = await createShow({ world, routes: [{ source: 'midi/cc/1', target: 'speed' }] });
```

## Exports

`webtoeWorld({ name = 'webtoe', app = 'https://webtoe.openaudiovisual.com/', project = null, params = [], extra = null })` → a world
- `app`: the WebToe app to embed; `project` (a `.webtoe.json` URL) is passed as `?project=`
- `params`: an openav param schema; the keys are the `ext()` names in the patch
- `extra(state, out)`: add derived values to `out` every frame
- the iframe may use the camera and microphone

Working example: `examples/04-webtoe-stage`.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-world-webtoe)
