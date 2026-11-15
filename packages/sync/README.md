# @openav/sync

Spine · several pages, one show. One page is the **leader** (it runs the timeline and takes the input), the others are
**followers**: their timelines do not walk by themselves, they chase the leader's `T` with
[`timeline.follow()`](../timeline) (a small rate change when close, a seek when far, its pause and hold copied, running
on alone when it goes quiet). This package is the wire between them. It knows nothing about what is being shown: whatever
the work wants to travel with the clock goes in `extra`, and arrives once, in order, unread.

```js
const show = await createShow({
  world,
  sync: { role: 'leader', channel: 'hall' },            // or role: 'follower' on the other pages
  // sync: { role: 'follower', channel: 'hall', url: 'ws://leader.local:8080/relay' },   // pages on other machines
});
```

```js
import { createSync } from '@openav/sync';              // without createShow
const sync = createSync({ role: 'follower', channel: 'hall', timeline });
// every frame, after timeline.advance(dt):
sync.frame();
timeline.followStatus().text;                           // "0.004 s behind the leader · worst 0.016 s"
```

Transports: a `BroadcastChannel` when there is no `url` (pages of one browser profile and origin, no network), the room relay
([`@openav/relay`](../relay), roles `leader` and `follower`) when there is one (`true` = this page's own `/relay`, so
`node serve.js` is the whole setup). Both carry the same JSON.

```
{ v:1, kind:'frame', src, seq, T, playing, holding, rate, cut?, extra? }      leader → followers, every frame
{ v:1, kind:'hello', id, role:'follower', info?, reason? }                    follower → leader
{ v:1, kind:'state', src, seq, to, T, playing, holding, rate, cut?, extra? }  leader → that follower (late joiners, resync)
```

A follower says `hello` when it comes up, until it has a `state`, after a gap in `seq`, after a silence, and when its socket
reconnects; the leader answers with a `state`, so a page that joins late lands on the show's present. A frame older than the newest
is dropped, a gap is reported (`onGap`), and `extra` is delivered once each, in order.

| export | |
|---|---|
| `createSync({ role, channel, url, timeline, score, follow, extra, state, hz, info, accept, onFrame, onState, onGap, id, now, transport })` | a `SyncLeader` or `SyncFollower`; a follower's timeline is made to follow it; `close()` lets go |
| `SyncLeader` | `frame()` · `sendState(to?)` · `status()` · `monitor()` · `close()` |
| `SyncFollower` | `latest()` (the `timeline.follow()` source) · `hello(reason)` · `frame()` · `status()` · `monitor()` · `close()` |
| `BroadcastTransport` · `RelayTransport` · `createTransport` | `{ send(msg), onMessage(cb), onOpen(cb), open, close() }` |

With `createShow({ sync })` a follower page takes no input of its own (`keys`, `midi`, `drums`, `audio`, `hands`, `pose`, `leap` and
`remote` are off; `input: true` keeps them), the leader's `score.cut` is checked against the follower's, and the sync numbers go to the
backstage monitor. Full reference: [docs](https://openaudiovisual.com/docs/#show-control-several-pages-one-show) ·
[follow](https://openaudiovisual.com/docs/#show-control-following-another-clock-follow)
