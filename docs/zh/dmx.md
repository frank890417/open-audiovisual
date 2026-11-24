# DMX 燈光

DMX512 是告訴舞台燈要做什麼的方法：一條線傳一個 **universe**，裡面有 512 個通道，每個通道是 0 到 255 的數字，每秒送大約 40 次。一台燈從它的**位址**開始聽幾個通道（一台 par 可能從位址 1 到 6 依序讀 dimmer、紅、綠、藍、白、strobe），每個通道代表什麼寫在它的說明書裡，也就是它的 **profile**。網路可以一次傳很多個 universe（Art-Net、sACN），USB 介面則把電腦的數字變成線上的訊號。

`@openav/dmx` 把一套燈光放進作品裡：燈具 profile、patch、一個在任何時刻都算得出每台燈樣子的引擎（scene、cue、chase、effect），以及三種把位元組送出去的方法。沒有燈、沒有介面也能跑：頁面上的監看器會顯示燈收到什麼。[範例 28](https://openaudiovisual.com/examples/28-dmx-lights/) 把這一切放在同一頁。

> [!WARNING]
> 這裡的東西還沒有用真的燈具、節點或介面試過。位元組照 Art-Net 4、ANSI E1.31 和 Enttec DMX USB Pro API 公開的格式寫，測試也在這台機器上把每個封包解回來，但還沒有任何一台燈為本專案收過它們。演出前，用[在 TouchDesigner 裡確認](#dmx-check-it-in-touchdesigner)那一節和燈本身檢查你的燈光，手隨時放在 blackout 上。

## 離開電腦的三條路

| 路 | 從哪裡 | 需要什麼 | 適合 |
|---|---|---|---|
| **輸出橋接程式＋Art-Net** | 頁面 → `ws://127.0.0.1:6450/out` → UDP 6454 | `node packages/out/bridge/out-bridge.mjs --config out.json`，一台 Art-Net 節點 | 場館、大部分網路節點、很多個 universe |
| **輸出橋接程式＋sACN** | 頁面 → 橋接程式 → UDP 5568（多播或單播） | 同一支橋接程式，一個 sACN（E1.31）接收端 | 燈光控台和比較新的節點，好幾個來源之間有優先權 |
| **Web Serial＋Enttec DMX USB Pro** | 頁面 → USB，不用橋接程式 | 電腦上的 Chrome 或 Edge，一台 DMX USB Pro 或講它協定的介面 | 一台介面、一個 universe、教室 |

瀏覽器不能送 UDP，所以網路協定要從**輸出橋接程式**出去，就是驅動 WLED 燈條和馬達板的那支本機程式（[`@openav/out`](packages.md)）。頁面替每個 DMX 位址送一個值，頻道名稱是 `dmx/<universe>/<address>`，橋接程式的 `artnet`、`sacn` 或 `enttec` 輸出替每個 universe 留一個 512 位元組的緩衝區，有變化時固定每秒送 40 格，沒變時每秒補送一次（節點大約 2.5 秒沒聽到東西，就會判定來源不見了）。

```json
{ "channels": [
  { "match": "dmx/1/*", "sink": "artnet", "host": "2.0.0.10" },
  { "match": "dmx/2/*", "sink": "sacn", "priority": 100, "source": "my show" },
  { "match": "dmx/3/*", "sink": "enttec", "path": "/dev/cu.usbserial-EN000000", "universe": 3 }
], "safe": { "dmx/1/49": "hold", "dmx/1/51": "hold", "dmx/*": 0 }, "timeoutMs": 500 }
```

- **Art-Net** 送到節點的位址（`host`，也可以是一串位址）。Art-Net 4 規定 ArtDmx 不廣播：每個 universe 每秒 40 個封包會送到網路上每一台裝置，慢的節點和 Wi-Fi 會被塞爆。`"broadcast": true` 是留給只聽廣播的舊節點，而且那個網路上沒有別的東西。
- **sACN** 送到每個 universe 的多播群組 `239.255.<高位元組>.<低位元組>`（接收端自己加入想要的群組），給了 `host` 就改成單播。`priority` 是 0–200（預設 100，接收端採用聽到的最高值），`source` 是控台上顯示的名字，`interface` 選多播從哪張網卡出去。正常關閉時，送完安全值之後會再送三個「stream terminated」封包。
- **Enttec** 把一個 `universe` 寫到序列埠上的 DMX USB Pro。找不到裝置只是一個狀態，每 2 秒重試，絕不會讓程式當掉。
- **Web Serial** 不需要橋接程式：`dmxTransport('serial')` 加一個 **Connect** 按鈕（瀏覽器會問要用哪個連接埠，只能在點擊時問）。只有電腦上的 Chrome 和 Edge，網址要是 https 或 localhost。
- 這裡沒有：Enttec Open DMX 或任何沒有處理器的 FTDI 線（電腦得自己掌握 DMX break 的時序，網頁做不到穩定），RDM、Art-Net 的節點探索（ArtPoll）、ArtSync。

### 哪個 universe 是哪個

「universe 1」就是你 patch 時用的號碼，也是頻道名稱裡的號碼 `dmx/1/…`。它送出去是 **Art-Net 的 Port-Address 1**（Net 0、Sub-Net 0、Universe 1），也是 **sACN 的 universe 1**。`dmx/N/…` 是 Port-Address N（最大 32767，Net、Sub-Net、Universe 合成一個 15 位元的數字），也是 sACN 的 universe N（最大 63999）。

有些軟體把第一個 universe 叫做「1」，送出去卻是 Art-Net 的 Port-Address 0，而 Art-Net 4 已經不建議用 0。節點如果設成 0，就把頁面 patch 在 universe 0（`dmx/0/…` 走 Art-Net 送得到，sACN 沒有 universe 0），比較好的做法是把節點改成 1。`encodeArtDmx()` 吃的就是 Port-Address 本身，預設是 1。

## 燈具和 patch

**profile** 說明一台燈有哪些通道，以及每個模式送出它們的順序。通用的 profile 跟套件一起提供（`FIXTURES`：調光器、RGB、RGBW、RGBA、RGBAW+UV 的 par、頻閃燈、8 通道和 16 通道的搖頭燈），真正的燈具 profile 是一個 JSON 檔，複製一份，照它的說明書改。它們都沒有標成已驗證，因為只有燈就在眼前的人，才能說一份 profile 是對的。

**patch** 把燈具放到 universe 和位址上，可以分組、設上下限：

```js
import { Patch } from '@openav/dmx';

const patch = new Patch();
for (let i = 0; i < 8; i++) patch.add({ id: `par${i + 1}`, profile: 'generic-rgbw', mode: '6ch', address: 1 + i * 6, groups: ['pars'] });
patch.add({ id: 'head1', profile: 'generic-moving-head', mode: '16ch', address: 49, groups: ['heads'], limits: { tilt: [0.1, 0.9] } });
patch.check();   // fixtures that share addresses, if any
```

作品從來不寫通道號碼。它要的是屬性，每個 0..1：`dimmer`、`color: [r, g, b]`、`pan`、`tilt`、`strobe`、`zoom`。patch 把它們換成每台燈的位元組：顏色拆成這台燈實際有的發光元件（RGBW par 先用白光），模式有 fine 通道的 pan 和 tilt 寫成兩個位元組，沒有調光通道的燈，dimmer 會乘進顏色裡。

## scene、cue、chase 和 effect

`DmxEngine` 把每台燈在任何時刻的樣子算出來，結果只取決於時間：同一個 `t` 永遠得到同樣的位元組，所以沒有燈也能檢查畫面，錄影也能一格一格算。由下往上的圖層：

| 圖層 | 呼叫 | 是什麼 |
|---|---|---|
| 基礎 | `scene(name, { target: props })`、`base(...names)` | 一直開著的畫面 |
| cue | `cue(name, { scene, fadeIn, fadeOut, curve })`、`go(name, at)`、`release(at)` | 帶淡入淡出切到一個 scene，跟燈光控台一樣 |
| chase | `chase(name, { steps, every, unit, fade })`、`run(name, on)` | 每隔幾拍或幾秒輪到下一個 scene |
| effect | `effect(name, { target, property, wave, rate, depth, spread })`、`tune(name, { rate, depth }, at)` | 對一群燈做 sine、saw、square、chase、flicker 或 rainbow，每台比前一台晚一點 |
| 即時值 | `set(target, props)` | 推桿、麥克風：蓋在所有東西上面 |
| 群組推桿 | `submaster(target, level)` | 管一個群組的推桿：把每一層算出的 dimmer 等比例調暗 |
| 最後 | `engine.master`、`engine.blackout`、patch 的上下限 | 總控、blackout、每台燈的上下限 |

目標可以是燈的 id、群組、`'*'`，或這些的清單。`tune()` 改變正在跑的 effect 的速度而不會跳：波形從它現在的位置接著走，只是變快或變慢。（重新定義 effect 會讓相位重來，在已經跑了 100 秒的波形上轉旋鈕，會一下子閃過好幾個週期。）

```js
const engine = new DmxEngine(patch);
engine.scene('on', { pars: { dimmer: 1 }, heads: { dimmer: 1, tilt: 0.4 } }).base('on');
engine.effect('breathe', { target: 'pars', wave: 'sine', rate: 0.2, depth: 0.35, spread: 1 });
engine.effect('sweep', { target: 'heads', property: 'pan', rate: 0.12, depth: 0.5 });
const universes = engine.render(t);      // every light at t seconds
```

## 每一格的位元組送去哪裡

`dmxTransport()` 每一格接過 `render()` 的結果，只送有變的部分：

```js
import { dmxTransport } from '@openav/dmx';
import { OutClient } from '@openav/out';

const out = dmxTransport('sim', { patch });                                       // memory only: out.bytes(1)
// const out = dmxTransport('bridge', { patch, client: new OutClient({ id: 'my-show' }).connect() });   // the out-bridge
// const out = dmxTransport('serial', { patch, universe: 1 });  button.onclick = () => out.connect();  // an Enttec Pro
out.send(engine.render(t));
```

每一種傳送端在送出任何東西之前，都先讓這一格經過頻閃保護（見[安全](#safety)），給它 `{ patch }`，它才讀得到每台燈實際的亮度。bridge 傳送端對每個有變的通道呼叫一次 `client.set('dmx/<universe>/<address>', byte / 255)`。serial 傳送端在它的 universe 有任何變化時寫出一整個 Enttec 資料框（全部 512 個通道），最多每 25 毫秒一格，沒變時每秒一次。

在[實驗室](lab-integration.md)的作品裡，`"modules": ["out", "dmx"]` 會給你 `lab.dmx`：從 `meta.dmx.patch` 建好的 patch、它的引擎、開著頻閃保護的傳送端（`?dmx=bridge` 經過 `lab.out`，`?dmx=serial` 送到 Enttec Pro）、算燈並送出的 `lab.dmx.frame(t)`、`lab.dmx.monitor(el)` 和 `lab.dmx.params(options)`。

## 用聲音和控制器推燈

引擎自己從來不讀訊號（框架的第一條規則：連續的控制走參數）。`dmxParams()` 把它的控制點變成參數，從此燈就跟任何世界一樣被演奏：

```js
const rig = dmxParams(engine, { groups: ['pars', 'heads'], effects: ['breathe', 'sweep'], chases: ['walk'] });
const lights = {
  name: 'lights',
  params: rig.params,                       // dmx/master, dmx/blackout, dmx/pars/dimmer, dmx/pars/hue, dmx/sweep/rate, …
  update(dt, state) { t += dt; rig.apply(state, t); out.send(engine.render(t)); },
  render() {},
};
```

| 鍵名 | 推什麼 |
|---|---|
| `dmx/master` | 總控 |
| `dmx/blackout` | blackout（階梯參數，0 或 1） |
| `dmx/<group>/dimmer` | 群組推桿：底下的 cue、chase、effect 照樣在跑 |
| `dmx/<group>/hue`、`/saturation` | 群組的顏色，放在它自己的基礎 scene 裡（rainbow effect 會混在它上面） |
| `dmx/<effect>/rate`、`/depth` | 那個 effect，經過 `tune()`：轉旋鈕時不會跳 |
| `dmx/<chase>/run` | chase 開或關 |

接下來 mapping 層就能把任何東西接上去，寫在 `routes` 裡，或在 L2 · Mapping 面板按 learn：

```js
routes: [
  { source: 'audio/rms', target: 'dmx/pars/dimmer', inMax: 0.25, outMin: 0.25, smooth: 0.25 },   // the room's loudness (smoothed for the look)
  { source: 'drum/kick/env', target: 'dmx/pars/dimmer', outMin: 0.3, smooth: 0.12 },             // the drum machine, when there is no mic
  { source: 'chord/consonance', target: 'dmx/pars/hue', inMin: -1, inMax: 1, outMin: 0.62, outMax: 0.06, smooth: 0.4 },
  { source: 'midi/cc/7', target: 'dmx/master' },                                                   // any controller's volume fader
],
```

時間軸可以自動化同樣的鍵（`automation: { 'dmx/pars/hue': [[0, 0.07], [24, 0.58]] }`），手機控制面板把它們顯示成推桿（它們的 `group` 是 `lights`），世界自己的參數也可以同時餵畫面和燈。

## 安全

- **Blackout。** `engine.blackout = true`（或 `dmx/blackout` 參數，或範例 28 的 Blackout 按鈕）讓每一個 dimmer 立刻歸零（沒有調光通道的燈，連顏色也歸零，因為它的亮度就在顏色裡），pan、tilt、zoom 和 control 通道停在原處，所以全暗的時候搖頭燈不會突然轉。
- **上下限。** 每台放好的燈可以設 `limits`（`{ dimmer: [0, 0.8], tilt: [0.1, 0.9] }`），在所有圖層之後、總控之前套用。
- **閃爍，以每台燈來算。** 每秒閃超過大約三次，可能讓光敏性癲癇的人發作。會傷到人的是一台燈實際發出來的光，所以上限 `maxFlashHz`（預設 3）是以「每台燈」來算的，分兩層。
  1. **引擎裡。** 先把每個 effect、每個 chase 各自限制在上限以內：以秒為單位的速度直接夾住，以拍為單位的速度一次減半直到符合（這樣還是踩在拍子上），chase 把每一步的長度加倍，隨機閃爍每秒換新值的次數也不超過上限。接著對每一台燈，把所有會讓它閃的東西（作用在它的 dimmer 或顏色上的 effect，以及用位置以外的東西改變它的 chase）的頻率加起來。總和超過上限，就只在這台燈上把這些來源放慢，直到不超過為止：以秒為單位的照同一個比例放慢，以拍為單位的對半降，chase 的每一步加倍。兩個 3 Hz 的 effect 疊在同一台 par 上，在那台燈上各跑 1.5 Hz，只帶著其中一個的 par 保持原速。`engine.state(t).slowed`（以及 `describe().slowed`）列出被放慢的燈、放慢前後的總和，以及每一個來源。這一層仍然只取決於時間：同一個 `t` 得到同樣的位元組，錄影一樣可以逐格算。旋鈕用 `tune()` 改其中一個波形的速度時，同一台燈上的其他波形也從原本的位置接著走，不會跳。
  2. **輸出前。** 每一個 `dmxTransport()`（sim、bridge、serial）在送出之前都讓這一格經過頻閃保護。它從位元組讀出每台燈的亮度（調光乘上最亮的顏色通道），照 WCAG 2.3.1 的方式算一次閃：亮度往相反方向變化兩次，每次至少滿刻度的 10%，從上一個轉折點量起。任何一秒內，一台燈變亮這麼多的次數不能超過 3 次：下一次變亮會超過的時候，燈穩穩停在上一次送出的亮度，等這一秒有空位了再跟上。變暗永遠直接通過，所以 blackout 和暗下來的 cue 下一格就到，保護也不會送出比要求更亮的光。它只壓調光通道的位元組（沒有調光通道的燈，就把顏色位元組一起等比例調低），pan、tilt、zoom、gobo、strobe、control 通道，以及沒被壓住的每一台燈，都原封不動送出。這一層擋得住引擎看不到的東西：即時值（推桿、麥克風、在 180 bpm 十六分音符下推 dimmer 的 `drum/kick/env`，是每秒 12 次）、兩個引擎推同一套燈，以及幾個波形疊起來，在某一秒裡的轉折比它們的頻率加起來還多。它有記憶，所以放在傳送端、引擎外面，數的是真實時間的秒數，不是時間軸被拉到的時間。
  - 把 patch 交給傳送端：`dmxTransport('sim', { patch })`。沒有 patch 的話，保護只能一個 DMX 通道一個通道地看，比較粗（見下面的橋接程式），狀態會寫 `unit: 'channel'`。
  - `out.flashGuard` 是 `{ on, unit, maxFlashHz, held }`：`held` 是上一格被壓住的燈。監看器會用琥珀色的框把它們圈起來。
  - 要關掉保護，必須明確寫 `dmxTransport(kind, { flashGuard: false })`。關掉的這段時間，監看器會一直顯示紅色的 **FLASH GUARD OFF**。調高引擎的 `maxFlashHz` 不會跟著調高保護的上限，那要在傳送端寫 `{ maxFlashHz }`。
  - 輸出橋接程式的三個 DMX 輸出也有同一道保護，預設開著，所以別的程式經由橋接程式送 DMX 時一樣受保護。橋接程式不知道 patch，所以在那裡的單位是一個 DMX 通道，比較粗：它也會壓住根本不會閃的通道。最要緊的是 16 位元的 pan 或 tilt：平順移動的時候，它的細調位元組會跑出很快的鋸齒波，被壓住時光束會跳最多一個粗調的格子（範例 28 的掃動經過它：540° 的搖頭燈上不到 2°）。把這些通道寫進那條路線的 `"flashGuard": { "exempt": ["dmx/1/49-52"] }`，或在你依靠頁面這一道保護的時候，用 `"flashGuard": false` 關掉橋接程式的。見 [out 套件的 README](https://github.com/frank890417/open-audiovisual/blob/main/packages/out/README.md#the-flash-guard)。
  - strobe 通道照它自己的規則：profile 寫了 Hz 的遵守上限，沒寫的停在 open 的值。
  - 只有確定要的時候才調高上限（或設成 `Infinity`）。
- **兩層都擋不到的。** 很多台燈一起閃：保護一台一台地算，二十台 par 各自每秒閃 3 次、但彼此錯開，整個場地看起來就閃得快很多，觀眾視野裡閃爍的總面積要由你判斷。投影、螢幕或 LED 牆上的畫面：保護只看得到 DMX（範例 28 的舞台是用保護過的位元組畫的，但 world 自己的畫布不受保護）。亮度不變、只有顏色來回換（飽和的紅和藍交替，也就是 WCAG 說的「紅色閃爍」）：這裡的亮度是調光乘上最亮的通道，不會動。pan、tilt 快速移動不算閃，也不會被壓住。
- **control 通道。** `control` 通道（重置、燈泡開關、內建程式）不能被 scene、effect、參數或路線碰到，只有 `engine.control(id, key, byte)` 能寫。
- **看門狗。** 走橋接程式時，頁面一停止說話（關掉分頁、頁面凍結），每個通道在 `timeoutMs`（預設 500 毫秒）之後被放到它的 `safe` 值，最後一個頁面斷線或橋接程式正常關閉時則是立刻。第一個符合的萬用字元優先，`"hold"` 表示沒有安全值：`{ "dmx/1/49": "hold", "dmx/*": 0 }` 讓整套燈暗下來，但一台搖頭燈的 pan 停在原處。Web Serial 沒有看門狗：Pro 會一直重送最後一格，所以 `close()` 之前先送一次 blackout。

## 沒有硬體時怎麼看

- `dmxTransport('sim', { patch })` 把經過頻閃保護的位元組留在記憶體裡，`out.bytes(1)` 就是 universe 1，`out.changed` 是上一次送出改變的通道。
- `mountDmxMonitor(el, { patch, transport, engine })` 把燈畫在頁面上：每台燈一個色塊（顏色乘上亮度，搖頭燈的 pan 和 tilt 畫成一個小記號），再加上一個 universe 的 512 個通道表，每格用長條表示它的值，顏色是它推的那種光。滑鼠指著一格，就讀得到位址、值、燈具和通道。所有東西都從位元組讀回來，所以 profile 差一個通道，這裡的顏色也會跟著錯。`monitor.update()` 不帶參數時，顯示的是傳送端經過頻閃保護之後實際送出的內容。標題列會說保護正在做什麼，被壓住的燈有琥珀色的框，給了引擎的話，被每台燈上限放慢的燈會標上「slow」。
- [範例 28](https://openaudiovisual.com/examples/28-dmx-lights/) 用同一套燈畫出一個舞台，下面放著監看器，預設用 `sim` 傳送端：`?out=bridge` 送到輸出橋接程式，`?out=serial` 多一個給 Enttec Pro 的 Connect 按鈕。
- `tests/dmx-out.test.js` 在這台機器上跑橋接程式，用套件自己的解碼器把它送出的每個 Art-Net 和 sACN 封包解回來。

## 在 TouchDesigner 裡確認

TouchDesigner 的 **DMX In CHOP** 是另一個跟這份程式碼完全無關的接收端，所以在燈還沒進場之前，拿它來確認很合適。

1. 在 `out.json` 裡把 universe 1 送到這台機器：`{ "match": "dmx/1/*", "sink": "artnet", "host": "127.0.0.1" }`（或 `"sink": "sacn", "host": "127.0.0.1"`）。啟動橋接程式。
2. 在 TouchDesigner 加一個 DMX In CHOP。Art-Net 就選 Art-Net 介面，設 Net 0、Subnet 0、Universe 1（Port-Address 1）。sACN 就選 sACN、universe 1。
3. 用 `?out=bridge` 打開範例 28。CHOP 會顯示 512 個通道在動：par 1 是通道 1 到 6（dimmer、紅、綠、藍、白、strobe），head 1 從 49 開始。
4. 關掉分頁：半秒內通道就會回到它們的安全值。

這個確認還沒有為本專案做過，你手上那一版 TouchDesigner 的 CHOP 參數名稱也可能寫得有點不一樣。

## 還沒有用真的硬體測過

確認過的：位元組的格式對照規格、每個封包都在這台機器上解回來（universe、位元組、每秒最多 44 個封包、補送的封包、頁面離開時的安全值）、Enttec 輸出和 Web Serial 傳送端用代替的連接埠測過、引擎的上限、淡入淡出和兩層頻閃保護在 `npm test` 裡（以每秒 40 格、注入的時鐘算閃爍次數，計數器跟保護本身分開寫）、範例 28 在沒有序列埠和 MIDI 權限的無頭瀏覽器裡跑過。頻閃保護還沒有在真的燈上看過：燈具拿到被壓住的調光位元組會怎麼反應（它自己的調光曲線、淡入淡出時間），這裡還不知道。沒確認的：真的 Art-Net 節點、sACN 接收端或燈光控台、Enttec DMX USB Pro、任何一台真燈的通道，以及用 TouchDesigner 當接收端。如果你手上有其中任何一樣，試試看，告訴我們你看到了什麼。
