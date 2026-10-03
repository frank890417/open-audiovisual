# @openav/relay

Room-scoped WebSocket relay + browser client. Zero dependencies — the RFC 6455
codec is hand-rolled (`frames.js`, pure, tested), routing is pure logic
(`hub.js`), and `server.js` is ~70 lines of `http` glue.

```
node serve.js                     # dev server already hosts it at ws://host:PORT/relay
node packages/relay/server.js     # or standalone on :7458
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
