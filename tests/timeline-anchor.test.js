// @openav/timeline · 牆鐘錨定（anchor）與漂移計數（drift）。
//
// Loop 把每一幀的 dt 夾在 0.1 s：瀏覽器卡了 0.5 s，節目時間只前進 0.1 s，比牆鐘慢了 0.4 s。
// 長場無人值守需要看得到這個數字，必要時追回來。anchor() 讓 Timeline 自己讀牆鐘（可注入，測試用假鐘）：
//   · 預設（不呼叫 anchor）：一個位元都沒變，連牆鐘都不讀
//   · mode 'warn'（預設）：只計數、只通知，不動 t
//   · mode 'catch-up'：欠的追回來；欠太多（jump）就直接跳；epoch 在未來就等到那一刻開演
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timeline } from '../packages/timeline/index.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);
const P = [{ key: 'x', min: 0, max: 1, def: 0 }];
const MS0 = 1_000_000;                                  // 小一點的數字：浮點的尾數夠用，累加 600 幀也不會有 1e-9 的誤差
const clock = (ms = MS0) => { const now = () => ms; now.tick = (s) => { ms += s * 1000; }; return now; };
const mk = (o = {}) => new Timeline({ params: P, total: 1000, ...o });
/** n 幀：牆鐘走 wall 秒、dt 秒餵給 advance（wall 預設等於 dt：一切正常） */
const run = (t, clk, n, dt, wall = dt) => { for (let i = 0; i < n; i++) { clk.tick(wall); t.advance(dt); } };
const quiet = (fn) => { const w = console.warn; const calls = []; console.warn = (...a) => calls.push(a.join(' ')); try { fn(calls); } finally { console.warn = w; } return calls; };

// ───────────── 預設行為不變 ─────────────

test('anchor: without anchor() nothing reads the wall clock and drift() is null', () => {
  const t = mk({ scenes: [{ id: 'a', t: 0 }, { id: 'b', t: 5 }] });
  const real = Date.now; let reads = 0;
  Date.now = () => { reads++; return real(); };
  try { t.play(); for (let i = 0; i < 200; i++) t.advance(0.05); } finally { Date.now = real; }
  assert.equal(reads, 0, 'the default timeline never looks at a clock');
  assert.equal(t.drift(), null);
  near(t.t, 10, 1e-9);
});

test('anchor: mode "warn" only counts — t, scenes, cues, loops and holds come out exactly as on a timeline that is not anchored', () => {
  const scenes = [{ id: 'a', t: 0, cues: [{ name: 'c', t: 1 }] }, { id: 'b', t: 3, hold: true }, { id: 'c', t: 6 }];
  const mkTwin = (anchored) => {
    const clk = clock(), log = [];
    const t = mk({ total: 10, loop: { from: 0, to: 8 }, scenes, ...(anchored ? { anchor: { now: clk, onDrift() {} } } : {}) });
    t.onSceneChange((i, sc, info) => log.push(['scene', sc.id, info.cause])); t.onCue((c) => log.push(['cue', c.name]));
    t.play();
    for (let i = 0; i < 400; i++) {
      clk.tick(i % 7 === 0 ? 0.4 : 0.03);            // 牆鐘忽快忽慢
      t.advance(i % 5 === 0 ? 0.1 : 0.03);
      if (t.holding && i % 50 === 0) t.release();
    }
    return { t: t.t, loops: t.loops, log };
  };
  assert.deepEqual(mkTwin(true), mkTwin(false));
});

// ───────────── 計數：Loop 夾 dt 吃掉的時間 ─────────────

test('drift: every frame the wall clock ran longer than dt is a stall; "lost" is what the clamp cost, "behind" what is still owed', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk, onDrift() {} });
  t.play();
  run(t, clk, 1, 0.1);                    // 第一幀：以它為零點
  run(t, clk, 10, 0.1, 0.5);              // 十幀：牆鐘走 0.5 s，Loop 只給 0.1 s
  const d = t.drift();
  near(t.t, 1.1, 1e-9);
  near(d.lost, 4.0, 1e-9); near(d.behind, 4.0, 1e-9);
  assert.equal(d.stalls, 10); near(d.worst, 0.5); assert.equal(d.frames, 11);
  assert.equal(d.repaid, 0); assert.equal(d.mode, 'warn');
});

test('drift: ordinary frames cost nothing, not even a rounding crumb', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk });
  t.play(); run(t, clk, 600, 1 / 60);
  const d = t.drift();
  assert.equal(d.stalls, 0); assert.equal(d.lost, 0); near(d.behind, 0, 1e-9);
  assert.match(d.text, /on the wall clock/);
});

test('drift().text reads as a sentence: how far behind, what the clamp cost, how many stalls', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk, onDrift() {} });
  t.play(); run(t, clk, 1, 0.1); run(t, clk, 3, 0.1, 0.35);
  assert.match(t.drift().text, /0\.75 s behind the wall clock/);
  assert.match(t.drift().text, /3 stalls cost 0\.75 s/);
  assert.match(t.drift().text, /worst gap 0\.35 s/);
});

test('drift: being ahead is reported, never "corrected" backwards', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk, mode: 'catch-up' });
  t.play(); run(t, clk, 20, 0.1, 0.05);
  near(t.t, 2.0, 1e-9);
  assert.ok(t.drift().behind < 0);
  assert.match(t.drift().text, /ahead/);
});

test('drift: a changed rate counts in show seconds (rate 2 and a 0.5 s gap owes 1 s per 0.2 s frame)', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk, mode: 'catch-up' });
  t.rate = 2; t.play(); run(t, clk, 30, 0.1);
  near(t.drift().behind, 0, 1e-9); near(t.t, 6, 1e-9);
  run(t, clk, 4, 0.1, 0.5);                       // 牆鐘 2 s，rate 2 → 應走 4 s
  near(t.t, 6 + 4, 1e-9);
});

// ───────────── 警告 ─────────────

test('warn: onDrift fires when "behind" crosses warnAt, once, and again after it recovered and crossed anew', () => {
  const clk = clock(), t = mk(), seen = [];
  t.anchor(undefined, { now: clk, onDrift: (e) => seen.push(e.kind) });
  t.play(); run(t, clk, 1, 0.1);
  run(t, clk, 12, 0.1, 0.5);                      // behind 4.8：越過 1 s 一次
  assert.deepEqual(seen, ['behind']);
  run(t, clk, 60, 0.1, 0.01);                     // 牆鐘比 dt 短：慢慢還清（-5.4）
  assert.deepEqual(seen, ['behind', 'recovered']);
  run(t, clk, 6, 0.1, 0.5);
  assert.deepEqual(seen, ['behind', 'recovered', 'behind']);
});

test('warn: with no handler it says so once on the console; a handler (option or onDrift) replaces the console', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk });
  t.play(); run(t, clk, 1, 0.1);
  const calls = quiet(() => run(t, clk, 12, 0.1, 0.5));
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\[timeline\].*behind the wall clock/);
  const clk2 = clock(), t2 = mk(), got = [];
  t2.anchor(undefined, { now: clk2 }); t2.onDrift((e) => got.push(e.kind));
  t2.play(); run(t2, clk2, 1, 0.1);
  assert.equal(quiet(() => run(t2, clk2, 12, 0.1, 0.5)).length, 0);
  assert.deepEqual(got, ['behind']);
});

// ───────────── 追平 ─────────────

test('catch-up: the time the clamp dropped is given back, so show time follows the wall clock', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk, mode: 'catch-up' });
  t.play(); run(t, clk, 1, 0.1);
  run(t, clk, 10, 0.1, 0.5);
  near(t.t, 0.1 + 5.0, 1e-9);                     // 牆鐘走了 5.1 s，節目也是
  const d = t.drift();
  near(d.behind, 0, 1e-9); near(d.repaid, 4.0, 1e-9); near(d.lost, 4.0, 1e-9);
  assert.match(d.text, /caught up 4\.00 s/);
});

test('catch-up: small stalls are repaid through normal playback — the cues inside the repaid time fire', () => {
  const clk = clock(), seen = [];
  const t = mk({ scenes: [{ id: 'a', t: 0, cues: [{ name: 'c', t: 2.5 }] }] });
  t.onCue((c) => seen.push(c.name));
  t.anchor(undefined, { now: clk, mode: 'catch-up' });
  t.play(); run(t, clk, 1, 0.1); run(t, clk, 6, 0.1, 0.5);
  assert.deepEqual(seen, ['c']);
  const warn = mk({ scenes: [{ id: 'a', t: 0, cues: [{ name: 'c', t: 2.5 }] }] }), clk2 = clock(), seen2 = [];
  warn.onCue((c) => seen2.push(c.name)); warn.anchor(undefined, { now: clk2, onDrift() {} });
  warn.play(); run(warn, clk2, 1, 0.1); run(warn, clk2, 6, 0.1, 0.5);
  assert.deepEqual(seen2, [], 'warn mode leaves t alone, so the cue is not reached');
});

test('catch-up: more than `jump` seconds owed is closed by a seek (no cues, onSeek hears "seek"), then playback goes on', () => {
  const clk = clock(), seen = [], moved = [];
  const t = mk({ scenes: [{ id: 'a', t: 0, cues: [{ name: 'c', t: 5 }] }] });
  t.onCue((c) => seen.push(c.name)); t.onSeek((tt, kind) => moved.push([+tt.toFixed(3), kind]));
  t.anchor(undefined, { now: clk, mode: 'catch-up', jump: 2 });
  t.play(); run(t, clk, 1, 0.1); run(t, clk, 1, 0.1, 10);
  near(t.t, 10.1, 1e-9);
  assert.deepEqual(seen, [], 'the cue at 5 s was jumped over, not performed');
  assert.deepEqual(moved, [[10.0, 'seek']]);
  assert.equal(t.drift().jumps, 1); near(t.drift().behind, 0, 1e-9);
});

test('catch-up: a jump in a looping show lands where the loop would have it', () => {
  const clk = clock(), t = mk({ total: 20, loop: true });
  t.anchor(undefined, { now: clk, mode: 'catch-up', jump: 2 });
  t.play(); run(t, clk, 1, 0.1); run(t, clk, 1, 0.1, 45);
  near(t.t, 45.1 % 20, 1e-9); assert.equal(t.loops, 2);
});

test('catch-up: a hold parks the show, and the debt it leaves is forgiven when the operator lets go', () => {
  const clk = clock(), t = mk({ scenes: [{ id: 'a', t: 0, hold: true }, { id: 'b', t: 2 }] });
  t.anchor(undefined, { now: clk, mode: 'catch-up' });
  t.play(); run(t, clk, 1, 0.1); run(t, clk, 30, 0.1, 0.5);
  assert.equal(t.holding, true); assert.ok(t.t < 2 && t.t > 1.999);
  near(t.drift().behind, 0, 1e-9);                  // 停在 hold 的那一刻，這一幀沒走完的部分就一筆勾銷了
  assert.ok(t.drift().forgiven > 0);
  run(t, clk, 5, 0.1, 20);                         // 在 hold 裡等了很久（advance 照呼叫）
  near(t.drift().behind, 0, 1e-9);
  t.release();
  run(t, clk, 60, 1 / 60);
  assert.ok(Math.abs(t.drift().behind) < 1e-6, `${t.drift().behind}`);
  assert.ok(t.drift().forgiven > 0);
  assert.equal(t.currentScene().id, 'b');
  assert.ok(t.t < 4, `no sudden rush after the release: ${t.t}`);
});

test('pause: the minutes it lasts are not a drift — whether or not advance() was called meanwhile', () => {
  for (const callAdvance of [true, false]) {
    const clk = clock(), t = mk();
    t.anchor(undefined, { now: clk, mode: 'catch-up' });
    t.play(); run(t, clk, 120, 1 / 60);
    t.pause();
    if (callAdvance) run(t, clk, 5, 0.1, 12); else clk.tick(60);
    const frozen = t.t;
    t.play(); run(t, clk, 120, 1 / 60);
    near(t.t - frozen, 2, 1e-9);
    assert.ok(Math.abs(t.drift().behind) < 1e-9, `callAdvance=${callAdvance}: ${t.drift().behind}`);
  }
});

test('catch-up: a debt owed at the moment of a pause is forgiven on resume (the schedule starts over from where the show stands)', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk, mode: 'catch-up', tolerance: 100 });   // 公差設很大：只計數、先不追
  t.play(); run(t, clk, 1, 0.1); run(t, clk, 10, 0.1, 0.5);
  near(t.drift().behind, 4.0, 1e-9);
  t.pause(); clk.tick(30); t.play(); run(t, clk, 1, 0.1);
  near(t.drift().behind, 0, 1e-9); near(t.drift().forgiven, 4.0, 1e-9);
});

// ───────────── 絕對 epoch：預約開演、晚到追上 ─────────────

test('scheduled start: with an epoch in the future, mode "catch-up" stands still until then, then runs on the wall clock', () => {
  const clk = clock(), t = mk();
  t.anchor(MS0 + 3000, { now: clk, mode: 'catch-up' });
  t.play();
  run(t, clk, 2, 1 / 60, 1);
  assert.equal(t.t, 0, 'still waiting');
  const d = t.drift();
  assert.equal(d.waiting, true); near(d.startsIn, 1.0, 1e-9);
  assert.match(d.text, /starts in 1\.0 s/);
  assert.equal(t.playing, true, 'it is armed, not stopped');
  run(t, clk, 1, 1 / 60, 1);                       // 牆鐘剛好到 epoch
  near(t.t, 1 / 60, 1e-9);
  run(t, clk, 1, 1 / 60, 1);                       // epoch 後 1 s：節目時間追到 1 s
  near(t.t, 1.0, 1e-9);
  assert.equal(t.drift().waiting, false);
});

test('scheduled start: mode "warn" never stands still — an epoch in the future is only a reference', () => {
  const clk = clock(), t = mk();
  t.anchor(MS0 + 60_000, { now: clk, onDrift() {} });
  t.play(); run(t, clk, 10, 0.1);
  near(t.t, 1.0, 1e-9);
});

test('late join: an epoch in the past plus catch-up puts a restarted machine where the show is now (a seek: no cues, holds ignored)', () => {
  const clk = clock(), seen = [];
  const t = mk({ scenes: [{ id: 'a', t: 0, hold: true, cues: [{ name: 'c', t: 3 }] }, { id: 'b', t: 5 }] });
  t.onCue((c) => seen.push(c.name));
  t.anchor(MS0 - 7000, { now: clk, mode: 'catch-up', jump: 5 });
  t.play(); run(t, clk, 1, 1 / 60);
  near(t.t, 7 + 1 / 60, 1e-6);
  assert.equal(t.currentScene().id, 'b'); assert.equal(t.holding, false);
  assert.deepEqual(seen, []);
});

test('late join in "warn" mode only measures: the machine starts at the start and says how far behind the schedule it is', () => {
  const clk = clock(), t = mk();
  t.anchor(MS0 - 7000, { now: clk, onDrift() {} });
  t.play(); run(t, clk, 1, 1 / 60);
  near(t.t, 1 / 60, 1e-9);
  near(t.drift().behind, 7, 1e-6);
});

test('epoch can be milliseconds, a Date or an ISO string; anything else is refused', () => {
  const clk = clock();
  for (const e of [MS0, new Date(MS0), new Date(MS0).toISOString()]) {
    const t = mk(); t.anchor(e, { now: clk });
    assert.equal(t.drift().epoch, MS0);
  }
  for (const bad of ['next tuesday', NaN, new Date(NaN), {}, true]) assert.throws(() => mk().anchor(bad), TypeError, String(bad));
  assert.throws(() => mk().anchor(undefined, { mode: 'fast' }), /mode/);
  assert.throws(() => mk().anchor(undefined, { now: 5 }), /now/);
});

// ───────────── 生命週期 ─────────────

test('reset() starts the counting over (a relative anchor is learned again at the next play); unanchor() forgets it all', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk, onDrift() {} });
  t.play(); run(t, clk, 1, 0.1); run(t, clk, 5, 0.1, 0.5);
  assert.equal(t.drift().stalls, 5);
  t.reset();
  const d = t.drift();
  assert.deepEqual([d.stalls, d.frames, d.lost, d.behind, d.started], [0, 0, 0, 0, false]);
  assert.equal(d.mode, 'warn');
  t.unanchor();
  assert.equal(t.drift(), null);
});

test('the constructor takes anchor: true, an epoch, or { epoch, mode, … } — so createShow({ timeline: { anchor } }) reaches it', () => {
  const clk = clock();
  assert.equal(mk({ anchor: true }).drift().mode, 'warn');
  assert.equal(mk({ anchor: MS0 }).drift().epoch, MS0);
  const t = mk({ anchor: { epoch: MS0, mode: 'catch-up', jump: 3, now: clk } });
  assert.deepEqual([t.drift().mode, t.drift().epoch], ['catch-up', MS0]);
  assert.equal(mk({ anchor: false }).drift(), null);
  assert.equal(mk().drift(), null);
});

test('re-anchoring replaces the old anchor: counters start from zero', () => {
  const clk = clock(), t = mk();
  t.anchor(undefined, { now: clk, onDrift() {} });
  t.play(); run(t, clk, 1, 0.1); run(t, clk, 3, 0.1, 0.5);
  assert.equal(t.drift().stalls, 3);
  t.anchor(undefined, { now: clk, onDrift() {} });
  assert.equal(t.drift().stalls, 0);
});

// ───────────── 隨機操作：不變式 ─────────────

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** 同一串隨機操作餵給任意多條時間軸（各自有自己的假鐘）；每一步之後呼叫 check(步數)。 */
function fuzz(seed, rigs, check, steps = 1500) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < steps; i++) {
    const r = rnd();
    if (r < 0.72) {
      const dt = [0.016, 0.033, 0.1][Math.floor(rnd() * 3)], wall = rnd() < 0.12 ? dt + 0.2 + rnd() * 3 : dt;
      for (const { t, clk } of rigs) { clk.tick(wall); t.advance(dt); }
    } else if (r < 0.78) rigs.forEach(({ t }) => t.pause());
    else if (r < 0.86) rigs.forEach(({ t }) => t.play());
    else if (r < 0.91) { const T = rnd() * 40; rigs.forEach(({ t }) => t.seek(T)); }
    else if (r < 0.95) rigs.forEach(({ t }) => t.release());
    else if (r < 0.96) rigs.forEach(({ t }) => t.reset());
    else if (r < 0.98) { const k = [0.5, 1, 2][Math.floor(rnd() * 3)]; rigs.forEach(({ t }) => { t.rate = k; }); }
    else rigs.forEach(({ clk }) => clk.tick(rnd() * 20));              // 沒人呼叫 advance 的一段空白
    check(i);
  }
}
const FUZZ_SCENES = [{ id: 'a', t: 0, cues: [{ name: 'c1', t: 4 }] }, { id: 'b', t: 10, hold: true }, { id: 'c', t: 20 }, { id: 'd', t: 30, hold: true }];
const mkRig = (opts, anchor) => { const clk = clock(); const t = mk({ total: 40, scenes: FUZZ_SCENES, ...opts, ...(anchor ? { anchor: { now: clk, onDrift() {}, ...anchor } } : {}) }); return { t, clk }; };

test('fuzz: "warn" mode follows an unanchored timeline step for step, through pauses, seeks, holds, resets, rate changes and loops', () => {
  for (const [seed, opts] of [[1, {}], [2, { loop: true }], [3, { loop: { from: 5, to: 25 } }], [4, { loop: 'scene' }], [5, {}]]) {
    const plain = mkRig(opts), warn = mkRig(opts, { mode: 'warn' });
    const heard = [[], []];
    plain.t.onCue((c) => heard[0].push(c.name)); warn.t.onCue((c) => heard[1].push(c.name));
    fuzz(seed, [plain, warn], (i) => {
      const a = plain.t, b = warn.t;
      assert.deepEqual([b.t, b.playing, b.holding, b.loops], [a.t, a.playing, a.holding, a.loops], `seed ${seed} step ${i}`);
    });
    assert.deepEqual(heard[1], heard[0], `seed ${seed}: same cues`);
  }
});

test('fuzz: "catch-up" never leaves the show behind the wall clock by more than the tolerance while it plays, and never goes out of range', () => {
  const seen = { repaid: 0, jumps: 0, forgiven: 0, holds: 0, stalls: 0 };      // 隨機操作真的走到了這些情況，不是空轉
  for (const [seed, opts] of [[11, {}], [12, { loop: true }], [13, { loop: { from: 5, to: 25 } }], [14, {}]]) {
    const rig = mkRig(opts, { mode: 'catch-up', tolerance: 0.05, jump: 3 });
    let prev = { lost: 0, repaid: 0, forgiven: 0, stalls: 0 };
    fuzz(seed, [rig], (i) => {
      const { t } = rig, d = t.drift();
      for (const k of ['repaid', 'jumps', 'forgiven', 'stalls']) seen[k] = Math.max(seen[k], d[k]);
      if (t.holding) seen.holds++;
      assert.ok(Number.isFinite(t.t) && t.t >= 0 && t.t <= 40, `seed ${seed} step ${i}: t = ${t.t}`);
      for (const k of Object.keys(prev)) { assert.ok(d[k] >= prev[k] - 1e-9 || d.frames === 0, `seed ${seed} step ${i}: ${k} went down`); }
      prev = d.frames === 0 ? { lost: 0, repaid: 0, forgiven: 0, stalls: 0 } : { lost: d.lost, repaid: d.repaid, forgiven: d.forgiven, stalls: d.stalls };
      if (t.playing && d.started) assert.ok(d.behind <= 0.05 + 1e-6, `seed ${seed} step ${i}: still ${d.behind} s behind while playing`);
      if (!t.playing) assert.ok(Math.abs(d.behind) < 1e-9, `seed ${seed} step ${i}: a stopped show owes nothing (${d.behind})`);
    });
  }
  for (const [k, v] of Object.entries(seen)) assert.ok(v > 0, `the fuzz never produced ${k}`);
});
