// @openav/sync — several pages, one show.
//
// One page is the LEADER: it runs the show and says, every frame, where it is. The others are FOLLOWERS: their timelines do not
// walk by themselves, they chase the leader's T (Timeline.follow(): a small rate change when close, a seek when far, its pause and
// hold copied, running on alone when it goes quiet). This package is the wire between them; the timeline knows only the shape of a
// frame. Nothing here knows what is being shown: whatever the work wants to travel with the clock (its own override values, input
// events) goes in `extra`, and arrives once, in order, unread.
//
//   const sync = createSync({ role: 'leader', channel: 'hall', timeline });     // same machine: a BroadcastChannel, no network
//   const sync = createSync({ role: 'follower', channel: 'hall', timeline });   // ← the other page (same origin)
//   createSync({ role: 'follower', channel: 'hall', url: 'ws://leader-machine:8080/relay', timeline })   // another machine: the room relay
//   // every frame, after timeline.advance(dt):   sync.frame()          (createShow({ sync }) does all of this)
//
// Messages (plain JSON, the same on both transports):
//   { v:1, kind:'frame', src, seq, T, playing, holding, rate, cut?, extra? }   leader → followers, every frame
//   { v:1, kind:'hello', id, role:'follower', info?, reason? }                 follower → leader: "I am here, tell me where we are"
//   { v:1, kind:'state', src, seq, to, T, playing, holding, rate, cut?, extra? } leader → that follower (late joiners, resyncs)
// `seq` counts the leader's frames: a follower drops what is old or twice, sees a gap, and asks for the state again.

import { RelayClient } from '../relay/index.js?v=72212d8';

export const SYNC_VERSION = 1;
const CHANNEL_RE = /^[\w-]{1,32}$/;                        // the relay's room names are the same shape (hub.js cleanRoom)
const rnd = () => Math.random().toString(36).slice(2, 8);
const defaultNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
const isMsg = (m) => m !== null && typeof m === 'object' && m.v === SYNC_VERSION;

// ───────────── 傳輸 ─────────────
// 一個傳輸是 { send(msg), onMessage(cb), onOpen(cb), open, close() }：msg 是一個 JSON 物件（{ v, kind, … }）。
// 兩種傳輸都把訊息轉成 JSON 再送，所以 undefined、Date、Map 在兩邊一樣不見：換傳輸不會換行為。

/** 同一台機器、同一個來源的頁面之間：BroadcastChannel，零網路。名稱前面加 `oav-sync:`，不會撞到作品自己的頻道。 */
export class BroadcastTransport {
  constructor({ channel, BroadcastChannel: BC = globalThis.BroadcastChannel } = {}) {
    if (typeof BC !== 'function') throw new Error('[sync] this page has no BroadcastChannel; give a relay address (url) to sync over the network instead');
    this.channel = channel;
    this.open = true;
    this._cbs = [];
    this.bc = new BC('oav-sync:' + channel);
    this.bc.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      for (const cb of this._cbs) cb(m);
    };
  }
  send(msg) { if (this.open) { try { this.bc.postMessage(JSON.stringify(msg)); } catch { /* an unserializable extra: this frame is lost, the next is another */ } } }
  onMessage(cb) { this._cbs.push(cb); return this; }
  onOpen() { return this; }                              // 一直是開的：不會有「重新連上」
  close() { this.open = false; try { this.bc.close(); } catch { /* already closed */ } }
}

/** 跨機器：房間 relay（packages/relay）的 WebSocket，角色 leader／follower。房間名就是 channel。url：relay 的 ws:// 位址，null＝本頁同源的 /relay。 */
export class RelayTransport {
  constructor({ url = null, room, role, id, Client = RelayClient } = {}) {
    this.room = room; this.role = role; this.id = id;
    this._cbs = []; this._opens = []; this._was = false;
    const full = url ? url + (url.includes('?') ? '&' : '?') + `role=${role}&room=${encodeURIComponent(room)}&id=${encodeURIComponent(id)}` : null;
    this.client = new Client({
      role, room, id, url: full, batchHz: 1,                // 這條連線只送 sync：不需要信號的批次計時器跑快
      onSync: (m) => { const { type, ...msg } = m; for (const cb of this._cbs) cb(msg); },
      onStatus: (c) => { const open = !!c.open; if (open && !this._was) for (const cb of this._opens) cb(); this._was = open; },
    });
    this.client.connect();
  }
  get open() { return !!this.client.open; }
  send(msg) { this.client.sync(msg); }
  onMessage(cb) { this._cbs.push(cb); return this; }
  /** cb() 每次連上（含斷線後重連）：從屬端在這裡重新說 hello。 */
  onOpen(cb) { this._opens.push(cb); return this; }
  close() { this.client.close(); }
}

/** role 'leader' | 'follower'；channel 1–32 個字母數字 - _；url 沒有＝BroadcastChannel，true＝本頁同源的 /relay，字串＝那個 ws:// relay。 */
export function createTransport({ role, channel, url = null, id = (role === 'leader' ? 'L-' : 'F-') + rnd(), BroadcastChannel, Client } = {}) {
  if (role !== 'leader' && role !== 'follower') throw new TypeError(`[sync] role must be 'leader' or 'follower' (got ${JSON.stringify(role)})`);
  if (typeof channel !== 'string' || !CHANNEL_RE.test(channel)) throw new TypeError(`[sync] channel must be 1–32 letters, digits, - or _ (got ${JSON.stringify(channel)})`);
  if (url) return new RelayTransport({ url: url === true ? null : url, room: channel, role, id, Client });
  return new BroadcastTransport({ channel, BroadcastChannel });
}

// ───────────── 主控端 ─────────────

export class SyncLeader {
  /**
   * @param {object} o
   * @param {object} o.timeline    讀它的 t／playing／holding／rate（seek 時馬上送一幀）
   * @param {object} o.transport
   * @param {string} [o.id]
   * @param {string|(()=>string|null)|null} [o.cut]   節目版本（score 的 cut id），隨每一幀送出；從屬端可以拒絕跟不同版本的主控端
   * @param {(()=>any)|null} [o.extra]       每送一幀問一次；回傳非 undefined 就放進那一幀的 `extra`（作品要跟著時鐘走的資料；框架不解讀）
   * @param {((hello:object)=>any)|null} [o.state]  從屬端 hello 時問一次；答案放進 state 的 `extra`（例如整捲磁帶，讓中途加入的從屬端補上）
   * @param {number} [o.hz]        每秒最多幾幀（0＝每個 frame() 都送）。狀態變了（播放、暫停、hold、rate、seek）的那一幀一定馬上送
   * @param {()=>number} [o.now]   毫秒（只用在 hz）
   * @param {(hello:object)=>void} [o.onHello]
   */
  constructor({ timeline, transport, id = 'L-' + rnd(), cut = null, extra = null, state = null, hz = 0, now = defaultNow, onHello = null } = {}) {
    if (!timeline) throw new TypeError('[sync] SyncLeader needs a timeline');
    if (!transport) throw new TypeError('[sync] SyncLeader needs a transport');
    Object.assign(this, { timeline, transport, id, cut, extra, state, hz, now, onHello });
    this.role = 'leader';
    this.seq = 0; this.sent = 0; this.hellos = 0; this.closed = false;
    this._followers = new Map(); this._last = null; this._at = -Infinity; this._force = true;
    timeline.onSeek?.(() => { this._force = true; });
    transport.onMessage((m) => this._onMessage(m));
  }
  _cut() { const c = typeof this.cut === 'function' ? this.cut() : this.cut; return c === undefined ? null : c; }
  _ask(fn, arg) {
    if (typeof fn !== 'function') return undefined;
    try { return fn(arg); } catch (e) { console.error('[sync] a leader hook threw:', e); return undefined; }
  }
  _body() {
    const tl = this.timeline, cut = this._cut();
    return { T: tl.t, playing: !!tl.playing, holding: !!tl.holding, rate: tl.rate, ...(cut !== null ? { cut } : {}) };
  }
  /** 每個影格呼叫一次（timeline.advance 之後）。送出一幀就回 true，被 hz 節流掉就回 false。 */
  frame() {
    if (this.closed) return false;
    const now = this.now(), b = this._body(), l = this._last;
    const changed = this._force || !l || l.playing !== b.playing || l.holding !== b.holding || l.rate !== b.rate || l.cut !== b.cut;
    if (this.hz > 0 && !changed && now - this._at < 1000 / this.hz) return false;
    this._force = false; this._last = b; this._at = now;
    const msg = { v: SYNC_VERSION, kind: 'frame', src: this.id, seq: ++this.seq, ...b };
    const ex = this._ask(this.extra);
    if (ex !== undefined) msg.extra = ex;
    this.transport.send(msg); this.sent++;
    return true;
  }
  /** 現在的 state，`to` 一個從屬端（不給＝所有從屬端）。hello 會自動回；要自己推（例如作品剛換了磁帶）也可以呼叫。 */
  sendState(to, hello) {
    const msg = { v: SYNC_VERSION, kind: 'state', src: this.id, seq: this.seq, ...(to ? { to } : {}), ...this._body() };
    const ex = this._ask(this.state, hello);
    if (ex !== undefined) msg.extra = ex;
    this.transport.send(msg);
  }
  _onMessage(m) {
    if (!isMsg(m) || m.kind !== 'hello' || typeof m.id !== 'string') return;
    this.hellos++;
    this._followers.set(m.id, { seen: this.now(), info: m.info });
    this._ask(this.onHello, m);
    this.sendState(m.id, m);
  }
  status() { return { role: 'leader', id: this.id, open: !!this.transport.open, seq: this.seq, sent: this.sent, hellos: this.hellos, followers: this._followers.size, cut: this._cut() }; }
  /** 給後台 monitor 的數字（createShow 掛上 monitor.extra）。 */
  monitor() { return { 'sync/role': 'leader', 'sync/followers': this._followers.size, 'sync/connected': !!this.transport.open }; }
  close() { this.closed = true; this.transport.close(); }
}

// ───────────── 從屬端 ─────────────

export class SyncFollower {
  /**
   * 它自己就是 Timeline.follow() 的 source：latest() 回最後一則主控端 frame，now 是它蓋 `at` 用的鐘。
   * @param {object} o
   * @param {object} o.transport
   * @param {string} [o.id]            relay 上要和 transport 的 id 一樣（state 用它點名）
   * @param {()=>number} [o.now]       毫秒；要和 timeline.follow 的 now 同一個鐘（createSync 會接好）
   * @param {object|null} [o.timeline] 只用來給 monitor() 和 close()（timeline.follow 是 createSync 呼叫的）
   * @param {any} [o.info]             隨每個 hello 送給主控端（版本、指紋…），主控端的 state(hello) 讀得到
   * @param {((msg:object)=>boolean|string|void)|null} [o.accept]  false（或一個理由字串）＝拒絕這則 frame／state：不交給任何人、latest() 也不更新
   * @param {((msg:object)=>void)|null} [o.onFrame]   每則被接受的 frame，依序一次（msg.extra 在裡面）
   * @param {((msg:object)=>void)|null} [o.onState]   每則被接受的 state（msg.extra 在裡面）
   * @param {((gap:{from:number,to:number})=>void)|null} [o.onGap]  漏了 seq from…to
   * @param {boolean} [o.resync=true]  漏了幀、沉默後回來、換了主控端：再 hello 一次，拿 state 補上
   * @param {number} [o.helloEvery=1000]    還沒有 state 的時候每隔多少毫秒再 hello 一次（frame() 負責計時）
   * @param {number} [o.takeoverAfter=1500] 原本的主控端安靜了這麼多毫秒，才接受別的主控端（人工把另一台升成主控端、主控端重開）
   * @param {number} [o.resyncAfter=1000]   安靜了這麼多毫秒之後的第一幀，當作「回來了」
   */
  constructor({ transport, id = 'F-' + rnd(), now = defaultNow, timeline = null, info, accept = null, onFrame = null, onState = null, onGap = null, resync = true, helloEvery = 1000, takeoverAfter = 1500, resyncAfter = 1000 } = {}) {
    if (!transport) throw new TypeError('[sync] SyncFollower needs a transport');
    Object.assign(this, { transport, id, now, timeline, info, accept, onFrame, onState, onGap, resync, helloEvery, takeoverAfter, resyncAfter });
    this.role = 'follower';
    this.src = null; this.seq = -1; this.haveState = false; this.refused = null; this.closed = false; this.attached = false;
    this.counts = { frames: 0, states: 0, gaps: 0, dropped: 0, rejected: 0, ignored: 0, hellos: 0 };
    this._last = null; this._at = null; this._helloAt = -Infinity; this._opened = false; this._acceptWarned = false;
    transport.onMessage((m) => this._onMessage(m));
    transport.onOpen?.(() => { this.hello(this._opened ? 'reconnect' : undefined); this._opened = true; });
    if (transport.open) { this._opened = true; this.hello(); }
  }

  /** Timeline.follow() 的 source：最後一則被接受的 frame { T, playing, holding, rate, at, seq, cut? }，還沒有就是 null。 */
  latest() { return this._last; }

  /** 跟主控端說「我在這裡，告訴我現在到哪了」。回 true＝送出去了。 */
  hello(reason) {
    if (this.closed || !this.transport.open) return false;
    this._helloAt = this.now(); this.counts.hellos++;
    this.transport.send({ v: SYNC_VERSION, kind: 'hello', id: this.id, role: 'follower', ...(this.info !== undefined ? { info: this.info } : {}), ...(reason ? { reason } : {}) });
    return true;
  }
  /** 每個影格呼叫一次：還沒拿到 state（主控端還沒上線、hello 被丟了）就每隔 helloEvery 再問一次。 */
  frame() {
    if (this.closed || this.haveState) return;
    if (this.now() - this._helloAt >= this.helloEvery) this.hello('retry');
  }

  _hook(fn, arg) {
    if (typeof fn !== 'function') return;
    try { fn(arg); } catch (e) { console.error('[sync] a follower hook threw:', e); }
  }
  _onMessage(m) {
    if (this.closed || !isMsg(m)) return;
    if (m.kind === 'frame') this._take(m, false);
    else if (m.kind === 'state' && (m.to === undefined || m.to === null || m.to === this.id)) this._take(m, true);
  }
  _take(m, isState) {
    if (typeof m.src !== 'string' || !Number.isFinite(m.T) || !Number.isFinite(m.seq)) return;
    const now = this.now();
    if (typeof this.accept === 'function') {
      let verdict = true;
      try { verdict = this.accept(m); } catch (e) { verdict = 'the accept hook threw'; if (!this._acceptWarned) { this._acceptWarned = true; console.error('[sync] the accept hook threw:', e); } }
      if (verdict === false || typeof verdict === 'string') { this.counts.rejected++; this.refused = typeof verdict === 'string' ? verdict : 'refused'; return; }
    }
    let takeover = false;
    if (this.src === null) this.src = m.src;
    else if (m.src !== this.src) {
      if (this._at !== null && now - this._at < this.takeoverAfter) { this.counts.ignored++; return; }
      this.src = m.src; this.seq = -1; takeover = true;
    }
    this.refused = null;
    let gap = null;
    if (!isState) {
      if (this.seq >= 0 && m.seq <= this.seq) { this.counts.dropped++; return; }          // 舊的或重複的：順序是主控端的順序
      if (this.seq >= 0 && m.seq > this.seq + 1) { gap = { from: this.seq + 1, to: m.seq - 1 }; this.counts.gaps++; }
      this.seq = m.seq; this.counts.frames++;
    } else {
      this.seq = Math.max(this.seq, m.seq); this.haveState = true; this.counts.states++;
    }
    const silentFor = this._at === null ? 0 : now - this._at;
    this._at = now;
    this._last = {
      T: m.T, playing: !!m.playing, holding: !!m.holding, rate: Number.isFinite(m.rate) ? m.rate : 1, at: now, seq: m.seq,
      ...(m.cut !== undefined && m.cut !== null ? { cut: m.cut } : {}),
    };
    if (gap) this._hook(this.onGap, gap);
    this._hook(isState ? this.onState : this.onFrame, m);
    // 漏了幀、換了主控端、安靜很久之後回來：那段時間的 extra 可能掉了，向主控端要整份 state
    const why = takeover ? 'takeover' : gap ? 'gap' : (!isState && silentFor > this.resyncAfter) ? 'resumed' : null;
    if (why && this.resync) {
      this.haveState = false;
      if (now - this._helloAt >= 250) this.hello(why);                                     // 太密的由 frame() 的計時補上
    }
  }

  status() {
    return {
      role: 'follower', id: this.id, leader: this.src, connected: !!this.transport.open, seq: this.seq, haveState: this.haveState,
      silence: this._at === null ? null : (this.now() - this._at) / 1000, refused: this.refused, ...this.counts,
    };
  }
  /** 給後台 monitor 的數字（createShow 掛上 monitor.extra）：誤差、沉默、失聯（紅）、被拒絕的理由。 */
  monitor() {
    const st = this.timeline?.followStatus?.() ?? null;
    const lost = !!st?.lost, refused = this.refused;
    return {
      'sync/role': 'follower',
      'sync/state': refused ? `refused: ${refused}` : st ? st.state : this._last ? 'tracking' : 'waiting',
      'sync/error': { v: st?.error ?? 0, min: -0.5, max: 0.5, ...(lost || refused ? { warn: true } : {}) },
      'sync/silence': st ? st.silence : this._at === null ? 0 : (this.now() - this._at) / 1000,
      'sync/lost': { v: lost ? 1 : 0, min: 0, max: 1, ...(lost ? { warn: true } : {}) },
      'sync/jumps': st ? st.jumps : 0,
      'sync/gaps': this.counts.gaps,
    };
  }
  close() {
    this.closed = true;
    if (this.attached) this.timeline?.unfollow?.();
    this.transport.close();
  }
}

// ───────────── 一次組好 ─────────────

/**
 * 主控端或從屬端，連同傳輸。從屬端的 timeline 會接上 follow()；主控端要在每個影格 timeline.advance(dt) 之後呼叫 sync.frame()
 * （從屬端也呼叫：它負責 hello 的重試計時）。createShow({ sync }) 把這些都接好。
 * @param {object} o
 * @param {'leader'|'follower'} o.role
 * @param {string} o.channel    BroadcastChannel 的名稱，也是 relay 的房間名（1–32 個字母數字 - _）
 * @param {string|true|null} [o.url]  沒給＝BroadcastChannel（同一台機器）；ws://… relay 位址；true＝本頁同源的 /relay
 * @param {object} o.timeline
 * @param {{cut?:string}|null} [o.score]  有就把 score.cut 當 cut 送出（主控端）／核對（從屬端：不同版本的主控端被拒絕）
 * @param {object} [o.follow]   從屬端：Timeline.follow() 的選項（nudge、deadband、jump、lostAfter、latency、onFollow）
 * @param {object} [o.transport]  自己的傳輸（測試、別的通道）；沒給就照 channel／url 建
 * 其餘：主控端 extra／state／hz／onHello；從屬端 info／accept／onFrame／onState／onGap／resync／helloEvery／takeoverAfter／resyncAfter；id、now
 * @returns {SyncLeader|SyncFollower}
 */
export function createSync({ role, channel, url = null, id, timeline, score = null, transport = null, now, follow = {}, ...rest } = {}) {
  if (!timeline) throw new TypeError('[sync] createSync(): timeline is required');
  if (role !== 'leader' && role !== 'follower') throw new TypeError(`[sync] role must be 'leader' or 'follower' (got ${JSON.stringify(role)})`);
  const me = id ?? (role === 'leader' ? 'L-' : 'F-') + rnd();
  const tr = transport || createTransport({ role, channel, url, id: me });
  const cutOf = () => (score && score.cut !== undefined ? score.cut : null);
  if (role === 'leader') {
    const { extra, state, hz, onHello } = rest;
    return new SyncLeader({ timeline, transport: tr, id: me, now, cut: cutOf, extra, state, hz, onHello });
  }
  const { info, accept, onFrame, onState, onGap, resync, helloEvery, takeoverAfter, resyncAfter } = rest;
  const guard = (m) => {
    const mine = cutOf();
    if (mine !== null && m.cut !== undefined && m.cut !== null && m.cut !== mine) return `cut ${m.cut} ≠ ${mine}`;   // 不同版本的主控端：長度不同，T 對不起來
    return typeof accept === 'function' ? accept(m) : true;
  };
  const f = new SyncFollower({ transport: tr, id: me, now, timeline, info, accept: guard, onFrame, onState, onGap, resync, helloEvery, takeoverAfter, resyncAfter });
  timeline.follow(f, { ...follow, now: f.now });
  f.attached = true;
  return f;
}
