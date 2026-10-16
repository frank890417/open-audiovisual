// @openav/timeline · follow()：時間軸接外部時鐘（多執行個體同步的從屬端）。
//
// 一個頁面當主控端（leader），其他頁面的時間軸不自己往前走，而是追主控端的 T：
//   · 差不到一幀：不管；差超過一幀：用 rate 微調（預設 ±5%）把差收斂；差超過 jump（預設 0.5 s）：seek 過去
//   · 暫停、hold 跟著主控端；主控端失聯 lostAfter 秒（預設 4）就照最後的 rate 自己走，並在回報裡標出來
//   · unfollow() 還原；不呼叫 follow() 的時間軸，行為和以前逐步相同（不變性守門）
// 全部用注入的假時鐘在 node 裡跑：兩條 Timeline、一個假的牆鐘、一個「主控端的最後一則 frame」。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Timeline } from '../packages/timeline/index.js';

const near = (a, b, e = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= e, `${msg} ${a} ≉ ${b} (±${e})`);
const P = [{ key: 'x', min: 0, max: 1, def: 0 }];
const DT = 1 / 60;

/**
 * 主控端 + 從屬端，共用一個假牆鐘。step() 是「一幀」：牆鐘走 wall 秒，主控端 advance(dt)，
 * 它的 frame 經過 transit 秒的路程到達，從屬端 advance(dt)。phase：從屬端的幀比主控端晚多少（占一幀的比例）。
 */
function rig({ scenes = [], total = 1000, loop = false, follow = {}, followNow = true } = {}) {
  let ms = 1_000_000;
  const clk = () => ms;
  const leader = new Timeline({ params: P, total, scenes, loop });
  const fol = new Timeline({ params: P, total, scenes, loop });
  let last = null, leaderAt = ms;
  const queue = [];
  const arrive = () => { while (queue.length && queue[0].at <= ms + 1e-6) { const q = queue.shift(); last = { ...q.frame, at: q.at }; } };
  const r = {
    clk, leader, fol,
    get last() { return last; },
    /** 主控端此刻真正的 T（含它自己這一幀之後又走了多久） */
    truth() { return leader.t + (leader.playing && !leader.holding ? ((ms - leaderAt) / 1000) * leader.rate : 0); },
    gap() { return r.truth() - fol.t; },
    step({ dt = DT, wall = dt, hear = true, transit = 0, phase = 0 } = {}) {
      ms += wall * 1000 * (1 - phase);
      leader.advance(dt); leaderAt = ms;
      if (hear) queue.push({ at: ms + transit * 1000, frame: { T: leader.t, playing: leader.playing, holding: leader.holding, rate: leader.rate } });
      ms += wall * 1000 * phase;
      arrive();
      fol.advance(dt);
    },
    run(n, o) { for (let i = 0; i < n; i++) r.step(o); },
    /** 主控端自己走 n 幀，從屬端沒聽到 */
    leaderAlone(n) { for (let i = 0; i < n; i++) { ms += DT * 1000; leader.advance(DT); leaderAt = ms; } },
    hear() { last = { T: leader.t, playing: leader.playing, holding: leader.holding, rate: leader.rate, at: ms }; },
  };
  fol.follow({ latest: () => last, now: followNow ? clk : undefined }, { now: clk, ...follow });
  return r;
}

// ───────────── 不變性：不 follow 時一個位元都沒變 ─────────────

/** 一段固定的腳本（場景、hold、cue、loop 範圍、rate、seek、暫停），每一幀記下時間軸的全部狀態。 */
function scriptedTrace(make) {
  const scenes = [
    { id: 'a', t: 0, cues: [{ name: 'c1', t: 1 }, { name: 'c2', t: 2.5 }] }, { id: 'b', t: 3, hold: true }, { id: 'c', t: 6, cues: [{ name: 'c3', t: 7 }] }, { id: 'd', t: 9 },
  ];
  const tl = make({ params: P, total: 12, scenes, loop: { from: 1, to: 11 }, automation: { x: [[0, 0], [6, 1, 'ease'], [12, 0.2]] } });
  const log = [], rows = [];
  tl.onSceneChange((i, sc, info) => log.push(['scene', sc.id, info.cause]));
  tl.onCue((c, info) => log.push(['cue', c.name, info.cause]));
  tl.onSeek((t, kind) => log.push(['seek', +t.toFixed(9), kind]));
  tl.onLoop((i) => log.push(['loop', i.count]));
  tl.play();
  for (let i = 0; i < 1500; i++) {
    if (i === 200 && tl.holding) tl.release();
    if (i === 260) tl.rate = 1.5;
    if (i === 400) tl.seek(2);
    if (i === 450) tl.pause();
    if (i === 470) tl.play();
    if (i === 520) { tl.rate = 0.75; if (tl.holding) tl.release(); }
    if (i === 700 && tl.holding) tl.release();
    if (i === 900 && tl.holding) tl.release();
    if (i === 1000) tl.jumpScene(-1);
    if (i % 3 === 0 && tl.holding) tl.release();
    tl.advance(i % 7 === 0 ? 0.1 : DT);
    rows.push([+tl.t.toFixed(9), tl.playing, tl.holding, tl.rate, tl.sceneIndexAt(), tl.loops, +tl.state().x.toFixed(9)]);
  }
  return crypto.createHash('sha1').update(JSON.stringify({ log, rows })).digest('hex');
}

// 這個指紋是在整合分支 99440fa（還沒有 follow）的 Timeline 上算出來的：腳本 1500 幀，每一幀的 t／playing／holding／rate／場景／圈數／
// 參數值，加上所有 onSceneChange／onCue／onSeek／onLoop 的呼叫。加了 follow 之後，沒呼叫它的時間軸必須算出同一個指紋。
const OLD_TRACE = '158e81b305b83d68643d44f2f038dfd295631da2';

test('invariance: a timeline that never follows runs exactly as before follow() existed (1500 scripted frames, hashed on the old code)', () => {
  assert.equal(scriptedTrace((o) => new Timeline(o)), OLD_TRACE);
});

test('invariance: follow() then unfollow() before anything plays leaves a timeline identical to one that never followed', () => {
  const twin = (o) => { const t = new Timeline(o); t.follow({ latest: () => null }, { now: () => 0 }); t.unfollow(); return t; };
  assert.equal(scriptedTrace(twin), OLD_TRACE);
});

test('invariance: without follow() the timeline reads no clock at all, and following is false', () => {
  const t = new Timeline({ params: P, total: 100 });
  const dn = Date.now, pn = performance.now.bind(performance);
  let reads = 0;
  Date.now = () => { reads++; return dn(); };
  performance.now = () => { reads++; return pn(); };
  try { t.play(); for (let i = 0; i < 300; i++) t.advance(DT); } finally { Date.now = dn; performance.now = pn; }
  assert.equal(reads, 0);
  assert.equal(t.following, false);
  assert.equal(t.followStatus(), null);
  near(t.t, 5, 1e-9);
});

// ───────────── 追趕 ─────────────

test('follow: in step with the leader, the follower never touches its rate and never jumps', () => {
  const r = rig();
  r.leader.play();
  const rates = new Set();
  for (let i = 0; i < 600; i++) { r.step(); rates.add(r.fol.rate); }
  assert.deepEqual([...rates], [1]);
  near(r.fol.t, r.leader.t, 1e-9);
  assert.equal(r.fol.playing, true);
  const s = r.fol.followStatus();
  assert.equal(s.jumps, 0); assert.equal(s.state, 'tracking'); assert.equal(s.lost, false);
  assert.ok(s.worst < DT, `worst ${s.worst}`);
});

test('follow: a follower half a frame out of phase (it reads the leader between two frames) stays within a frame of the leader\'s T without ever touching rate', () => {
  const r = rig();
  r.leader.play();
  const rates = new Set();
  for (let i = 0; i < 600; i++) { r.step({ phase: 0.5 }); rates.add(r.fol.rate); assert.ok(Math.abs(r.gap()) <= DT, `frame ${i}: ${r.gap()}`); }
  assert.deepEqual([...rates], [1]);
  assert.equal(r.fol.followStatus().jumps, 0);
});

test('follow: a gap under a second is closed with rate, not a jump — 0.3 s behind gets rate 1.05 until it is back within a frame', () => {
  const r = rig();
  r.leader.play();
  r.leaderAlone(18);                      // 主控端先走了 0.3 s，從屬端還沒聽到
  r.hear();
  const seeks = []; r.fol.onSeek((t, k) => seeks.push(k));
  let max = 0, min = Infinity, back = -1;
  for (let i = 0; i < 700; i++) {
    r.step(); max = Math.max(max, r.fol.rate); min = Math.min(min, r.fol.rate);
    if (back < 0 && Math.abs(r.gap()) <= DT / 2 + 1e-3) back = i;
  }
  assert.deepEqual(seeks, [], 'no seek');
  near(max, 1.05, 1e-12); assert.equal(min, 1);
  assert.ok(back > 330 && back < 370, `closed after ${back} frames (0.3 s at 5% = 5.8 s)`);
  assert.ok(Math.abs(r.gap()) <= DT / 2 + 1e-3, `final gap ${r.gap()}`);
  assert.equal(r.fol.rate, 1, 'rate is the leader\'s again once it caught up');
  assert.equal(r.fol.followStatus().jumps, 0);
  assert.ok(r.fol.followStatus().worst > 0.25, 'the status remembers the biggest gap it saw');
});

test('follow: a follower that is ahead is slowed to 0.95', () => {
  const r = rig();
  r.fol.seek(0.3);
  r.leader.play();
  let min = Infinity;
  for (let i = 0; i < 500; i++) { r.step(); min = Math.min(min, r.fol.rate); }
  near(min, 0.95, 1e-12);
  assert.ok(Math.abs(r.gap()) <= DT / 2 + 1e-3, `gap ${r.gap()}`);
  assert.equal(r.fol.rate, 1);
});

test('follow: nudge, deadband and jump are options (nudge 0.2 closes 0.3 s four times faster; a jump of 0.2 seeks for the same gap)', () => {
  const fast = rig({ follow: { nudge: 0.2 } });
  fast.leader.play(); fast.leaderAlone(18); fast.hear();
  let n = 0; while (Math.abs(fast.gap()) > DT && n < 1000) { fast.step(); n++; }
  assert.ok(n > 70 && n < 95, `${n} frames at 20%`);
  const seeky = rig({ follow: { jump: 0.2 } });
  seeky.leader.play(); seeky.leaderAlone(18); seeky.hear();
  seeky.step();
  near(seeky.gap(), 0, 1e-9); assert.equal(seeky.fol.followStatus().jumps, 1);
});

test('follow: the leader\'s rate is the follower\'s rate (2×, 0.5×), and the follower tracks it', () => {
  for (const rate of [2, 0.5]) {
    const r = rig();
    r.leader.rate = rate; r.leader.play();
    for (let i = 0; i < 300; i++) r.step();
    near(r.fol.t, r.leader.t, 1e-9, `rate ${rate}`);
    assert.equal(r.fol.rate, rate);
  }
});

test('follow: latency — frames that spend 50 ms on the way leave the follower 50 ms behind, unless told (latency: 0.05)', () => {
  const plain = rig();
  plain.leader.play(); plain.run(300, { transit: 0.05 });
  near(plain.gap(), 0.05, 0.01, 'without latency');
  const told = rig({ follow: { latency: 0.05 } });
  told.leader.play(); told.run(900, { transit: 0.05 });
  assert.ok(Math.abs(told.gap()) <= DT / 2 + 1e-3, `with latency: ${told.gap()}`);
  const fn = rig({ follow: { latency: () => 0.05 } });
  fn.leader.play(); fn.run(900, { transit: 0.05 });
  assert.ok(Math.abs(fn.gap()) <= DT / 2 + 1e-3, 'a function works too');
});

// ───────────── 大差：seek ─────────────

test('follow: a gap over 0.5 s is one seek (cause "seek"), cues in the skipped span do not fire, onFollow hears "found" then "jump"', () => {
  const scenes = [{ id: 'a', t: 0, cues: [{ name: 'early', t: 10 }] }, { id: 'b', t: 50, cues: [{ name: 'late', t: 100 }] }];
  const r = rig({ scenes });
  const seeks = [], cues = [], events = [];
  r.fol.onSeek((t, k) => seeks.push([+t.toFixed(6), k])); r.fol.onCue((c) => cues.push(c.name)); r.fol.onFollow((e) => events.push(e.kind));
  r.leader.play(); r.leader.seek(100.5); r.leader.play();
  r.step();
  near(r.fol.t, r.leader.t, 1e-9);
  assert.deepEqual(seeks, [[+r.fol.t.toFixed(6), 'seek']]);
  assert.deepEqual(cues, [], 'a seek never fires cues');
  assert.deepEqual(events, ['found', 'jump']);
  assert.equal(r.fol.followStatus().jumps, 1);
  assert.equal(r.fol.currentScene().id, 'b');
  r.run(60);
  assert.equal(r.fol.followStatus().jumps, 1, 'one seek, then it just walks');
});

test('follow: a follower playing through a cue fires it like any timeline', () => {
  const r = rig({ scenes: [{ id: 'a', t: 0, cues: [{ name: 'hit', t: 1 }] }] });
  const cues = []; r.fol.onCue((c) => cues.push(c.name));
  r.leader.play(); r.run(120);
  assert.deepEqual(cues, ['hit']);
});

// ───────────── 暫停／hold ─────────────

test('follow: the leader pausing pauses the follower, and a small difference is settled exactly (the screens stop on the same T)', () => {
  const r = rig();
  r.leader.play(); r.leaderAlone(6); r.hear();       // 從屬端落後 0.1 s，正在追
  r.run(30);
  assert.equal(r.fol.playing, true);
  assert.ok(r.gap() > 0.05, 'still catching up');
  r.leader.pause(); r.step();
  assert.equal(r.fol.playing, false);
  assert.equal(r.fol.t, r.leader.t, 'exactly the leader\'s T');
  r.run(30);
  assert.equal(r.fol.t, r.leader.t, 'and it stays there');
  r.leader.play(); r.run(30);
  assert.equal(r.fol.playing, true);
  near(r.fol.t, r.leader.t, 1e-9);
});

test('follow: the follower\'s own play/pause/seek is overruled by the next leader frame (the leader is the clock)', () => {
  const r = rig();
  r.leader.play(); r.run(60);
  r.fol.pause(); assert.equal(r.fol.playing, false);
  r.step();
  assert.equal(r.fol.playing, true, 'back to the leader\'s state');
  r.fol.seek(0.2);
  r.step();
  near(r.fol.t, r.leader.t, 1e-9, 'put back on the leader\'s T');
});

const HOLD_SCENES = [{ id: 'a', t: 0 }, { id: 'b', t: 5, hold: true }, { id: 'c', t: 8 }, { id: 'd', t: 12 }];
// scene b ends at 8 and holds there (hold: true stops the show at the END of that scene, as in the timeline docs)
test('follow: a hold — the leader parks at the end of the scene, the follower walks up to it and parks by itself; releasing lets both go on', () => {
  const r = rig({ scenes: HOLD_SCENES });
  r.leader.play(); r.leaderAlone(28); r.hear();         // 從屬端落後 0.47 s：主控端到 hold 的時候它還在追
  const seen = []; r.fol.onSceneChange((i, sc) => seen.push(sc.id));
  for (let i = 0; i < 2000 && !(r.leader.holding && r.fol.holding); i++) r.step();
  assert.equal(r.leader.holding, true); assert.equal(r.fol.holding, true);
  assert.equal(r.fol.playing, false);
  near(r.fol.t, r.leader.t, 1e-5);
  assert.equal(r.fol.currentScene().id, 'b'); assert.ok(!seen.includes('c'), 'never leaked into scene c: ' + seen);
  r.run(120);
  assert.equal(r.fol.holding, true, 'stays parked while the leader holds'); near(r.fol.t, r.leader.t, 1e-5);
  r.leader.play();                        // 放掉 hold
  r.run(3);
  assert.equal(r.fol.holding, false); assert.equal(r.fol.playing, true);
  assert.equal(r.fol.currentScene().id, 'c');
  near(r.fol.t, r.leader.t, 2 * DT);
  r.run(120);
  near(r.fol.t, r.leader.t, 1e-9);
});

test('follow: a follower that gets to the hold before the leader waits there — a leader frame from just before the boundary does not release it', () => {
  const r = rig({ scenes: HOLD_SCENES });
  r.leader.play();
  while (r.leader.t < 7.9) r.step();
  r.fol.seek(r.leader.t + 0.04);          // 快到 hold 邊界（8 s）了，從屬端比主控端快 0.04 s（在 jump 以內）
  const seen = []; r.fol.onSceneChange((i, sc) => seen.push(sc.id));
  let earlyPark = false;
  for (let i = 0; i < 2000 && !r.leader.holding; i++) { r.step(); if (r.fol.holding && !r.leader.holding) earlyPark = true; }
  r.run(5);
  assert.equal(earlyPark, true, 'the follower really did park first');
  assert.equal(r.leader.holding, true); assert.equal(r.fol.holding, true);
  near(r.fol.t, r.leader.t, 1e-5);
  assert.ok(!seen.includes('c'), 'did not run on into the next scene: ' + seen);
});

test('follow: the follower is jumped to the leader when the leader leaves the hold by seeking elsewhere', () => {
  const r = rig({ scenes: HOLD_SCENES });
  r.leader.play();
  for (let i = 0; i < 2000 && !(r.leader.holding && r.fol.holding); i++) r.step();
  r.leader.seek(1); r.leader.play(); r.step();
  assert.equal(r.fol.holding, false);
  near(r.fol.t, r.leader.t, 1e-9);
});

// ───────────── 失聯 ─────────────

test('follow: before it hears anyone the follower stands still ("waiting"); after lostAfter seconds it runs by itself and says so', () => {
  const r = rig();
  const events = [];
  r.fol.onFollow((e) => events.push(e.kind));
  r.fol.play();                           // 本機按了播放，但還沒有主控端
  for (let i = 0; i < 120; i++) { r.step({ hear: false }); }
  assert.equal(r.fol.t, 0); assert.equal(r.fol.followStatus().state, 'waiting');
  assert.equal(r.fol.followStatus().heard, false);
  for (let i = 0; i < 160; i++) r.step({ hear: false });     // 共 4.67 s
  assert.equal(r.fol.followStatus().state, 'lost');
  assert.ok(r.fol.t > 0.5, 'running on its own: ' + r.fol.t);
  assert.deepEqual(events, ['lost']);
});

test('follow: the leader goes silent — the follower keeps to its path, after lostAfter (default 4 s) it runs on the last rate by itself and the report says lost', () => {
  const r = rig();
  r.leader.rate = 2; r.leader.play();
  const events = [];
  r.fol.onFollow((e) => events.push([e.kind, +e.silence.toFixed(1)]));
  r.run(120);
  assert.equal(r.fol.followStatus().lost, false);
  // 靜音 3 s：還沒算失聯，從屬端照主控端的路徑外插
  for (let i = 0; i < 180; i++) r.step({ hear: false });
  let s = r.fol.followStatus();
  assert.equal(s.lost, false); assert.equal(s.state, 'tracking');
  near(s.silence, 3, 0.02);
  near(r.fol.t, r.leader.t, 0.02, 'extrapolated along the leader\'s path');
  assert.equal(events.length, 1 /* found */);
  // 再 2 s：失聯
  for (let i = 0; i < 120; i++) r.step({ hear: false });
  s = r.fol.followStatus();
  assert.equal(s.lost, true); assert.equal(s.state, 'lost'); assert.equal(s.lostCount, 1);
  assert.ok(s.silence > 4 && s.silence < 5.1, String(s.silence));
  assert.match(s.text, /leader.*(silent|lost)/i);
  assert.deepEqual(events.map((e) => e[0]), ['found', 'lost']);
  assert.equal(r.fol.rate, 2, 'last rate of the leader');
  const t0 = r.fol.t;
  for (let i = 0; i < 60; i++) r.step({ hear: false });
  near(r.fol.t - t0, 2, 1e-9, 'one second at rate 2, on its own');
  assert.equal(r.fol.playing, true);
});

test('follow: the leader comes back — "found" again, the follower is on it within a frame or a jump, and lostCount stays 1', () => {
  const r = rig();
  r.leader.play(); r.run(60);
  const events = []; r.fol.onFollow((e) => events.push(e.kind));
  for (let i = 0; i < 600; i++) r.step({ hear: false });
  assert.equal(r.fol.followStatus().lost, true);
  r.leader.seek(300); r.leader.play();
  r.step();
  assert.equal(r.fol.followStatus().lost, false);
  near(r.fol.t, r.leader.t, 1e-9);
  assert.deepEqual(events, ['lost', 'found', 'jump']);
  assert.equal(r.fol.followStatus().lostCount, 1);
});

test('follow: lostAfter is an option, and Infinity never gives up', () => {
  const r = rig({ follow: { lostAfter: 1 } });
  r.leader.play(); r.run(30);
  for (let i = 0; i < 90; i++) r.step({ hear: false });
  assert.equal(r.fol.followStatus().lost, true);
  const never = rig({ follow: { lostAfter: Infinity } });
  never.leader.play(); never.run(30);
  for (let i = 0; i < 6000; i++) never.step({ hear: false });
  assert.equal(never.fol.followStatus().lost, false);
});

test('follow: a paused follower whose leader was paused stays paused through a silence (nothing to run on)', () => {
  const r = rig();
  r.leader.play(); r.run(30); r.leader.pause(); r.run(10);
  const t = r.fol.t;
  for (let i = 0; i < 600; i++) r.step({ hear: false });
  assert.equal(r.fol.followStatus().lost, true);
  assert.equal(r.fol.t, t); assert.equal(r.fol.playing, false);
});

// ───────────── 回報 ─────────────

test('followStatus: a JSON-friendly object like drift(): state, error, worst, jumps, silence, lost, text', () => {
  const r = rig();
  assert.equal(r.fol.following, true);
  let s = r.fol.followStatus();
  assert.equal(s.state, 'waiting'); assert.equal(s.error, null); assert.equal(s.jumps, 0); assert.equal(s.heard, false);
  r.leader.play(); r.leaderAlone(12); r.hear(); r.step();
  s = r.fol.followStatus();
  assert.equal(s.state, 'tracking');
  near(s.error, 0.2, 0.01, 'the leader is 0.2 s ahead');
  assert.ok(s.silence >= 0 && s.silence < 0.05);
  assert.equal(typeof s.text, 'string'); assert.match(s.text, /behind the leader/);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'survives JSON');
  for (const k of ['state', 'error', 'worst', 'jumps', 'silence', 'lost', 'lostCount', 'heard', 'frames', 'rate', 'leaderRate', 'leaderT', 'leaderPlaying', 'leaderHolding', 'lostAfter', 'text']) assert.ok(k in s, k);
});

test('followStatus: the first alignment is not "worst" — a late joiner that seeks onto the leader still reports a clean run afterwards', () => {
  const r = rig();
  r.leader.seek(200); r.leader.play(); r.run(300);
  const s = r.fol.followStatus();
  assert.equal(s.jumps, 1); assert.ok(s.worst < DT, 'worst ' + s.worst);
});

// ───────────── unfollow ─────────────

test('unfollow: gives back the rate it had before follow(), stops reading the source, and the timeline is an ordinary one again', () => {
  const r = rig();
  r.fol.unfollow();
  assert.equal(r.fol.following, false); assert.equal(r.fol.followStatus(), null);
  // 重做一次，這回在追的途中 unfollow
  const q = rig();
  q.fol.rate = 1; q.leader.play(); q.leaderAlone(18); q.hear(); q.run(30);
  assert.ok(q.fol.rate > 1.04, 'nudged');
  q.fol.unfollow();
  assert.equal(q.fol.rate, 1, 'rate restored');
  const t = q.fol.t; q.fol.pause(); q.fol.advance(DT);
  assert.equal(q.fol.t, t, 'paused means paused again');
  q.fol.play(); q.fol.advance(DT);
  near(q.fol.t, t + DT, 1e-12);
});

test('unfollow: the rate the work had set before follow() comes back (a 0.8× rehearsal timeline)', () => {
  let clk = 0;
  const t = new Timeline({ params: P, total: 100 });
  t.rate = 0.8;
  t.follow({ latest: () => ({ T: 5, playing: true, holding: false, rate: 3, at: 0 }) }, { now: () => clk });
  t.advance(DT);
  assert.equal(t.rate, 3, 'follows the leader\'s rate');
  t.unfollow();
  assert.equal(t.rate, 0.8);
});

test('follow: calling follow() again replaces the source and starts the report over; onFollow listeners stay', () => {
  const r = rig();
  const heard = []; r.fol.onFollow((e) => heard.push(e.kind));
  r.leader.play(); r.run(30);
  r.fol.follow({ latest: () => null, now: r.clk }, { now: r.clk });
  assert.equal(r.fol.followStatus().frames, 0); assert.equal(r.fol.followStatus().heard, false);
  r.fol.follow({ latest: () => r.last, now: r.clk }, { now: r.clk });
  r.step();
  assert.equal(heard.filter((k) => k === 'found').length, 2, 'found at the first source and again at the second');
});

test('follow: calling follow() again in the middle of a chase still gives back the rate from before the first follow(), also when the new leader never answers', () => {
  let clk = 0;
  const t = new Timeline({ params: P, total: 100 });
  t.rate = 0.8;
  const src = { latest: () => ({ T: 5, playing: true, holding: false, rate: 3, at: 0 }) };
  t.follow(src, { now: () => clk }); t.advance(DT);
  assert.equal(t.rate, 3);
  t.follow({ latest: () => null }, { now: () => clk, lostAfter: 1 });          // 換一個還沒開口的主控端
  clk = 2000; t.play(); t.advance(DT);
  assert.equal(t.followStatus().lost, true);
  assert.equal(t.rate, 0.8, 'lost: the rate it had before any follow(), not the last leader\'s');
  t.unfollow();
  assert.equal(t.rate, 0.8);
});

// ───────────── 循環 ─────────────

test('follow: across the wrap of a looping show the follower neither jumps nor is thrown a whole lap off', () => {
  const r = rig({ total: 10, loop: true });
  r.leader.play(); r.leaderAlone(6); r.hear();       // 從屬端落後 0.1 s
  const t0 = []; r.fol.onSeek((t) => t0.push(t));
  r.run(60 * 25);                                     // 25 s = 2.5 圈
  assert.equal(r.leader.loops, 2);
  assert.deepEqual(t0, [], 'no seek');
  assert.equal(r.fol.followStatus().jumps, 0);
  assert.ok(Math.abs(r.gap()) < 0.02 || Math.abs(Math.abs(r.gap()) - 10) < 0.02, 'gap ' + r.gap());
  assert.equal(r.fol.loops, 2);
});

test('follow: a looping follower far from the leader seeks to the leader\'s place in the lap, not past its end', () => {
  const r = rig({ total: 10, loop: true });
  r.leader.seek(9.9); r.leader.play(); r.hear();
  r.fol.seek(2);
  r.step();
  assert.ok(r.fol.followStatus().jumps >= 1);
  near(r.fol.t, r.leader.t, 0.05);
});

// ───────────── 輸入檢查 ─────────────

test('follow: a source that is neither a function nor has latest(), and nonsense options, throw a readable error', () => {
  const t = new Timeline({ params: P });
  for (const bad of [null, undefined, 5, 'x', {}, { latest: 1 }]) assert.throws(() => t.follow(bad), /follow\(\).*source/s, String(bad));
  const ok = { latest: () => null };
  for (const o of [{ nudge: -1 }, { nudge: 1 }, { nudge: 'a' }, { deadband: -1 }, { jump: -1 }, { lostAfter: -1 }, { lostAfter: NaN }, { latency: 'x' }, { now: 5 }]) {
    assert.throws(() => t.follow(ok, o), /follow\(\)/, JSON.stringify(o));
  }
  assert.equal(t.following, false, 'a refused follow() changes nothing');
});

test('follow: a frame with a non-finite T is no frame; a broken source cannot stop the timeline (it counts as silence)', () => {
  let n = 0;
  const t = new Timeline({ params: P, total: 100 });
  t.follow({ latest: () => { n++; if (n % 2) throw new Error('boom'); return { T: NaN, playing: true }; } }, { now: () => 0 });
  const err = console.error; console.error = () => {};
  try { for (let i = 0; i < 10; i++) t.advance(DT); } finally { console.error = err; }
  assert.equal(t.t, 0);
  assert.equal(t.followStatus().heard, false);
});

test('follow: a function is a source too — () => frame', () => {
  const clk = 0;
  const t = new Timeline({ params: P, total: 100 });
  t.follow(() => ({ T: 10, playing: false, holding: false, rate: 1 }), { now: () => clk });
  t.advance(DT);
  assert.equal(t.t, 10); assert.equal(t.playing, false);
});
