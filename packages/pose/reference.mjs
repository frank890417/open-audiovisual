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
      en: 'Tracks up to two hands from the camera and publishes positions, pinches, openness, angle, seven gestures and the distance between the hands as `hand/*` signals.',
      zh: '用鏡頭追蹤最多兩隻手，把位置、捏合、手張開多少、手的角度、七種手勢、捏一下與手勢的事件，以及兩手之間的距離，發布成 `hand/*` 訊號。',
    },
    params: [
      {
        name: 'signals', type: 'Signals | null', optional: true, default: 'null',
        en: 'The [`Signals`](#Signals) registry to publish into. Without one the tracker still runs and keeps `hands` and `features`, but publishes nothing.',
        zh: '要發布進去的 [`Signals`](#Signals) 登錄表。沒有的話，追蹤器照樣會跑、也會更新 `hands` 和 `features`，只是不發布任何訊號。',
      },
      {
        name: 'mirror', type: 'Boolean', optional: true, default: 'true',
        en: 'Treat the camera as a mirror: x is flipped, and the left and right labels MediaPipe gives are swapped so the signals match the body.',
        zh: '把鏡頭當成鏡子：x 會左右翻轉，MediaPipe 給的左手、右手標籤也會對調，讓訊號跟身體對得上。',
      },
      {
        name: 'gestures', type: 'Boolean', optional: true, default: 'true',
        en: 'Recognise gestures. `true` runs MediaPipe\'s GestureRecognizer, which finds the hands and names a gesture for each in one pass; `false` runs the HandLandmarker alone (no `gesture` signals, a slightly smaller model).',
        zh: '要不要辨識手勢。`true` 跑 MediaPipe 的 GestureRecognizer，一次就找出手、也替每隻手判斷手勢。`false` 只跑 HandLandmarker（沒有 `gesture` 訊號，模型稍微小一點）。',
      },
      {
        name: 'thresholds', type: 'Object', optional: true, default: '{}',
        en: 'Overrides for the defaults: `pinchMin` 0.2 and `pinchMax` 1.2 (thumb ↔ finger in hand sizes that read 0 and 1), `pinchOn` 0.35 and `pinchOff` 0.56 (a pinch starts below, ends above), `openMin` 0.6 and `openMax` 1.1 (openness that reads 0 and 1; a pinch also needs the other fingers above `openMin`), `gestureOn` 0.5 and `gestureOff` 0.35 (gesture score), `bothMin` 0.2 and `bothMax` 1.0 (palm ↔ palm in frame heights), `hold` 80 (ms a new state must last), `speedFull` 3 (frame heights per second that read speed 1). The tracker keeps this object as `thresholds` and reads it every frame, so changing a value while it runs takes effect at once. In a show: `modules: { hands: { thresholds } }`.',
        zh: '覆寫預設值：`pinchMin` 0.2 和 `pinchMax` 1.2（拇指到手指幾個手的大小算 0、算 1）、`pinchOn` 0.35 和 `pinchOff` 0.56（低於前者開始捏、高於後者放開）、`openMin` 0.6 和 `openMax` 1.1（張開程度算 0、算 1，捏一下也要其他手指高於 `openMin`）、`gestureOn` 0.5 和 `gestureOff` 0.35（手勢分數）、`bothMin` 0.2 和 `bothMax` 1.0（兩個手掌相距幾個畫面高）、`hold` 80（新的狀態要維持幾毫秒）、`speedFull` 3（每秒幾個畫面高算速度 1）。追蹤器把這個物件存成 `thresholds`，每一格都會讀，所以執行中改一個值馬上生效。在演出裡是 `modules: { hands: { thresholds } }`。',
      },
    ],
    description: [
      {
        en: 'The **hand** tracker: up to two hands, 21 landmarks each, run on the device with MediaPipe Tasks Vision (1.2.3). It downloads nothing until `enable()`, and no video leaves the machine. In a show, `createShow({ modules: { hands: true } })` builds one (`show.hands`) and the L1 panel gets a 🖐 hands button.',
        zh: '**手部**追蹤器：最多兩隻手，每隻 21 個關節點，在裝置上用 MediaPipe Tasks Vision（1.2.3）執行。在 `enable()` 之前不會下載任何東西，影像也不會離開這台機器。在演出裡，`createShow({ modules: { hands: true } })` 會建好一個（`show.hands`），L1 面板會多出一個 🖐 hands 按鈕。',
      },
      {
        en: 'Per side (`left`, `right`) under `hand/<side>/`: `present` (0 or 1), `x` and `y` (the palm; y flipped so 1 is raised), `tip/x` and `tip/y` (the index fingertip), `thumb/index`, `thumb/middle`, `thumb/ring` and `thumb/pinky` (thumb tip to each fingertip, **0 = touching**, 1 = wide open), `openness` (0 = fist, 1 = all fingers out), `angle` (wrist to the base of the middle finger: 0.5 = fingers up, 0.75 = pointing to the viewer\'s right, 0.25 = left), `speed` (palm speed, 1 = 3 frame heights a second), `pinched` (0 or 1), `gesture` (0 none, 1 fist, 2 open, 3 point, 4 thumb-up, 5 thumb-down, 6 victory, 7 iloveyou) and `gesture/<name>` (0 or 1 for each of those names). Pulses: `hand/<side>/pinch-start` and `pinch-end` with `{ side, x, y, distance }` at the fingertip, and `hand/<side>/gesture/<name>-start` with `{ side, x, y, gesture, score }`. Both hands: `hand/both/present`, `hand/both/distance` (palm centre to palm centre), `hand/both/x` and `y` (the midpoint) and `hand/both/angle` (the line from the left palm to the right one, 0.5 = level).',
        zh: '每一側（`left`、`right`）在 `hand/<side>/` 底下：`present`（0 或 1）、`x` 和 `y`（手掌，y 翻轉過，1 是舉高）、`tip/x` 和 `tip/y`（食指指尖）、`thumb/index`、`thumb/middle`、`thumb/ring`、`thumb/pinky`（拇指指尖到各指尖，**0 = 碰在一起**，1 = 張到最開）、`openness`（0 = 握拳，1 = 手指全開）、`angle`（手腕到中指根部：0.5 = 手指朝上，0.75 = 指向觀看者的右邊，0.25 = 左邊）、`speed`（手掌速度，每秒 3 個畫面高 = 1）、`pinched`（0 或 1）、`gesture`（0 沒有、1 握拳、2 張開、3 指上、4 讚、5 倒讚、6 YA、7 I love you），以及 `gesture/<name>`（上面每個名稱各一個 0 或 1）。脈衝：`hand/<side>/pinch-start` 和 `pinch-end`，帶著指尖的 `{ side, x, y, distance }`，還有 `hand/<side>/gesture/<name>-start`，帶著 `{ side, x, y, gesture, score }`。兩隻手：`hand/both/present`、`hand/both/distance`（兩個手掌中心的距離）、`hand/both/x` 和 `y`（中點）、`hand/both/angle`（左手掌到右手掌的連線，0.5 = 水平）。',
      },
      {
        en: 'Every distance is divided by the size of the hand (wrist to the base of the middle finger) and measured with x multiplied by the frame\'s aspect ratio, so neither moving toward the camera nor turning the hand sideways changes a pinch. A pinch counts only with the other three fingers out, so a fist is not a pinch. Each state (pinched, a gesture) has two thresholds and must last 80 ms before it counts, so it starts once and ends once instead of flickering; a hand that leaves the picture ends its pinch and gesture at once.',
        zh: '每個距離都除以手的大小（手腕到中指根部），而且 x 乘上畫面的長寬比，所以手往鏡頭靠近、手轉向側面，捏合的值都不會變。捏一下要其他三指張開才算，所以握拳不會被當成捏。每個狀態（捏住、一個手勢）都有兩個門檻，而且要維持 80 毫秒才算數，所以它開始一次、結束一次，不會一直閃。手離開畫面，它的捏合和手勢馬上結束。',
      },
      {
        en: 'Route the continuous ones to params and the pulses to pulse params: `{ source: \'hand/right/openness\', target: \'bloom\', smooth: 0.12 }`, `{ source: \'hand/right/gesture/victory-start\', target: \'nextScene\' }`. For "pinch closes" on a distance use `invert`. The first three measures, `hand/<side>/pinch/index`, `pinch/middle` and `spread`, are kept exactly as they were (divided by 2.2 hand sizes, no aspect correction: an open hand reads about 0.5), so shows built on them feel the same; prefer `thumb/*` in new work.',
        zh: '連續的訊號接到參數，脈衝接到脈衝參數：`{ source: \'hand/right/openness\', target: \'bloom\', smooth: 0.12 }`、`{ source: \'hand/right/gesture/victory-start\', target: \'nextScene\' }`。距離要「捏緊時變大」就用 `invert`。最早的三個量 `hand/<side>/pinch/index`、`pinch/middle` 和 `spread` 完全維持原樣（除以 2.2 個手的大小、沒有修正長寬比，張開的手大約是 0.5），用它們做的演出感覺不會變。新作品請用 `thumb/*`。',
      },
    ],
    needs: {
      en: 'Call `await hands.enable()`: it loads the MediaPipe library from jsDelivr and the gesture model (or the hand model with `gestures: false`) from Google\'s model storage (so it needs the network), asks for the camera (`https` or `localhost`, and the user must allow it) and starts the loop. Until then the signals sit at their starting values. `feed()` works without any of that.',
      zh: '要呼叫 `await hands.enable()`：它會從 jsDelivr 載入 MediaPipe 函式庫、從 Google 的模型儲存空間載入手勢模型（`gestures: false` 時是手的模型，所以需要網路）、向瀏覽器要鏡頭（`https` 或 `localhost`，使用者也要允許），然後啟動迴圈。在那之前，訊號都停在起始值。`feed()` 不需要這些。',
    },
    members: {
      enable: {
        en: '`enable({ videoEl = null } = {})`: ask for the camera (640 × 360), load the model (up to two hands) and start detecting, once per camera frame. `videoEl` is a `<video>` to use; without one an off-screen video is created. Resolves `true`; rejects if the camera is refused or the library or model cannot load.',
        zh: '`enable({ videoEl = null } = {})`：要鏡頭（640 × 360）、載入模型（最多兩隻手），然後每一格鏡頭畫面偵測一次。`videoEl` 是要使用的 `<video>`。沒給的話會建立一個不顯示的。完成時是 `true`。鏡頭被拒絕、或函式庫或模型載不進來就會被拒絕（reject）。',
      },
      stop: {
        en: 'Stop detecting and release the camera. The hands are reported gone: `present` goes to 0 and a held pinch or gesture ends.',
        zh: '停止偵測並釋放鏡頭。手會被當成離開了：`present` 變成 0，正在捏或正在比的手勢會結束。',
      },
      skeleton: {
        en: 'Draw the hands onto a 2D canvas context: `skeleton(ctx, w, h, { colorLeft, colorRight, lineWidth = 2 })`, the 21 landmarks joined into finger bones, with bigger dots at the thumb, index and middle fingertips. Left is green and right is yellow by default.',
        zh: '把手畫到 2D 畫布的 context 上：`skeleton(ctx, w, h, { colorLeft, colorRight, lineWidth = 2 })`，把 21 個關節點連成手指的骨頭，拇指、食指、中指的指尖畫成比較大的圓點。預設左手是綠色，右手是黃色。',
      },
      overlay: {
        en: '`overlay(ctx, w, h, { video = false, dim = 0.55, colorLeft, colorRight, pinchColor, scale = 1 })`: draw what the tracker measures, for tuning or for an audience. With `video: true` the camera picture first (mirrored like the signals, stretched to the canvas, darkened by `dim`), then for each hand the skeleton and its 21 points, the thumb-to-index line with its `thumb/index` value and a ring as wide as the gap (green while pinched), an arrow for the angle with the angle and openness, the gesture\'s name and score while one is held, the palm centre, and the dashed line between the palms with the distance and tilt. Points land where their signals say (`x × w`, `y × h`), so a 16:9 canvas shows the hands undistorted.',
        zh: '`overlay(ctx, w, h, { video = false, dim = 0.55, colorLeft, colorRight, pinchColor, scale = 1 })`：把追蹤器量到的東西畫出來，調門檻或給觀眾看都可以。`video: true` 時先畫鏡頭畫面（跟訊號一樣左右鏡像、拉滿畫布、用 `dim` 壓暗），再替每隻手畫骨架和 21 個點、拇指到食指的線和它的 `thumb/index` 數值、一個跟兩指距離一樣寬的圓（捏住時變綠）、表示角度的箭頭和角度、張開程度、正在比的手勢名稱與分數、手掌中心，以及兩個手掌之間的虛線、距離和傾斜。點會落在訊號說的位置（`x × w`、`y × h`），所以 16:9 的畫布上手不會變形。',
      },
      feed: {
        en: '`feed(result, now = performance.now())`: publish one detection result, `{ landmarks, handedness, gestures }` in MediaPipe\'s shape, through the same measures, latches and signals as the camera\'s. `enable()` calls it every frame; call it yourself to play recorded landmarks, hands from another detector, or made-up hands (example 27 does that until the camera is on). `now` is in milliseconds and drives the 80 ms hold and the speed.',
        zh: '`feed(result, now = performance.now())`：把一筆偵測結果（MediaPipe 格式的 `{ landmarks, handedness, gestures }`）送過跟鏡頭一樣的計算、門檻和訊號。`enable()` 每一格都會呼叫它。自己呼叫它，就能播放錄下來的關節點、別的偵測器給的手，或編出來的手（範例 27 在鏡頭打開之前就是這樣做）。`now` 是毫秒，80 毫秒的維持時間和速度都看它。',
      },
    },
    notes: [
      {
        en: 'Fields to read: `hands` (`[{ handed: \'left\' | \'right\', lm }]`, `lm` the 21 landmarks `{ x, y, z }` in the camera image, y downward and not mirrored), `features` (`{ left, right, both }`: per hand the measures plus `thumbRaw`, `opennessRaw`, `pinchRaw`, `size`, `pinched` and `gesture` `{ name, id, score }`; for both, `distanceRaw`; `null` when absent), `ms` (the last detection in milliseconds), `aspect` (the camera\'s width ÷ height), `thresholds`, `running`, `mirror`, `video`.',
        zh: '可以讀的欄位：`hands`（`[{ handed: \'left\' | \'right\', lm }]`，`lm` 是 21 個關節點 `{ x, y, z }`，在鏡頭影像裡，y 向下、沒有左右翻轉）、`features`（`{ left, right, both }`：每隻手的量，加上 `thumbRaw`、`opennessRaw`、`pinchRaw`、`size`、`pinched` 和 `gesture` `{ name, id, score }`。兩隻手的有 `distanceRaw`。沒有手時是 `null`）、`ms`（上一次偵測花了幾毫秒）、`aspect`（鏡頭的寬 ÷ 高）、`thresholds`、`running`、`mirror`、`video`。',
      },
      {
        en: 'The default thresholds are those of the TouchDesigner `hand_features` module built on torinmb/mediapipe-touchdesigner for the same course, tuned on one performer\'s hands at a desk (M4 Max, Logitech MX Brio, hands 50–80 cm from the lens): pinched 0.11–0.28 hand sizes and open 0.95–1.2; a fist\'s openness 0.12–0.5 and an open hand\'s about 1.0; gesture scores only 0.5–0.82, which is why a gesture starts at 0.5. MediaPipe gives one gesture per hand (the most likely), so each `gesture/<name>` follows that one\'s score and drops when another takes over.',
        zh: '預設門檻來自為同一門課做的 TouchDesigner `hand_features` 模組（建立在 torinmb/mediapipe-touchdesigner 之上），用一個人的手在桌前調的（M4 Max、Logitech MX Brio，手離鏡頭 50 到 80 公分）：捏緊 0.11 到 0.28 個手的大小、張開 0.95 到 1.2。握拳的張開程度 0.12 到 0.5，張開的手大約 1.0。手勢分數只到 0.5 到 0.82，所以手勢從 0.5 開始算。MediaPipe 每隻手只給一個手勢（最像的那個），所以每個 `gesture/<name>` 跟著那一個的分數走，換成別的手勢就掉下來。',
      },
      {
        en: 'When both hands carry the same left or right label (it happens), the one further to the viewer\'s left becomes `left`.',
        zh: '兩隻手被標成同一邊的時候（會發生），比較靠觀看者左邊的那隻算 `left`。',
      },
    ],
    tbd: [
      {
        en: 'The browser version has been run on MediaPipe\'s sample photos through a fake camera in Chromium on macOS (fist, open, point, thumb up and victory named correctly, 14–23 ms a frame on an M4 Max; thumb down and I love you had no sample) but not yet with live hands, so the thresholds are the TouchDesigner module\'s and not measured in the browser, and which hand reads `left` in front of a real camera was not checked.',
        zh: '瀏覽器版在 macOS 的 Chromium 上用假鏡頭播 MediaPipe 的範例照片跑過（握拳、張開、指上、讚、YA 都判對了，M4 Max 上每格 14 到 23 毫秒，倒讚和 I love you 沒有樣本），還沒有用真人的手試過，所以門檻是 TouchDesigner 模組的，沒有在瀏覽器裡量過，真的鏡頭前哪隻手算 `left` 也還沒驗。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { HandTracker } from '@openav/pose';

const signals = new Signals();
const hands = new HandTracker({ signals });
document.addEventListener('click', () => hands.enable(), { once: true });   // the camera prompt, then the model
signals.on('hand/right/pinch-start', ({ x, y }) => console.log('pinch at', x.toFixed(2), y.toFixed(2)));
signals.on('hand/right/gesture/victory-start', () => console.log('victory'));`,
        caption: { en: 'Click the page and allow the camera; pinch thumb and index with the other fingers out, then make a victory sign: the console prints `pinch at …` once per pinch and `victory` once per sign.', zh: '點一下頁面並允許鏡頭。拇指捏食指、其他三指張開，再比一個 YA：每捏一下主控台印一次 `pinch at …`，每比一次印一次 `victory`。' },
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
      {
        code: `import { HandTracker } from '@openav/pose';

const hands = new HandTracker();                      // no camera: feed() takes the hands
const P = [[0, 0], [-0.04, 0.04], [-0.08, 0.08], [-0.11, 0.12], [-0.13, 0.16], [-0.05, 0.19], [-0.055, 0.26],
  [-0.06, 0.31], [-0.065, 0.35], [0, 0.2], [0, 0.28], [0, 0.33], [0, 0.38], [0.045, 0.19], [0.05, 0.26],
  [0.055, 0.31], [0.06, 0.34], [0.085, 0.16], [0.095, 0.21], [0.1, 0.25], [0.105, 0.28]];   // an open hand, upright
const at = (cx) => P.map(([x, y]) => ({ x: cx + x / 1.78 * 1.2, y: 0.75 - y * 1.2, z: 0 }));
hands.feed({ landmarks: [at(0.3), at(0.7)], handedness: [[{ categoryName: 'Right' }], [{ categoryName: 'Left' }]],
  gestures: [[{ categoryName: 'Open_Palm', score: 0.7 }], [{ categoryName: 'Open_Palm', score: 0.7 }]] }, 0);
hands.feed({ landmarks: [at(0.3), at(0.7)], handedness: [[{ categoryName: 'Right' }], [{ categoryName: 'Left' }]],
  gestures: [[{ categoryName: 'Open_Palm', score: 0.7 }], [{ categoryName: 'Open_Palm', score: 0.7 }]] }, 100);

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 225);
hands.overlay(ctx, 400, 225);
console.log(hands.features.right.gesture.name, hands.features.both.distance.toFixed(2));`,
        caption: { en: 'Two open hands are fed in without a camera and drawn with what the tracker measures: green and yellow skeletons, the pinch value on each, OPEN 0.70 under each wrist and a dashed line between the palms with their distance. The console prints `open` and the distance.', zh: '不開鏡頭，直接餵進兩隻張開的手，畫出追蹤器量到的東西：綠色和黃色的骨架、每隻手的捏合數值、手腕下方的 OPEN 0.70，以及兩個手掌之間的虛線和距離。主控台印出 `open` 和距離。' },
      },
    ],
    related: ['PoseTracker', 'Signals', 'Mapper', 'LeapInput', 'createShow'],
    keywords: {
      en: ['hands', 'hand tracking', 'pinch', 'gesture', 'fist', 'victory', 'thumb up', 'fingers', 'camera', 'webcam', 'mediapipe', 'landmarks', 'thumb index', 'openness', 'hand angle', 'two hands', 'palm'],
      zh: ['手', '手部追蹤', '捏合', '捏一下', '手勢', '握拳', '比 YA', '比讚', '手指', '鏡頭', '網路攝影機', 'mediapipe', '關節點', '拇指食指', '張開', '手的角度', '雙手距離', '掌心'],
    },
  },
};
