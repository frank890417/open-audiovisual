// @openav/pose reference: camera in, body and hand landmarks out, as signals. On-device inference with MediaPipe Tasks Vision.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The tracking examples need a camera, so they are static; the skeleton examples draw from landmarks you already have, so they run.

export default {
  PoseTracker: {
    group: 'pose',
    summary: {
      en: 'Tracks one body from the camera and publishes wrist positions, wrist speed, hand spread, height and lean as `pose/*` signals.',
      zh: '用鏡頭追蹤一個人的身體，把手腕的位置、手腕速度、雙手距離、身高位置和傾斜，發布成 `pose/*` 訊號。',
    },
    params: [
      {
        name: 'signals', type: 'Signals | null', optional: true, default: 'null',
        en: 'The [`Signals`](#Signals) registry to publish into. Without one the tracker still runs and keeps `landmarks`, but publishes nothing.',
        zh: '要發布進去的 [`Signals`](#Signals) 登錄表。沒有的話，追蹤器照樣會跑、也會更新 `landmarks`，只是不發布任何訊號。',
      },
      {
        name: 'mirror', type: 'Boolean', optional: true, default: 'true',
        en: 'Treat the camera as a mirror: x is flipped, so moving toward the viewer\'s right makes x grow. Natural for performers. `false` keeps the camera\'s own left and right.',
        zh: '把鏡頭當成鏡子：x 會左右翻轉，所以往觀看者的右邊移動，x 就變大。對表演者很自然。`false` 則保留鏡頭本身的左右。',
      },
    ],
    description: [
      {
        en: 'This is the **body** tracker: one person, 33 landmarks (the BlazePose set), run by MediaPipe Tasks Vision on the device. No video leaves the machine, and nothing is downloaded until you call `enable()`. For fine finger control use [`HandTracker`](#HandTracker) instead. In a show, `createShow({ modules: { pose: true } })` builds one and the console\'s L1 panel gets a 🕺 body button that calls `enable()`; it is `show.pose`.',
        zh: '這是**身體**追蹤器：一個人、33 個關節點（BlazePose 那一套），在裝置上由 MediaPipe Tasks Vision 執行。影像不會離開這台機器，在你呼叫 `enable()` 之前也不會下載任何東西。要精細控制手指的話，改用 [`HandTracker`](#HandTracker)。在演出裡，`createShow({ modules: { pose: true } })` 會建好一個，主控台的 L1 面板會多出一個 🕺 body 按鈕來呼叫 `enable()`，它就是 `show.pose`。',
      },
      {
        en: 'Signals, all normalised, with y **flipped** so that 1 means raised and 0 means the bottom of the frame (performance meaning beats pixel meaning): `pose/present` (0 or 1: someone is visible), `pose/hand/left/x` and `/y`, `pose/hand/right/x` and `/y` (wrist positions, 0..1), `pose/hand/left/v` and `pose/hand/right/v` (wrist speed, 0..1, clamped), `pose/hands/spread` (distance between the wrists, 0..1), `pose/height` (nose height, 0..1: crouching to standing) and `pose/lean` (shoulder-line tilt, −1..1). When nobody is in view only `pose/present` goes to 0; the others keep their last values.',
        zh: '訊號全都是正規化的，y **翻轉**過，所以 1 是舉高、0 是畫面底部（演出的意義比像素的意義重要）：`pose/present`（0 或 1：看得到人）、`pose/hand/left/x` 和 `/y`、`pose/hand/right/x` 和 `/y`（手腕位置，0..1）、`pose/hand/left/v` 和 `pose/hand/right/v`（手腕速度，0..1，超過會被夾住）、`pose/hands/spread`（兩個手腕的距離，0..1）、`pose/height`（鼻子的高度，0..1：蹲下到站直）和 `pose/lean`（肩線的傾斜，−1..1）。畫面裡沒人的時候，只有 `pose/present` 會變成 0，其他的維持最後的值。',
      },
      {
        en: 'Map these to params (`{ source: \'pose/hand/right/y\', target: \'energy\', smooth: 0.1 }`) so a raised hand does what a knob would. The detection runs on every animation frame while `running`.',
        zh: '把它們映射到參數（`{ source: \'pose/hand/right/y\', target: \'energy\', smooth: 0.1 }`），舉起的手就能做旋鈕做的事。偵測在 `running` 期間每個動畫畫面都會跑。',
      },
    ],
    needs: {
      en: 'Call `await pose.enable()`: it loads the MediaPipe library from jsDelivr and the model from Google\'s model storage (so it needs the network), asks the browser for the camera (the page needs `https` or `localhost`, and the user must allow it), and starts the loop. Until then every signal sits at its starting value.',
      zh: '要呼叫 `await pose.enable()`：它會從 jsDelivr 載入 MediaPipe 函式庫、從 Google 的模型儲存空間載入模型（所以需要網路）、向瀏覽器要鏡頭（網頁要在 `https` 或 `localhost` 底下，使用者也要允許），然後啟動迴圈。在那之前，所有訊號都停在起始值。',
    },
    members: {
      enable: {
        en: '`enable({ videoEl = null } = {})` asks for the camera (640 × 360), loads the model and starts detecting. `videoEl` is a `<video>` element to use; without one an off-screen video is created. Resolves `true`; rejects if the camera is refused or the library or model cannot be loaded.',
        zh: '`enable({ videoEl = null } = {})` 要鏡頭（640 × 360）、載入模型並開始偵測。`videoEl` 是要使用的 `<video>` 元素。沒給的話會建立一個不顯示的。完成時是 `true`。鏡頭被拒絕、或函式庫或模型載不進來就會被拒絕（reject）。',
      },
      stop: {
        en: 'Stop detecting and release the camera. Signals keep their last values. `enable()` can start it again.',
        zh: '停止偵測並釋放鏡頭。訊號維持最後的值。可以再呼叫 `enable()` 重新開始。',
      },
      skeleton: {
        en: 'Draw the body onto a 2D canvas context: `skeleton(ctx, w, h, { color, lineWidth = 2 })`, the bones of the torso, arms and legs plus dots at the nose, shoulders, wrists and hips. It follows the same mirroring as the signals but not the y flip (it draws in screen space). Does nothing without `landmarks`. Call it every frame after drawing the background.',
        zh: '把身體畫到 2D 畫布的 context 上：`skeleton(ctx, w, h, { color, lineWidth = 2 })`，包含軀幹、手臂、腿的骨頭，以及鼻子、肩膀、手腕、髖部的圓點。左右翻轉的方式跟訊號一致，但不做 y 翻轉（它畫的是螢幕座標）。沒有 `landmarks` 的時候什麼都不做。每個畫面在畫完背景之後呼叫。',
      },
    },
    notes: [
      {
        en: 'Fields to read: `landmarks` (the latest 33 raw points `{ x, y, z, visibility }`, x and y 0..1 in the camera image, y downward and not mirrored; `null` when nobody is seen), `running`, `mirror`, `video`.',
        zh: '可以讀的欄位：`landmarks`（最新的 33 個原始點 `{ x, y, z, visibility }`，x、y 是鏡頭影像裡的 0..1，y 向下、沒有左右翻轉，看不到人就是 `null`）、`running`、`mirror`、`video`。',
      },
      {
        en: 'Landmark indexes (BlazePose): nose 0, shoulders 11 and 12, wrists 15 and 16, hips 23 and 24.',
        zh: '關節點編號（BlazePose）：鼻子 0、肩膀 11 和 12、手腕 15 和 16、髖部 23 和 24。',
      },
      {
        en: 'The model is MediaPipe\'s "lite" pose landmarker on the GPU, one pose at a time. If two people are in view, only one is tracked.',
        zh: '模型是 MediaPipe 的「lite」姿態偵測器，跑在 GPU 上，一次只追蹤一個姿態。畫面裡有兩個人的話，只會追蹤其中一個。',
      },
    ],
    tbd: [
      {
        en: 'Not tried here with a live camera. In particular, which person\'s hand `pose/hand/left/*` follows in practice was not checked: the code takes landmark 16 for `left` and landmark 15 for `right` when `mirror` is true (the other way round when false), and the package docs say `left` is the viewer\'s left.',
        zh: '這裡沒有用真正的鏡頭試過。尤其是 `pose/hand/left/*` 實際上跟著誰的手，沒有查證：`mirror` 為 true 的時候，程式用關節點 16 當 `left`、15 當 `right`（false 時相反），套件文件則說 `left` 是觀看者的左邊。',
      },
      {
        en: 'Whether the camera permission prompt needs a click first was not tested; the package README calls `enable()` from a button.',
        zh: '鏡頭權限的詢問是否一定要先點一下，沒有測試過。套件的 README 是從按鈕呼叫 `enable()`。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { PoseTracker } from '@openav/pose';

const signals = new Signals();
const pose = new PoseTracker({ signals });
document.addEventListener('click', async () => {
  await pose.enable();                                   // camera prompt, then the model downloads
  console.log('tracking');
}, { once: true });
setInterval(() => {
  console.log('raised hand', signals.get('pose/hand/right/y').toFixed(2), 'present', signals.get('pose/present'));
}, 500);`,
        caption: { en: 'Click the page and allow the camera: the console prints `tracking`, then every half second the height of the right wrist (1 = raised) and whether someone is in view.', zh: '點一下頁面並允許鏡頭：主控台印出 `tracking`，然後每半秒印出右手腕的高度（1 = 舉高），以及畫面裡有沒有人。' },
        run: 'static',
        why: 'It needs a camera and a browser permission, and downloads the MediaPipe library and model; the headless check has none of them.',
      },
      {
        code: `import { PoseTracker } from '@openav/pose';

const pose = new PoseTracker();                       // never enabled: no camera, no download
const point = (x, y) => ({ x, y, z: 0, visibility: 1 });
const landmarks = Array.from({ length: 33 }, () => point(0.5, 0.5));
landmarks[0] = point(0.5, 0.2);                       // nose
landmarks[11] = point(0.58, 0.35); landmarks[12] = point(0.42, 0.35);   // shoulders
landmarks[13] = point(0.68, 0.45); landmarks[14] = point(0.32, 0.25);   // elbows
landmarks[15] = point(0.74, 0.58); landmarks[16] = point(0.24, 0.1);    // wrists: one down, one raised
landmarks[23] = point(0.55, 0.62); landmarks[24] = point(0.45, 0.62);   // hips
landmarks[25] = point(0.56, 0.8); landmarks[26] = point(0.44, 0.8);     // knees
landmarks[27] = point(0.56, 0.95); landmarks[28] = point(0.44, 0.95);   // ankles
landmarks[29] = point(0.57, 0.97); landmarks[30] = point(0.43, 0.97);   // heels
landmarks[31] = point(0.6, 0.98); landmarks[32] = point(0.4, 0.98);     // toes
pose.landmarks = landmarks;                           // what enable() keeps filling in from the camera

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
pose.skeleton(ctx, 400, 300, { color: '#7aa6ff', lineWidth: 3 });`,
        caption: { en: 'A stick figure with one arm raised is drawn on the canvas from made-up landmarks: the overlay `skeleton()` draws over the camera picture, without needing a camera.', zh: '用編造的關節點在畫布上畫出一個舉著一隻手的火柴人：這就是 `skeleton()` 疊在鏡頭畫面上的骨架，不需要鏡頭。' },
      },
      {
        code: `import { Signals, Params, Loop } from '@openav/core';
import { Mapper } from '@openav/mapping';
import { PoseTracker } from '@openav/pose';

const signals = new Signals();
const params = new Params([{ key: 'energy', min: 0, max: 1, def: 0.2 }]);
const mapper = new Mapper({ signals, params });
mapper.addRoute({ source: 'pose/hand/right/y', target: 'energy', smooth: 0.1 });   // a raised hand is energy
const pose = new PoseTracker({ signals });

document.addEventListener('click', () => pose.enable(), { once: true });
new Loop((dt) => {
  mapper.update(dt);
  const energy = params.resolve().energy;
  const ctx = document.getElementById('c').getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
  ctx.fillStyle = '#7aa6ff'; ctx.fillRect(20, 280, 360 * energy, 10);
}).start();`,
        caption: { en: 'Click to start the camera, then raise your right hand: the bar at the bottom of the canvas grows with it, because the pose signal is mapped to a param.', zh: '點一下啟動鏡頭，然後舉起右手：畫布底下的長條會跟著變長，因為姿態訊號被映射到一個參數。' },
        run: 'static',
        why: 'It needs a camera and a browser permission; the headless check has none.',
      },
    ],
    related: ['HandTracker', 'Signals', 'Mapper', 'LeapInput', 'createShow'],
    keywords: {
      en: ['pose', 'body tracking', 'camera', 'webcam', 'mediapipe', 'skeleton', 'wrist', 'hand height', 'lean', 'blazepose', 'landmarks', 'dancer'],
      zh: ['姿態', '身體追蹤', '鏡頭', '網路攝影機', 'mediapipe', '骨架', '手腕', '手的高度', '傾斜', '關節點', '舞者'],
    },
  },

  HandTracker: {
    group: 'pose',
    summary: {
      en: 'Tracks up to two hands from the camera with 21 landmarks each and publishes palm position and thumb-to-finger pinch distances as `hand/*` signals.',
      zh: '用鏡頭追蹤最多兩隻手，每隻 21 個關節點，把掌心位置和拇指到手指的捏合距離發布成 `hand/*` 訊號。',
    },
    params: [
      {
        name: 'signals', type: 'Signals | null', optional: true, default: 'null',
        en: 'The [`Signals`](#Signals) registry to publish into. Without one the tracker still runs and keeps `hands`, but publishes nothing.',
        zh: '要發布進去的 [`Signals`](#Signals) 登錄表。沒有的話，追蹤器照樣會跑、也會更新 `hands`，只是不發布任何訊號。',
      },
      {
        name: 'mirror', type: 'Boolean', optional: true, default: 'true',
        en: 'Treat the camera as a mirror: x is flipped, and the left and right labels MediaPipe gives are swapped so the signals match the body.',
        zh: '把鏡頭當成鏡子：x 會左右翻轉，MediaPipe 給的左手、右手標籤也會對調，讓訊號跟身體對得上。',
      },
    ],
    description: [
      {
        en: 'The **fine-control** tracker: each hand gives two precise continuous controllers, thumb to index and thumb to middle finger, so two hands are four controllers you can pinch. The distances are normalised by the size of your palm (wrist to the base of the middle finger), so moving toward or away from the camera does not change a pinch: stage-robust. It runs on the device with MediaPipe Tasks Vision and downloads nothing until `enable()`. In a show, `createShow({ modules: { hands: true } })` builds one (`show.hands`) and the L1 panel gets a 🖐 hands button.',
        zh: '**精細控制**的追蹤器：每隻手提供兩個精確的連續控制，拇指到食指、拇指到中指，所以兩隻手就是四個可以捏的控制。距離會依你的手掌大小（手腕到中指根部）正規化，所以靠近或遠離鏡頭不會改變捏合的值，在舞台上很穩。它在裝置上用 MediaPipe Tasks Vision 執行，在 `enable()` 之前不會下載任何東西。在演出裡，`createShow({ modules: { hands: true } })` 會建好一個（`show.hands`），L1 面板會多出一個 🖐 hands 按鈕。',
      },
      {
        en: 'For each of `left` and `right` it publishes `hand/<side>/present` (0 or 1), `hand/<side>/x` and `/y` (the palm, 0..1; y flipped so 1 is raised), `hand/<side>/pinch/index` and `hand/<side>/pinch/middle` (0..1, **0 = touching**, 1 = wide open) and `hand/<side>/spread` (index fingertip to little fingertip, 0..1). A side with no hand in view gets `present` 0 and keeps its other values. Note that these names do not start with `pose/`, and are different from the body tracker\'s.',
        zh: '`left` 和 `right` 各自會發布 `hand/<side>/present`（0 或 1）、`hand/<side>/x` 和 `/y`（掌心，0..1，y 翻轉過，所以 1 是舉高）、`hand/<side>/pinch/index` 和 `hand/<side>/pinch/middle`（0..1，**0 = 碰在一起**，1 = 張得最開），以及 `hand/<side>/spread`（食指指尖到小指指尖，0..1）。畫面裡沒有手的那一邊，`present` 會是 0，其他的值維持不變。請注意，這些名稱不是 `pose/` 開頭，跟身體追蹤器的不一樣。',
      },
      {
        en: 'A pinch is a distance, so for "pinch closes" use a route with `invert`: `{ source: \'hand/right/pinch/index\', target: \'tightness\', invert: true, smooth: 0.1 }`. If you want pinch start and end as events, [`LeapInput`](#LeapInput)\'s gestures do that; `HandTracker` only gives the continuous distances.',
        zh: '捏合是一個距離，所以想要「捏緊的時候變大」，就在路由裡用 `invert`：`{ source: \'hand/right/pinch/index\', target: \'tightness\', invert: true, smooth: 0.1 }`。如果你要把捏合的開始和結束當成事件，[`LeapInput`](#LeapInput) 的手勢就是做這個的。`HandTracker` 只提供連續的距離。',
      },
    ],
    needs: {
      en: 'Call `await hands.enable()`: it loads the MediaPipe library from jsDelivr and the hand model from Google\'s model storage (so it needs the network), asks for the camera (`https` or `localhost`, and the user must allow it) and starts the loop. Until then the signals sit at their starting values.',
      zh: '要呼叫 `await hands.enable()`：它會從 jsDelivr 載入 MediaPipe 函式庫、從 Google 的模型儲存空間載入手的模型（所以需要網路）、向瀏覽器要鏡頭（`https` 或 `localhost`，使用者也要允許），然後啟動迴圈。在那之前，訊號都停在起始值。',
    },
    members: {
      enable: {
        en: '`enable({ videoEl = null } = {})`: ask for the camera (640 × 360), load the model (up to two hands) and start detecting. `videoEl` is a `<video>` to use; without one an off-screen video is created. Resolves `true`; rejects if the camera is refused or the library or model cannot load.',
        zh: '`enable({ videoEl = null } = {})`：要鏡頭（640 × 360）、載入模型（最多兩隻手）並開始偵測。`videoEl` 是要使用的 `<video>`。沒給的話會建立一個不顯示的。完成時是 `true`。鏡頭被拒絕、或函式庫或模型載不進來就會被拒絕（reject）。',
      },
      stop: {
        en: 'Stop detecting and release the camera. Signals keep their last values.',
        zh: '停止偵測並釋放鏡頭。訊號維持最後的值。',
      },
      skeleton: {
        en: 'Draw the hands onto a 2D canvas context: `skeleton(ctx, w, h, { colorLeft, colorRight, lineWidth = 2 })`, the 21 landmarks joined into finger bones, with bigger dots at the thumb, index and middle fingertips (the pinch control points). Left is green and right is yellow by default.',
        zh: '把手畫到 2D 畫布的 context 上：`skeleton(ctx, w, h, { colorLeft, colorRight, lineWidth = 2 })`，把 21 個關節點連成手指的骨頭，拇指、食指、中指的指尖（捏合的控制點）畫成比較大的圓點。預設左手是綠色，右手是黃色。',
      },
    },
    notes: [
      {
        en: 'Fields to read: `hands` (`[{ handed: \'left\' | \'right\', lm }]`, `lm` the 21 landmarks `{ x, y, z }` in the camera image, y downward and not mirrored), `running`, `mirror`, `video`.',
        zh: '可以讀的欄位：`hands`（`[{ handed: \'left\' | \'right\', lm }]`，`lm` 是 21 個關節點 `{ x, y, z }`，在鏡頭影像裡，y 向下、沒有左右翻轉）、`running`、`mirror`、`video`。',
      },
      {
        en: 'Landmark indexes used: wrist 0, thumb tip 4, index tip 8, middle tip 12, little finger tip 20, base of the middle finger 9 (the palm position and the size reference).',
        zh: '用到的關節點編號：手腕 0、拇指指尖 4、食指指尖 8、中指指尖 12、小指指尖 20、中指根部 9（掌心位置，也是計算大小的參考）。',
      },
    ],
    tbd: [
      {
        en: 'Not tried here with a live camera, so the real range of the pinch values (for example how close to 0 a firm pinch gets) is not measured.',
        zh: '這裡沒有用真正的鏡頭試過，所以捏合值實際的範圍（例如用力捏的時候能多接近 0）沒有量過。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { HandTracker } from '@openav/pose';

const signals = new Signals();
const hands = new HandTracker({ signals });
document.addEventListener('click', () => hands.enable(), { once: true });   // the camera prompt, then the model
signals.on('hand/right/pinch/index', (distance) => {
  if (distance < 0.1) console.log('right hand pinches thumb and index');
});`,
        caption: { en: 'Click the page and allow the camera; hold a hand up and pinch thumb to index finger: the console prints `right hand pinches thumb and index` while they touch.', zh: '點一下頁面並允許鏡頭，舉起一隻手、拇指碰食指：兩指相碰的時候，主控台印出 `right hand pinches thumb and index`。' },
        run: 'static',
        why: 'It needs a camera and a browser permission, and downloads the MediaPipe library and model; the headless check has none of them.',
      },
      {
        code: `import { HandTracker } from '@openav/pose';

const hands = new HandTracker();                      // never enabled: no camera, no download
const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
lm[0] = { x: 0.5, y: 0.9, z: 0 };                     // wrist
const fingers = [[1, 0.38, 0.8, 0.28, 0.7, 0.2, 0.62, 0.14, 0.55],     // thumb: joints 1 to 4 as x, y pairs
  [5, 0.42, 0.55, 0.4, 0.42, 0.39, 0.32, 0.38, 0.22],                  // index
  [9, 0.5, 0.53, 0.5, 0.38, 0.5, 0.27, 0.5, 0.17],                     // middle
  [13, 0.58, 0.55, 0.6, 0.42, 0.61, 0.32, 0.62, 0.23],                 // ring
  [17, 0.64, 0.6, 0.67, 0.5, 0.69, 0.42, 0.7, 0.34]];                  // little
for (const [first, ...xy] of fingers) for (let i = 0; i < 4; i++) lm[first + i] = { x: xy[i * 2], y: xy[i * 2 + 1], z: 0 };
hands.hands = [{ handed: 'right', lm }];              // what enable() keeps filling in from the camera

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
hands.skeleton(ctx, 400, 300, { lineWidth: 3 });`,
        caption: { en: 'An open right hand is drawn in yellow on the canvas from made-up landmarks, with bigger dots at the thumb, index and middle fingertips: the overlay `skeleton()` gives you over the camera picture.', zh: '用編造的關節點在畫布上用黃色畫出一隻張開的右手，拇指、食指、中指的指尖是比較大的圓點：這就是 `skeleton()` 疊在鏡頭畫面上的骨架。' },
      },
    ],
    related: ['PoseTracker', 'Signals', 'Mapper', 'LeapInput', 'createShow'],
    keywords: {
      en: ['hands', 'hand tracking', 'pinch', 'fingers', 'camera', 'webcam', 'mediapipe', 'landmarks', 'thumb index', 'spread', 'palm'],
      zh: ['手', '手部追蹤', '捏合', '手指', '鏡頭', '網路攝影機', 'mediapipe', '關節點', '拇指食指', '張開', '掌心'],
    },
  },
};
