// @openav/remote reference: the phone app and the show-side adapter. Read by tools/build-reference.mjs (see AGENTS.md,
// "Documenting a public name"). Phone sensors cannot run headless, so their module examples feed the page real
// DeviceOrientationEvent / DeviceMotionEvent / PointerEvent objects, the same events a phone would produce.

export default {
  PhoneSensors: {
    group: 'remote',
    summary: {
      en: 'Turns a phone\'s tilt, acceleration, rotation, knocks and front-camera light into named signals, in screen axes, and hands them to the `io` you give it.',
      zh: '把手機的傾斜、加速度、旋轉、敲擊和前鏡頭的光線，換成有名字的訊號（用螢幕座標軸），交給你給它的 `io`。',
    },
    params: [
      { name: 'io', type: '{ set(name, value), send(name, value, pulse?) }', en: 'Where the signals go. `set` gets the continuous ones, `send` the knocks (with `pulse` true). The names have no `phone/<id>/` in front: `tilt/x`, `accel/z`. A [`RelayClient`](#RelayClient) with a prefix, or a `Signals` registry, can sit behind it.', zh: '訊號要送去哪裡。`set` 收連續的訊號，`send` 收敲擊（`pulse` 為 true）。名稱前面沒有 `phone/<id>/`，是 `tilt/x`、`accel/z` 這樣。後面可以接加了前綴的 [`RelayClient`](#RelayClient)，或是 `Signals`。' },
      { name: 'hooks', type: '{ onKnock?, onSample?, notify? }', en: 'Optional callbacks. `onKnock(strength)` after each knock, `onSample(name, value)` for every continuous sample (to draw a readout), `notify(message)` with a one-line problem report such as a refused permission. The messages are written in Chinese.', zh: '選用的回呼。`onKnock(strength)` 在每次敲擊之後呼叫，`onSample(name, value)` 每個連續樣本都呼叫（拿來畫讀數），`notify(message)` 收一行問題說明，例如權限被拒絕。訊息是中文寫的。' },
    ],
    description: [
      {
        en: 'This is the phone half of the sense tab, with no page in it: make one with an `io`, call `start()` from a tap, and signals flow. From the phone\'s own events it produces `tilt/x` and `tilt/y` (−1..1, which is ±45° from the resting pose, x to the right and y toward you, in screen axes, so a phone turned sideways still reports "tilt right is +x"), `orient/alpha|beta|gamma` (degrees), `accel/x|y|z` (m/s², gravity included), `rot/alpha|beta|gamma` (degrees per second), `knock` (a pulse `{ strength, delta, t }`) and, if you turn the camera on, `light` (0..1).',
        zh: '這是 感測 分頁在手機這一半的邏輯，裡面不含頁面：給它一個 `io`，在使用者點一下時呼叫 `start()`，訊號就開始流動。它用手機自己的事件產生 `tilt/x` 和 `tilt/y`（−1..1，也就是離靜止姿勢 ±45°，x 向右、y 朝向你，用的是螢幕座標軸，所以手機橫著拿也還是「往右傾是 +x」）、`orient/alpha|beta|gamma`（度）、`accel/x|y|z`（m/s²，含重力）、`rot/alpha|beta|gamma`（每秒幾度）、`knock`（脈衝 `{ strength, delta, t }`），打開鏡頭的話還有 `light`（0..1）。',
      },
      {
        en: 'A knock is a jolt: when the acceleration vector changes by more than `threshold` (10 m/s² by default) between two motion samples, and at least 130 ms after the last knock, `io.send(\'knock\', { strength, delta, t }, true)` fires. `delta` is the size of the change, and `strength` runs from 0.15 just over the threshold up to 1. The phone also vibrates for 10 ms where it can. Hold the phone how you want to play it and call `calibrate()` to make that pose the zero of the tilt.',
        zh: '敲擊就是猛地一震：兩筆動作樣本之間，加速度向量的變化超過 `threshold`（預設 10 m/s²），而且距離上次敲擊至少 130 毫秒，就會觸發 `io.send(\'knock\', { strength, delta, t }, true)`。`delta` 是變化的大小，`strength` 從剛過門檻的 0.15 到 1。手機能震動的話也會震 10 毫秒。把手機拿成你想演奏的姿勢，呼叫 `calibrate()`，就把那個姿勢當成傾斜的零點。',
      },
      {
        en: 'For the show page itself running on a phone, [`localSensors()`](#localSensors) wraps this class and files straight into a `Signals`.',
        zh: '演出頁面本身就跑在手機上的話，用 [`localSensors()`](#localSensors)，它包住這個類別，直接把訊號歸進 `Signals`。',
      },
    ],
    needs: {
      en: 'Call `start()` from a tap or click, not on page load. iOS asks for motion permission only inside a user gesture, and it only gives motion sensors to pages on `https://`; touch and keys work over plain `http://`. `start()` always resolves `true`: look at `denied` for a refusal. If no sensor data arrives within 2.5 s, `hooks.notify` says so (a desktop, or an iPhone page on http). `setCamera(true)` also needs a gesture and HTTPS on iOS.',
      zh: '要在點擊或觸碰時才呼叫 `start()`，不是載入頁面時。iOS 只在使用者手勢裡才會問動作權限，而且只把動作感測器開放給 `https://` 的頁面，觸控和琴鍵在一般的 `http://` 就能用。`start()` 一律回傳 `true`，被拒絕要看 `denied`。2.5 秒內沒有任何感測資料進來的話，`hooks.notify` 會說明（桌機，或 http 的 iPhone 頁面）。`setCamera(true)` 在 iOS 上同樣要手勢和 HTTPS。',
    },
    members: {
      start: { en: '`start()`: async. Ask for the motion permission where the browser requires it, then listen to `deviceorientation` and `devicemotion`. Resolves `true` even when the answer was no (then `denied` is true and the listeners are attached anyway). Calling it again does nothing.', zh: '`start()`：非同步。在瀏覽器要求的地方先問動作權限，然後開始聽 `deviceorientation` 和 `devicemotion`。就算答案是不行也回傳 `true`（這時 `denied` 是 true，聽的事件照樣掛上）。再呼叫一次不會有任何作用。' },
      stop: { en: '`stop()`: stop listening and turn the camera off.', zh: '`stop()`：不再聽事件，也把鏡頭關掉。' },
      calibrate: { en: '`calibrate()`: take the current tilt as the resting pose. Tilt reads 0 here, until the phone moves.', zh: '`calibrate()`：把目前的傾斜當成靜止姿勢。這個姿勢下傾斜讀到 0，直到手機移動。' },
      cycleThreshold: { en: '`cycleThreshold()`: make the knock threshold 2 m/s² higher and return it; past 24 it wraps to 4. For a "knock sensitivity" button.', zh: '`cycleThreshold()`：把敲擊門檻調高 2 m/s² 並回傳，超過 24 就繞回 4。給「敲擊靈敏度」按鈕用。' },
      setCamera: { en: '`setCamera(on)`: async. `true` opens the front camera and publishes `light` (the mean brightness of a 32 × 24 picture, 0..1) ten times a second; `false` stops it. Resolves `true` when done, `false` if the camera is not available (then `hooks.notify` says why).', zh: '`setCamera(on)`：非同步。`true` 打開前鏡頭，每秒 10 次發布 `light`（32 × 24 畫面的平均亮度，0..1）。`false` 就停掉。完成回傳 `true`，鏡頭不能用就回傳 `false`（這時 `hooks.notify` 會說明原因）。' },
      screenTilt: { en: '`PhoneSensors.screenTilt(beta, gamma, angle?)`: static. Turn the two raw tilt angles into screen axes for a screen angle of 0, 90, 180 or 270 degrees. Returns `{ x, y }` in degrees.', zh: '`PhoneSensors.screenTilt(beta, gamma, angle?)`：靜態方法。把兩個原始傾斜角，依螢幕角度 0、90、180 或 270 度換成螢幕座標軸。回傳 `{ x, y }`，單位是度。' },
    },
    notes: [
      {
        en: 'Public fields: `io`, `hooks`, `started`, `gotSensor` (true once any sensor data has arrived), `denied` (iOS said no; it stays no until the Settings app is changed), `rest` and `deg` (tilt in degrees), `threshold` (the knock threshold, 10) and `COOLDOWN` (130 ms).',
        zh: '公開的欄位有 `io`、`hooks`、`started`、`gotSensor`（收過任何感測資料就是 true）、`denied`（iOS 說不行，要到「設定」裡改才會變）、`rest` 和 `deg`（傾斜，單位度）、`threshold`（敲擊門檻，10）和 `COOLDOWN`（130 毫秒）。',
      },
    ],
    tbd: [
      {
        en: 'Not tried on a real iPhone or Android phone for this entry: the iOS permission flow, the HTTPS requirement and the 2.5 s "no data" message are read from the code and from docs/remote.md. The examples feed the class real `DeviceOrientationEvent` and `DeviceMotionEvent` objects in a desktop browser instead.',
        zh: '這一條沒有用真正的 iPhone 或 Android 手機試過：iOS 的權限流程、HTTPS 的要求、2.5 秒的「沒有資料」訊息，都是從程式碼和 docs/remote.md 讀來的。範例是在桌面瀏覽器裡，把真正的 `DeviceOrientationEvent` 和 `DeviceMotionEvent` 餵給這個類別。',
      },
    ],
    examples: [
      {
        code: `import { PhoneSensors } from '@openav/remote';

const seen = [];
const sensors = new PhoneSensors({
  set: (name, value) => seen.push(name + ' = ' + value),
  send: (name, value) => seen.push(name + ' ' + JSON.stringify(value)),
});
await sensors.start();   // on a phone: call this from a tap

// the event a phone fires; here a made-up one, tipped 22.5° toward you and 45° to the left
window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 5, beta: 22.5, gamma: -45 }));
sensors.stop();
document.getElementById('app').innerHTML = seen.join('<br>');`,
        caption: { en: 'Prints tilt/x = -1 (45° left is the end of the range), tilt/y = 0.5, then the three raw orient angles.', zh: '印出 tilt/x = -1（向左 45° 就是範圍的盡頭）、tilt/y = 0.5，然後是三個原始的 orient 角度。' },
      },
      {
        code: `import { PhoneSensors } from '@openav/remote';

const seen = [];
const sensors = new PhoneSensors(
  { set() {}, send: (name, v) => seen.push(name + ': strength ' + v.strength + ', delta ' + v.delta) },
  { onKnock: (s) => seen.push('onKnock(' + s + ')') },
);
await sensors.start();
await new Promise((r) => setTimeout(r, 200));   // the 130 ms knock cooldown counts from page load
navigator.vibrate = () => true;                 // a knock also buzzes the phone; a stand-in for a desktop page

const motion = (x) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
  accelerationIncludingGravity: { x, y: 0, z: 9.8 },
}));
motion(0);    // at rest, gravity only
motion(15);   // a jolt: the acceleration changed by 15 m/s²
motion(15.5); // too small to count
sensors.stop();
seen.push('threshold now ' + sensors.cycleThreshold());
document.getElementById('app').innerHTML = seen.join('<br>');`,
        caption: { en: 'Prints one knock with strength 0.35 and delta 15 (and the onKnock call), then the new threshold 12 after cycleThreshold().', zh: '印出一次敲擊，strength 是 0.35、delta 是 15（還有 onKnock 的呼叫），然後是 cycleThreshold() 之後的新門檻 12。' },
      },
      {
        code: `import { PhoneSensors } from '@openav/remote';

// the same tilt (beta 10, gamma 20) as the screen turns: x is always "to the right of the screen"
const rows = [0, 90, 180, 270].map((angle) => {
  const { x, y } = PhoneSensors.screenTilt(10, 20, angle);
  return 'screen angle ' + angle + ': x ' + x + ', y ' + y;
});
document.getElementById('app').innerHTML = rows.join('<br>');`,
        caption: { en: 'Prints x and y for the four screen angles: (20, 10), (10, -20), (-20, -10), (-10, 20).', zh: '印出四個螢幕角度的 x 和 y：(20, 10)、(10, -20)、(-20, -10)、(-10, 20)。' },
      },
    ],
    related: ['localSensors', 'attachTouchPad', 'RelayClient', 'mountRemote', 'signalMeta'],
    keywords: {
      en: ['phone sensors', 'tilt', 'accelerometer', 'gyroscope', 'deviceorientation', 'devicemotion', 'knock', 'shake', 'light sensor', 'ios permission', 'motion'],
      zh: ['手機感測器', '傾斜', '加速度', '陀螺儀', '動作感測', '敲擊', '搖晃', '光線', 'ios 權限', '動作'],
    },
  },

  attachTouchPad: {
    group: 'remote',
    summary: {
      en: 'Makes an element a multi-touch pad: each finger publishes `touch/x`, `touch/y` and `touch/down` (0..1 inside the element), and `touch/count` says how many are down.',
      zh: '把一個元素變成多點觸控板：每根手指發布 `touch/x`、`touch/y` 和 `touch/down`（在元素裡的 0..1），`touch/count` 是現在按著幾根。',
    },
    params: [
      { name: 'pad', type: 'HTMLElement', en: 'The element to listen on. Give it `touch-action: none` in CSS, or the browser may take a drag for a scroll and cancel the touch.', zh: '要監聽的元素。在 CSS 裡給它 `touch-action: none`，不然瀏覽器可能把拖曳當成捲動，把觸碰取消掉。' },
      { name: 'io', type: '{ set(name, value) }', en: 'Where the values go, as for [`PhoneSensors`](#PhoneSensors): only `set` is used, and the names have no `phone/<id>/` in front.', zh: '數值要送去哪裡，跟 [`PhoneSensors`](#PhoneSensors) 一樣：只用到 `set`，名稱前面沒有 `phone/<id>/`。' },
      { name: 'onMove', type: 'Function', optional: true, en: '`(slot, x, y, down) => {}`, when a finger touches and each time it moves. `x` and `y` are 0..1 and `down` is true. Use it to draw the finger.', zh: '`(slot, x, y, down) => {}`，手指按下去和每次移動的時候呼叫。`x`、`y` 是 0..1，`down` 是 true。拿來畫手指的位置。' },
      { name: 'onEnd', type: 'Function', optional: true, en: '`(slot) => {}`, when a finger lifts or the touch is cancelled.', zh: '`(slot) => {}`，手指離開或觸碰被取消的時候呼叫。' },
    ],
    description: [
      {
        en: 'The first finger down is slot 0 and publishes `touch/x`, `touch/y`, `touch/down`; the second is slot 1 and publishes `touch/1/x`, `touch/1/y`, `touch/1/down`, and so on. A slot is given back when its finger lifts, so the lowest free number is used next. `x` runs 0 at the left edge to 1 at the right, `y` runs 0 at the top to 1 at the bottom, both held inside the element and rounded to 4 decimals. `touch/down` is 1 or 0, and `touch/count` is the number of fingers down.',
        zh: '第一根按下去的手指是 slot 0，發布 `touch/x`、`touch/y`、`touch/down`。第二根是 slot 1，發布 `touch/1/x`、`touch/1/y`、`touch/1/down`，以此類推。手指離開就把 slot 還回去，下一根會用最小的空號。`x` 從左邊緣的 0 到右邊緣的 1，`y` 從上緣的 0 到下緣的 1，都限制在元素裡面，並四捨五入到小數點後 4 位。`touch/down` 是 1 或 0，`touch/count` 是按著的手指數。',
      },
      {
        en: 'It publishes `touch/down` 0 and `touch/count` 0 at once, so a receiver knows the pad is there before anyone touches it. It uses pointer events, so a mouse works too (one finger).',
        zh: '它一接上去就先發布 `touch/down` 0 和 `touch/count` 0，所以接收端在還沒有人碰之前就知道觸控板存在。它用的是 pointer 事件，所以滑鼠也能用（算一根手指）。',
      },
    ],
    notes: [
      {
        en: 'The sense tab uses this on its touch pad, with `io` writing to a [`RelayClient`](#RelayClient) under `phone/<id>/`.',
        zh: '感測 分頁的觸控板用的就是它，`io` 寫進 [`RelayClient`](#RelayClient)，名稱加上 `phone/<id>/`。',
      },
    ],
    examples: [
      {
        code: `import { attachTouchPad } from '@openav/remote';

const pad = document.createElement('div');
pad.style.cssText = 'width:200px;height:200px;background:#222;touch-action:none';
document.getElementById('app').append(pad);

const seen = [];
attachTouchPad(pad, { set: (name, value) => seen.push(name + '=' + value) });

// a finger lands a quarter of the way across, halfway down, then moves right
const r = pad.getBoundingClientRect();
const touch = (type, id, fx, fy) => pad.dispatchEvent(new PointerEvent(type, {
  pointerId: id, clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, bubbles: true,
}));
touch('pointerdown', 1, 0.25, 0.5);
touch('pointermove', 1, 0.5, 0.5);
touch('pointerup', 1, 0.5, 0.5);
pad.after(Object.assign(document.createElement('p'), { innerHTML: seen.join('<br>') }));`,
        caption: { en: 'A 200 px square appears, and under it the values a finger would publish: touch/down=0, touch/count=0 at the start, then x, y, down and count as it lands, moves and lifts.', zh: '畫面上出現一個 200 像素的方塊，下面列出一根手指會發布的數值：一開始的 touch/down=0、touch/count=0，然後是它落下、移動、離開時的 x、y、down 和 count。' },
      },
      {
        code: `import { attachTouchPad } from '@openav/remote';

const pad = document.createElement('div');
pad.style.cssText = 'width:200px;height:100px;background:#222;touch-action:none';
document.getElementById('app').append(pad);

const seen = [];
attachTouchPad(pad, { set: (name, value) => { if (name.endsWith('/count') || name.endsWith('/down')) seen.push(name + '=' + value); } }, {
  onMove: (slot, x, y) => seen.push('finger ' + slot + ' at ' + x.toFixed(2) + ', ' + y.toFixed(2)),
  onEnd: (slot) => seen.push('finger ' + slot + ' lifted'),
});
const r = pad.getBoundingClientRect();
const touch = (type, id, fx, fy) => pad.dispatchEvent(new PointerEvent(type, {
  pointerId: id, clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, bubbles: true,
}));
touch('pointerdown', 1, 0.1, 0.5);   // slot 0
touch('pointerdown', 2, 0.9, 0.5);   // slot 1: touch/1/…
touch('pointerup', 1, 0.1, 0.5);     // slot 0 is free again
touch('pointerdown', 3, 0.5, 0.5);   // takes slot 0
pad.after(Object.assign(document.createElement('p'), { innerHTML: seen.join('<br>') }));`,
        caption: { en: 'Two fingers get slots 0 and 1; after the first lifts, the next finger takes slot 0 again. The list shows the callbacks and the count.', zh: '兩根手指拿到 slot 0 和 1，第一根離開之後，下一根又拿回 slot 0。清單裡是各個回呼和手指數。' },
      },
    ],
    related: ['PhoneSensors', 'mountRemote', 'RelayClient'],
    keywords: {
      en: ['touch pad', 'multi-touch', 'fingers', 'pointer events', 'touch/x', 'touch/count', 'xy pad', 'phone'],
      zh: ['觸控板', '多點觸控', '手指', 'pointer 事件', 'touch/x', 'touch/count', 'xy 板', '手機'],
    },
  },

  localSensors: {
    group: 'remote',
    summary: {
      en: 'For a show page that runs on the phone itself: the phone\'s own sensors go straight into a `Signals` as `phone/local/…`, with a `phone/any/…` copy.',
      zh: '給跑在手機本身上的演出頁面用：手機自己的感測器直接進到 `Signals`，名稱是 `phone/local/…`，另外多一份 `phone/any/…` 的複本。回傳 `PhoneSensors`。',
    },
    params: [
      { name: 'signals', type: 'Signals', en: 'The registry to fill (from `@openav/core`).', zh: '要填的註冊表（來自 `@openav/core`）。' },
      { name: 'prefix', type: 'String', optional: true, en: 'What goes in front of each sensor name.', zh: '放在每個感測器名稱前面的字。' },
      { name: 'alias', type: 'String | null', optional: true, en: 'The word for the copy, `phone/<alias>/…`. `null` turns the copy off.', zh: '複本用的字，`phone/<alias>/…`。`null` 表示不做複本。' },
      { name: 'source', type: 'String', optional: true, en: 'Stored as the signals\' `source` in `signals.meta`.', zh: '存成 `signals.meta` 裡這些訊號的 `source`。' },
      { name: 'hooks', type: 'Object', optional: true, en: 'The `hooks` of [`PhoneSensors`](#PhoneSensors): `onKnock`, `onSample`, `notify`.', zh: '[`PhoneSensors`](#PhoneSensors) 的 `hooks`：`onKnock`、`onSample`、`notify`。' },
    ],
    returns: { type: 'PhoneSensors', en: 'Nothing is listening yet: call `.start()` from a tap.', zh: '還沒有開始聽：要在點擊時呼叫 `.start()`。' },
    description: [
      {
        en: 'A remote phone reaches the show through a relay. When the show page is open on the phone itself, there is no one to relay to, so this reads the sensors in place. The names and thresholds are the same as a remote phone\'s (`phone/local/tilt/x` is −1..1, `phone/local/knock` is a pulse), declared the same way by [`fileSignal()`](#fileSignal), and mirrored to `phone/any/…`, so a route written for "the latest phone", `phone/any/tilt/x`, works whether the phone is in your hand as a controller or is the show.',
        zh: '遠端的手機要透過中繼才找得到演出。演出頁面就開在手機上的時候，沒有人需要轉送，所以直接在原地讀感測器。名稱和門檻跟遠端手機一樣（`phone/local/tilt/x` 是 −1..1，`phone/local/knock` 是脈衝），用 [`fileSignal()`](#fileSignal) 一樣的方式宣告，並複製一份到 `phone/any/…`，所以替「最新的那支手機」寫的路由 `phone/any/tilt/x`，不論手機是拿在手上當控制端、還是它本身就是演出，都能用。',
      },
    ],
    needs: {
      en: 'Call `.start()` on the result from a tap (iOS asks for permission only inside a gesture, and only on https pages). Until then nothing is published. See [`PhoneSensors`](#PhoneSensors).',
      zh: '拿到結果之後，要在點擊時呼叫 `.start()`（iOS 只在手勢裡才會問權限，而且只限 https 頁面）。在那之前什麼都不會發布。見 [`PhoneSensors`](#PhoneSensors)。',
    },
    examples: [
      {
        code: `import { localSensors } from '@openav/remote';
import { Signals } from '@openav/core';

const signals = new Signals();
const own = localSensors(signals);
await own.start();   // on a phone: from a tap

window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 22.5, gamma: -45 }));
own.stop();
document.getElementById('app').innerHTML = [
  'phone/local/tilt/x = ' + signals.get('phone/local/tilt/x'),
  'phone/any/tilt/y = ' + signals.get('phone/any/tilt/y'),
  'source: ' + signals.meta.get('phone/local/tilt/x').source,
].join('<br>');`,
        caption: { en: 'Prints the tilt under both names (-1 and 0.5) and the source "local". On a phone the events come from the sensors instead of from this made-up one.', zh: '印出兩個名稱底下的傾斜值（-1 和 0.5）和來源「local」。在手機上，事件是從感測器來的，而不是這個編出來的。' },
      },
      {
        code: `import { localSensors } from '@openav/remote';
import { Signals } from '@openav/core';

const signals = new Signals();
const own = localSensors(signals, { prefix: 'phone/me/', alias: null });   // no phone/any copy
await own.start();
window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 0, gamma: 9 }));
own.stop();
document.getElementById('app').textContent =
  'phone/me/tilt/x = ' + signals.get('phone/me/tilt/x') + ', copy exists: ' + signals.meta.has('phone/any/tilt/x');`,
        caption: { en: 'A different prefix and no alias: prints "phone/me/tilt/x = 0.2, copy exists: false".', zh: '換一個前綴、不做別名：印出「phone/me/tilt/x = 0.2, copy exists: false」。' },
      },
    ],
    related: ['PhoneSensors', 'fileSignal', 'aliasOf', 'bindSignals'],
    keywords: {
      en: ['local sensors', 'phone as the show', 'no relay', 'phone/local', 'tilt', 'motion', 'show on a phone'],
      zh: ['本機感測器', '手機當演出', '不用中繼', 'phone/local', '傾斜', '動作', '演出跑在手機上'],
    },
  },

  mountRemoteHost: {
    group: 'remote',
    summary: {
      en: 'The show side of the phone remote: joins the relay as the runner, files phone signals, builds the control panel from the params and echoes values back.',
      zh: '手機遙控在演出這一邊：以演出端（runner）身分加入中繼，歸檔手機訊號，依世界的參數建立控制面板，並把數值回送。回傳 host。',
    },
    params: [
      { name: 'signals', type: 'Signals', en: 'The registry that phone signals are filed in.', zh: '手機訊號要歸進去的註冊表。' },
      { name: 'params', type: 'Params', en: 'The world\'s params. Its `schema` is what the control surface is built from.', zh: '世界的參數。控制面板就是依它的 `schema` 建立的。' },
      { name: 'mapper', type: 'Mapper', en: 'The mapper that gets the `surface/… → param` routes (a route it already has is not added twice).', zh: '會收到 `surface/… → param` 路由的映射器（它已經有的路由不會重複加）。' },
      { name: 'world', type: 'Object', optional: true, en: 'The world: its `params` are used when `params.schema` is empty, its `name` becomes the layout\'s title, and its `surface` (a hand-written layout) is used instead of a generated one.', zh: '世界物件：`params.schema` 是空的時候用它的 `params`，它的 `name` 會變成版面的標題，它的 `surface`（手寫的版面）會取代自動產生的。' },
      { name: 'room', type: 'String', optional: true, en: 'The relay room to join.', zh: '要加入的中繼房間。' },
      { name: 'auto', type: 'Object', optional: true, en: 'Options for [`autoSurface()`](#autoSurface): `pairs`, `meters`, `style`, `perPage`, `smooth`, `title`.', zh: '傳給 [`autoSurface()`](#autoSurface) 的選項：`pairs`、`meters`、`style`、`perPage`、`smooth`、`title`。' },
      { name: 'surface', type: 'Object', optional: true, en: 'An explicit layout. It wins over `world.surface`.', zh: '指定的版面。它比 `world.surface` 優先。' },
      { name: 'feedbackHz', type: 'Number', optional: true, en: 'How many times a second `host.frame()` sends the param values back to the phones.', zh: '`host.frame()` 每秒把參數值送回手機幾次。' },
      { name: 'url', type: 'String', optional: true, en: 'A relay to use instead of this page\'s own `/relay`, such as `wss://host/relay`. `role`, `room` and `id` are added to it for you. The runner id is then `show-` plus four random characters, so two tabs of one show do not collide; without `url` it is `show`.', zh: '不用這個頁面自己的 `/relay`，改用的中繼，例如 `wss://host/relay`。`role`、`room`、`id` 會替你補上去。這時演出端的 id 是 `show-` 加四個隨機字元，所以同一個演出開兩個分頁也不會打架。沒給 `url` 的話就是 `show`。' },
      { name: 'mode', type: "'local' | 'public' | 'custom'", optional: true, en: 'What `pickRelay()` decided. Only the words of the join card depend on it; the host reports it as `host.relayMode`.', zh: '`pickRelay()` 的決定。只有加入卡片上的字會依它而變，host 會把它報成 `host.relayMode`。' },
      { name: 'controllers', type: 'MidiControllers', optional: true, en: 'The on-screen MIDI controllers of `@openav/midi`: the phone\'s MIDI tab then shows the same device, and what is played on either screen shows on the other.', zh: '`@openav/midi` 的螢幕 MIDI 控制器：這樣手機的 MIDI 分頁會顯示同一台裝置，兩邊畫面上彈的音也會互相顯示。' },
    ],
    returns: { type: 'Object', en: '`{ relay, layout, routes, bindings, publish, room, relayUrl, relayMode, onStatus, frame(dt, state), connect(), dispose() }`. `connect()` returns the host again.', zh: '`{ relay, layout, routes, bindings, publish, room, relayUrl, relayMode, onStatus, frame(dt, state), connect(), dispose() }`。`connect()` 會再回傳 host 本身。' },
    description: [
      {
        en: '`createShow({ modules: { remote: true } })` calls this for you, so the world never has to know about phones. Calling it yourself does five things: it makes a [`RelayClient`](#RelayClient) as the room\'s runner; files every phone signal into `signals` with [`bindSignals()`](#bindSignals) (so `phone/any/…` always holds the latest phone); builds the layout from `surface`, `world.surface` or [`autoSurface()`](#autoSurface) of the params; adds the `surface/… → param` routes to the mapper; and, when you call `host.frame(dt, state)` every frame, sends the resolved param values back about `feedbackHz` times a second so the phones\' faders follow the timeline.',
        zh: '`createShow({ modules: { remote: true } })` 會替你呼叫它，所以世界完全不必知道手機的存在。自己呼叫的話，它做五件事：先做一個 [`RelayClient`](#RelayClient) 當房間的演出端，再用 [`bindSignals()`](#bindSignals) 把每個手機訊號歸進 `signals`（所以 `phone/any/…` 永遠是最新那支手機的值），然後用 `surface`、`world.surface` 或參數的 [`autoSurface()`](#autoSurface) 建立版面，接著把 `surface/… → param` 路由加進映射器，最後，你每個畫面呼叫 `host.frame(dt, state)` 的話，它大約每秒 `feedbackHz` 次把算好的參數值送回去，讓手機上的推桿跟著時間軸動。',
      },
      {
        en: 'Making the host does not connect it: call `host.connect()` when you want the socket. On every (re)connection it publishes the layout as relay config `surface`, so a phone that joins later gets the right panel. `host.layout`, `host.routes` and `host.bindings` are there to look at straight away, and `host.dispose()` closes the socket.',
        zh: '做出 host 並不會連線：要連的時候呼叫 `host.connect()`。每次（重新）連上時，它會把版面當成中繼設定 `surface` 發布出去，所以之後才加入的手機也拿得到正確的面板。`host.layout`、`host.routes`、`host.bindings` 一做出來就能看，`host.dispose()` 會把 socket 關掉。',
      },
    ],
    needs: {
      en: 'A relay for `connect()` to reach: `node serve.js` hosts one at `/relay`, a static site uses the public relay (see `pickRelay()`), or pass `url`. Building the host needs none of that.',
      zh: '要有中繼讓 `connect()` 連：`node serve.js` 在 `/relay` 架了一個，靜態網站用公開中繼（見 `pickRelay()`），或傳 `url`。單單做出 host 不需要這些。',
    },
    examples: [
      {
        code: `import { mountRemoteHost } from '@openav/remote/host';
import { Signals, Params } from '@openav/core';
import { Mapper } from '@openav/mapping';

const world = { name: 'Bloom', params: [
  { key: 'hue', min: 0, max: 360, def: 200 },
  { key: 'burst', pulse: true },
] };
const signals = new Signals();
const params = new Params(world.params);
const mapper = new Mapper({ signals, params });

const host = mountRemoteHost({ signals, params, mapper, world, room: 'demo' });   // not connected yet
document.getElementById('app').innerHTML = [
  'title: ' + host.layout.title,
  'widgets: ' + host.layout.pages[0].widgets.map((w) => w.id + ' (' + w.type + ')').join(', '),
  'routes: ' + host.routes.map((r) => r.source + ' > ' + r.target).join(', '),
  'in the mapper: ' + mapper.routes.length,
].join('<br>');
host.dispose();`,
        caption: { en: 'Prints what the host built from two params: a layout titled Bloom with a fader and a button, the two routes, and that the mapper now has them.', zh: '印出 host 用兩個參數建出來的東西：標題是 Bloom、有一支推桿和一顆按鈕的版面、兩條路由，以及映射器現在已經有這兩條。' },
      },
      {
        code: `import { mountRemoteHost, mountJoinCard } from '@openav/remote/host';

// signals, params, mapper and world as above
const host = mountRemoteHost({ signals, params, mapper, world, room: 'main' }).connect();
mountJoinCard(document.body, host);   // the QR code and URL for phones

function frame(dt, state) {
  host.frame(dt, state);               // echo the params back to the phones
}`,
        caption: { en: 'The usual wiring on a show page: connect, show the join card, and call `host.frame()` from the frame loop. A phone that scans the card moves the faders.', zh: '演出頁面上的一般接法：連線、顯示加入卡片、在畫面迴圈裡呼叫 `host.frame()`。手機掃了卡片上的 QR code，就能推動推桿。' },
        run: 'static',
        why: 'It opens a WebSocket to a relay and needs a phone to scan the card; the smoke page has no relay. The example above builds the host without connecting.',
      },
    ],
    related: ['mountJoinCard', 'RelayClient', 'bindSignals', 'autoSurface', 'routesFromLayout', 'feedbackFor', 'attachRelay', 'mountRemote'],
    keywords: {
      en: ['remote host', 'show side', 'runner', 'phone remote', 'surface', 'feedback', 'relay', 'modules remote', 'createShow'],
      zh: ['遙控演出端', '演出這一邊', 'runner', '手機遙控', '控制面板', '回饋', '中繼', 'modules remote', 'createShow'],
    },
  },

  mountJoinCard: {
    group: 'remote',
    summary: {
      en: 'Puts a small card on the show page with a QR code and the URL a phone should open, and a line that says whether the relay is reachable and how many phones are in.',
      zh: '在演出頁面上放一張小卡片，有 QR code 和手機該打開的網址，還有一行字說明中繼連不連得上、有幾支手機進來。',
    },
    params: [
      { name: 'parent', type: 'HTMLElement', en: 'The element to add the card to. The card is `position: absolute` at its top left, so the parent should be positioned (`position: relative`) and big enough to show it.', zh: '要把卡片加進去的元素。卡片是 `position: absolute`，貼在左上角，所以父元素最好有定位（`position: relative`），而且夠大，放得下它。' },
      { name: 'host', type: 'Object', en: 'The host from [`mountRemoteHost()`](#mountRemoteHost). The card reads `host.room`, `host.relayMode` and `host.relayUrl`, and takes over `host.onStatus` to write the status line.', zh: '[`mountRemoteHost()`](#mountRemoteHost) 回傳的 host。卡片會讀 `host.room`、`host.relayMode`、`host.relayUrl`，並接管 `host.onStatus` 來寫狀態那行字。' },
    ],
    returns: { type: 'HTMLElement', en: 'The card\'s element, already in `parent`. Remove it with `.remove()`.', zh: '卡片的元素，已經放進 `parent` 裡了。要移除就呼叫 `.remove()`。' },
    description: [
      {
        en: 'The URL is the phone page (`packages/remote/` next to this file) with `?room=<room>` on it, and with `?relay=…` as well when the show uses the public relay or a relay of your own, so the phone ends up in the same room on the same relay. On `localhost` it asks `node serve.js` for this machine\'s LAN address at `/__info` and puts that in the URL, because a phone cannot open `localhost`. The QR code is drawn from the URL; if the URL is too long for the encoder, the code is left out and the URL stays.',
        zh: '網址是手機頁面（這個檔案旁邊的 `packages/remote/`），後面接 `?room=<room>`，演出用公開中繼或你自己的中繼的話還會接上 `?relay=…`，這樣手機會進到同一個中繼的同一個房間。在 `localhost` 的時候，它會向 `node serve.js` 的 `/__info` 詢問這台電腦的區域網路位址並填進網址，因為手機打不開 `localhost`。QR code 是依網址畫出來的，網址太長、編碼器放不下時，就只留網址、不畫 QR code。',
      },
      {
        en: 'The status line reads `relay ok · 2 phones · room demo` when the connection is open (and adds `· public relay` on the public one), `relay offline — is it \`node serve.js\`?` when a local relay cannot be reached, and `can\'t reach the relay (…) — retrying` for a shared one. On a phone held upright the card starts folded, because the stage is small; tap it to open or fold it.',
        zh: '連線打開的時候，狀態那行寫 `relay ok · 2 phones · room demo`（用公開中繼的話後面加 `· public relay`），本機的中繼連不上時寫 `relay offline — is it \`node serve.js\`?`，共用的中繼連不上則寫 `can\'t reach the relay (…) — retrying`。直拿的手機上，卡片一開始是收起來的，因為舞台很小，點一下可以展開或收起。',
      },
    ],
    notes: [
      { en: 'The words on the card are in English.', zh: '卡片上的字是英文。' },
    ],
    examples: [
      {
        code: `import { mountRemoteHost, mountJoinCard } from '@openav/remote/host';
import { Signals, Params } from '@openav/core';
import { Mapper } from '@openav/mapping';

const params = new Params([{ key: 'hue', min: 0, max: 360, def: 200 }]);
const signals = new Signals();
const mapper = new Mapper({ signals, params });
const host = mountRemoteHost({ signals, params, mapper, room: 'demo' });   // not connected

const card = mountJoinCard(document.getElementById('app'), host);
host.onStatus({ status: 'open', peers: { controllers: 2 } });   // pretend the relay answered`,
        caption: { en: 'A card appears at the top left with a QR code, the phone URL ending in ?room=demo, and the line "relay ok · 2 phones · room demo".', zh: '左上角出現一張卡片，有 QR code、結尾是 ?room=demo 的手機網址，以及「relay ok · 2 phones · room demo」這行字。' },
      },
    ],
    related: ['mountRemoteHost', 'mountRemote', 'RelayClient'],
    keywords: {
      en: ['join card', 'qr code', 'phone url', 'room', 'scan', 'show page', 'public relay', 'status'],
      zh: ['加入卡片', 'qr code', '手機網址', '房間', '掃描', '演出頁面', '公開中繼', '狀態'],
    },
  },

  mountRemote: {
    group: 'remote',
    summary: {
      en: 'The whole phone app in one call: a status bar and the tabs sense, keys, control and MIDI, talking to the relay as a controller. `/packages/remote/` is exactly this.',
      zh: '一次呼叫就是整個手機 app：狀態列加上 感測、琴鍵、控制台、MIDI 這幾個分頁，以控制端身分跟中繼溝通。`/packages/remote/` 做的就是這件事。',
    },
    params: [
      { name: 'root', type: 'HTMLElement', en: 'Where to put the app. It fills the whole page (`position: fixed`), so pass `document.body`.', zh: '要把 app 放在哪裡。它會填滿整個頁面（`position: fixed`），所以傳 `document.body`。' },
      { name: 'opts', type: 'Object', optional: true, en: '`{ room, relayUrl, surfaceUrl, metaUrl }`, each optional. `room` is the relay room (else `?room=` in the address, else `window.__REMOTE__.room`, else `default`). `relayUrl` is a `ws://` or `wss://` relay (else `?relay=`; only those two schemes are accepted, so a link cannot point the phone anywhere else). `surfaceUrl` is a layout JSON for the control tab and `metaUrl` a JSON with a `params` array, which the control tab turns into [`autoSurface()`](#autoSurface). The address can also say `?tab=sense|keys|control|midi`.', zh: '`{ room, relayUrl, surfaceUrl, metaUrl }`，每一項都可省略。`room` 是中繼房間（沒給就用網址的 `?room=`，再沒有就用 `window.__REMOTE__.room`，再沒有就是 `default`）。`relayUrl` 是 `ws://` 或 `wss://` 的中繼（沒給就用 `?relay=`。只收這兩種，所以一個連結不能把手機指到別的地方）。`surfaceUrl` 是控制台分頁用的版面 JSON，`metaUrl` 是帶 `params` 陣列的 JSON，控制台分頁會把它變成 [`autoSurface()`](#autoSurface)。網址上也可以寫 `?tab=sense|keys|control|midi`。' },
    ],
    returns: { type: 'Object', en: '`{ relay, show(tab), surface, dispose() }`: the [`RelayClient`](#RelayClient), a function that switches tab, the control tab\'s [`Surface`](#Surface) (a getter, `null` until that tab has been opened), and `dispose()`, which closes the relay, unlocks the viewport, lets go of the wake lock and removes the app.', zh: '`{ relay, show(tab), surface, dispose() }`：[`RelayClient`](#RelayClient)、切換分頁的函式、控制台分頁的 [`Surface`](#Surface)（getter，那個分頁還沒打開過就是 `null`），以及 `dispose()`：關掉中繼、解除視窗鎖定、放掉螢幕喚醒鎖、移除整個 app。' },
    description: [
      {
        en: 'It is what a phone opens: `lockViewport()` so nothing scrolls or zooms, `keepAwake()` so the screen stays on, one [`RelayClient`](#RelayClient) as a controller that every tab shares, and the tabs. Sense is a tilt ball, readouts, a multi-touch pad ([`attachTouchPad()`](#attachTouchPad)) and the sensors ([`PhoneSensors`](#PhoneSensors)) behind a start button. Keys is a piano that is one row in landscape and two stacked rows in portrait. Control is a [`Surface`](#Surface). MIDI is a virtual controller.',
        zh: '它就是手機打開的那個東西：`lockViewport()` 讓畫面不能捲動也不能縮放，`keepAwake()` 讓螢幕不暗掉，一個所有分頁共用的、身分是控制端的 [`RelayClient`](#RelayClient)，再加上幾個分頁。感測（sense）有一顆傾斜球、讀數、一塊多點觸控板（[`attachTouchPad()`](#attachTouchPad)），以及藏在開始按鈕後面的感測器（[`PhoneSensors`](#PhoneSensors)）。琴鍵（keys）是一台鋼琴，橫拿時一排，直拿時上下兩排。控制台（control）是一個 [`Surface`](#Surface)。MIDI 是一台虛擬控制器。',
      },
      {
        en: 'The control tab\'s layout comes from, in order: `surfaceUrl` or `?surface=`, `metaUrl` or `?meta=`, whatever layout the show publishes over the relay (the config `surface`), and finally a small generic panel so the page is never blank. The signals are `phone/<id>/…` (sense), `midi/note/on|off` and `midi/cc/64` (keys), and `surface/<page>/<id>` (control). The app opens on `?tab=`, else the tab used last in this browser, else sense.',
        zh: '控制台分頁的版面依序從這些地方找：`surfaceUrl` 或 `?surface=`、`metaUrl` 或 `?meta=`、演出透過中繼發布的版面（設定 `surface`），最後是一個小小的通用面板，頁面永遠不會空白。訊號是 `phone/<id>/…`（感測）、`midi/note/on|off` 和 `midi/cc/64`（琴鍵）、`surface/<page>/<id>`（控制台）。app 一開始打開 `?tab=` 指定的分頁，沒有就是這個瀏覽器上次用的分頁，再沒有就是感測。',
      },
    ],
    needs: {
      en: 'A page of its own (it takes over the whole screen) and a relay to reach: the same origin\'s `/relay` unless `relayUrl` or `?relay=` says otherwise. Without a show in the room the header says it is waiting for the work to open.',
      zh: '一個專屬的頁面（它會佔滿整個螢幕），以及一個連得到的中繼：沒有 `relayUrl` 或 `?relay=` 的話就是同源的 `/relay`。房間裡沒有演出的時候，狀態列會寫在等作品開啟。',
    },
    notes: [
      { en: 'The words on the app\'s tabs and header are in Chinese.', zh: 'app 的分頁和狀態列上的字是中文。' },
    ],
    tbd: [
      {
        en: 'Not opened on a real phone for this entry: how the tabs behave is read from `packages/remote/app.js` and docs/remote.md.',
        zh: '這一條沒有在真正的手機上打開過：分頁怎麼運作，是從 `packages/remote/app.js` 和 docs/remote.md 讀來的。',
      },
    ],
    examples: [
      {
        code: `import { mountRemote } from '@openav/remote';

// the whole phone app: this is what /packages/remote/ does
const app = mountRemote(document.body, { room: 'main' });

// later: app.show('keys') switches tab, app.dispose() takes everything down`,
        caption: { en: 'On a phone: the status bar with the connection and latency, and the four tabs (sense, keys, control and MIDI, labelled in Chinese) along the bottom.', zh: '在手機上：有連線和延遲的狀態列，以及下方的 感測、琴鍵、控制台、MIDI 分頁。' },
        run: 'static',
        why: 'It takes over the whole page (position fixed, locked viewport, wake lock) and opens a WebSocket to the page\'s own /relay, which the smoke page does not have.',
      },
    ],
    related: ['mountRemoteHost', 'PhoneSensors', 'attachTouchPad', 'Surface', 'RelayClient'],
    keywords: {
      en: ['phone app', 'remote page', 'controller', 'tabs', 'sense', 'keys', 'control surface', 'ipad', 'touchosc', 'room'],
      zh: ['手機 app', '遙控頁面', '控制端', '分頁', '感測', '琴鍵', '控制面板', 'ipad', 'touchosc', '房間'],
    },
  },
};
