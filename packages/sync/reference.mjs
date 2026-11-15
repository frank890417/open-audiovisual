// @openav/sync reference: several pages, one show. One page leads, the others follow its clock; this package is the wire between them.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  createSync: {
    group: 'core',
    summary: {
      en: 'Makes one page the leader or a follower of a show that several pages perform: it builds the transport, and a follower\'s timeline starts following the leader\'s clock.',
      zh: '讓一個頁面成為「好幾個頁面演同一場」裡的主控端或從屬端：它會建好傳輸，從屬端的時間軸也會開始追主控端的時鐘。',
    },
    params: [
      {
        name: 'role', type: '\'leader\' | \'follower\'',
        en: '`\'leader\'`: this page runs the show and says where it is every frame. `\'follower\'`: this page\'s timeline chases the leader. Anything else throws a `TypeError`.',
        zh: '`\'leader\'`：這個頁面跑演出，每一幀說出自己在哪。`\'follower\'`：這個頁面的時間軸去追主控端。其他值會丟出 `TypeError`。',
      },
      {
        name: 'channel', type: 'String',
        en: 'The name the pages meet under: the `BroadcastChannel` name and the relay room. 1 to 32 letters, digits, `-` or `_`. Not needed when you pass your own `transport`.',
        zh: '頁面碰頭用的名字：`BroadcastChannel` 的名稱，也是中繼的房間名。1 到 32 個字母、數字、`-` 或 `_`。自己傳 `transport` 的時候不需要。',
      },
      {
        name: 'url', type: 'String | true | null', optional: true, default: 'null',
        en: 'Nothing: a `BroadcastChannel` (pages of one browser on one machine, same origin). A `ws://` or `wss://` address: the room relay on that machine. `true`: this page\'s own `/relay`.',
        zh: '不給：用 `BroadcastChannel`（同一台機器、同一個瀏覽器、同一個來源的頁面）。`ws://` 或 `wss://` 位址：那台機器上的房間中繼。`true`：這個頁面自己的 `/relay`。',
      },
      {
        name: 'id', type: 'String', optional: true,
        en: 'This peer\'s id. The default is `L-` or `F-` followed by six random characters.',
        zh: '這一端的 id。預設是 `L-` 或 `F-` 加上六個隨機字元。',
      },
      {
        name: 'timeline', type: 'Timeline',
        en: 'The [`Timeline`](#Timeline) of this page. Required. The leader reads its `t`, `playing`, `holding` and `rate`; on a follower, `timeline.follow()` is called for you.',
        zh: '這個頁面的 [`Timeline`](#Timeline)。必填。主控端讀它的 `t`、`playing`、`holding` 和 `rate`。在從屬端，會替你呼叫 `timeline.follow()`。',
      },
      {
        name: 'score', type: 'Score | null', optional: true, default: 'null',
        en: 'A [`Score`](#Score), or any object with a `cut`. The leader sends `score.cut` with every frame, and a follower refuses a leader whose cut is different from its own.',
        zh: '一份 [`Score`](#Score)，或任何有 `cut` 的物件。主控端會把 `score.cut` 隨每一幀送出，從屬端會拒絕 cut 跟自己不同的主控端。',
      },
      {
        name: 'transport', type: 'Object | null', optional: true, default: 'null',
        en: 'Your own transport, `{ send(msg), onMessage(cb), onOpen(cb), open, close() }`, for a test or another channel. Without it one is built from `channel` and `url` by [`createTransport()`](#createTransport).',
        zh: '你自己的傳輸 `{ send(msg), onMessage(cb), onOpen(cb), open, close() }`，給測試或別的通道用。沒給就由 [`createTransport()`](#createTransport) 照 `channel` 和 `url` 建一個。',
      },
      {
        name: 'now', type: 'Function', optional: true,
        en: 'The clock, in milliseconds (default `performance.now`). A follower hands the same clock to `timeline.follow()`.',
        zh: '時鐘，單位是毫秒（預設 `performance.now`）。從屬端會把同一個時鐘交給 `timeline.follow()`。',
      },
      {
        name: 'follow', type: 'Object', optional: true, default: '{}',
        en: 'Follower: the options of `timeline.follow()` (`nudge`, `deadband`, `jump`, `lostAfter`, `latency`, `onFollow`).',
        zh: '從屬端：`timeline.follow()` 的選項（`nudge`、`deadband`、`jump`、`lostAfter`、`latency`、`onFollow`）。',
      },
      {
        name: 'rest', type: 'Object', optional: true,
        en: 'Not a key of its own: every other key of the options object. A leader takes `extra`, `state`, `hz` and `onHello` (see [`SyncLeader`](#SyncLeader)); a follower takes `info`, `accept`, `onFrame`, `onState`, `onGap`, `resync`, `helloEvery`, `takeoverAfter` and `resyncAfter` (see [`SyncFollower`](#SyncFollower)).',
        zh: '它本身不是一個鍵，而是選項物件裡其餘的所有鍵。主控端收 `extra`、`state`、`hz` 和 `onHello`（見 [`SyncLeader`](#SyncLeader)）。從屬端收 `info`、`accept`、`onFrame`、`onState`、`onGap`、`resync`、`helloEvery`、`takeoverAfter` 和 `resyncAfter`（見 [`SyncFollower`](#SyncFollower)）。',
      },
    ],
    returns: {
      type: 'SyncLeader | SyncFollower',
      en: 'A [`SyncLeader`](#SyncLeader) or a [`SyncFollower`](#SyncFollower). Both have `frame()`, `status()`, `monitor()` and `close()`.',
      zh: '一個 [`SyncLeader`](#SyncLeader) 或 [`SyncFollower`](#SyncFollower)。兩者都有 `frame()`、`status()`、`monitor()` 和 `close()`。',
    },
    description: [
      {
        en: 'A wall of three outputs, a stage and a lobby, a rehearsal laptop beside the show laptop: one show, several pages. One page is the **leader**: it runs the timeline and says, every frame, where it is. The others are **followers**: their timelines do not walk by themselves, they chase the leader\'s `T` (a small rate change when close, a seek when far, its pause and hold copied, running on alone when it goes quiet: that half is [`timeline.follow()`](#Timeline)). Every page runs the same code; only `role` differs.',
        zh: '三顆輸出拼成的一面牆、舞台加大廳、排練的筆電放在演出筆電旁邊：一場演出，好幾個頁面。其中一個頁面是**主控端**（leader）：它跑時間軸，每一幀說出自己在哪。其餘是**從屬端**（follower）：它們的時間軸不自己往前走，而是追主控端的 `T`（差得少就微調 rate，差得多就 seek，主控端暫停或停在 hold 也跟著，主控端沒聲音了就自己走：這一半是 [`timeline.follow()`](#Timeline)）。每個頁面跑同一份程式，只有 `role` 不同。',
      },
      {
        en: 'In a show you do not call it: [`createShow({ sync: { role, channel } })`](#createShow) does, calls `sync.frame()` every frame, switches a follower\'s input modules off and sends the sync numbers to the backstage monitor. By hand, call `sync.frame()` once per frame right after `timeline.advance(dt)`, on the leader (it sends the frame) and on a follower (it retries its hello).',
        zh: '在演出裡不用自己呼叫：[`createShow({ sync: { role, channel } })`](#createShow) 會替你呼叫，每個影格呼叫 `sync.frame()`，把從屬端會產生輸入的模組關掉，並把同步的數字送到後台監看。手工組裝的話，每個影格在 `timeline.advance(dt)` 之後呼叫一次 `sync.frame()`，主控端要呼叫（它送出這一幀），從屬端也要（它負責重試 hello）。',
      },
      {
        en: 'The messages are plain JSON, the same on both transports:\n\n```text\n{ v:1, kind:\'frame\', src, seq, T, playing, holding, rate, cut?, extra? }       leader → followers, every frame\n{ v:1, kind:\'hello\', id, role:\'follower\', info?, reason? }                     follower → leader\n{ v:1, kind:\'state\', src, seq, to, T, playing, holding, rate, cut?, extra? }   leader → that follower\n```\n\n`seq` counts the leader\'s frames. A follower drops a frame that is old or repeated, notices a gap, and says hello again to get a `state`, so a page that joins late or reloads lands on the show\'s present.',
        zh: '訊息是單純的 JSON，兩種傳輸送的都一樣：\n\n```text\n{ v:1, kind:\'frame\', src, seq, T, playing, holding, rate, cut?, extra? }       leader → followers, every frame\n{ v:1, kind:\'hello\', id, role:\'follower\', info?, reason? }                     follower → leader\n{ v:1, kind:\'state\', src, seq, to, T, playing, holding, rate, cut?, extra? }   leader → that follower\n```\n\n`seq` 是主控端送出的 frame 的編號。從屬端會丟掉舊的或重複的 frame，發現缺口就再說一次 hello 去要 `state`，所以中途加入或重新載入的頁面，會落在演出的現在。',
      },
    ],
    needs: {
      en: 'A [`Timeline`](#Timeline) on every page, and the same `channel` on all of them. Without a `url`, the pages must be open in the same browser, from the same origin. With one, a room relay must be running (`node serve.js` hosts one at `/relay`).',
      zh: '每個頁面都要有一條 [`Timeline`](#Timeline)，而且用同一個 `channel`。沒有 `url` 的時候，頁面要開在同一個瀏覽器、同一個來源底下。有 `url` 的時候，要有一台房間中繼在跑（`node serve.js` 在 `/relay` 架了一個）。',
    },
    notes: [
      {
        en: 'The pages share *time*, nothing else. A world that integrates `dt` (a feedback trail, a particle system) will not look the same on two pages at the same `T` unless what must match is written as a function of `T`, or travels in `extra`.',
        zh: '頁面之間共用的只有*時間*。會積分 `dt` 的世界（殘影、粒子系統），在 `T` 相同的兩個頁面上不會長得一樣，除非要一致的東西都寫成 `T` 的函式，或放在 `extra` 裡一起送。',
      },
      {
        en: 'A frame carries the leader\'s `T`, not a wall-clock time. Across machines a follower trails by about one trip unless you set `follow: { latency }`. There is no election: to promote a follower, load it with `role: \'leader\'` once the old leader is gone.',
        zh: 'frame 帶的是主控端的 `T`，不是牆鐘的時刻。跨機器時，從屬端大約會落後一趟路程的時間，除非你設定 `follow: { latency }`。沒有選舉：要把從屬端升成主控端，就是在舊主控端不見之後，用 `role: \'leader\'` 載入它。',
      },
    ],
    tbd: [
      {
        en: 'Two real pages, and two machines over the relay, were not run here. The examples join a leader and a follower inside one page with a stand-in transport.',
        zh: '真正的兩個頁面，以及透過中繼連起來的兩台機器，沒有在這裡跑過。範例是在同一個頁面裡用替身傳輸把主控端和從屬端接起來。',
      },
    ],
    examples: [
      {
        code: `import { Params } from '@openav/core';
import { Timeline } from '@openav/timeline';
import { createSync } from '@openav/sync';

// A stand-in for the wire, so both ends run in one page: what one side sends, the other hears (as JSON, like the real ones).
function wire() {
  const end = (other) => ({
    open: true, cbs: [],
    send(msg) { for (const cb of other().cbs) cb(JSON.parse(JSON.stringify(msg))); },
    onMessage(cb) { this.cbs.push(cb); return this; },
    onOpen() { return this; },
    close() { this.open = false; },
  });
  const a = end(() => b), b = end(() => a);
  return [a, b];
}
const [toFollowers, toLeader] = wire();
let clock = 0;
const now = () => clock;                                   // one fake clock for both ends
const stage = new Timeline({ params: new Params([]), total: 60 });
const lobby = new Timeline({ params: new Params([]), total: 60 });
const leader = createSync({ role: 'leader', channel: 'hall', timeline: stage, transport: toFollowers, now });
const follower = createSync({ role: 'follower', channel: 'hall', timeline: lobby, transport: toLeader, now });

stage.seek(12);                                            // only the leader is told
stage.play();
for (let i = 0; i < 120; i++) {                            // two seconds at 60 frames a second
  clock += 1000 / 60;
  stage.advance(1 / 60); leader.frame();
  lobby.advance(1 / 60); follower.frame();
}
console.log(stage.t.toFixed(2), lobby.t.toFixed(2), lobby.followStatus().text);
console.log(leader.status().followers, follower.status().frames);`,
        caption: { en: 'Only the leader was seeked and played, and the follower is where it is: the console prints `14.00 14.00 with the leader · 1 jump` (the one jump is the follower landing on second 12), then `1 120`.', zh: '只有主控端被 seek 和播放，從屬端卻跟它在同一個位置：主控台印出 `14.00 14.00 with the leader · 1 jump`（那一次 jump 是從屬端落到第 12 秒），接著是 `1 120`。' },
      },
      {
        code: `import { createShow } from '@openav/show';

const role = new URLSearchParams(location.search).get('role') === 'follower' ? 'follower' : 'leader';
const show = await createShow({
  world,                                                   // your world: the same code on every page
  sync: { role, channel: 'hall' },                         // pages of one browser on one machine
  // sync: { role, channel: 'hall', url: 'ws://leader.local:8080/relay' },   // pages on other machines
});
console.log(show.sync.status());`,
        caption: { en: 'Open the page once as it is and once with `?role=follower`: play, pause and seek on the first, and the second shows the same moment of the show.', zh: '同一個頁面開兩次，一次照原樣，一次加上 `?role=follower`：在第一個頁面播放、暫停、seek，第二個頁面顯示的是演出的同一個瞬間。' },
        run: 'static',
        why: 'It needs two pages open in one browser (or a relay between two machines) and a world of your own.',
      },
    ],
    related: ['SyncLeader', 'SyncFollower', 'createTransport', 'Timeline', 'createShow', 'attachRelay', 'Score'],
    keywords: {
      en: ['sync', 'several pages', 'multi screen', 'leader', 'follower', 'video wall', 'broadcast channel', 'relay', 'clock', 'same show'],
      zh: ['同步', '多個頁面', '多螢幕', '主控端', '從屬端', '拼接牆', 'broadcast channel', '中繼', '時鐘', '同一場演出'],
    },
  },

  SyncLeader: {
    group: 'core',
    summary: {
      en: 'The leader\'s end of the sync: each `frame()` sends the timeline\'s `T`, playing, holding and rate, and every follower\'s hello is answered with the state.',
      zh: '同步的主控端這一頭：每次呼叫 `frame()` 就送出一幀，帶著時間軸的 `T`、playing、holding 和 rate，並用 state 回答每個從屬端的 hello。',
    },
    params: [
      {
        name: 'timeline', type: 'Timeline',
        en: 'The [`Timeline`](#Timeline) to report. Required. Its `t`, `playing`, `holding` and `rate` are read for every frame, and a seek makes the next frame go out at once.',
        zh: '要回報的 [`Timeline`](#Timeline)。必填。每一幀都讀它的 `t`、`playing`、`holding` 和 `rate`，它被 seek 之後，下一幀會馬上送出。',
      },
      {
        name: 'transport', type: 'Object',
        en: 'Where the messages go: a [`BroadcastTransport`](#BroadcastTransport), a [`RelayTransport`](#RelayTransport) or your own. Required.',
        zh: '訊息要送去哪裡：[`BroadcastTransport`](#BroadcastTransport)、[`RelayTransport`](#RelayTransport)，或你自己的傳輸。必填。',
      },
      {
        name: 'id', type: 'String', optional: true,
        en: 'This leader\'s id, the `src` of its messages. The default is `L-` and six random characters.',
        zh: '這個主控端的 id，也就是它訊息裡的 `src`。預設是 `L-` 加六個隨機字元。',
      },
      {
        name: 'cut', type: 'String | Function | null', optional: true, default: 'null',
        en: 'The version of the show (a score\'s cut id), or a function that returns it. Sent with every frame when it is not `null`, so a follower can refuse a leader that plays another version.',
        zh: '演出的版本（總譜的 cut id），或一個回傳它的函式。不是 `null` 的時候會隨每一幀送出，讓從屬端可以拒絕演別的版本的主控端。',
      },
      {
        name: 'extra', type: 'Function | null', optional: true, default: 'null',
        en: 'Asked once for every frame sent. What it returns (unless `undefined`) travels in that frame\'s `extra`: the work\'s own data that must go with the clock. The framework does not read it.',
        zh: '每送一幀問一次。它回傳的東西（`undefined` 除外）會放進那一幀的 `extra`：作品自己要跟著時鐘走的資料。框架不會讀它。',
      },
      {
        name: 'state', type: 'Function | null', optional: true, default: 'null',
        en: 'Asked as `state(hello)` when a follower says hello. What it returns travels in the `extra` of the `state` reply, for example everything a late joiner missed.',
        zh: '從屬端說 hello 的時候，以 `state(hello)` 問一次。它回傳的東西會放進 `state` 回覆的 `extra`，例如中途加入的頁面漏掉的所有東西。',
      },
      {
        name: 'hz', type: 'Number', optional: true, default: '0',
        en: 'The most frames sent per second; 0 sends on every `frame()`. A frame where playing, holding, rate or cut changed, or that follows a seek, always goes out at once.',
        zh: '每秒最多送幾幀，0 表示每次 `frame()` 都送。playing、holding、rate 或 cut 改變的那一幀，以及 seek 之後的那一幀，一定馬上送。',
      },
      {
        name: 'now', type: 'Function', optional: true, default: 'performance.now',
        en: 'The clock in milliseconds, used for `hz` and to note when each follower was last heard.',
        zh: '時鐘，單位是毫秒，用在 `hz` 的節流，以及記下每個從屬端上次出聲的時間。',
      },
      {
        name: 'onHello', type: 'Function | null', optional: true, default: 'null',
        en: 'Called as `onHello(hello)` for every hello, before the state is sent.',
        zh: '每收到一個 hello，就在送出 state 之前以 `onHello(hello)` 呼叫。',
      },
    ],
    description: [
      {
        en: '[`createSync({ role: \'leader\', … })`](#createSync) builds one for you with its transport. Call `leader.frame()` once per frame, after `timeline.advance(dt)`: it sends `{ v, kind: \'frame\', src, seq, T, playing, holding, rate, cut?, extra? }`, and `seq` goes up by one for every frame sent. When a follower says hello, the leader notes it and answers with a `state` message addressed to that follower, so the follower lands on the show\'s present.',
        zh: '[`createSync({ role: \'leader\', … })`](#createSync) 會替你連同傳輸一起建好一個。每個影格在 `timeline.advance(dt)` 之後呼叫一次 `leader.frame()`：它送出 `{ v, kind: \'frame\', src, seq, T, playing, holding, rate, cut?, extra? }`，每送一幀 `seq` 就加一。從屬端說 hello 的時候，主控端記下它，並回一則指名給它的 `state` 訊息，讓它落在演出的現在。',
      },
      {
        en: 'An `extra`, `state` or `onHello` hook that throws is caught and logged as `[sync]`; the message still goes out, without its `extra`. A `cut` function is not guarded: an error in it comes out of `frame()`.',
        zh: '`extra`、`state` 或 `onHello` 掛鉤丟出錯誤會被接住、記成 `[sync]`，訊息照樣送出，只是沒有 `extra`。`cut` 函式沒有這層保護：它丟出的錯誤會從 `frame()` 冒出來。',
      },
    ],
    needs: {
      en: 'Call `frame()` every frame: nothing is sent by itself.',
      zh: '每個影格都要呼叫 `frame()`：它不會自己送。',
    },
    members: {
      frame: {
        en: 'Send this frame. Returns `true` when a frame went out and `false` when `hz` throttled it or the leader is closed.',
        zh: '送出這一幀。有送出去回傳 `true`，被 `hz` 節流掉或主控端已經關閉則回傳 `false`。',
      },
      sendState: {
        en: '`sendState(to?, hello?)`: send the current state to the follower with the id `to`, or to every follower when `to` is left out. A hello is answered with it automatically; call it yourself when the work has new standing data to push.',
        zh: '`sendState(to?, hello?)`：把目前的 state 送給 id 是 `to` 的從屬端，不給 `to` 就送給所有從屬端。hello 會自動用它回覆。作品有新的常駐資料要推的時候，可以自己呼叫。',
      },
      status: {
        en: '`{ role: \'leader\', id, open, seq, sent, hellos, followers, cut }`. `followers` counts the ids that have said hello; an id that leaves is not removed.',
        zh: '`{ role: \'leader\', id, open, seq, sent, hellos, followers, cut }`。`followers` 是說過 hello 的 id 數量，離開的 id 不會被移除。',
      },
      monitor: {
        en: 'The numbers for the backstage monitor: `{ \'sync/role\': \'leader\', \'sync/followers\', \'sync/connected\' }`. `createShow()` hooks it to `monitor.extra()`.',
        zh: '給後台監看的數字：`{ \'sync/role\': \'leader\', \'sync/followers\', \'sync/connected\' }`。`createShow()` 會把它掛到 `monitor.extra()` 上。',
      },
      close: {
        en: 'Stop sending and close the transport.',
        zh: '停止送出，並關掉傳輸。',
      },
    },
    notes: [
      {
        en: 'Plain fields: `role` (`\'leader\'`), `id`, `timeline`, `transport`, `cut`, `extra`, `state`, `hz`, `now`, `onHello`, `seq`, `sent`, `hellos`, `closed`.',
        zh: '普通欄位：`role`（`\'leader\'`）、`id`、`timeline`、`transport`、`cut`、`extra`、`state`、`hz`、`now`、`onHello`、`seq`、`sent`、`hellos`、`closed`。',
      },
    ],
    examples: [
      {
        code: `import { Params } from '@openav/core';
import { Timeline } from '@openav/timeline';
import { SyncLeader } from '@openav/sync';

const sent = [];
const transport = { open: true, send: (msg) => sent.push(msg), onMessage() {}, close() {} };   // keeps what would go on the wire
const timeline = new Timeline({ params: new Params([]), total: 60 });
const leader = new SyncLeader({ timeline, transport, id: 'stage', extra: () => ({ wind: 0.3 }) });

timeline.play();
timeline.advance(0.5);
leader.frame();
console.log(JSON.stringify(sent[0]));`,
        caption: { en: 'The console prints the frame a follower would get: `{"v":1,"kind":"frame","src":"stage","seq":1,"T":0.5,"playing":true,"holding":false,"rate":1,"extra":{"wind":0.3}}`.', zh: '主控台印出從屬端會收到的那一幀：`{"v":1,"kind":"frame","src":"stage","seq":1,"T":0.5,"playing":true,"holding":false,"rate":1,"extra":{"wind":0.3}}`。' },
      },
    ],
    related: ['createSync', 'SyncFollower', 'createTransport', 'BroadcastTransport', 'RelayTransport', 'Timeline'],
    keywords: {
      en: ['leader', 'sync', 'frame', 'state', 'hello', 'clock', 'extra', 'broadcast'],
      zh: ['主控端', '同步', 'frame', 'state', 'hello', '時鐘', 'extra', '廣播'],
    },
  },

  SyncFollower: {
    group: 'core',
    summary: {
      en: 'The follower\'s end of the sync: takes the leader\'s frames in order, keeps the last one for `timeline.follow()`, and says hello until it has the state.',
      zh: '同步的從屬端這一頭：依序收下主控端的 frame，留著最後一則給 `timeline.follow()`，並在拿到 state 之前一直說 hello。',
    },
    params: [
      {
        name: 'transport', type: 'Object',
        en: 'Where the messages come from: a [`BroadcastTransport`](#BroadcastTransport), a [`RelayTransport`](#RelayTransport) or your own. Required.',
        zh: '訊息從哪裡來：[`BroadcastTransport`](#BroadcastTransport)、[`RelayTransport`](#RelayTransport)，或你自己的傳輸。必填。',
      },
      {
        name: 'id', type: 'String', optional: true,
        en: 'This follower\'s id: the leader addresses its `state` reply to it. On a relay it must be the id the transport joined with. The default is `F-` and six random characters.',
        zh: '這個從屬端的 id：主控端的 `state` 回覆用它點名。走中繼的時候，它要跟傳輸加入房間用的 id 一樣。預設是 `F-` 加六個隨機字元。',
      },
      {
        name: 'now', type: 'Function', optional: true, default: 'performance.now',
        en: 'The clock in milliseconds that stamps `at` on every frame. It must be the clock `timeline.follow()` uses ([`createSync()`](#createSync) wires that).',
        zh: '時鐘，單位是毫秒，用來替每一則 frame 蓋上 `at`。它要跟 `timeline.follow()` 用的是同一個鐘（[`createSync()`](#createSync) 會接好）。',
      },
      {
        name: 'timeline', type: 'Timeline | null', optional: true, default: 'null',
        en: 'Used only by `monitor()` (it reads `timeline.followStatus()`) and by `close()`. The constructor does not call `timeline.follow()`: `createSync()` does.',
        zh: '只有 `monitor()`（它讀 `timeline.followStatus()`）和 `close()` 會用到。建構函式不會呼叫 `timeline.follow()`，那是 `createSync()` 做的。',
      },
      {
        name: 'info', type: 'any', optional: true,
        en: 'Sent to the leader with every hello (a version, a fingerprint). The leader\'s `state(hello)` hook can read it as `hello.info`.',
        zh: '隨每個 hello 送給主控端（版本、指紋之類）。主控端的 `state(hello)` 掛鉤可以用 `hello.info` 讀到。',
      },
      {
        name: 'accept', type: 'Function | null', optional: true, default: 'null',
        en: 'Called as `accept(msg)` for every frame and state. Returning `false`, or a string that says why, refuses the message: nobody is told and `latest()` does not change.',
        zh: '每一則 frame 和 state 都以 `accept(msg)` 呼叫。回傳 `false`，或一個說明理由的字串，就是拒絕這則訊息：不交給任何人，`latest()` 也不更新。',
      },
      {
        name: 'onFrame', type: 'Function | null', optional: true, default: 'null',
        en: 'Called as `onFrame(msg)` for every accepted frame, once each and in the leader\'s order. The leader\'s data is in `msg.extra`.',
        zh: '每一則被接受的 frame 都以 `onFrame(msg)` 呼叫，各一次，照主控端的順序。主控端的資料在 `msg.extra` 裡。',
      },
      {
        name: 'onState', type: 'Function | null', optional: true, default: 'null',
        en: 'Called as `onState(msg)` for every accepted state reply (`msg.extra` holds what the leader\'s `state` hook returned).',
        zh: '每一則被接受的 state 回覆都以 `onState(msg)` 呼叫（`msg.extra` 是主控端的 `state` 掛鉤回傳的東西）。',
      },
      {
        name: 'onGap', type: 'Function | null', optional: true, default: 'null',
        en: 'Called as `onGap({ from, to })` when frames were missed: the `seq` numbers `from` to `to` never arrived.',
        zh: '漏了 frame 的時候以 `onGap({ from, to })` 呼叫：`seq` 編號 `from` 到 `to` 的那些沒有到。',
      },
      {
        name: 'resync', type: 'Boolean', optional: true, default: 'true',
        en: 'After a gap, a silence, or a change of leader: say hello again and get the state.',
        zh: '漏了幀、沉默一陣子之後，或換了主控端的時候：再說一次 hello，把 state 拿回來。',
      },
      {
        name: 'helloEvery', type: 'Number', optional: true, default: '1000',
        en: 'While there is no state yet, `frame()` says hello again every this many milliseconds.',
        zh: '還沒有 state 的時候，`frame()` 每隔這麼多毫秒再說一次 hello。',
      },
      {
        name: 'takeoverAfter', type: 'Number', optional: true, default: '1500',
        en: 'Another leader is accepted only after the current one has been quiet for this many milliseconds. Until then its messages are ignored.',
        zh: '原本的主控端安靜了這麼多毫秒，才接受另一個主控端。在那之前，另一個主控端的訊息會被忽略。',
      },
      {
        name: 'resyncAfter', type: 'Number', optional: true, default: '1000',
        en: 'The first frame after a silence of this many milliseconds counts as "the leader is back" and asks for the state.',
        zh: '安靜了這麼多毫秒之後的第一幀，算是「主控端回來了」，會去要 state。',
      },
    ],
    description: [
      {
        en: '[`createSync({ role: \'follower\', … })`](#createSync) builds one, with its transport, and makes the timeline follow it. A `SyncFollower` is itself the source that `timeline.follow()` takes: `latest()` answers the last accepted frame and `now` is the clock that stamped it.',
        zh: '[`createSync({ role: \'follower\', … })`](#createSync) 會連同傳輸一起建好一個，並讓時間軸去追它。`SyncFollower` 自己就是 `timeline.follow()` 收的那種來源：`latest()` 回答最後一則被接受的 frame，`now` 就是替它蓋時間的那個鐘。',
      },
      {
        en: 'Order is the leader\'s order: a frame whose `seq` is not above the last one is dropped, and a jump in `seq` is a gap. It keeps to the first leader it hears. It says hello when the transport is open, again on every reconnect, every `helloEvery` milliseconds until a state arrives, and after a gap, a takeover or a silence when `resync` is on.',
        zh: '順序以主控端的順序為準：`seq` 沒有比上一則大的 frame 會被丟掉，`seq` 跳號就是缺口。它守著第一個聽到的主控端。傳輸開著的時候它會說 hello，每次重連再說一次，拿到 state 之前每 `helloEvery` 毫秒說一次，`resync` 開著的話，漏幀、換主控端、沉默之後也會再說。',
      },
    ],
    needs: {
      en: 'Call `frame()` every frame so that a lost hello is retried. To make a timeline follow it by hand: `timeline.follow(follower, { now: follower.now })`.',
      zh: '每個影格都要呼叫 `frame()`，這樣掉了的 hello 才會重試。要自己讓時間軸追它：`timeline.follow(follower, { now: follower.now })`。',
    },
    members: {
      latest: {
        en: 'The last accepted frame, `{ T, playing, holding, rate, at, seq, cut? }`, or `null` before any arrived. `at` is when it arrived, on the `now` clock.',
        zh: '最後一則被接受的 frame：`{ T, playing, holding, rate, at, seq, cut? }`，還沒收到就是 `null`。`at` 是它到達的時刻，用的是 `now` 這個鐘。',
      },
      hello: {
        en: '`hello(reason?)`: tell the leader "I am here, tell me where we are". Returns `true` when it was sent, `false` when the follower is closed or the transport is not open.',
        zh: '`hello(reason?)`：跟主控端說「我在這裡，告訴我現在到哪了」。送出去了回傳 `true`，從屬端已關閉或傳輸沒開則回傳 `false`。',
      },
      frame: {
        en: 'Call once per frame. While there is no state yet, it says hello again every `helloEvery` milliseconds; otherwise it does nothing.',
        zh: '每個影格呼叫一次。還沒拿到 state 的時候，每 `helloEvery` 毫秒再說一次 hello，其他時候什麼都不做。',
      },
      status: {
        en: '`{ role: \'follower\', id, leader, connected, seq, haveState, silence, refused, frames, states, gaps, dropped, rejected, ignored, hellos }`. `silence` is the seconds since the last accepted message (`null` before the first); `refused` is the reason of the last refusal, or `null`.',
        zh: '`{ role: \'follower\', id, leader, connected, seq, haveState, silence, refused, frames, states, gaps, dropped, rejected, ignored, hellos }`。`silence` 是距離上一則被接受的訊息幾秒（還沒收過是 `null`），`refused` 是最近一次拒絕的理由，沒有就是 `null`。',
      },
      monitor: {
        en: 'The numbers for the backstage monitor: `sync/role`, `sync/state`, `sync/error`, `sync/silence`, `sync/lost`, `sync/jumps`, `sync/gaps`. `sync/error` and `sync/lost` carry `warn: true` (red) when the leader is lost or refused.',
        zh: '給後台監看的數字：`sync/role`、`sync/state`、`sync/error`、`sync/silence`、`sync/lost`、`sync/jumps`、`sync/gaps`。主控端失聯或被拒絕的時候，`sync/error` 和 `sync/lost` 會帶著 `warn: true`（變紅）。',
      },
      close: {
        en: 'Stop listening and close the transport. A follower made by `createSync()` also calls `timeline.unfollow()`.',
        zh: '停止收訊息並關掉傳輸。由 `createSync()` 建的從屬端還會呼叫 `timeline.unfollow()`。',
      },
    },
    notes: [
      {
        en: 'Plain fields: `role` (`\'follower\'`), `id`, `src` (the leader it keeps to, or `null`), `seq`, `haveState`, `refused`, `closed`, `attached`, `counts`, and the options you passed.',
        zh: '普通欄位：`role`（`\'follower\'`）、`id`、`src`（它守著的主控端，沒有就是 `null`）、`seq`、`haveState`、`refused`、`closed`、`attached`、`counts`，以及你傳進來的選項。',
      },
      {
        en: 'An `accept` hook that throws refuses the message (the reason reads `the accept hook threw`) and is logged once. The other hooks are caught and logged as `[sync]`.',
        zh: '`accept` 掛鉤丟出錯誤就等於拒絕這則訊息（理由是 `the accept hook threw`），而且只記一次。其他掛鉤的錯誤會被接住、記成 `[sync]`。',
      },
    ],
    examples: [
      {
        code: `import { SyncFollower } from '@openav/sync';

let hear;                                                   // stands in for the wire: call hear(msg) to deliver one
const sent = [];
const transport = { open: true, send: (msg) => sent.push(msg), onMessage(cb) { hear = cb; }, close() {} };
const follower = new SyncFollower({
  transport, id: 'lobby', now: () => 5000,
  onFrame: (msg) => console.log('frame', msg.seq, JSON.stringify(msg.extra)),
  onGap: (gap) => console.log('missed', gap.from, 'to', gap.to),
});
console.log(JSON.stringify(sent[0]));                       // it said hello at once

const frame = (seq, T) => ({ v: 1, kind: 'frame', src: 'stage', seq, T, playing: true, holding: false, rate: 1, extra: { wind: seq / 10 } });
hear(frame(1, 0.5));
hear(frame(1, 0.5));                                        // the same frame again: dropped
hear(frame(4, 2));                                          // 2 and 3 never came
console.log(JSON.stringify(follower.latest()));`,
        caption: { en: 'The console prints the hello (`{"v":1,"kind":"hello","id":"lobby","role":"follower"}`), `frame 1 {"wind":0.1}`, then `missed 2 to 3` and `frame 4 {"wind":0.4}`, and the frame the timeline would follow: `{"T":2,"playing":true,"holding":false,"rate":1,"at":5000,"seq":4}`.', zh: '主控台印出 hello（`{"v":1,"kind":"hello","id":"lobby","role":"follower"}`）、`frame 1 {"wind":0.1}`，接著是 `missed 2 to 3` 和 `frame 4 {"wind":0.4}`，最後是時間軸會去追的那一則 frame：`{"T":2,"playing":true,"holding":false,"rate":1,"at":5000,"seq":4}`。' },
      },
    ],
    related: ['createSync', 'SyncLeader', 'createTransport', 'BroadcastTransport', 'RelayTransport', 'Timeline'],
    keywords: {
      en: ['follower', 'sync', 'follow', 'frame', 'state', 'hello', 'gap', 'resync', 'late join'],
      zh: ['從屬端', '同步', '追', 'frame', 'state', 'hello', '缺口', '重新同步', '中途加入'],
    },
  },

  createTransport: {
    group: 'core',
    summary: {
      en: 'Builds the transport for a role and a channel: a `BroadcastTransport` when there is no `url`, a `RelayTransport` when there is one.',
      zh: '照角色和 channel 建出傳輸：沒有 `url` 就是 `BroadcastTransport`，有 `url` 就是 `RelayTransport`。',
    },
    params: [
      {
        name: 'role', type: '\'leader\' | \'follower\'',
        en: 'Who this page is. Anything else throws a `TypeError`.',
        zh: '這個頁面的角色。其他值會丟出 `TypeError`。',
      },
      {
        name: 'channel', type: 'String',
        en: 'The `BroadcastChannel` name and the relay room: 1 to 32 letters, digits, `-` or `_`. Anything else throws a `TypeError`.',
        zh: '`BroadcastChannel` 的名稱，也是中繼的房間名：1 到 32 個字母、數字、`-` 或 `_`。其他值會丟出 `TypeError`。',
      },
      {
        name: 'url', type: 'String | true | null', optional: true, default: 'null',
        en: 'Nothing: a `BroadcastChannel`. `true`: this page\'s own `/relay`. A string: that `ws://` or `wss://` relay.',
        zh: '不給：用 `BroadcastChannel`。`true`：這個頁面自己的 `/relay`。字串：那個 `ws://` 或 `wss://` 中繼。',
      },
      {
        name: 'id', type: 'String', optional: true,
        en: 'The peer id the relay knows this page by. The default is `L-` or `F-` and six random characters. A `BroadcastTransport` does not use it.',
        zh: '中繼用來認這個頁面的 id。預設是 `L-` 或 `F-` 加六個隨機字元。`BroadcastTransport` 用不到它。',
      },
      {
        name: 'BroadcastChannel', type: 'Function', optional: true,
        en: 'The `BroadcastChannel` class to use (for a test). The default is the page\'s own.',
        zh: '要用的 `BroadcastChannel` 類別（測試用）。預設是頁面自己的。',
      },
      {
        name: 'Client', type: 'Function', optional: true,
        en: 'The relay client class to use (for a test). The default is [`RelayClient`](#RelayClient).',
        zh: '要用的中繼用戶端類別（測試用）。預設是 [`RelayClient`](#RelayClient)。',
      },
    ],
    returns: {
      type: 'BroadcastTransport | RelayTransport',
      en: 'A transport: `{ send(msg), onMessage(cb), onOpen(cb), open, close() }`.',
      zh: '一個傳輸：`{ send(msg), onMessage(cb), onOpen(cb), open, close() }`。',
    },
    description: [
      {
        en: '[`createSync()`](#createSync) calls it when you do not pass a transport of your own. Both transports turn a message into JSON before sending, so `undefined`, a `Date` or a `Map` are lost the same way on both, and swapping one for the other does not change what the work sees.',
        zh: '你沒有自己傳 transport 的時候，[`createSync()`](#createSync) 會呼叫它。兩種傳輸都把訊息轉成 JSON 再送，所以 `undefined`、`Date`、`Map` 在兩邊一樣不見，換傳輸不會改變作品看到的東西。',
      },
    ],
    examples: [
      {
        code: `import { createTransport } from '@openav/sync';

const transport = createTransport({ role: 'leader', channel: 'hall' });
console.log(transport.constructor.name, transport.open);
transport.close();

try { createTransport({ role: 'leader', channel: 'main hall' }); } catch (e) { console.log(e.message); }`,
        caption: { en: 'The console prints `BroadcastTransport true`, then the error for a channel name with a space in it: `[sync] channel must be 1–32 letters, digits, - or _ (got "main hall")`.', zh: '主控台印出 `BroadcastTransport true`，接著是 channel 名稱裡有空格時的錯誤：`[sync] channel must be 1–32 letters, digits, - or _ (got "main hall")`。' },
      },
    ],
    related: ['createSync', 'BroadcastTransport', 'RelayTransport', 'RelayClient'],
    keywords: {
      en: ['transport', 'broadcast channel', 'relay', 'websocket', 'channel', 'room'],
      zh: ['傳輸', 'broadcast channel', '中繼', 'websocket', 'channel', '房間'],
    },
  },

  BroadcastTransport: {
    group: 'core',
    summary: {
      en: 'The sync transport between pages of one browser on one machine: a `BroadcastChannel` named `oav-sync:<channel>`, with no network.',
      zh: '同一台機器、同一個瀏覽器的頁面之間的同步傳輸：一個名叫 `oav-sync:<channel>` 的 `BroadcastChannel`，不用網路。',
    },
    params: [
      {
        name: 'channel', type: 'String',
        en: 'The channel name. `oav-sync:` is put in front, so it cannot collide with a channel the work uses itself.',
        zh: 'channel 的名稱。前面會加上 `oav-sync:`，所以不會撞到作品自己用的頻道。',
      },
      {
        name: 'BroadcastChannel', type: 'Function', optional: true, default: 'globalThis.BroadcastChannel',
        en: 'The `BroadcastChannel` class to use (for a test). Where there is none, the constructor throws and tells you to give a relay address instead.',
        zh: '要用的 `BroadcastChannel` 類別（測試用）。環境裡沒有的話，建構函式會丟出錯誤，告訴你改給中繼的位址。',
      },
    ],
    description: [
      {
        en: 'The browser only joins pages of the same origin and the same browser profile, so the leader and the followers must be opened from the same address. Nothing else has to run: no server, no network. It is what [`createTransport()`](#createTransport) returns when there is no `url`.',
        zh: '瀏覽器只會連通同一個來源、同一個設定檔的頁面，所以主控端和從屬端要從同一個網址打開。不用另外跑任何東西：不用伺服器，也不用網路。沒有 `url` 的時候，[`createTransport()`](#createTransport) 回傳的就是它。',
      },
      {
        en: 'A message is sent as JSON text and parsed on arrival. A message that cannot be turned into JSON is lost without an error (the next frame is another); text that is not JSON is ignored on arrival.',
        zh: '訊息以 JSON 文字送出，到達時再解析。轉不成 JSON 的訊息會直接不見，不會丟出錯誤（下一幀又是新的一則）。到達的文字不是 JSON 就忽略。',
      },
    ],
    members: {
      send: {
        en: '`send(msg)`: post one message to the other pages on the channel. Does nothing after `close()`.',
        zh: '`send(msg)`：把一則訊息送給這個 channel 上的其他頁面。`close()` 之後什麼都不做。',
      },
      onMessage: {
        en: '`onMessage(cb)`: call `cb(msg)` for every message from another page. Returns the transport.',
        zh: '`onMessage(cb)`：每收到別的頁面的一則訊息就呼叫 `cb(msg)`。回傳傳輸本身。',
      },
      onOpen: {
        en: 'Does nothing and returns the transport: this transport is always open, so there is no reconnect to announce.',
        zh: '什麼都不做，回傳傳輸本身：這種傳輸一直是開的，沒有「重新連上」這回事。',
      },
      close: {
        en: 'Close the channel. `open` becomes `false`.',
        zh: '關掉頻道。`open` 變成 `false`。',
      },
    },
    notes: [
      {
        en: 'Plain fields: `channel`, `open` (true until `close()`), and `bc`, the `BroadcastChannel` itself.',
        zh: '普通欄位：`channel`、`open`（`close()` 之前都是 true），以及 `bc`，也就是 `BroadcastChannel` 本身。',
      },
    ],
    examples: [
      {
        code: `import { BroadcastTransport } from '@openav/sync';

// two ends of one channel, as two pages would each have one
const stage = new BroadcastTransport({ channel: 'hall' });
const lobby = new BroadcastTransport({ channel: 'hall' });
lobby.onMessage((msg) => {
  console.log('lobby heard', JSON.stringify(msg));
  stage.close(); lobby.close();
});
stage.send({ v: 1, kind: 'frame', T: 3, later: undefined });`,
        caption: { en: 'A moment later the console prints `lobby heard {"v":1,"kind":"frame","T":3}`: the message crossed as JSON, so the `undefined` field is gone.', zh: '過一下子，主控台印出 `lobby heard {"v":1,"kind":"frame","T":3}`：訊息是以 JSON 傳過去的，所以值是 `undefined` 的欄位不見了。' },
      },
    ],
    related: ['createTransport', 'RelayTransport', 'createSync'],
    keywords: {
      en: ['broadcast channel', 'transport', 'same machine', 'same origin', 'no network', 'tabs', 'windows'],
      zh: ['broadcast channel', '傳輸', '同一台機器', '同源', '不用網路', '分頁', '視窗'],
    },
  },

  RelayTransport: {
    group: 'core',
    summary: {
      en: 'The sync transport between machines: a WebSocket to the room relay, joined with the role `leader` or `follower`. The room is the channel.',
      zh: '跨機器的同步傳輸：連到房間中繼的 WebSocket，以 `leader` 或 `follower` 的角色加入。房間就是 channel。',
    },
    params: [
      {
        name: 'url', type: 'String | null', optional: true, default: 'null',
        en: 'The relay\'s address, such as `ws://leader.local:8080/relay`; `role`, `room` and `id` are added to its query for you. `null` uses this page\'s own `/relay` (or `?relay=` in the page address).',
        zh: '中繼的位址，例如 `ws://leader.local:8080/relay`，`role`、`room` 和 `id` 會替你加到查詢字串上。`null` 表示用這個頁面自己的 `/relay`（或頁面網址上的 `?relay=`）。',
      },
      {
        name: 'room', type: 'String',
        en: 'The relay room. Pages in different rooms never hear each other.',
        zh: '中繼的房間。不同房間的頁面彼此聽不到。',
      },
      {
        name: 'role', type: '\'leader\' | \'follower\'',
        en: 'The role to join as. The relay hands a leader\'s messages to the room\'s followers and a follower\'s to its leaders.',
        zh: '加入房間用的角色。中繼會把主控端的訊息交給房間裡的從屬端，把從屬端的訊息交給主控端。',
      },
      {
        name: 'id', type: 'String',
        en: 'The peer id. A leader\'s `state` reply is addressed to it, so a follower must use the same id here and in [`SyncFollower`](#SyncFollower).',
        zh: '這一端的 id。主控端的 `state` 回覆用它點名，所以從屬端在這裡和在 [`SyncFollower`](#SyncFollower) 裡要用同一個 id。',
      },
      {
        name: 'Client', type: 'Function', optional: true, default: 'RelayClient',
        en: 'The relay client class to use (for a test).',
        zh: '要用的中繼用戶端類別（測試用）。',
      },
    ],
    description: [
      {
        en: 'It wraps a [`RelayClient`](#RelayClient) and connects at once. The relay is the one phones use ([`attachRelay()`](#attachRelay)); `node serve.js` on the leader\'s machine is the whole setup. It is what [`createTransport()`](#createTransport) returns when there is a `url`. On a page served over https the address must be `wss://`: the browser blocks `ws://` there.',
        zh: '它包著一個 [`RelayClient`](#RelayClient)，建立的時候就連線。中繼就是手機用的那一個（[`attachRelay()`](#attachRelay)），在主控端那台機器上跑 `node serve.js` 就是全部的設定。有 `url` 的時候，[`createTransport()`](#createTransport) 回傳的就是它。用 https 提供的頁面要用 `wss://` 位址：瀏覽器在那裡會擋掉 `ws://`。',
      },
      {
        en: 'A message that finds the socket closed is gone, not queued: the next frame is a few milliseconds behind it, and a follower that missed one asks for the state again. The client reconnects by itself, and `onOpen` tells you each time.',
        zh: '訊息送出時 socket 沒開就不見了，不會排隊：下一幀只晚幾毫秒，漏了一幀的從屬端會再要一次 state。用戶端會自己重連，每次連上 `onOpen` 都會通知你。',
      },
    ],
    needs: {
      en: 'A room relay the page can reach. The relay has no authentication: use a closed network and a channel name nobody will guess. A `state` over 256 KB needs `attachRelay(server, { maxMessageChars, maxBytes })`.',
      zh: '要有一台頁面連得到的房間中繼。中繼沒有身分驗證：請用封閉的網路，以及沒人猜得到的 channel 名。超過 256 KB 的 `state` 需要 `attachRelay(server, { maxMessageChars, maxBytes })`。',
    },
    members: {
      open: {
        en: 'True while the socket is open (a getter).',
        zh: 'socket 開著的時候是 true（getter）。',
      },
      send: {
        en: '`send(msg)`: send one message through the relay. Dropped while the socket is closed.',
        zh: '`send(msg)`：透過中繼送出一則訊息。socket 沒開的時候直接丟掉。',
      },
      onMessage: {
        en: '`onMessage(cb)`: call `cb(msg)` for every sync message from the other side. Returns the transport.',
        zh: '`onMessage(cb)`：每收到對面的一則同步訊息就呼叫 `cb(msg)`。回傳傳輸本身。',
      },
      onOpen: {
        en: '`onOpen(cb)`: call `cb()` every time the socket opens, including after a reconnect. A follower says hello again there. Returns the transport.',
        zh: '`onOpen(cb)`：每次 socket 連上就呼叫 `cb()`，斷線後重連也算。從屬端會在這裡重新說 hello。回傳傳輸本身。',
      },
      close: {
        en: 'Close the socket for good.',
        zh: '把 socket 關掉，不再重連。',
      },
    },
    notes: [
      {
        en: 'Plain fields: `room`, `role`, `id`, and `client`, the `RelayClient` underneath.',
        zh: '普通欄位：`room`、`role`、`id`，以及 `client`，也就是底下那個 `RelayClient`。',
      },
    ],
    tbd: [
      {
        en: 'Not run against a real relay here: the description is read from the code of this package and of `@openav/relay`.',
        zh: '沒有在這裡對著真正的中繼跑過：說明是從這個套件和 `@openav/relay` 的程式碼讀來的。',
      },
    ],
    examples: [
      {
        code: `import { RelayTransport } from '@openav/sync';

const transport = new RelayTransport({ url: 'ws://leader.local:8080/relay', room: 'hall', role: 'follower', id: 'lobby' });
transport.onOpen(() => console.log('connected to the relay'));
transport.onMessage((msg) => console.log(msg.kind, msg.T));`,
        caption: { en: 'With `node serve.js` running on `leader.local` and a leader page in the room `hall`, the console prints `connected to the relay` and then a line such as `frame 12.4` for every frame the leader sends.', zh: '`leader.local` 上跑著 `node serve.js`、房間 `hall` 裡有一個主控端頁面的時候，主控台印出 `connected to the relay`，之後主控端每送一幀就印出像 `frame 12.4` 這樣的一行。' },
        run: 'static',
        why: 'It needs a relay server on another machine and a leader page in the same room.',
      },
    ],
    related: ['createTransport', 'BroadcastTransport', 'RelayClient', 'attachRelay', 'createSync'],
    keywords: {
      en: ['relay', 'transport', 'websocket', 'other machines', 'network', 'room', 'leader', 'follower'],
      zh: ['中繼', '傳輸', 'websocket', '跨機器', '網路', '房間', '主控端', '從屬端'],
    },
  },

  SYNC_VERSION: {
    group: 'core',
    summary: {
      en: 'The version of the sync messages: `1`, the `v` field of every frame, hello and state. A message with another `v` is ignored.',
      zh: '同步訊息的版本：`1`，也就是每一則 frame、hello 和 state 的 `v` 欄位。`v` 是別的值的訊息會被忽略。',
    },
    description: [
      {
        en: 'Every message [`SyncLeader`](#SyncLeader) and [`SyncFollower`](#SyncFollower) send starts with `v: SYNC_VERSION`, and both ignore, without an error, a message whose `v` is different. Use it when you write a message by hand, for a test or for a transport of your own.',
        zh: '[`SyncLeader`](#SyncLeader) 和 [`SyncFollower`](#SyncFollower) 送出的每一則訊息都以 `v: SYNC_VERSION` 開頭，兩邊遇到 `v` 不一樣的訊息都會直接忽略，不會丟出錯誤。自己手寫訊息的時候（測試，或你自己的傳輸）可以用它。',
      },
    ],
    examples: [
      {
        code: `import { SYNC_VERSION } from '@openav/sync';

console.log(SYNC_VERSION);
console.log(JSON.stringify({ v: SYNC_VERSION, kind: 'hello', id: 'lobby', role: 'follower' }));`,
        caption: { en: 'The console prints `1`, then a hello written by hand: `{"v":1,"kind":"hello","id":"lobby","role":"follower"}`.', zh: '主控台印出 `1`，接著是手寫的一則 hello：`{"v":1,"kind":"hello","id":"lobby","role":"follower"}`。' },
      },
    ],
    related: ['SyncLeader', 'SyncFollower', 'createSync'],
    keywords: {
      en: ['sync version', 'protocol', 'message version', 'v'],
      zh: ['同步版本', '協定', '訊息版本', 'v'],
    },
  },
};
