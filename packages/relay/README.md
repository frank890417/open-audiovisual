# @openav/relay

Room-scoped WebSocket relay + browser client. Zero dependencies — the RFC 6455
codec is hand-rolled (`frames.js`, pure, tested), routing is pure logic
(`hub.js`), and `server.js` is ~70 lines of `http` glue.

```
node serve.js                     # dev server already hosts it at ws://host:PORT/relay
node packages/relay/server.js     # or standalone on :7458
RELAY_HOST=127.0.0.1 node packages/relay/server.js 8903   # bind to localhost behind a reverse proxy (TLS, rate limits)
```

Roles in a room (`?role=controller|runner|monitor&room=<name>&id=<device>`):

| from | to | what |
|---|---|---|
| controller (phone) | runner + monitor | `signal` / `batch` |
| runner (the show) | monitor | `signal` / `batch` |
| runner | controllers + monitors | `feedback` (meters, fader echo), `config` (the surface layout; replayed to late joiners) |
| monitor | nobody | |

Wire format = the cheyuwu-lab relay's (`{"type":"signal","name","value","t","pulse"?}`, `batch`,
`ping`/`pong`, `status`) plus `feedback` and `config`; clients ignore types they do not know.

```js
import { RelayClient, bindSignals } from '@openav/relay';
const show = new RelayClient({ role: 'runner', room: 'main' }).connect();
bindSignals(show, signals);               // phone signals → Signals, + phone/any/… alias
const phone = new RelayClient({ role: 'controller', room: 'main' }).connect();
phone.set('phone/me/tilt/x', 0.3);        // continuous: 30 Hz batch + 1 Hz refresh
phone.send('midi/note/on', { note: 60 }, true);   // pulse: immediate, never coalesced
```

## `link.js`: MIDI between pages in one room

`MidiLink` joins a room twice (a `controller` socket that sends, a `runner` socket that hears, so the relay as deployed
routes it unchanged) and carries MIDI between pages: Strudel in one tab and a p5 sketch in another, or two computers.
oav-p5's `link=<room>` uses it.

```js
import { MidiLink } from '@openav/relay/link.js';
const link = new MidiLink({ url: 'wss://remote.cheyuwu.com/relay', room: 'class4', onMessages: (list) => list.forEach(({ bytes, at }) => …) });
link.connect();
link.send([0x90, 60, 100], performance.now() + 250);   // when it should sound, on this page's clock
```

Each message carries when it left and when each item should sound, on the sender's clock. The receiver keeps the smallest
`arrival − departure` of the last 10 s (the clock difference plus the fastest trip) and subtracts the trip that both ends'
smallest ping round trips of the last 30 s say ((rtt sender + rtt receiver) / 2): an item then plays when it plays at the
sender, or at once if that is past (`late`). `delay` (ms) buffers more. A page drops its own messages and any message twice;
beacons every 2 s say who is in the room (`peerCount()`, `info()`). `LinkTiming` is the clock-difference estimate alone.
Measured on strudel.cc, two tabs over wss://remote.cheyuwu.com (one way ≈ 61 ms): within −3 … +7 ms of Strudel's timestamps
(two runs). A page on https (strudel.cc) cannot reach a `ws://` relay on the same machine or LAN in Chrome (local-network checks).
