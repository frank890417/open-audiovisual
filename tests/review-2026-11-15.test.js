// Three small bugs a review noted on 2026-11-15 and nobody fixed until 0.11.0 (the fourth note of that review, a source
// that re-sends the same value after ✕, is case 3 of tests/hand-holds.test.js). One test each, each red on 0.10.0.
//
//   1  new Timeline({ anchor: 0 })      0 ms is an epoch (1970-01-01), but `if (anchor)` read it as "no anchor"
//   2  SyncLeader with a throwing cut   _cut() called it bare, so frame() threw: in createShow the rest of that frame
//                                       (segment modules, the mapper, the stage, the console) was skipped, every frame
//   3  SyncLeader.status().followers    only grew: a follower page reloaded (a new id) or closed was counted for ever
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timeline } from '../packages/timeline/index.js';
import { SyncLeader, SyncFollower, createSync } from '../packages/sync/index.js';
import { syncOptions } from '../packages/show/options.js';

const P = [{ key: 'x', min: 0, max: 1, def: 0 }];
const clock = (ms = 5_000_000) => { const now = () => ms; now.tick = (s) => { ms += s * 1000; }; return now; };
const mkTl = (o = {}) => new Timeline({ params: P, total: 1000, ...o });

/** Ends on one in-memory bus (JSON round trip, like the real transports); `open` can be switched off per end. */
function memoryBus() {
  const ends = [], log = [];
  return {
    log,
    end() {
      const e = { cbs: [], open: true, send(msg) { const m = JSON.parse(JSON.stringify(msg)); log.push(m); for (const o of ends) if (o !== e && o.open) o.cbs.forEach((cb) => cb(JSON.parse(JSON.stringify(m)))); },
        onMessage(cb) { e.cbs.push(cb); }, onOpen() {}, close() { e.open = false; } };
      ends.push(e); return e;
    },
  };
}

test('1 · anchor: 0 anchors the timeline at epoch 0 ms; false, null, undefined and an empty string still mean none', () => {
  const t = mkTl({ anchor: 0 });
  assert.notEqual(t.drift(), null, '0.10.0: null, the anchor was dropped');
  assert.equal(t.drift().epoch, 0);
  assert.equal(mkTl({ anchor: { epoch: 0, mode: 'catch-up' } }).drift().epoch, 0, 'the object form already worked');
  for (const none of [false, null, undefined, '']) assert.equal(mkTl({ anchor: none }).drift(), null, JSON.stringify(none));
  assert.throws(() => mkTl({ anchor: 'not a date' }), /epoch must be/);
});

test('2 · a cut function that throws does not stop the leader\'s frame: the frame goes out without a cut, the error is logged once', () => {
  const bus = memoryBus(), tl = mkTl();
  const errors = [];
  const err = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    const L = new SyncLeader({ timeline: tl, transport: bus.end(), id: 'L', now: clock(), cut: () => { throw new Error('no score yet'); } });
    tl.play();
    for (let i = 0; i < 100; i++) { tl.advance(1 / 60); assert.equal(L.frame(), true, `frame ${i} went out`); }
    assert.equal(bus.log.length, 100);
    assert.ok(bus.log.every((m) => m.kind === 'frame' && !('cut' in m)));
    assert.doesNotThrow(() => L.sendState('F1'));
    assert.equal(L.status().cut, null);
    assert.equal(errors.length, 1, `one line, not one per frame: ${errors.length}`);
    assert.match(errors[0], /cut\(\) threw/);
  } finally { console.error = err; }
});

test('3 · followers counts the pages that are there: a follower says it is still there, says goodbye on close, and is forgotten when it goes quiet', () => {
  const bus = memoryBus(), now = clock(), tl = mkTl();
  const L = new SyncLeader({ timeline: tl, transport: bus.end(), id: 'L', now });
  const page = (id) => {
    const tr = bus.end();
    const F = new SyncFollower({ transport: tr, id, now });
    return { F, tr };
  };
  const frames = (n) => { for (let i = 0; i < n; i++) { now.tick(1 / 60); tl.advance(1 / 60); L.frame(); for (const p of pages) if (!p.F.closed) p.F.frame(); } };
  const pages = [page('F-a'), page('F-b')];
  frames(5);
  assert.equal(L.status().followers, 2);

  pages[0].F.close();                                       // a page closed by its operator: it says goodbye
  assert.equal(L.status().followers, 1, '0.10.0: still 2');
  assert.ok(bus.log.some((m) => m.kind === 'bye' && m.id === 'F-a'));

  pages[1].tr.open = false;                                 // a page reloaded: the old one is just gone, a new id says hello
  pages[1].F.closed = true;
  pages.push(page('F-c'));
  frames(60 * 3);
  assert.equal(L.status().followers, 2, 'for a while both count');
  frames(60 * 5);
  assert.equal(L.status().followers, 1, 'the one that went quiet is forgotten after forgetAfter (6 s); 0.10.0: 2');
  assert.equal(L.monitor()['sync/followers'], 1);
  frames(60 * 30);
  assert.equal(L.status().followers, 1, 'a follower that is there stays counted: it says so every 2 s');
  assert.ok(bus.log.filter((m) => m.kind === 'here' && m.id === 'F-c').length >= 15);

  // a follower of 0.10.0 only ever says hello: it is counted as it always was, for ever
  const old = bus.end();
  old.send({ v: 1, kind: 'hello', id: 'F-old', role: 'follower' });
  frames(60 * 20);
  assert.equal(L.status().followers, 2);
});

test('3 · the new options reach the parts: forgetAfter on the leader, aliveEvery on the follower (0 = never), through createSync and createShow({ sync })', () => {
  const bus = memoryBus(), now = clock(), tl = mkTl();
  const L = createSync({ role: 'leader', channel: 'hall', timeline: tl, transport: bus.end(), now, forgetAfter: 1000 });
  assert.equal(L.forgetAfter, 1000);
  const F = createSync({ role: 'follower', channel: 'hall', timeline: mkTl(), transport: bus.end(), now, aliveEvery: 0 });
  assert.equal(F.aliveEvery, 0);
  for (let i = 0; i < 600; i++) { now.tick(1 / 60); F.frame(); }
  assert.equal(bus.log.filter((m) => m.kind === 'here').length, 0, 'aliveEvery: 0 says nothing');
  assert.equal(syncOptions({ role: 'leader', channel: 'hall', forgetAfter: 3000 }).forgetAfter, 3000);
  assert.equal(syncOptions({ role: 'follower', channel: 'hall', aliveEvery: 500 }).aliveEvery, 500);
});
