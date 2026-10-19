// @openav/record reference: the performance video, the work's sound, the event log and MIDI takes.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The keys are the public names the code has (tools/reference/scan.mjs reads them); a key the code does not have is a red test.
// Module examples run as ES modules in the reference smoke, with an import map for every @openav/* package, a <div id="app">,
// a 400x300 <canvas id="c"> and a fake camera and microphone.

export default {
  // ------------------------------------------------------------------------------------------------ the video
  Compositor: {
    group: 'record',
    summary: {
      en: "Draws your work and the performer's camera into one canvas of an exact size, every frame: the canvas that a Recorder records.",
      zh: '每個畫面把你的作品和表演者的鏡頭畫進一張尺寸精確的畫布：這張畫布就是 Recorder 要錄的那張。',
    },
    params: [
      { name: 'size', type: 'String | Object | Number[]', optional: true, default: "'vertical-1080p'", en: 'The size of the output, which is the size of the file. A preset id from [`PRESETS`](#PRESETS) (`\'vertical-4k\'`), `\'1080x1920\'`, `[w, h]` or `{ w, h }`. Each side is rounded up to an even number. See [`resolveSize()`](#resolveSize).', zh: '輸出的尺寸，也就是檔案的尺寸。可以是 [`PRESETS`](#PRESETS) 的 id（`\'vertical-4k\'`）、`\'1080x1920\'`、`[w, h]` 或 `{ w, h }`。每一邊都會進位成偶數。見 [`resolveSize()`](#resolveSize)。' },
      { name: 'layout', type: 'String', optional: true, default: "'stack'", en: 'Where the work and the camera go: `stack`, `pip`, `side` or `work` (see [`LAYOUTS`](#LAYOUTS)).', zh: '作品和鏡頭放在哪裡：`stack`、`pip`、`side`、`work`（見 [`LAYOUTS`](#LAYOUTS)）。' },
      { name: 'layoutOptions', type: 'Object', optional: true, default: '{}', en: 'Passed on to [`layoutRects()`](#layoutRects): `fit`, `camFit`, `camAnchor`, `minCam`, `split`, `pip`.', zh: '原封不動交給 [`layoutRects()`](#layoutRects)：`fit`、`camFit`、`camAnchor`、`minCam`、`split`、`pip`。' },
      { name: 'getWorkCanvas', type: 'Function', optional: true, default: 'null', en: 'Returns the canvas of your work, or `null`. It is asked every frame, because a p5 sketch may replace its canvas and a WebGL work may resize it. The compositor never owns the work.', zh: '回傳你的作品的畫布，或 `null`。每個畫面都會問一次，因為 p5 草圖可能換掉畫布，WebGL 作品可能改變大小。合成器從來不擁有作品。' },
      { name: 'background', type: 'String', optional: true, default: "'#000'", en: 'The colour behind everything, any canvas colour string.', zh: '所有東西後面的顏色，任何畫布能用的顏色字串。' },
      { name: 'mirrorCam', type: 'Boolean', optional: true, default: 'true', en: 'Show the camera as a mirror, as performers expect. Keep it equal to the `mirror` of a hand tracker drawn on top.', zh: '把鏡頭顯示成鏡子，這是表演者習慣的樣子。要跟畫在上面的手部追蹤的 `mirror` 保持一樣。' },
      { name: 'maxFps', type: 'Number', optional: true, default: '60', en: 'Draw at most this often when running. A 120 Hz display does not need 120 composites a second.', zh: '跑起來的時候最多這麼頻繁地畫。120 Hz 的螢幕不需要每秒合成 120 次。' },
      { name: 'onDraw', type: 'Function', optional: true, default: 'null', en: '`onDraw(ctx, rects, comp)`, called after the work and the camera are drawn, to put an overlay on top. A context state is saved and restored around it. An error in it is warned about once and does not stop the recording.', zh: '`onDraw(ctx, rects, comp)`，作品和鏡頭畫好之後呼叫，用來在最上面再蓋一層。呼叫前後會保存和還原繪圖狀態。裡面出錯只會警告一次，不會中斷錄影。' },
      { name: 'canvas', type: 'HTMLCanvasElement', optional: true, default: 'null', en: 'Draw into this canvas instead of making a new one. Its width and height are set to the output size.', zh: '畫進這張畫布，不另外做新的。它的寬高會被設成輸出的尺寸。' },
    ],
    description: [
      {
        en: "A performance video is two things in one picture: your work and the performer. The `Compositor` makes that picture. It owns a canvas (`comp.canvas`) of exactly the size of the file you want, whatever your window is, so a vertical 4K video from a laptop really is 4K. It is the canvas you hand to a [`Recorder`](#Recorder). To show it on the page as a preview, put `comp.canvas` in the DOM and shrink it with CSS.",
        zh: "表演影片是同一個畫面裡的兩件事：你的作品和表演者。`Compositor` 就是做這個畫面的。它擁有一張畫布（`comp.canvas`），大小就是你要的檔案大小，跟你的視窗多大無關，所以在筆電上錄的直式 4K 影片真的是 4K。把這張畫布交給 [`Recorder`](#Recorder)。要在頁面上預覽，就把 `comp.canvas` 放進 DOM，再用 CSS 縮小。",
      },
      {
        en: "`comp.start()` redraws every animation frame (and, because a hidden tab freezes animation frames, from a Web Worker timer too, so a recording does not freeze with the tab). `comp.draw()` draws one frame now: call it yourself right after your work renders if you have your own loop. `comp.rects` is the last layout, `{ work, cam }` in output pixels, and `comp.fps` is the rate it has been drawing at.",
        zh: "`comp.start()` 每個動畫畫面重畫一次（而且因為被藏起來的分頁會凍結動畫畫面，所以也用 Web Worker 的計時器畫，這樣錄影不會跟著分頁一起凍住）。`comp.draw()` 馬上畫一個畫面：如果你有自己的迴圈，就在作品畫完之後自己呼叫它。`comp.rects` 是最近一次的版面，`{ work, cam }`，單位是輸出的像素，`comp.fps` 是它實際畫的頻率。",
      },
      {
        en: "The camera is optional and never owned: `setCamera(stream)` shows it and `setCamera(null)` lets go, and you stop the tracks yourself. The camera's area can show a **panel** instead, anything with `draw(ctx, rect, now)`, for example a drawing of the controller being played. The area for the camera is reserved before the camera arrives, so the picture does not jump.",
        zh: "鏡頭是選用的，而且合成器不擁有它：`setCamera(stream)` 顯示它，`setCamera(null)` 放手，音軌由你自己停。鏡頭的區域也可以改放一個**面板**，也就是任何有 `draw(ctx, rect, now)` 的東西，例如一張正在彈的控制器的圖。鏡頭的區域會在鏡頭來之前就先留好，所以畫面不會跳動。",
      },
    ],
    notes: [
      {
        en: "A WebGL work: the compositor copies its canvas in the same animation frame it was drawn in, which works in Chrome. If you see black, create the WebGL context with `preserveDrawingBuffer: true`, or call `comp.draw()` right after your render and do not call `start()`.",
        zh: "WebGL 的作品：合成器會在作品畫完的同一個動畫畫面裡複製它的畫布，在 Chrome 上這樣就行。如果看到黑的，就用 `preserveDrawingBuffer: true` 建立 WebGL context，或在你渲染完之後馬上呼叫 `comp.draw()`，並且不要呼叫 `start()`。",
      },
      {
        en: "Webcams usually stop at 1080p30, so a 4K `stack` layout enlarges the camera about 1.6 times. The work above it stays sharp because it is drawn at the output size, as long as the work's own canvas is at least as large as its area.",
        zh: "網路攝影機通常只到 1080p30，所以 4K 的 `stack` 版面會把鏡頭放大約 1.6 倍。上面的作品是照輸出尺寸畫的，只要作品自己的畫布至少跟它的區域一樣大，就會保持清楚。",
      },
      {
        en: "In a p5 sketch you do not need this: [`startRecording()`](#startRecording) records the canvas and its sound for you. The `Compositor` is for a page that records the work together with a camera.",
        zh: "在 p5 草圖裡用不到這個：[`startRecording()`](#startRecording) 會替你錄畫布和它的聲音。`Compositor` 是給要把作品和鏡頭一起錄的頁面用的。",
      },
    ],
    members: {
      size: { en: 'Getter. The output size `{ w, h }`, which is the size of `comp.canvas`.', zh: 'Getter。輸出尺寸 `{ w, h }`，也就是 `comp.canvas` 的大小。' },
      setSize: { en: 'Changes the output size (the same values as the `size` option). Do it between takes: a recorder that is already running keeps the size it started with. Returns the compositor.', zh: '改變輸出尺寸（值跟 `size` 選項一樣）。要在兩次錄影之間做：已經在跑的錄影器會保持它開始時的尺寸。回傳合成器本身。' },
      setLayout: { en: 'Changes the layout and, if you pass `options`, merges them into `layoutOptions` (the `pip` object is merged too). Throws for a name that is not in [`LAYOUTS`](#LAYOUTS). Returns the compositor.', zh: '改變版面，如果有給 `options`，就合併進 `layoutOptions`（`pip` 物件也會合併）。名字不在 [`LAYOUTS`](#LAYOUTS) 裡會丟出錯誤。回傳合成器本身。' },
      video: { en: 'Getter. The `<video>` element the camera plays in, or `null` when there is none. Use it for a separate monitor.', zh: 'Getter。鏡頭播放用的 `<video>` 元素，沒有鏡頭就是 `null`。可以拿來做另外一個監看畫面。' },
      cameraSize: { en: 'Getter. The camera\'s size `{ w, h }` once it plays, otherwise `null`.', zh: 'Getter。鏡頭開始播之後的尺寸 `{ w, h }`，否則是 `null`。' },
      setCamera: { en: 'Shows a camera: a `MediaStream` (played in a hidden muted `<video>` made here), a `<video>` or a canvas, drawn as it is. `null` removes it, and its tracks keep running. Returns a promise of the camera size `{ w, h }` once frames arrive, or `null` (no camera, or none within 5 seconds).', zh: '顯示一個鏡頭：可以是 `MediaStream`（會用這裡建的一個隱藏、靜音的 `<video>` 播放）、`<video>` 或畫布，照原樣畫。`null` 是移除，它的音軌會繼續跑。回傳一個 promise，畫面來了就 resolve 成鏡頭尺寸 `{ w, h }`，沒有鏡頭或 5 秒內沒畫面就是 `null`。' },
      panel: { en: 'Getter. The panel drawn in the camera\'s area, or `null` (the camera is shown).', zh: 'Getter。畫在鏡頭區域的面板，或 `null`（顯示的是鏡頭）。' },
      setPanel: { en: 'Draws a panel where the camera goes: `{ draw(ctx, rect, now), aspect }`. `draw` is called every frame with a context clipped to the area, `rect` is `{ x, y, w, h }` in output pixels and `aspect` (width divided by height, default 16/9) shapes a picture-in-picture corner. `setPanel(null)` brings the camera back, which stayed attached. The compositor never disposes a panel. Throws if the panel has no `draw`.', zh: '把面板畫在鏡頭的位置：`{ draw(ctx, rect, now), aspect }`。`draw` 每個畫面都會被呼叫，繪圖範圍被裁成那個區域，`rect` 是輸出像素的 `{ x, y, w, h }`，`aspect`（寬除以高，預設 16/9）決定子母畫面角落的形狀。`setPanel(null)` 把鏡頭換回來，它一直都連著。合成器不會替你 dispose 面板。面板沒有 `draw` 會丟出錯誤。' },
      draw: { en: 'Draws one frame now and returns the rects `{ work, cam }`. Call it right after your work renders if you run your own loop.', zh: '馬上畫一個畫面，並回傳版面 `{ work, cam }`。如果你有自己的迴圈，就在作品渲染完之後呼叫。' },
      drawOnCamera: { en: 'Draws over the camera in the camera\'s own coordinates: `fn(ctx, w, h)` gets a context moved to where the whole camera frame lands and clipped to the visible camera area, which is what a hand or pose tracker\'s `skeleton(ctx, w, h)` expects. Call it from `onDraw`. Does nothing without a camera, or with a panel in its place.', zh: '用鏡頭自己的座標畫在鏡頭上面：`fn(ctx, w, h)` 拿到的繪圖環境，原點移到整個鏡頭畫面落下的位置，並且裁在看得到的鏡頭區域裡，手部或姿態追蹤的 `skeleton(ctx, w, h)` 要的就是這個。在 `onDraw` 裡呼叫。沒有鏡頭，或位置上放的是面板，就什麼都不做。' },
      start: { en: 'Redraws every animation frame (at most `maxFps` a second), and from a Web Worker timer while the tab is hidden. Returns the compositor.', zh: '每個動畫畫面重畫一次（每秒最多 `maxFps` 次），分頁被藏起來的時候改由 Web Worker 的計時器畫。回傳合成器本身。' },
      stop: { en: 'Stops redrawing. Returns the compositor.', zh: '停止重畫。回傳合成器本身。' },
      dispose: { en: 'Stops and lets go of the camera (its tracks are yours to stop).', zh: '停止並放開鏡頭（音軌要由你自己停）。' },
    },
    examples: [
      {
        code: `import { Compositor } from '@openav/record';

const work = document.createElement('canvas');          // the work: any canvas
work.width = 600; work.height = 600;
const g = work.getContext('2d');
g.fillStyle = '#c33'; g.fillRect(0, 0, 600, 600);

const comp = new Compositor({ size: '540x960', layout: 'stack', getWorkCanvas: () => work });
const rects = comp.draw();                               // one frame, now
console.log(comp.size, rects.work.h, rects.cam.box.h);   // { w: 540, h: 960 } 540 420

comp.canvas.style.width = '135px';                       // a preview, scaled down with CSS
document.getElementById('app').append(comp.canvas);`,
        caption: { en: 'A square work is drawn into a 540 by 960 frame: the work takes the top 540 pixels and 420 are kept for the camera. The result appears on the page as a small preview.', zh: '把一個正方形的作品畫進 540 乘 960 的畫面：作品佔上面 540 像素，下面 420 像素留給鏡頭。結果以小預覽的樣子出現在頁面上。' },
      },
      {
        code: `import { Compositor, openCamera } from '@openav/record';

const work = document.getElementById('c');              // the 400 x 300 canvas of the page
const wg = work.getContext('2d');
const comp = new Compositor({ size: 'landscape-1080p', layout: 'pip', getWorkCanvas: () => work,
  layoutOptions: { pip: { corner: 'br', size: 0.25 } } });
comp.start();                                           // redraws every frame
const size = await comp.setCamera(await openCamera());  // the browser asks for the camera
console.log(size, comp.rects.cam.w);                    // { w: 1920, h: 1080 } 480 (what the camera gives may differ)

let x = 0;
(function animate() {                                   // the work moves, the composite follows
  wg.fillStyle = '#111'; wg.fillRect(0, 0, 400, 300);
  wg.fillStyle = '#ffd166'; wg.fillRect(x = (x + 4) % 380, 120, 20, 60);
  requestAnimationFrame(animate);
})();
comp.canvas.style.width = '480px';
document.getElementById('app').append(comp.canvas);`,
        caption: { en: 'The animated canvas fills a 1080p frame with the camera in a corner. Allow the camera when the browser asks; the composite appears below the work.', zh: '會動的畫布鋪滿 1080p 的畫面，鏡頭在一個角落。瀏覽器問的時候允許鏡頭。合成的結果會出現在作品下面。' },
      },
      {
        code: `import { Compositor } from '@openav/record';

const work = document.getElementById('c');
const comp = new Compositor({
  size: [720, 720], layout: 'work', getWorkCanvas: () => work,
  onDraw(ctx, rects) {                                   // an overlay, on top of everything
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '32px sans-serif';
    ctx.fillText('take 1', rects.work.x + 20, rects.work.y + 48);
  },
});
work.getContext('2d').fillRect(0, 0, 400, 300);
comp.draw();
document.getElementById('app').append(comp.canvas);
comp.canvas.style.width = '240px';`,
        caption: { en: 'The work alone in a square frame, with a caption written over it by `onDraw`. The caption is part of the picture, so it is in the recording.', zh: '作品單獨放在正方形畫面裡，上面由 `onDraw` 寫了一行字。這行字是畫面的一部分，所以會被錄進影片。' },
      },
    ],
    related: ['Recorder', 'layoutRects', 'PRESETS', 'openCamera', 'AudioTap', 'startRecording'],
    keywords: {
      en: ['compositor', 'composite', 'camera', 'webcam', 'canvas', 'layout', 'picture in picture', 'pip', 'stack', 'vertical video'],
      zh: ['合成器', '合成', '鏡頭', '網路攝影機', '畫布', '版面', '子母畫面', '直式影片', '錄影', '鏡像'],
    },
  },

  Recorder: {
    group: 'record',
    summary: {
      en: 'Records a canvas, together with the sound you give it, into one video file with one MediaRecorder, so picture and sound stay in sync.',
      zh: '用一個 MediaRecorder 把一張畫布連同你給它的聲音錄成一個影片檔，所以畫面和聲音保持同步。',
    },
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', optional: true, default: 'null', en: 'What to record, usually `compositor.canvas`.', zh: '要錄什麼，通常是 `compositor.canvas`。' },
      { name: 'stream', type: 'MediaStream', optional: true, default: 'null', en: 'A ready video stream to record instead of a canvas.', zh: '要錄的現成影像串流，用來取代畫布。' },
      { name: 'fps', type: 'Number', optional: true, default: '60', en: 'The capture rate of the canvas. Use [`recommendedFps(w, h)`](#recommendedFps): 30 for 2.7K and 4K.', zh: '畫布的擷取頻率。用 [`recommendedFps(w, h)`](#recommendedFps)：2.7K 和 4K 是 30。' },
      { name: 'audioTracks', type: 'MediaStreamTrack[]', optional: true, default: '[]', en: 'The sound, for example `tap.tracks` of an [`AudioTap`](#AudioTap). Several tracks are mixed into one, because Chrome records only the first audio track of a stream.', zh: '聲音，例如 [`AudioTap`](#AudioTap) 的 `tap.tracks`。給好幾條會混成一條，因為 Chrome 只會錄一個串流的第一條音軌。' },
      { name: 'audioOnly', type: 'Boolean', optional: true, default: 'false', en: 'Record only the audio tracks: the sound as a file of its own. Then `canvas` and `stream` are not needed.', zh: '只錄音軌：把聲音另外存成一個檔。這時不需要 `canvas` 和 `stream`。' },
      { name: 'videoBitsPerSecond', type: 'Number', optional: true, en: 'The video bitrate. The default is [`recommendedBitrate()`](#recommendedBitrate) of the canvas size and `fps` (12 Mb/s when there is no canvas).', zh: '影像位元率。預設是依畫布尺寸和 `fps` 算出的 [`recommendedBitrate()`](#recommendedBitrate)（沒有畫布的話是 12 Mb/s）。' },
      { name: 'audioBitsPerSecond', type: 'Number', optional: true, default: '192000', en: 'The audio bitrate.', zh: '聲音位元率。' },
      { name: 'mimeType', type: 'String', optional: true, en: 'Force one MIME type. The default is the first one the browser supports from [`VIDEO_MIMES`](#VIDEO_MIMES) or [`AUDIO_MIMES`](#AUDIO_MIMES), see [`pickMime()`](#pickMime).', zh: '強制用某一個 MIME 型別。預設是瀏覽器支援的第一個 [`VIDEO_MIMES`](#VIDEO_MIMES) 或 [`AUDIO_MIMES`](#AUDIO_MIMES)，見 [`pickMime()`](#pickMime)。' },
      { name: 'prefer', type: "'mp4' | 'webm'", optional: true, default: 'null', en: 'Try this container first when picking the MIME type.', zh: '挑 MIME 型別的時候先試這種容器。' },
    ],
    description: [
      {
        en: "`new Recorder({ canvas, audioTracks })` then `start()` and, later, `await stop()`. The canvas track and the audio track go into the same `MediaRecorder`, which stamps both from one clock: nothing has to be lined up afterwards. `stop()` resolves, after the last chunk, with `{ mimeType, ext, bytes, chunks, durationMs, width, height, fps, audio, blob, error }`: the `blob` is the file, `ext` the extension to give it (`mp4`, `webm`, `m4a`…), `audio` whether it has sound. Give the blob to `URL.createObjectURL()` for a download link.",
        zh: "`new Recorder({ canvas, audioTracks })`，然後 `start()`，之後 `await stop()`。畫布的影像軌和聲音軌進的是同一個 `MediaRecorder`，它用同一個時鐘替兩者打時間戳記，所以事後不用對齊。`stop()` 在最後一塊資料到了之後 resolve，內容是 `{ mimeType, ext, bytes, chunks, durationMs, width, height, fps, audio, blob, error }`：`blob` 就是檔案，`ext` 是該用的副檔名（`mp4`、`webm`、`m4a`…），`audio` 是有沒有聲音。把 blob 交給 `URL.createObjectURL()` 就能做下載連結。",
      },
      {
        en: "Which file you get depends on the browser: it records MP4 (H.264 and AAC) when it can, WebM otherwise. A WebM from Chrome has no duration in its header; players cope, editors may want `ffmpeg -i in.webm -c copy out.webm`. The file is a master to edit, so the default bitrate is high.",
        zh: "拿到什麼檔案看瀏覽器：能錄 MP4（H.264 和 AAC）就錄 MP4，不行就錄 WebM。Chrome 錄出來的 WebM 檔頭沒有長度，播放器沒問題，剪輯軟體可能需要 `ffmpeg -i in.webm -c copy out.webm`。這個檔案是拿來剪輯的母帶，所以預設的位元率偏高。",
      },
      {
        en: "To keep a long take out of the tab's memory, pass `ondata(blob, seq)` to `start()`: each chunk (every `timeslice` ms) is handed over in order, and a promise you return is awaited before the next chunk and before `stop()` resolves, so uploads stay ordered. With `ondata` the chunks are not kept and `blob` is `null`, unless you pass `keep: true`. To line a take up with an [`EventLog`](#EventLog), start the log with `recorder.t0`, the `performance.now()` of the moment recording started.",
        zh: "要讓很長的一段錄影不佔著分頁的記憶體，就在 `start()` 傳 `ondata(blob, seq)`：每一塊資料（每隔 `timeslice` 毫秒）會依序交給你，你回傳的 promise 會在下一塊、以及 `stop()` resolve 之前被等待，所以上傳的順序不會亂。有給 `ondata` 的話資料塊不會保留，`blob` 是 `null`，除非你傳 `keep: true`。要讓一段錄影跟 [`EventLog`](#EventLog) 對齊，就用 `recorder.t0` 來開始事件記錄，它是開始錄影那一刻的 `performance.now()`。",
      },
    ],
    needs: {
      en: "A browser with `MediaRecorder` (`Recorder.supported` tells), and a canvas or a stream, or `audioOnly: true`: otherwise the constructor throws a `TypeError`. Mixing several audio tracks makes an `AudioContext`, which needs the page to have had a click. A camera or microphone in the stream needs the user's permission, as always.",
      zh: "需要有 `MediaRecorder` 的瀏覽器（`Recorder.supported` 會告訴你），也要有畫布或串流，或 `audioOnly: true`：否則建構時會丟出 `TypeError`。混好幾條音軌會建一個 `AudioContext`，頁面需要先被點過一次。串流裡有鏡頭或麥克風的話，一樣需要使用者許可。",
    },
    tbd: [
      {
        en: "Whether data arrives while the recording is still running depends on the container and the browser. In headless Chromium, writing MP4, `bytes` stayed 0 for a one-second take with a `timeslice` of 200 and the chunks came at `stop()`. Other browsers and WebM were not tried.",
        zh: "錄影進行中資料會不會陸續送來，要看容器和瀏覽器。在 headless Chromium 錄 MP4 的時候，一秒鐘的錄影、`timeslice` 設 200，`bytes` 一直是 0，資料塊是在 `stop()` 時才來。其他瀏覽器和 WebM 沒有試過。",
      },
    ],
    members: {
      state: { en: 'Getter. `\'inactive\'`, `\'recording\'` or `\'paused\'`.', zh: 'Getter。`\'inactive\'`、`\'recording\'` 或 `\'paused\'`。' },
      recording: { en: 'Getter. Whether `state` is `\'recording\'`.', zh: 'Getter。`state` 是不是 `\'recording\'`。' },
      elapsed: { en: 'Getter. Milliseconds since `start()` while recording, the length of the take once stopped, 0 before.', zh: 'Getter。錄影中是從 `start()` 算起的毫秒數，停止之後是這段錄影的長度，開始之前是 0。' },
      bytes: { en: 'Getter. Bytes handed over so far. Some browsers hand over the data only when you stop, so it can stay 0 during a short take.', zh: 'Getter。到目前為止交出來的位元組數。有些瀏覽器只在停止時才交資料，所以很短的錄影過程中它可能一直是 0。' },
      start: { en: 'Starts recording and returns the recorder. `{ timeslice = 1000, ondata, keep }`: how often (ms) a chunk is handed over, a function for each chunk, and whether to keep the chunks for the `blob`. Starting a recorder that already records does nothing. Throws if the browser has no `MediaRecorder`.', zh: '開始錄影並回傳錄影器。`{ timeslice = 1000, ondata, keep }`：每隔多久（毫秒）交一塊資料、每一塊要呼叫的函式，以及要不要留下資料塊做成 `blob`。對已經在錄的錄影器再開始不會有作用。瀏覽器沒有 `MediaRecorder` 會丟出錯誤。' },
      stop: { en: 'Stops, waits for the last chunk and every `ondata` promise, stops the canvas track it made and returns a promise of the result object. Calling it again returns the same result. Throws if the recorder was never started.', zh: '停止，等最後一塊資料和每個 `ondata` 的 promise，停掉它自己建的畫布影像軌，並回傳結果物件的 promise。再呼叫一次會回傳同一個結果。從沒開始過就呼叫會丟出錯誤。' },
      supported: { en: 'Static getter. True when this browser can record a canvas: it has `MediaRecorder` and `canvas.captureStream`.', zh: 'Static getter。這個瀏覽器能不能錄畫布：有 `MediaRecorder` 和 `canvas.captureStream` 就是 true。' },
    },
    examples: [
      {
        code: `import { Recorder } from '@openav/record';

const canvas = document.getElementById('c');
const g = canvas.getContext('2d');
let x = 0;
(function animate() {                          // something moving to record
  g.fillStyle = '#111'; g.fillRect(0, 0, 400, 300);
  g.fillStyle = '#ffd166'; g.fillRect(x = (x + 5) % 380, 120, 20, 60);
  requestAnimationFrame(animate);
})();

const rec = new Recorder({ canvas, fps: 30 });
rec.start();
await new Promise((done) => setTimeout(done, 1000));   // record for one second
const take = await rec.stop();
console.log(take.ext, take.width, take.height, take.fps, take.audio, take.blob.size > 0);
// mp4 400 300 30 false true   (webm where the browser cannot write mp4)

const a = document.getElementById('app').appendChild(document.createElement('a'));
a.href = URL.createObjectURL(take.blob); a.download = 'take.' + take.ext; a.textContent = 'Download';`,
        caption: { en: 'Records one second of the moving square and logs what the file is. A Download link appears on the page.', zh: '錄一秒鐘會動的方塊，印出這個檔案是什麼。頁面上出現一個下載連結。' },
      },
      {
        code: `import { Recorder, AudioTap } from '@openav/record';

const tap = new AudioTap();                                  // the sound that goes into the file
const osc = new OscillatorNode(tap.context, { frequency: 220 });
tap.add(osc); osc.start();
await tap.resume();                                          // from a click, in a real page

const video = new Recorder({ canvas: document.getElementById('c'), fps: 30, audioTracks: tap.tracks });
const sound = new Recorder({ audioOnly: true, audioTracks: tap.workTracks });   // the sound as its own file
video.start(); sound.start();
await new Promise((done) => setTimeout(done, 1000));
const [v, a] = await Promise.all([video.stop(), sound.stop()]);
console.log(v.ext, v.audio, a.ext, a.width);   // mp4 true m4a 0`,
        caption: { en: 'One second of video with a 220 Hz tone in it, and the same tone as a separate audio file. The picture and the sound of the video enter the same recorder.', zh: '一秒鐘的影片，裡面有一個 220 Hz 的音，同一個音另外存成一個聲音檔。影片的畫面和聲音進的是同一個錄影器。' },
      },
      {
        code: `import { Recorder } from '@openav/record';

const chunks = [];
const rec = new Recorder({ canvas: document.getElementById('c'), fps: 30 });
rec.start({
  timeslice: 250,
  ondata: async (blob, seq) => { chunks.push(blob.size); },   // send it somewhere here; the next chunk waits
});
await new Promise((done) => setTimeout(done, 1000));
const take = await rec.stop();
console.log(take.blob, take.chunks === chunks.length, take.bytes === chunks.reduce((a, b) => a + b, 0));   // null true true`,
        caption: { en: 'With `ondata` the chunks are handed to you one by one, in order, and the result carries no `blob`: this is how a long take stays out of the tab\'s memory.', zh: '有給 `ondata` 的話，資料塊會依序一塊一塊交給你，結果裡沒有 `blob`：長時間的錄影就是這樣不佔分頁的記憶體。' },
      },
    ],
    related: ['Compositor', 'AudioTap', 'EventLog', 'pickMime', 'recommendedFps', 'startRecording', 'stopRecording'],
    keywords: {
      en: ['record', 'recorder', 'mediarecorder', 'video', 'mp4', 'webm', 'canvas capture', 'audio', 'download', 'blob'],
      zh: ['錄影', '錄影器', '影片', 'mp4', 'webm', '畫布擷取', '聲音', '下載', 'blob', '錄製'],
    },
  },

  AudioTap: {
    group: 'record',
    summary: {
      en: "Collects the sound of your work (and, if you add it, a microphone) into one recordable track, without sending anything to the speakers.",
      zh: '把你的作品的聲音（以及你加進來的麥克風）收集成一條可以錄的音軌，不會把任何東西送到喇叭。',
    },
    params: [
      { name: 'context', type: 'AudioContext', optional: true, default: 'null', en: 'The `AudioContext` to mix in, usually the work\'s own. One is made if you leave it out; it needs Web Audio to exist.', zh: '要在哪個 `AudioContext` 裡混音，通常是作品自己的。沒給的話會新建一個，需要瀏覽器有 Web Audio。' },
      { name: 'sources', type: 'Array', optional: true, default: '[]', en: 'Things to add to the work bus at once: `AudioNode`s, `MediaStream`s or `MediaStreamTrack`s (see `add()`).', zh: '要馬上加進作品匯流排的東西：`AudioNode`、`MediaStream` 或 `MediaStreamTrack`（見 `add()`）。' },
      { name: 'captureDestination', type: 'Boolean', optional: true, default: 'false', en: 'Also call `captureDestination()` right away.', zh: '同時馬上呼叫 `captureDestination()`。' },
    ],
    description: [
      {
        en: "Recording the speakers with a microphone gives you the room. Tapping the Web Audio graph gives you the instrument exactly as it was synthesized, on the same clock as the canvas. An `AudioTap` has two buses and two outputs. The **work** bus is the sound of the piece; the **extra** bus is for things that belong in the video but not in the sound file, such as a microphone. `tap.stream` and `tap.tracks` are work and extras together (give them to the video [`Recorder`](#Recorder)); `tap.workStream` and `tap.workTracks` are the work alone (for the separate audio file). Both are a single track, on purpose: Chrome records only the first audio track of a stream.",
        zh: "用麥克風錄喇叭，錄到的是房間。接上 Web Audio 的節點圖，錄到的是樂器合成出來的原樣，而且跟畫布用同一個時鐘。`AudioTap` 有兩條匯流排和兩個輸出。**work** 匯流排是作品的聲音，**extra** 匯流排放的是該在影片裡、卻不該在聲音檔裡的東西，例如麥克風。`tap.stream` 和 `tap.tracks` 是 work 加 extra（交給影片的 [`Recorder`](#Recorder)），`tap.workStream` 和 `tap.workTracks` 只有 work（給另外存的聲音檔）。兩個都只有一條音軌，這是故意的：Chrome 只會錄一個串流的第一條音軌。",
      },
      {
        en: "The tap never routes anything to the speakers, so adding a microphone cannot feed back. To record a sketch you did not write (p5.sound, Tone.js, [`Sound`](#Sound)), call `captureDestination()` **before** the work starts its sound: from then on every node that connects to a speaker destination is tapped too.",
        zh: "這個 tap 絕不會把東西送到喇叭，所以加麥克風不會產生回授。要錄不是你寫的草圖（p5.sound、Tone.js、[`Sound`](#Sound)），就在作品開始出聲**之前**呼叫 `captureDestination()`：從那時起，每個接到喇叭的節點也會被接進來。",
      },
    ],
    needs: {
      en: "An `AudioContext` that is running. Browsers start audio only after a click, so call `tap.resume()` from a click handler. Without the click the tracks exist but carry silence.",
      zh: "要有正在跑的 `AudioContext`。瀏覽器要點擊過才讓聲音開始，所以在點擊的處理函式裡呼叫 `tap.resume()`。沒有點擊的話，音軌雖然存在，裡面是靜音。",
    },
    members: {
      stream: { en: 'Getter. A `MediaStream` of the work and the extras mixed, one audio track. Give it to the video recorder.', zh: 'Getter。作品加額外聲音混好的 `MediaStream`，只有一條音軌。交給影片的錄影器。' },
      workStream: { en: 'Getter. A `MediaStream` of the work alone, one audio track: the separate audio file.', zh: 'Getter。只有作品的 `MediaStream`，一條音軌：給另外存的聲音檔。' },
      tracks: { en: 'Getter. The audio tracks of `stream` (one): `new Recorder({ audioTracks: tap.tracks })`.', zh: 'Getter。`stream` 的音軌（一條）：`new Recorder({ audioTracks: tap.tracks })`。' },
      workTracks: { en: 'Getter. The audio tracks of `workStream` (one).', zh: 'Getter。`workStream` 的音軌（一條）。' },
      add: { en: 'Taps a source: `add(source, { bus = \'work\', gain = 1 })`. A node of this tap\'s context is connected directly, a node of another `AudioContext` is bridged through a `MediaStream`, and a `MediaStream` or `MediaStreamTrack` is brought in as a source node. `bus: \'extra\'` reaches the video only. Returns a function that removes it. Throws a `TypeError` for anything else.', zh: '接上一個來源：`add(source, { bus = \'work\', gain = 1 })`。這個 tap 的 context 的節點直接接，別的 `AudioContext` 的節點經由 `MediaStream` 橋接，`MediaStream` 或 `MediaStreamTrack` 當作來源節點接進來。`bus: \'extra\'` 只會進到影片。回傳一個把它移除的函式。給其他東西會丟出 `TypeError`。' },
      captureDestination: { en: 'From now on, every node that connects to an `AudioDestinationNode` (the speakers), in any context, is tapped too, by a hook on `AudioNode.prototype.connect`. Install it **before** the work starts its sound: a node connected earlier is invisible. It can be called again without doubling. Returns a function that uninstalls it.', zh: '從現在起，每個接到 `AudioDestinationNode`（喇叭）的節點，不論在哪個 context，都會被接進來，做法是掛在 `AudioNode.prototype.connect` 上的一個鉤子。要在作品開始出聲**之前**裝好：先接上的節點看不到。重複呼叫不會加倍。回傳一個把它拆掉的函式。' },
      addMicrophone: { en: 'Adds a microphone (or any audio input) to the video\'s mix, not to the audio file. `{ deviceId, gain = 1, echoCancellation = false, noiseSuppression = false, autoGainControl = false }`: those three are off by default because they eat piano attacks and room tone. Returns a promise of the `MediaStream`. A microphone added before is replaced. Needs the user\'s permission.', zh: '把麥克風（或任何音訊輸入）加進影片的混音，不加進聲音檔。`{ deviceId, gain = 1, echoCancellation = false, noiseSuppression = false, autoGainControl = false }`：那三項預設關掉，因為它們會吃掉鋼琴的起音和房間的底噪。回傳 `MediaStream` 的 promise。先前加過的麥克風會被換掉。需要使用者許可。' },
      removeMicrophone: { en: 'Takes the microphone out of the mix and stops it, unless you pass `{ stop: false }`.', zh: '把麥克風從混音裡拿掉並停止它，除非你傳 `{ stop: false }`。' },
      level: { en: 'The peak level of the mix right now, 0..1: for a "sound is reaching the recording" meter.', zh: '混音現在的峰值音量，0..1：給「聲音有進到錄影裡」的指示用。' },
      resume: { en: 'Resumes a suspended context; call it from a click. Returns a promise.', zh: '叫醒被暫停的 context。要在點擊裡呼叫。回傳一個 promise。' },
      dispose: { en: 'Lets go of everything the tap made, including the hook and the microphone. The context itself is left alone.', zh: '放開 tap 建立的所有東西，包括鉤子和麥克風。context 本身不動。' },
    },
    examples: [
      {
        code: `import { AudioTap } from '@openav/record';

const tap = new AudioTap();                              // makes its own AudioContext
const osc = new OscillatorNode(tap.context, { frequency: 440 });
const remove = tap.add(osc);                             // the work bus
osc.start();
await tap.resume();                                      // from a click in a real page
await new Promise((done) => setTimeout(done, 300));
console.log(tap.tracks.length, tap.workTracks.length);   // 1 1
console.log(tap.level() > 0.1);                          // true: sound is reaching the recording
remove();`,
        caption: { en: 'A 440 Hz tone is tapped and the meter confirms that sound reaches the recording. The tracks are ready to hand to a Recorder.', zh: '接上一個 440 Hz 的音，指示確認聲音有進到錄影裡。音軌已經可以交給 Recorder。' },
      },
      {
        code: `import { AudioTap } from '@openav/record';

const tap = new AudioTap();
const uninstall = tap.captureDestination();              // before the work starts its sound

const ctx = new AudioContext();                          // "someone else's" sketch, in its own context
const osc = new OscillatorNode(ctx, { frequency: 330 });
osc.connect(ctx.destination);                            // goes to the speakers, and into the tap
osc.start();
await new Promise((done) => setTimeout(done, 300));
console.log(tap.level() > 0.05);                         // true
uninstall();
tap.dispose();`,
        caption: { en: 'A sound made in another AudioContext, connected to the speakers the usual way, is picked up by the tap too: this is how you record a sketch you did not write.', zh: '另一個 AudioContext 裡的聲音，照平常接到喇叭，tap 也收得到：錄不是你寫的草圖就是這樣做。' },
      },
    ],
    related: ['Recorder', 'mixTracks', 'Compositor', 'Sound', 'startRecording'],
    keywords: {
      en: ['audio tap', 'record sound', 'web audio', 'mix', 'capture', 'speakers', 'tone.js', 'p5.sound', 'track', 'stream'],
      zh: ['收音', '錄聲音', 'web audio', '混音', '擷取', '喇叭', '音軌', '串流'],
    },
  },

  mixTracks: {
    group: 'record',
    summary: {
      en: 'Mixes several audio tracks into one, because Chrome records only the first audio track of a stream.',
      zh: '把好幾條音軌混成一條，因為 Chrome 只會錄一個串流的第一條音軌。',
    },
    params: [
      { name: 'tracks', type: 'MediaStreamTrack[]', en: 'The audio tracks to mix.', zh: '要混的音軌。' },
    ],
    returns: { type: 'Object', en: '`{ track, close() }`: the one mixed `MediaStreamTrack`, and a function that closes the `AudioContext` that mixes it.', zh: '`{ track, close() }`：混好的那一條 `MediaStreamTrack`，以及關掉混音用的 `AudioContext` 的函式。' },
    description: [
      {
        en: "A [`Recorder`](#Recorder) calls this itself when you give it more than one live audio track, and closes the mix on `stop()`. Call it yourself when you want the one track for something else. It makes an `AudioContext`, so the page needs to have had a click. For several sounds that come from Web Audio nodes, [`AudioTap`](#AudioTap) is the better tool: it mixes them without a detour through streams.",
        zh: "你給 [`Recorder`](#Recorder) 超過一條活著的音軌時，它會自己呼叫這個，並在 `stop()` 時關掉混音。想把那一條音軌拿去做別的事時，才自己呼叫。它會建一個 `AudioContext`，所以頁面需要先被點過一次。如果聲音是來自 Web Audio 節點，用 [`AudioTap`](#AudioTap) 比較好：它直接混，不用繞一圈串流。",
      },
    ],
    examples: [
      {
        code: `import { AudioTap, mixTracks } from '@openav/record';

const tap = new AudioTap();
const mix = mixTracks([tap.tracks[0], tap.workTracks[0]]);   // two tracks in, one comes out
console.log(mix.track.kind, mix.track.readyState);            // audio live
mix.close();                                                  // closes the mixing context
tap.dispose();`,
        caption: { en: 'Two audio tracks go in and one live audio track comes out; `close()` shuts the mixer down.', zh: '兩條音軌進去，出來一條活的音軌。`close()` 把混音器關掉。' },
      },
    ],
    related: ['Recorder', 'AudioTap'],
    keywords: {
      en: ['mix', 'merge', 'audio tracks', 'combine', 'chrome first track', 'mediastream'],
      zh: ['混音', '合併', '音軌', '合成一條', 'mediastream'],
    },
  },

  // ------------------------------------------------------------------------------------------------ layout and sizes
  LAYOUTS: {
    group: 'record',
    summary: {
      en: "The four layout names, in picker order: `'stack'`, `'pip'`, `'side'`, `'work'`.",
      zh: "四種版面的名字，照選單的順序：`'stack'`、`'pip'`、`'side'`、`'work'`。",
    },
    value: {
      type: 'String[]',
      en: '`[\'stack\', \'pip\', \'side\', \'work\']`, a frozen-by-convention list (do not change it).',
      zh: '`[\'stack\', \'pip\', \'side\', \'work\']`，一份約定不要修改的清單。',
    },
    description: [
      {
        en: "`stack`: the work across the full width at the top, the camera fills the rest below (for vertical video: Reels, Shorts, TikTok). `pip`: the work fills the frame and the camera is a rounded inset in a corner (for square frames, or a work that needs all of the frame). `side`: the work at full height on the left, the camera fills the right (landscape). `work`: the work alone. [`layoutRects()`](#layoutRects) says exactly where everything lands, and the `layout` option of the [`Compositor`](#Compositor) takes one of these names; any other name throws.",
        zh: "`stack`：作品橫跨整個寬度放在上面，鏡頭填滿下面剩下的（給直式影片：Reels、Shorts、TikTok）。`pip`：作品鋪滿畫面，鏡頭是角落的圓角小視窗（給正方形畫面，或需要整個畫面的作品）。`side`：作品佔滿左邊的整個高度，鏡頭填滿右邊（橫式）。`work`：只有作品。確切的位置由 [`layoutRects()`](#layoutRects) 算出，[`Compositor`](#Compositor) 的 `layout` 選項收的就是這幾個名字，其他名字會丟出錯誤。",
      },
    ],
    examples: [
      {
        code: `import { LAYOUTS, layoutRects } from '@openav/record';

console.log(LAYOUTS.join(' '));                                    // stack pip side work
for (const name of LAYOUTS) {
  const r = layoutRects(name, { w: 1080, h: 1920 }, { workW: 1000, workH: 1000, camW: 1920, camH: 1080 });
  console.log(name, r.work.w + 'x' + r.work.h, r.cam ? r.cam.w + 'x' + r.cam.h : 'no camera');
}
// stack 1080x1080 1080x840
// pip 1080x1080 324x182
// side 648x648 432x1920   (a vertical frame is too narrow for side: the work gets 60% of the width)
// work 1080x1080 no camera`,
        caption: { en: 'Runs the four layouts on one vertical frame with a square work and a 16:9 camera, and logs the size of each area.', zh: '在同一個直式畫面上，用正方形的作品和 16:9 的鏡頭跑過四種版面，印出每個區域的大小。' },
      },
    ],
    related: ['layoutRects', 'Compositor', 'PRESETS'],
    keywords: {
      en: ['layout', 'stack', 'pip', 'side', 'picture in picture', 'work', 'arrangement', 'camera position'],
      zh: ['版面', '堆疊', '子母畫面', '並排', '鏡頭位置', '排版'],
    },
  },

  PRESETS: {
    group: 'record',
    summary: {
      en: 'The output sizes the compositor knows by name, from `vertical-1080p` (1080 by 1920) to `landscape-4k`, each with its suggested layout and frame rate.',
      zh: '合成器認得名字的輸出尺寸，從 `vertical-1080p`（1080 乘 1920）到 `landscape-4k`，每個都附建議的版面和畫格率。',
    },
    value: {
      type: 'Object[]',
      en: 'A frozen list of 11 presets. Each is `{ id, group, w, h, label, labelZh, layout, fps }`: `group` is `\'vertical\'`, `\'landscape\'` or `\'square\'`, `label` and `labelZh` are names for a picker, `layout` is the layout suggested for the shape and `fps` is [`recommendedFps()`](#recommendedFps).',
      zh: '一份凍結的清單，有 11 個預設。每個是 `{ id, group, w, h, label, labelZh, layout, fps }`：`group` 是 `\'vertical\'`、`\'landscape\'` 或 `\'square\'`，`label` 和 `labelZh` 是給選單用的名字，`layout` 是這種形狀建議的版面，`fps` 是 [`recommendedFps()`](#recommendedFps)。',
    },
    description: [
      {
        en: "```text\nid                 size        fps   layout\nvertical-1080p     1080x1920   60    stack\nvertical-4x5       1440x1800   60    stack\nvertical-2.7k      1520x2704   30    stack\nvertical-4k        2160x3840   30    stack\nlandscape-1080p    1920x1080   60    side\nlandscape-16x10    1920x1200   60    side\nlandscape-2.7k     2704x1520   30    side\nlandscape-4k       3840x2160   30    side\nsquare-1080        1080x1080   60    pip\nsquare-2048        2048x2048   30    pip\nsquare-2160        2160x2160   30    pip\n```",
        zh: "```text\nid                 尺寸        fps   版面\nvertical-1080p     1080x1920   60    stack\nvertical-4x5       1440x1800   60    stack\nvertical-2.7k      1520x2704   30    stack\nvertical-4k        2160x3840   30    stack\nlandscape-1080p    1920x1080   60    side\nlandscape-16x10    1920x1200   60    side\nlandscape-2.7k     2704x1520   30    side\nlandscape-4k       3840x2160   30    side\nsquare-1080        1080x1080   60    pip\nsquare-2048        2048x2048   30    pip\nsquare-2160        2160x2160   30    pip\n```",
      },
      {
        en: "Every side is even, because H.264 and VP9 encode 4:2:0 colour, which needs even sizes. Use an id as the `size` of a [`Compositor`](#Compositor); [`presetById()`](#presetById) looks one up.",
        zh: "每一邊都是偶數，因為 H.264 和 VP9 用 4:2:0 的色彩編碼，需要偶數的尺寸。可以把 id 當作 [`Compositor`](#Compositor) 的 `size`。用 [`presetById()`](#presetById) 查某一個。",
      },
    ],
    examples: [
      {
        code: `import { PRESETS } from '@openav/record';

console.log(PRESETS.length, PRESETS[0].id);                      // 11 vertical-1080p
const big = PRESETS.filter((p) => p.w * p.h > 2.6e6).map((p) => p.id + ' @' + p.fps);
console.log(big.join(', '));
// vertical-2.7k @30, vertical-4k @30, landscape-2.7k @30, landscape-4k @30, square-2048 @30, square-2160 @30`,
        caption: { en: 'Lists the presets that are bigger than about 2.6 megapixels: all of them are recorded at 30 frames a second.', zh: '列出大於約 260 萬像素的預設：它們全都用每秒 30 個畫面來錄。' },
      },
    ],
    related: ['presetById', 'resolveSize', 'recommendedFps', 'Compositor'],
    keywords: {
      en: ['sizes', 'presets', '1080p', '4k', 'vertical', 'landscape', 'square', 'resolution', '9:16', 'reels'],
      zh: ['尺寸', '預設', '1080p', '4k', '直式', '橫式', '方形', '解析度', '9:16', '輸出尺寸'],
    },
  },

  presetById: {
    group: 'record',
    summary: {
      en: "Finds one size preset by its id: `presetById('vertical-4k')`.",
      zh: "用 id 找出一個尺寸預設：`presetById('vertical-4k')`。",
    },
    params: [
      { name: 'id', type: 'String', en: 'The preset id, for example `\'square-1080\'`.', zh: '預設的 id，例如 `\'square-1080\'`。' },
    ],
    returns: { type: 'Object | null', en: 'The preset `{ id, group, w, h, label, labelZh, layout, fps }`, or `null` if there is no such id.', zh: '那個預設 `{ id, group, w, h, label, labelZh, layout, fps }`，沒有這個 id 就是 `null`。' },
    description: [
      {
        en: "Use it to fill a size picker with [`PRESETS`](#PRESETS), or to read the suggested frame rate and layout of a size before you build a [`Compositor`](#Compositor).",
        zh: "拿來為尺寸選單填上 [`PRESETS`](#PRESETS) 的內容，或在建 [`Compositor`](#Compositor) 之前讀一個尺寸建議的畫格率和版面。",
      },
    ],
    examples: [
      {
        code: `import { presetById } from '@openav/record';

const p = presetById('vertical-4k');
console.log(p.w, p.h, p.fps, p.layout);   // 2160 3840 30 stack
console.log(presetById('nope'));           // null`,
        caption: { en: 'Logs the numbers of one preset and shows that an unknown id gives `null`.', zh: '印出一個預設的各個數字，並顯示不認識的 id 會得到 `null`。' },
      },
    ],
    related: ['PRESETS', 'resolveSize'],
    keywords: {
      en: ['preset', 'lookup', 'size by id', 'find size', 'output size'],
      zh: ['預設', '查詢', '用 id 找尺寸', '輸出尺寸'],
    },
  },

  resolveSize: {
    group: 'record',
    summary: {
      en: "Turns any way of naming a size, like 'vertical-4k', '1080x1920' or [w, h], into { w, h }, rounded up to even numbers.",
      zh: "把任何寫尺寸的方式，像 'vertical-4k'、'1080x1920' 或 [w, h]，變成 { w, h }，並進位成偶數。",
    },
    params: [
      { name: 'size', type: 'String | Number[] | Object', en: 'A preset id from [`PRESETS`](#PRESETS), `\'WxH\'` (also with `×` or `*`), `[w, h]` or `{ w, h }`.', zh: '[`PRESETS`](#PRESETS) 的 id、`\'WxH\'`（也可以用 `×` 或 `*`）、`[w, h]` 或 `{ w, h }`。' },
    ],
    returns: { type: 'Object', en: '`{ w, h }`, whole numbers, each rounded up to the next even number.', zh: '`{ w, h }`，整數，各自進位到下一個偶數。' },
    description: [
      {
        en: "It is what the [`Compositor`](#Compositor) uses for its `size` and `setSize()`. A size that cannot be read (`'wat'`, a negative number, a missing side) throws a `TypeError`: `record: unknown size \"wat\"`. Even sizes matter because H.264 and VP9 encode 4:2:0 colour.",
        zh: "[`Compositor`](#Compositor) 的 `size` 和 `setSize()` 用的就是它。讀不懂的尺寸（`'wat'`、負數、少一邊）會丟出 `TypeError`：`record: unknown size \"wat\"`。尺寸要偶數，是因為 H.264 和 VP9 用 4:2:0 的色彩編碼。",
      },
    ],
    examples: [
      {
        code: `import { resolveSize } from '@openav/record';

console.log(resolveSize('vertical-4k'));      // { w: 2160, h: 3840 }
console.log(resolveSize('1081x1921'));        // { w: 1082, h: 1922 }
console.log(resolveSize([1000, 563]));        // { w: 1000, h: 564 }
try { resolveSize('wat'); } catch (e) { console.log(e.message); }   // record: unknown size "wat"`,
        caption: { en: 'Four ways of naming a size: a preset, text, a list, and a mistake that throws. Odd sides become even.', zh: '四種寫尺寸的方式：預設、文字、陣列，和一個會丟出錯誤的寫法。奇數的邊會變成偶數。' },
      },
    ],
    related: ['PRESETS', 'presetById', 'Compositor', 'layoutRects'],
    keywords: {
      en: ['size', 'resolution', 'even', 'width height', 'parse size', 'normalize'],
      zh: ['尺寸', '解析度', '偶數', '寬高', '解析尺寸', '正規化'],
    },
  },

  recommendedFps: {
    group: 'record',
    summary: {
      en: 'The frame rate to record a frame size at: 60 up to about 2.6 megapixels, 30 above that.',
      zh: '一個畫面尺寸該用什麼畫格率來錄：到約 260 萬像素是 60，再大就是 30。',
    },
    params: [
      { name: 'w', type: 'Number', en: 'Width in pixels.', zh: '寬，單位是像素。' },
      { name: 'h', type: 'Number', en: 'Height in pixels.', zh: '高，單位是像素。' },
    ],
    returns: { type: '30 | 60', en: '60 when `w × h` is at most 2 600 000 pixels, otherwise 30.', zh: '`w × h` 不超過 2 600 000 像素是 60，否則是 30。' },
    description: [
      {
        en: "60 fps holds up to about 1080 by 1920 (and 1440 by 1800, 1920 by 1200). A 4K canvas at 60 means 500 million pixels a second through the compositor and the encoder, which drops frames on a laptop in the middle of a performance, and 30 is what cameras shoot 4K at anyway. Pass the result as `fps` to a [`Recorder`](#Recorder).",
        zh: "60 fps 可以撐到約 1080 乘 1920（以及 1440 乘 1800、1920 乘 1200）。4K 的畫布用 60 的話，合成器和編碼器每秒要處理 5 億個像素，在筆電上表演到一半會掉格，而且相機拍 4K 本來也是 30。把結果當作 `fps` 交給 [`Recorder`](#Recorder)。",
      },
    ],
    examples: [
      {
        code: `import { recommendedFps } from '@openav/record';

console.log(recommendedFps(1080, 1920));   // 60
console.log(recommendedFps(2160, 3840));   // 30
console.log(recommendedFps(1920, 1200));   // 60`,
        caption: { en: 'Logs the rate for a 1080p vertical frame, a 4K vertical frame and a 16:10 landscape frame.', zh: '印出 1080p 直式、4K 直式和 16:10 橫式畫面的畫格率。' },
      },
    ],
    related: ['recommendedBitrate', 'Recorder', 'PRESETS'],
    keywords: {
      en: ['fps', 'frame rate', '60', '30', '4k', 'performance', 'dropped frames'],
      zh: ['畫格率', 'fps', '每秒幾格', '4k', '掉格'],
    },
  },

  recommendedBitrate: {
    group: 'record',
    summary: {
      en: 'A video bitrate that keeps fast generative detail clean: 0.12 bits per pixel per frame, held between 4 and 80 Mb/s.',
      zh: '能讓快速的生成式細節保持乾淨的影像位元率：每個像素每個畫面 0.12 位元，限制在 4 到 80 Mb/s。',
    },
    params: [
      { name: 'w', type: 'Number', en: 'Width in pixels.', zh: '寬，單位是像素。' },
      { name: 'h', type: 'Number', en: 'Height in pixels.', zh: '高，單位是像素。' },
      { name: 'fps', type: 'Number', optional: true, default: 'recommendedFps(w, h)', en: 'The frame rate. Left out, it is [`recommendedFps()`](#recommendedFps) for the size.', zh: '畫格率。沒給的話，用這個尺寸的 [`recommendedFps()`](#recommendedFps)。' },
    ],
    returns: { type: 'Number', en: 'Bits per second, rounded to 100 000. 1080 by 1920 at 60 fps is 14 900 000, 4K at 30 fps is 29 900 000.', zh: '每秒位元數，四捨五入到 100 000。1080 乘 1920、60 fps 是 14 900 000，4K、30 fps 是 29 900 000。' },
    description: [
      {
        en: "Particles and thin lines are the first things a low bitrate smears, so this is higher than a streaming bitrate on purpose: the file is a master that will be edited and encoded again. It is the default `videoBitsPerSecond` of a [`Recorder`](#Recorder) that records a canvas.",
        zh: "粒子和細線是位元率太低時最先被糊掉的東西，所以這個數字刻意比串流的位元率高：這個檔案是要再剪輯、再編碼的母帶。它是錄畫布的 [`Recorder`](#Recorder) 的 `videoBitsPerSecond` 預設值。",
      },
    ],
    examples: [
      {
        code: `import { recommendedBitrate } from '@openav/record';

const mbps = (w, h, fps) => (recommendedBitrate(w, h, fps) / 1e6).toFixed(1) + ' Mb/s';
console.log(mbps(1080, 1920));       // 14.9 Mb/s
console.log(mbps(2160, 3840));       // 29.9 Mb/s
console.log(mbps(320, 240));         // 4.0 Mb/s, the floor
console.log(mbps(3840, 2160, 60));   // 59.7 Mb/s`,
        caption: { en: 'The bitrate for a few sizes, in megabits per second: the floor of 4 holds for a tiny frame, and asking for 60 fps at 4K doubles the number.', zh: '幾種尺寸的位元率，單位是每秒百萬位元：很小的畫面會停在下限 4，4K 要 60 fps 的話數字會加倍。' },
      },
    ],
    related: ['recommendedFps', 'Recorder'],
    keywords: {
      en: ['bitrate', 'quality', 'video bitrate', 'mbps', 'compression', 'master'],
      zh: ['位元率', '畫質', '影像位元率', '壓縮', '母帶'],
    },
  },

  layoutRects: {
    group: 'record',
    summary: {
      en: 'Works out where the work and the camera go in an output frame, in whole pixels, for one of the four layouts.',
      zh: '算出作品和鏡頭在輸出畫面的哪裡，單位是整數像素，支援四種版面。',
    },
    params: [
      { name: 'layout', type: 'String', en: 'One of [`LAYOUTS`](#LAYOUTS). Any other name throws a `TypeError`.', zh: '[`LAYOUTS`](#LAYOUTS) 其中之一。其他名字會丟出 `TypeError`。' },
      { name: 'out', type: 'Object', en: 'The output size `{ w, h }` in pixels. It must be positive, or this throws.', zh: '輸出尺寸 `{ w, h }`，單位是像素。必須是正數，否則會丟出錯誤。' },
      { name: 'src', type: 'Object', optional: true, default: '{}', en: 'The sizes of the sources: `{ workW, workH, camW, camH }`. A missing or zero value means unknown. An unknown work counts as square. With an unknown camera the camera\'s area is still reserved, with `crop: null` and `frame: null`, so the frame does not jump when the camera arrives.', zh: '來源的尺寸：`{ workW, workH, camW, camH }`。沒給或是 0 就表示不知道。不知道尺寸的作品當作正方形。鏡頭尺寸不知道時，鏡頭的區域還是會先留好，`crop: null`、`frame: null`，所以鏡頭來的時候畫面不會跳動。' },
      { name: 'opts', type: 'Object', optional: true, default: '{}', en: 'Options: `fit` (`\'contain\'` default, or `\'cover\'`, for the work), `camFit` (`\'cover\'` default, or `\'contain\'`), `camAnchor` (`{ x, y }`, 0..1, default the middle: which part a cover-crop keeps, in what you see), `minCam` (0.2: the share of the height in `stack`, or of the width in `side`, that the camera must keep), `split` (0.6: the work\'s share when it would leave the camera less than `minCam`) and `pip` (`{ corner: \'br\' | \'bl\' | \'tr\' | \'tl\', size: 0.3, margin: 0.03, radius: 0.08, aspect: 0 }`: the inset\'s width as a share of the frame, its distance from the corner as a share of the short side, its corner radius as a share of the inset\'s short side, and its shape, 0 being the camera\'s own).', zh: '選項：`fit`（作品，預設 `\'contain\'`，或 `\'cover\'`）、`camFit`（預設 `\'cover\'`，或 `\'contain\'`）、`camAnchor`（`{ x, y }`，0..1，預設在中間：滿版裁切時保留哪一部分，是你看到的畫面裡的位置）、`minCam`（0.2：`stack` 裡鏡頭至少要留的高度比例，`side` 裡是寬度比例）、`split`（0.6：留給鏡頭的比 `minCam` 還少時，作品佔的比例）、`pip`（`{ corner: \'br\' | \'bl\' | \'tr\' | \'tl\', size: 0.3, margin: 0.03, radius: 0.08, aspect: 0 }`：小視窗寬度佔畫面的比例、離角落的距離佔短邊的比例、圓角半徑佔小視窗短邊的比例，以及形狀，0 表示用鏡頭自己的比例）。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ layout, out, work, cam }`. `work` and `cam` are `{ x, y, w, h, crop, frame, box }` in output pixels (all whole numbers), and `cam` also has `radius`. `crop` is the part of the source that is drawn (source pixels, may be fractional) or `null` for the whole source. `frame` is where the whole source frame would land, cropped parts falling outside the rect, which is what overlays need. `box` is the area it was placed in. `cam` is `null` for the `work` layout.',
      zh: '`{ layout, out, work, cam }`。`work` 和 `cam` 是輸出像素的 `{ x, y, w, h, crop, frame, box }`（全是整數），`cam` 還多一個 `radius`。`crop` 是來源被畫出來的那一塊（來源像素，可以有小數），整張都畫就是 `null`。`frame` 是整個來源畫面會落在哪裡，被裁掉的部分在矩形外面，疊圖需要它。`box` 是它被放進的區域。`work` 版面的 `cam` 是 `null`。',
    },
    description: [
      {
        en: "It is pure arithmetic: no DOM, no clock. The [`Compositor`](#Compositor) calls it whenever a size changes. A 1080 by 1920 frame with a square work and `stack` splits into exactly 1080 by 1080 and 1080 by 840, with no seam row. The crop of a camera is in the **displayed** orientation, so with the mirror on, an anchor of `x: 0.2` still means \"keep the left of what you see\".",
        zh: "這是純算術：沒有 DOM、沒有時鐘。[`Compositor`](#Compositor) 在尺寸改變時就呼叫它。1080 乘 1920 的畫面放一個正方形的作品、用 `stack`，會剛好切成 1080 乘 1080 和 1080 乘 840，中間沒有縫。鏡頭的裁切是用**顯示出來的**方向表示的，所以開了鏡像之後，`x: 0.2` 的錨點仍然是「保留你看到的畫面的左邊」。",
      },
      {
        en: "`stack` puts the work across the full width at the top and the camera below. If that would leave the camera under `minCam` of the height (a square or landscape frame), the work gets `split` of the height and is letterboxed in it. `side` is the same turned sideways. `pip` fills the frame with the work and puts the camera in a corner as a rounded inset. `work` is the work alone.",
        zh: "`stack` 把作品橫跨整個寬度放在上面，鏡頭在下面。如果這樣留給鏡頭的高度不到 `minCam`（正方形或橫式畫面），作品就只佔高度的 `split`，並且在裡面留黑邊。`side` 是同樣的做法轉九十度。`pip` 讓作品鋪滿畫面，把鏡頭放在角落當圓角小視窗。`work` 只有作品。",
      },
    ],
    examples: [
      {
        code: `import { layoutRects } from '@openav/record';

const r = layoutRects('stack', { w: 1080, h: 1920 }, { workW: 1000, workH: 1000, camW: 1920, camH: 1080 });
console.log(r.work.x, r.work.y, r.work.w, r.work.h);   // 0 0 1080 1080
console.log(r.cam.x, r.cam.y, r.cam.w, r.cam.h);       // 0 1080 1080 840
console.log(r.cam.crop);                                 // the middle of the 16:9 camera that fills 1080x840`,
        caption: { en: 'A square work and a 16:9 camera in a vertical frame: the work is the top 1080 pixels, the camera fills the 840 below it with a middle crop.', zh: '直式畫面裡放正方形的作品和 16:9 的鏡頭：作品是上面 1080 像素，鏡頭用中間的裁切填滿它下面的 840。' },
      },
      {
        code: `import { layoutRects } from '@openav/record';

const pip = layoutRects('pip', { w: 1920, h: 1080 }, { workW: 1920, workH: 1080, camW: 1280, camH: 720 },
  { pip: { corner: 'tl', size: 0.25 } });
console.log(pip.cam.x, pip.cam.y, pip.cam.w, pip.cam.h, pip.cam.radius);   // 32 32 480 270 22

const noCam = layoutRects('stack', { w: 1080, h: 1920 }, { workW: 1000, workH: 1000 });
console.log(noCam.cam.h, noCam.cam.crop, noCam.cam.frame);                  // 840 null null: the area is reserved
try { layoutRects('grid', { w: 10, h: 10 }); } catch (e) { console.log(e.message); }
// layoutRects: unknown layout "grid" (stack, pip, side, work)`,
        caption: { en: 'A picture-in-picture in the top-left corner, the reserved camera area before a camera exists, and the error for a layout that does not exist.', zh: '左上角的子母畫面、鏡頭還不存在時先留好的鏡頭區域，以及不存在的版面會得到的錯誤。' },
      },
    ],
    related: ['LAYOUTS', 'framePoint', 'Compositor', 'resolveSize'],
    keywords: {
      en: ['layout', 'rects', 'crop', 'cover', 'contain', 'letterbox', 'pip', 'stack', 'side', 'geometry'],
      zh: ['版面', '矩形', '裁切', '滿版', '黑邊', '子母畫面', '幾何', '畫面', '鏡頭區域'],
    },
  },

  framePoint: {
    group: 'record',
    summary: {
      en: "Turns a point in the camera's own 0..1 coordinates, like a hand landmark, into a pixel in the output frame.",
      zh: '把鏡頭自己的 0..1 座標裡的一個點，像手的關節點，換成輸出畫面裡的像素。',
    },
    params: [
      { name: 'camRect', type: 'Object | null', en: 'The `cam` of [`layoutRects()`](#layoutRects), or of `compositor.rects`.', zh: '[`layoutRects()`](#layoutRects) 的 `cam`，或 `compositor.rects` 的 `cam`。' },
      { name: 'u', type: 'Number', en: 'Across the camera picture, 0 left to 1 right, in the displayed (mirrored if `mirrorCam`) orientation.', zh: '橫跨鏡頭畫面，0 是左、1 是右，用顯示出來的方向（有 `mirrorCam` 就是鏡像後的）。' },
      { name: 'v', type: 'Number', en: 'Down the camera picture, 0 top to 1 bottom.', zh: '沿著鏡頭畫面往下，0 是上、1 是下。' },
    ],
    returns: { type: 'Object | null', en: '`{ x, y }` in output pixels, or `null` when there is no camera (or its size is not known yet).', zh: '輸出像素的 `{ x, y }`，沒有鏡頭（或還不知道它的尺寸）就是 `null`。' },
    description: [
      {
        en: "Landmarks from a hand or pose tracker come as fractions of the camera picture. To draw something on the output at the place a landmark is, you need pixels of the output, where the camera may be enlarged and cropped. `framePoint()` does that. It gives the same point whether or not part of the camera is cropped away, because it uses `frame`, the whole camera picture placed in the output. Use the same `mirror` in the tracker and in the compositor.",
        zh: "手部或姿態追蹤給的關節點是鏡頭畫面的比例。要在輸出上、關節點所在的位置畫東西，需要的是輸出畫面的像素，而鏡頭可能被放大和裁切。`framePoint()` 就是做這件事。不管鏡頭有沒有被裁掉一部分，它給的點都是對的，因為它用的是 `frame`，也就是整個鏡頭畫面放進輸出之後的位置。追蹤器和合成器要用同樣的 `mirror`。",
      },
    ],
    examples: [
      {
        code: `import { layoutRects, framePoint } from '@openav/record';

const r = layoutRects('stack', { w: 1080, h: 1920 }, { workW: 1000, workH: 1000, camW: 1920, camH: 1080 });
console.log(framePoint(r.cam, 0.5, 0.5));    // { x: 540, y: 1500 }: the middle of the camera
console.log(framePoint(r.cam, 0, 0));        // { x: -206.67, y: 1080 }: the left edge is cropped away, off the frame
console.log(framePoint(null, 0.5, 0.5));     // null: no camera`,
        caption: { en: 'The centre of the camera lands in the middle of its area. The camera\'s left edge is outside the frame because the 16:9 picture is cropped to fit.', zh: '鏡頭的中心落在它的區域中間。鏡頭的左邊緣在畫面外面，因為 16:9 的畫面為了塞進去被裁掉了。' },
      },
    ],
    related: ['layoutRects', 'Compositor'],
    keywords: {
      en: ['landmark', 'hand tracking', 'pose', 'overlay', 'coordinates', 'camera to output', 'skeleton'],
      zh: ['關節點', '手部追蹤', '姿態', '疊加', '座標', '鏡頭座標轉輸出', '骨架'],
    },
  },

  // ------------------------------------------------------------------------------------------------ file types
  VIDEO_MIMES: {
    group: 'record',
    summary: {
      en: 'The video MIME types the recorder tries, best first: MP4 with H.264 and AAC, then WebM.',
      zh: '錄影器會依序嘗試的影片 MIME 型別，最好的在前：先是 H.264 加 AAC 的 MP4，再來是 WebM。',
    },
    value: {
      type: 'String[]',
      en: 'A frozen list of 6 strings: `video/mp4;codecs=avc1.640033,mp4a.40.2`, `video/mp4;codecs=avc1,mp4a`, `video/webm;codecs=vp9,opus`, `video/webm;codecs=vp8,opus`, `video/webm`, `video/mp4`.',
      zh: '一份凍結的清單，有 6 個字串：`video/mp4;codecs=avc1.640033,mp4a.40.2`、`video/mp4;codecs=avc1,mp4a`、`video/webm;codecs=vp9,opus`、`video/webm;codecs=vp8,opus`、`video/webm`、`video/mp4`。',
    },
    description: [
      {
        en: "MP4 comes first because it opens everywhere a performance video goes next (an editor, Instagram, a phone's gallery) without a remux, and Chrome encodes H.264 in hardware. The first string asks for a profile (`avc1.640033`, High profile level 5.1, enough for 4K at 30 and 1080 by 1920 at 60) because Chrome says no to the generic `avc1,mp4a` but yes to the qualified one, so both are in the list for other browsers. Plain `video/mp4` is for Safari. [`pickMime()`](#pickMime) walks this list.",
        zh: "MP4 排第一，因為表演影片接下來要去的地方（剪輯軟體、Instagram、手機相簿）都能直接開，不用重新封裝，而且 Chrome 用硬體編 H.264。第一個字串指定了 profile（`avc1.640033`，High profile level 5.1，夠 4K 30 和 1080 乘 1920 60 用），因為 Chrome 對籠統的 `avc1,mp4a` 回答不行、對指定 profile 的卻回答可以，所以兩個都放進清單給別的瀏覽器用。單純的 `video/mp4` 是給 Safari 的。[`pickMime()`](#pickMime) 就是走過這份清單。",
      },
    ],
    examples: [
      {
        code: `import { VIDEO_MIMES, pickMime } from '@openav/record';

console.log(VIDEO_MIMES.length, VIDEO_MIMES[0]);   // 6 video/mp4;codecs=avc1.640033,mp4a.40.2
console.log(pickMime((m) => MediaRecorder.isTypeSupported(m)) || '(the browser chooses)');`,
        caption: { en: 'Logs the first candidate, and which one this browser would use.', zh: '印出第一個候選，以及這個瀏覽器實際會用哪一個。' },
      },
    ],
    related: ['AUDIO_MIMES', 'pickMime', 'extFor', 'Recorder'],
    keywords: {
      en: ['mime', 'mp4', 'webm', 'h264', 'codec', 'container', 'video format', 'candidates'],
      zh: ['mime', 'mp4', 'webm', 'h264', '編碼', '容器', '影片格式', '候選'],
    },
  },

  AUDIO_MIMES: {
    group: 'record',
    summary: {
      en: 'The audio MIME types the recorder tries for a sound-only file, best first: AAC in .m4a, then Opus.',
      zh: '只錄聲音的檔案時，錄影器會依序嘗試的音訊 MIME 型別，最好的在前：先是 .m4a 的 AAC，再來是 Opus。',
    },
    value: {
      type: 'String[]',
      en: 'A frozen list of 5 strings: `audio/mp4;codecs=mp4a.40.2`, `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/mp4`, `audio/webm`.',
      zh: '一份凍結的清單，有 5 個字串：`audio/mp4;codecs=mp4a.40.2`、`audio/webm;codecs=opus`、`audio/ogg;codecs=opus`、`audio/mp4`、`audio/webm`。',
    },
    description: [
      {
        en: "AAC in an `.m4a` file comes first because it imports into every DAW and editor. This is the list a [`Recorder`](#Recorder) with `audioOnly: true` uses, through [`pickMime()`](#pickMime).",
        zh: "AAC 的 `.m4a` 檔排第一，因為它每個 DAW 和剪輯軟體都能匯入。`audioOnly: true` 的 [`Recorder`](#Recorder) 用的就是這份清單，透過 [`pickMime()`](#pickMime)。",
      },
    ],
    examples: [
      {
        code: `import { AUDIO_MIMES, pickMime, extFor } from '@openav/record';

const mime = pickMime((m) => MediaRecorder.isTypeSupported(m), { audioOnly: true });
console.log(AUDIO_MIMES[0]);        // audio/mp4;codecs=mp4a.40.2
console.log(mime, extFor(mime));    // the one this browser would use, and its file extension`,
        caption: { en: 'Logs the best candidate for a sound file, and the one this browser would pick with its extension.', zh: '印出聲音檔最好的候選，以及這個瀏覽器實際會挑的那一個和它的副檔名。' },
      },
    ],
    related: ['VIDEO_MIMES', 'pickMime', 'extFor', 'Recorder'],
    keywords: {
      en: ['mime', 'm4a', 'aac', 'opus', 'audio format', 'sound file', 'candidates'],
      zh: ['mime', 'm4a', 'aac', 'opus', '音訊格式', '聲音檔', '候選'],
    },
  },

  pickMime: {
    group: 'record',
    summary: {
      en: "Picks the first MIME type from a list that the browser can record, using the browser's own check.",
      zh: '用瀏覽器自己的檢查，從清單裡挑出第一個瀏覽器錄得了的 MIME 型別。',
    },
    params: [
      { name: 'isTypeSupported', type: 'Function', en: 'The browser\'s check, for example `(m) => MediaRecorder.isTypeSupported(m)`. Not a function gives `\'\'`. A check that throws counts as "no" for that type.', zh: '瀏覽器的檢查函式，例如 `(m) => MediaRecorder.isTypeSupported(m)`。給的不是函式就回傳 `\'\'`。丟出錯誤的檢查，對那個型別算「不行」。' },
      { name: 'audioOnly', type: 'Boolean', optional: true, default: 'false', en: 'Use [`AUDIO_MIMES`](#AUDIO_MIMES) instead of [`VIDEO_MIMES`](#VIDEO_MIMES).', zh: '用 [`AUDIO_MIMES`](#AUDIO_MIMES) 而不是 [`VIDEO_MIMES`](#VIDEO_MIMES)。' },
      { name: 'prefer', type: "'mp4' | 'webm'", optional: true, default: 'null', en: 'Move this container to the front, keeping the order inside each group.', zh: '把這種容器移到最前面，兩組各自的內部順序不變。' },
      { name: 'candidates', type: 'String[]', optional: true, default: 'null', en: 'Your own list instead of the built-in one.', zh: '用你自己的清單，取代內建的。' },
    ],
    returns: { type: 'String', en: 'The first supported type, or `\'\'` when none matches (then let `MediaRecorder` choose its default).', zh: '第一個支援的型別，都不符合就回傳 `\'\'`（這時就讓 `MediaRecorder` 用它的預設）。' },
    description: [
      {
        en: "A [`Recorder`](#Recorder) calls this for you. It takes the browser's check as an argument so that it is pure and can be tried with a fake one, like the examples below.",
        zh: "[`Recorder`](#Recorder) 會替你呼叫它。它把瀏覽器的檢查當成參數傳進來，所以是純函式，可以像下面的範例那樣用假的檢查來試。",
      },
    ],
    examples: [
      {
        code: `import { pickMime } from '@openav/record';

const pretend = (...ok) => (mime) => ok.includes(mime);      // a fake browser that supports only these
const both = pretend('video/webm;codecs=vp9,opus', 'video/mp4;codecs=avc1.640033,mp4a.40.2');
console.log(pickMime(both));                                  // video/mp4;codecs=avc1.640033,mp4a.40.2
console.log(pickMime(both, { prefer: 'webm' }));              // video/webm;codecs=vp9,opus
console.log(pickMime(pretend('audio/webm;codecs=opus'), { audioOnly: true }));   // audio/webm;codecs=opus
console.log(JSON.stringify(pickMime(() => false)));           // ""`,
        caption: { en: 'Four fake browsers: one that has both, the same asked to prefer WebM, one that only records Opus, and one that records nothing.', zh: '四個假的瀏覽器：兩種都支援的、同一個但要求優先 WebM、只錄得了 Opus 的，和什麼都錄不了的。' },
      },
    ],
    related: ['VIDEO_MIMES', 'AUDIO_MIMES', 'extFor', 'Recorder'],
    keywords: {
      en: ['mime', 'supported', 'isTypeSupported', 'codec', 'choose format', 'mediarecorder'],
      zh: ['mime', '支援', 'isTypeSupported', '編碼', '挑格式', 'mediarecorder'],
    },
  },

  extFor: {
    group: 'record',
    summary: {
      en: "Gives the file extension for a recorded MIME type: video/mp4 is 'mp4', audio/mp4 is 'm4a', anything unknown is 'bin'.",
      zh: "給一個錄好的 MIME 型別該用的副檔名：video/mp4 是 'mp4'，audio/mp4 是 'm4a'，不認識的是 'bin'。",
    },
    params: [
      { name: 'mime', type: 'String', en: 'A MIME type, with or without codecs, in any letter case. Anything that is not text counts as empty.', zh: 'MIME 型別，有沒有 codecs 都行，大小寫不拘。不是文字的東西當作空字串。' },
    ],
    returns: { type: 'String', en: '`mp4`, `m4a` (audio/mp4), `webm`, `ogg`, `mkv` (video/x-matroska) or `bin`.', zh: '`mp4`、`m4a`（audio/mp4）、`webm`、`ogg`、`mkv`（video/x-matroska）或 `bin`。' },
    description: [
      {
        en: "A [`Recorder`](#Recorder) puts this in the `ext` of its result. Use it for a download name: `'take.' + extFor(blob.type)`.",
        zh: "[`Recorder`](#Recorder) 把它放進結果的 `ext`。拿來取下載檔名：`'take.' + extFor(blob.type)`。",
      },
    ],
    examples: [
      {
        code: `import { extFor } from '@openav/record';

console.log(extFor('video/mp4;codecs=avc1.640033,mp4a.40.2'));   // mp4
console.log(extFor('audio/mp4'), extFor('audio/webm'));           // m4a webm
console.log(extFor('video/x-matroska'), extFor('text/plain'));    // mkv bin`,
        caption: { en: 'Five MIME types and the extension each one gets.', zh: '五個 MIME 型別，和各自拿到的副檔名。' },
      },
    ],
    related: ['pickMime', 'Recorder', 'VIDEO_MIMES', 'AUDIO_MIMES'],
    keywords: {
      en: ['extension', 'file name', 'mime to extension', 'download name', 'mp4', 'm4a', 'webm'],
      zh: ['副檔名', '檔名', 'mime 轉副檔名', '下載檔名', 'mp4', 'm4a', 'webm'],
    },
  },

  // ------------------------------------------------------------------------------------------------ cameras
  cameraConstraints: {
    group: 'record',
    summary: {
      en: 'Builds the getUserMedia options for a camera: it asks for 1920 by 1080 at 30 fps, but only as an ideal, never as a demand.',
      zh: '做出開鏡頭用的 getUserMedia 選項：它要求 1920 乘 1080、30 fps，但只是理想值，不是硬性要求。',
    },
    params: [
      { name: 'deviceId', type: 'String', optional: true, default: "''", en: 'A specific camera, from [`listCameras()`](#listCameras). It is asked for as `exact`: if it is gone, opening fails.', zh: '指定哪一個鏡頭，來自 [`listCameras()`](#listCameras)。用 `exact` 要求：如果它不見了，就會開啟失敗。' },
      { name: 'width', type: 'Number', optional: true, default: '1920', en: 'The width to ask for, as `ideal`.', zh: '想要的寬，用 `ideal` 要求。' },
      { name: 'height', type: 'Number', optional: true, default: '1080', en: 'The height to ask for, as `ideal`.', zh: '想要的高，用 `ideal` 要求。' },
      { name: 'fps', type: 'Number', optional: true, default: '30', en: 'The frame rate to ask for, as `ideal`.', zh: '想要的畫格率，用 `ideal` 要求。' },
      { name: 'facingMode', type: 'String', optional: true, default: "''", en: '`\'user\'` or `\'environment\'` on a phone. Ignored when a `deviceId` is given.', zh: '手機上的 `\'user\'`（前鏡頭）或 `\'environment\'`（後鏡頭）。有給 `deviceId` 時會被忽略。' },
    ],
    returns: { type: 'Object', en: 'A `MediaStreamConstraints`: `{ video: { width: { ideal }, height: { ideal }, frameRate: { ideal }, deviceId?, facingMode? }, audio: false }`.', zh: '一個 `MediaStreamConstraints`：`{ video: { width: { ideal }, height: { ideal }, frameRate: { ideal }, deviceId?, facingMode? }, audio: false }`。' },
    description: [
      {
        en: "Size and rate are `ideal`, never `exact`: a camera that cannot do 1920 by 1080 should open at what it can, not throw in front of an audience. It is pure, so you can look at what [`openCamera()`](#openCamera) will ask for. The stream has no audio: a microphone is added through [`AudioTap`](#AudioTap).",
        zh: "尺寸和畫格率是 `ideal`，不是 `exact`：做不到 1920 乘 1080 的鏡頭應該用它做得到的規格開起來，而不是在觀眾面前丟出錯誤。它是純函式，所以你可以看 [`openCamera()`](#openCamera) 會要求什麼。串流裡沒有聲音：麥克風要透過 [`AudioTap`](#AudioTap) 加。",
      },
    ],
    examples: [
      {
        code: `import { cameraConstraints } from '@openav/record';

console.log(JSON.stringify(cameraConstraints()));
// {"video":{"width":{"ideal":1920},"height":{"ideal":1080},"frameRate":{"ideal":30}},"audio":false}
console.log(JSON.stringify(cameraConstraints({ deviceId: 'abc', width: 1280, height: 720, fps: 60 }).video));
// {"width":{"ideal":1280},"height":{"ideal":720},"frameRate":{"ideal":60},"deviceId":{"exact":"abc"}}`,
        caption: { en: 'The default request, and a request for one specific camera at 720p60.', zh: '預設的要求，以及指定某一個鏡頭、要 720p60 的要求。' },
      },
    ],
    related: ['openCamera', 'listCameras', 'Compositor'],
    keywords: {
      en: ['getUserMedia', 'constraints', 'camera', 'resolution', 'ideal', 'facingMode', 'device id'],
      zh: ['getUserMedia', '限制條件', '鏡頭', '解析度', '理想值', '前後鏡頭', '裝置 id'],
    },
  },

  listCameras: {
    group: 'record',
    summary: {
      en: 'Lists the video inputs of this computer as { deviceId, groupId, label }.',
      zh: '列出這台電腦的影像輸入，格式是 { deviceId, groupId, label }。',
    },
    params: [],
    returns: { type: 'Promise<Object[]>', en: 'A promise of a list of `{ deviceId, groupId, label }`. A device without a label is called `Camera 1`, `Camera 2`… by its position.', zh: '一個 promise，內容是 `{ deviceId, groupId, label }` 的清單。沒有名字的裝置會依位置叫作 `Camera 1`、`Camera 2`…。' },
    description: [
      {
        en: "Browsers hide the labels (and sometimes the ids) until the page has had camera permission once, so call it again after [`openCamera()`](#openCamera) to get the real names. Needs `https` or `localhost`: elsewhere there is no `navigator.mediaDevices` and the promise rejects.",
        zh: "瀏覽器在頁面拿到過一次鏡頭權限之前，會隱藏名字（有時連 id 也是），所以在 [`openCamera()`](#openCamera) 之後再呼叫一次，才會拿到真正的名字。需要 `https` 或 `localhost`：其他地方沒有 `navigator.mediaDevices`，promise 會被 reject。",
      },
    ],
    examples: [
      {
        code: `import { listCameras, openCamera } from '@openav/record';

console.log((await listCameras()).length > 0);        // true; the labels are generic until permission is given
const stream = await openCamera();                      // the browser asks for the camera
const cams = await listCameras();                       // now with their real names
console.log(cams.map((c) => c.label).join(', '));
stream.getTracks().forEach((t) => t.stop());`,
        caption: { en: 'Lists the cameras before and after permission is given; the second list has the real names. Stop the tracks when you are done.', zh: '在拿到權限之前和之後各列一次鏡頭。第二次的清單有真正的名字。用完之後要把音軌停掉。' },
      },
    ],
    related: ['listMicrophones', 'openCamera', 'cameraConstraints'],
    keywords: {
      en: ['cameras', 'webcam list', 'enumerate devices', 'video inputs', 'device id', 'camera picker'],
      zh: ['鏡頭清單', '網路攝影機', '列出裝置', '影像輸入', '裝置 id', '選鏡頭'],
    },
  },

  listMicrophones: {
    group: 'record',
    summary: {
      en: 'Lists the audio inputs of this computer as { deviceId, groupId, label }.',
      zh: '列出這台電腦的音訊輸入，格式是 { deviceId, groupId, label }。',
    },
    params: [],
    returns: { type: 'Promise<Object[]>', en: 'A promise of a list of `{ deviceId, groupId, label }`. A device without a label is called `Microphone 1`, `Microphone 2`… by its position.', zh: '一個 promise，內容是 `{ deviceId, groupId, label }` 的清單。沒有名字的裝置會依位置叫作 `Microphone 1`、`Microphone 2`…。' },
    description: [
      {
        en: "The same as [`listCameras()`](#listCameras) for audio, with the same rule about labels: they are generic until the page has had microphone permission once. Pass a `deviceId` to [`AudioTap.addMicrophone()`](#AudioTap) to use one.",
        zh: "跟 [`listCameras()`](#listCameras) 一樣，只是列的是音訊，名字的規則也一樣：頁面拿到過一次麥克風權限之前，名字都是通用的。把 `deviceId` 交給 [`AudioTap.addMicrophone()`](#AudioTap) 就能使用其中一個。",
      },
    ],
    examples: [
      {
        code: `import { listMicrophones } from '@openav/record';

const mics = await listMicrophones();
console.log(mics.length > 0, Object.keys(mics[0]).join(','));   // true deviceId,groupId,label`,
        caption: { en: 'Lists the audio inputs and shows the shape of one item.', zh: '列出音訊輸入，並顯示其中一項的形狀。' },
      },
    ],
    related: ['listCameras', 'AudioTap', 'openCamera'],
    keywords: {
      en: ['microphones', 'audio inputs', 'enumerate devices', 'mic list', 'device id', 'microphone picker'],
      zh: ['麥克風清單', '音訊輸入', '列出裝置', '裝置 id', '選麥克風'],
    },
  },

  openCamera: {
    group: 'record',
    summary: {
      en: 'Opens a camera and returns its MediaStream: ideally 1920 by 1080 at 30 fps, or whatever the camera can do.',
      zh: '開啟鏡頭並回傳它的 MediaStream：理想是 1920 乘 1080、30 fps，不行就用鏡頭做得到的。',
    },
    params: [
      { name: 'opts', type: 'Object', optional: true, default: '{}', en: 'The options of [`cameraConstraints()`](#cameraConstraints): `{ deviceId, width, height, fps, facingMode }`.', zh: '[`cameraConstraints()`](#cameraConstraints) 的選項：`{ deviceId, width, height, fps, facingMode }`。' },
    ],
    returns: { type: 'Promise<MediaStream>', en: 'A promise of the stream, with one video track and no audio. It rejects with the browser\'s error when permission is refused or the camera is missing.', zh: '串流的 promise，有一條影像軌，沒有聲音。權限被拒或沒有鏡頭時會用瀏覽器的錯誤 reject。' },
    description: [
      {
        en: "Give the stream to [`Compositor.setCamera()`](#Compositor). The caller owns the stream: stop its tracks when you are done, the compositor never does. Webcams usually top out at 1080p30, so a 4K frame enlarges the camera; the work above it stays sharp. It needs `https` or `localhost`, and the user's permission.",
        zh: "把串流交給 [`Compositor.setCamera()`](#Compositor)。串流由呼叫的人擁有：用完要自己把音軌停掉，合成器不會做。網路攝影機通常最多到 1080p30，所以 4K 的畫面會把鏡頭放大，上面的作品仍然清楚。需要 `https` 或 `localhost`，以及使用者許可。",
      },
    ],
    examples: [
      {
        code: `import { openCamera } from '@openav/record';

const stream = await openCamera();                // the browser asks for the camera
const video = document.createElement('video');
video.muted = true; video.srcObject = stream; await video.play();
console.log(video.videoWidth > 0);                // true once frames arrive
document.getElementById('app').append(video);
video.style.width = '240px';`,
        caption: { en: 'Allow the camera and a small live picture of it appears on the page.', zh: '允許鏡頭之後，頁面上會出現一個小小的即時畫面。' },
      },
    ],
    related: ['Compositor', 'cameraConstraints', 'listCameras'],
    keywords: {
      en: ['camera', 'webcam', 'open camera', 'getUserMedia', 'stream', 'video input', 'permission'],
      zh: ['鏡頭', '網路攝影機', '開啟鏡頭', '串流', '影像輸入', '權限'],
    },
  },

  // ------------------------------------------------------------------------------------------------ event log
  EventLog: {
    group: 'record',
    summary: {
      en: 'Keeps a timestamped list of what happened during a take, such as notes and parameter changes, on the same clock as the recording.',
      zh: '把一次錄影過程中發生的事，例如音符和參數變化，連同時間記成一份清單，用的是跟錄影同一個時鐘。',
    },
    params: [
      { name: 'now', type: 'Function', optional: true, default: 'performance.now', en: 'The clock, in milliseconds. The default is the same clock as `Recorder.t0`. Pass your own in a test.', zh: '時鐘，單位是毫秒。預設跟 `Recorder.t0` 是同一個時鐘。測試時傳自己的。' },
      { name: 'filter', type: 'Function', optional: true, default: 'null', en: '`filter(name, value, meta)`, returns whether to keep an event. It applies to `add()` too.', zh: '`filter(name, value, meta)`，回傳要不要留下這個事件。`add()` 也適用。' },
      { name: 'throttleMs', type: 'Number', optional: true, default: '0', en: 'For continuous signals: keep at most one event per name in this many milliseconds. Pulses (note on, note off…) are never throttled.', zh: '對連續的訊號：每個名字在這麼多毫秒內最多留一個事件。脈衝（音符開、音符關…）永遠不會被節流。' },
    ],
    description: [
      {
        en: "A video keeps the picture and the sound. The log keeps the **score** of the take: every note, pad hit and (throttled) hand position, in milliseconds from the moment recording started. With it a take can be re-rendered at another size, re-synced to a better audio take, or turned into MIDI later. Start it with the recorder's start time so event times line up with the video's first frame: `log.start(recorder.t0)`.",
        zh: "影片留下的是畫面和聲音。事件記錄留下的是這次錄影的**樂譜**：每個音符、每一下墊子、以及（有節流的）手的位置，從開始錄的那一刻算起的毫秒數。有了它，一段錄影之後可以用別的尺寸重新渲染、跟更好的聲音檔重新對齊，或轉成 MIDI。用錄影器的開始時間來開始它，事件時間才會跟影片的第一個畫面對齊：`log.start(recorder.t0)`。",
      },
      {
        en: "`log.attach(signals)` logs every signal a [`Signals`](#Signals) bus publishes; pulses are always kept and continuous signals obey `throttleMs`. Or add events yourself with `log.add(name, value)`. Values are cleaned into plain JSON data by [`cleanValue()`](#cleanValue). `toJSON()` gives `{ format: 'openav-eventlog', version: 1, startedAt, durationMs, count, events }`, and `EventLog.fromJSON(json)` reads it back. `toTake()` turns the log into a MIDI take; [`TakeRecorder`](#TakeRecorder) is a log that does exactly that on `midi/*`.",
        zh: "`log.attach(signals)` 會記下 [`Signals`](#Signals) 匯流排發布的每個訊號。脈衝一定會留，連續的訊號則受 `throttleMs` 限制。也可以自己用 `log.add(name, value)` 加事件。值會被 [`cleanValue()`](#cleanValue) 整理成單純的 JSON 資料。`toJSON()` 給 `{ format: 'openav-eventlog', version: 1, startedAt, durationMs, count, events }`，`EventLog.fromJSON(json)` 能讀回來。`toTake()` 把記錄轉成 MIDI 的 take，[`TakeRecorder`](#TakeRecorder) 就是在 `midi/*` 上剛好做這件事的記錄。",
      },
      {
        en: "Properties: `events` is the list `[{ t, name, value }]` (`t` in ms, to a tenth), `t0` the clock time of t = 0, `startedAt` the wall-clock time (ISO text) and `durationMs` is `null` until `stop()`.",
        zh: "屬性：`events` 是 `[{ t, name, value }]` 的清單（`t` 是毫秒，精確到十分之一），`t0` 是 t = 0 的時鐘時間，`startedAt` 是真實時間（ISO 文字），`durationMs` 在 `stop()` 之前是 `null`。",
      },
    ],
    members: {
      running: { en: 'Getter. True from `start()` until `stop()`.', zh: 'Getter。從 `start()` 到 `stop()` 之間是 true。' },
      start: { en: 'Starts a take and clears the log. `at` is the clock time of t = 0 (default now): pass `recorder.t0` to line up with a video. Returns the log.', zh: '開始一次錄影並清空記錄。`at` 是 t = 0 的時鐘時間（預設現在）：傳 `recorder.t0` 就能跟影片對齊。回傳記錄本身。' },
      stop: { en: 'Ends the take and sets `durationMs`; later events are ignored. Returns the log.', zh: '結束這次錄影並設定 `durationMs`。之後的事件會被忽略。回傳記錄本身。' },
      add: { en: 'Logs one event: `add(name, value, { at, pulse, meta })`, and returns it as `{ t, name, value }`, or `null` when the log is not running, the filter refused it, it happened before t = 0, or it was throttled. `pulse: false` makes it subject to `throttleMs`; `at` is the clock time (default now).', zh: '記下一個事件：`add(name, value, { at, pulse, meta })`，並以 `{ t, name, value }` 回傳，如果記錄沒在跑、被 filter 拒絕、發生在 t = 0 之前，或被節流，就回傳 `null`。`pulse: false` 會讓它受 `throttleMs` 限制。`at` 是時鐘時間（預設現在）。' },
      mark: { en: 'Logs a labelled marker such as "chorus" or "take 2 starts here" as an event named `mark` with `{ label, ...data }`.', zh: '記下一個帶標籤的標記，像「chorus」或「第二次從這裡開始」，成為名字是 `mark`、值是 `{ label, ...data }` 的事件。' },
      attach: { en: 'Logs every signal a `Signals` bus publishes (through `signals.onAny`). Returns a function that detaches again.', zh: '記下 `Signals` 匯流排發布的每個訊號（透過 `signals.onAny`）。回傳一個再解除的函式。' },
      detach: { en: 'Detaches from every bus it was attached to.', zh: '從所有接過的匯流排上解除。' },
      between: { en: 'The events with `start <= t < end` (milliseconds).', zh: '`start <= t < end` 的事件（毫秒）。' },
      toJSON: { en: 'The log as plain data: `{ format: \'openav-eventlog\', version: 1, startedAt, durationMs, count, events }`.', zh: '記錄的純資料：`{ format: \'openav-eventlog\', version: 1, startedAt, durationMs, count, events }`。' },
      toTake: { en: 'The log as a MIDI take `{ v: 1, name, createdAt, durationMs, events, meta }` (see [`normalizeTake()`](#normalizeTake)). `{ name = \'take\', meta = {} }`. Every event is kept; filter to `midi/*` first, or use a [`TakeRecorder`](#TakeRecorder).', zh: '把記錄轉成 MIDI 的 take `{ v: 1, name, createdAt, durationMs, events, meta }`（見 [`normalizeTake()`](#normalizeTake)）。`{ name = \'take\', meta = {} }`。所有事件都會保留。請先過濾成 `midi/*`，或改用 [`TakeRecorder`](#TakeRecorder)。' },
      fromJSON: { en: 'Static. Rebuilds a stopped log from `toJSON()` output or its text. Throws a `TypeError` if it is not an `openav-eventlog`.', zh: 'Static。從 `toJSON()` 的輸出或它的文字重建一份已經停止的記錄。不是 `openav-eventlog` 的話會丟出 `TypeError`。' },
    },
    examples: [
      {
        code: `import { EventLog } from '@openav/record';

let clock = 1000;                                   // a clock we move by hand, in ms
const log = new EventLog({ now: () => clock });
log.start();
clock = 1100; log.add('midi/note/on', { note: 60, vel: 0.8 });
clock = 1200; log.mark('chorus');
clock = 1500; log.stop();
console.log(log.events.map((e) => e.t + ' ' + e.name).join(' | '));   // 100 midi/note/on | 200 mark
console.log(log.durationMs, log.running, log.toJSON().count);          // 500 false 2
console.log(log.add('late'));                                          // null: the take is over`,
        caption: { en: 'A take of half a second on a clock moved by hand: a note at 100 ms, a marker at 200 ms. After `stop()` nothing more is accepted.', zh: '用手動撥動的時鐘錄半秒：100 毫秒一個音符，200 毫秒一個標記。`stop()` 之後就不再收任何事件。' },
      },
      {
        code: `import { EventLog } from '@openav/record';
import { Signals } from '@openav/core';

const signals = new Signals();
const log = new EventLog({ throttleMs: 100 });        // knobs: at most one event per 100 ms
log.start();
const detach = log.attach(signals);
signals.pulse('midi/note/on', { note: 64, vel: 0.7 }); // a pulse: always kept
for (let i = 0; i < 10; i++) signals.set('param/hue', i / 10);   // continuous: throttled
detach();
console.log(log.events.length, log.events[0].name);    // 2 midi/note/on
console.log(EventLog.fromJSON(log.toJSON()).events.length);   // 2`,
        caption: { en: 'A bus is attached: the note pulse is kept, and ten changes of a continuous signal in a few milliseconds become one event. The log survives a round trip through JSON.', zh: '接上一個匯流排：音符脈衝被留下，連續訊號在幾毫秒內的十次變化只剩一個事件。記錄經過 JSON 來回之後依然完整。' },
      },
    ],
    related: ['TakeRecorder', 'Recorder', 'cleanValue', 'Signals', 'toMidiFile'],
    keywords: {
      en: ['event log', 'log', 'score', 'timestamps', 'record events', 'notes played', 'signals', 'json', 'markers'],
      zh: ['事件記錄', '記錄', '樂譜', '時間戳記', '錄事件', '彈過的音', '訊號', 'json', '標記'],
    },
  },

  cleanValue: {
    group: 'record',
    summary: {
      en: 'Makes a copy of a signal value that is safe to write as JSON: rounded numbers, plain arrays, no functions, nothing too deep.',
      zh: '做出一份訊號值的複本，可以安全地寫成 JSON：數字捨入、陣列變普通陣列、沒有函式、也不會太深。',
    },
    params: [
      { name: 'v', type: 'any', en: 'The value to clean.', zh: '要整理的值。' },
      { name: 'depth', type: 'Number', optional: true, default: '0', en: 'How deep we already are. Leave it out; it is used by the function calling itself.', zh: '目前已經到第幾層。不用給，是函式呼叫自己的時候用的。' },
    ],
    returns: { type: 'any', en: 'The cleaned copy.', zh: '整理過的複本。' },
    description: [
      {
        en: "The rules: numbers are rounded to 6 decimals, and `NaN` and infinities become `null`. Typed arrays become plain arrays. A `bigint` becomes a number. Objects and arrays are copied down to depth 4 and anything deeper becomes `null`. A function, symbol or `undefined` becomes `null` in an array and the key is dropped from an object. [`EventLog`](#EventLog) runs every value through it.",
        zh: "規則：數字捨入到小數第 6 位，`NaN` 和無限大變成 `null`。型別陣列變成普通陣列。`bigint` 變成數字。物件和陣列往下複製到第 4 層，再深的變成 `null`。函式、symbol 和 `undefined` 在陣列裡變成 `null`，在物件裡這個鍵會被丟掉。[`EventLog`](#EventLog) 把每個值都經過它。",
      },
    ],
    examples: [
      {
        code: `import { cleanValue } from '@openav/record';

const out = cleanValue({
  a: 1.23456789, list: [1, NaN, () => 1], pos: new Float32Array([0.5, 0.25]), fn() {}, big: 10n,
});
console.log(JSON.stringify(out));
// {"a":1.234568,"list":[1,null,null],"pos":[0.5,0.25],"big":10}`,
        caption: { en: 'A messy object goes in and plain data comes out: the number is rounded, the function key is gone, the typed array became a list.', zh: '一個亂七八糟的物件進去，出來的是單純的資料：數字被捨入、函式的鍵不見了、型別陣列變成陣列。' },
      },
    ],
    related: ['EventLog', 'normalizeTake'],
    keywords: {
      en: ['clean', 'json safe', 'serialize', 'sanitize', 'round', 'typed array'],
      zh: ['整理', 'json 安全', '序列化', '清理', '捨入', '型別陣列'],
    },
  },

  // ------------------------------------------------------------------------------------------------ MIDI takes
  TAKE_VERSION: {
    group: 'record',
    summary: {
      en: 'The version number of the take format, which is 1. Every take has `v: 1`.',
      zh: 'take 格式的版本號，是 1。每個 take 都有 `v: 1`。',
    },
    value: { type: 'Number', en: '`1`.', zh: '版本號就是 `1`。' },
    description: [
      {
        en: "A take is a plain object `{ v, name, createdAt, durationMs, events, meta }`, see [`normalizeTake()`](#normalizeTake). [`validateTake()`](#validateTake) complains when `v` is not this number, and [`normalizeTake()`](#normalizeTake) writes it.",
        zh: "take 是一個普通物件 `{ v, name, createdAt, durationMs, events, meta }`，見 [`normalizeTake()`](#normalizeTake)。`v` 不是這個數字時，[`validateTake()`](#validateTake) 會抱怨，[`normalizeTake()`](#normalizeTake) 會把它寫進去。",
      },
    ],
    examples: [
      {
        code: `import { TAKE_VERSION, normalizeTake } from '@openav/record';

console.log(TAKE_VERSION);                       // 1
console.log(normalizeTake({ events: [] }).v);    // 1`,
        caption: { en: 'Logs the version, and that a take built from nothing gets it.', zh: '印出版本號，以及從空白做出來的 take 也會有它。' },
      },
    ],
    related: ['normalizeTake', 'validateTake'],
    keywords: {
      en: ['take version', 'format version', 'schema', 'v: 1'],
      zh: ['take 版本', '格式版本', '結構', '版本號'],
    },
  },

  normalizeTake: {
    group: 'record',
    summary: {
      en: 'Turns anything take-shaped, or its JSON text, into a valid take: events sorted by time, bad events dropped, nothing negative.',
      zh: '把任何長得像 take 的東西，或它的 JSON 文字，整理成合格的 take：事件依時間排序、壞事件丟掉、沒有負數。',
    },
    params: [
      { name: 'input', type: 'Object | String', en: 'A take, or its JSON text. A string is parsed with `JSON.parse`. Anything that is not an object throws a `TypeError`.', zh: '一個 take，或它的 JSON 文字。字串會用 `JSON.parse` 解析。不是物件的東西會丟出 `TypeError`。' },
    ],
    returns: { type: 'Object', en: 'A new take: `{ v: 1, name, createdAt, durationMs, events: [{ t, name, value }], meta }`.', zh: '一個新的 take：`{ v: 1, name, createdAt, durationMs, events: [{ t, name, value }], meta }`。' },
    description: [
      {
        en: "A take is what an [`EventLog`](#EventLog) filtered to `midi/*` records, as plain data: `t` is milliseconds from the start, `name` is a signal name such as `midi/note/on`, `value` is its payload, and `meta` holds free fields like `{ bpm, device, notes }`. `normalizeTake()` makes any input safe: events that are not objects, have no name or have a `t` that is not a number are dropped; `t` is rounded to a tenth of a millisecond and held at 0 or more; the events are sorted by `t` (events with equal times keep their order); `name` defaults to `'take'`; `durationMs` is at least the time of the last event. A new object is returned.",
        zh: "take 就是過濾成 `midi/*` 的 [`EventLog`](#EventLog) 記下的東西，是單純的資料：`t` 是從開始算起的毫秒數，`name` 是訊號名稱，像 `midi/note/on`，`value` 是它的內容，`meta` 放自由欄位，像 `{ bpm, device, notes }`。`normalizeTake()` 讓任何輸入都變安全：不是物件、沒有名字、`t` 不是數字的事件會被丟掉，`t` 捨入到十分之一毫秒並限制在 0 以上，事件依 `t` 排序（時間一樣的保持原來的順序），`name` 預設是 `'take'`，`durationMs` 至少是最後一個事件的時間。回傳的是新物件。",
      },
      {
        en: "Every function in this package that takes a take runs it through here first, so you can pass raw data.",
        zh: "這個套件裡每個收 take 的函式，都會先把它送進這裡處理，所以你可以直接傳原始資料。",
      },
    ],
    examples: [
      {
        code: `import { normalizeTake } from '@openav/record';

const take = normalizeTake({
  events: [{ t: 30, name: 'b' }, { t: 10, name: 'a', value: 1 }, { t: 'x', name: 'c' }, { name: 'd' }, null],
  durationMs: 5,
});
console.log(take.events.map((e) => e.t + ':' + e.name).join(' '));   // 10:a 30:b
console.log(take.durationMs, take.name, take.v);                     // 30 take 1`,
        caption: { en: 'Three of the five events are junk and go; the rest are sorted, and the length grows to cover the last event.', zh: '五個事件裡三個是垃圾，會被丟掉。剩下的排好序，長度也被拉長到涵蓋最後一個事件。' },
      },
    ],
    related: ['validateTake', 'TAKE_VERSION', 'trimSilence', 'EventLog', 'TakePlayer'],
    keywords: {
      en: ['take', 'normalize', 'sanitize', 'sort events', 'midi take', 'json', 'clean up'],
      zh: ['take', '正規化', '整理', '排序事件', 'midi take', 'json', '清理'],
    },
  },

  validateTake: {
    group: 'record',
    summary: {
      en: 'Checks a take and lists everything wrong with it as readable sentences. An empty list means it is valid.',
      zh: '檢查一個 take，把有問題的地方都列成看得懂的句子。空的清單表示沒問題。',
    },
    params: [
      { name: 'take', type: 'any', en: 'The take to check.', zh: '要檢查的 take。' },
    ],
    returns: { type: 'String[]', en: 'Sentences such as `v must be 1 (got 2)` or `events[3] is out of order (t 100 < 200)`. `[]` when valid. It never throws.', zh: '像 `v must be 1 (got 2)` 或 `events[3] is out of order (t 100 < 200)` 這樣的句子。沒問題就是 `[]`。它不會丟出錯誤。' },
    description: [
      {
        en: "It checks: `v` is [`TAKE_VERSION`](#TAKE_VERSION), `name` is a string, `durationMs` is a number from 0 up, `events` is an array, each event is an object with a signal `name` and a `t` of 0 or more, the events are in time order and none is after `durationMs`, and `meta`, if present, is an object. Use it on a take you read from a file; to repair one, use [`normalizeTake()`](#normalizeTake).",
        zh: "它檢查：`v` 是 [`TAKE_VERSION`](#TAKE_VERSION)，`name` 是字串，`durationMs` 是 0 以上的數字，`events` 是陣列，每個事件都是有訊號 `name` 和 0 以上的 `t` 的物件，事件依時間排序而且沒有任何一個超過 `durationMs`，`meta` 如果有的話是物件。用在從檔案讀來的 take 上。要修復的話，用 [`normalizeTake()`](#normalizeTake)。",
      },
    ],
    examples: [
      {
        code: `import { validateTake } from '@openav/record';

const good = { v: 1, name: 'riff', durationMs: 1500, events: [{ t: 500, name: 'midi/note/on', value: { note: 60 } }] };
console.log(validateTake(good));                  // []
console.log(validateTake({ v: 2, events: [{ t: -1, name: '' }] }));
// ["v must be 1 (got 2)", "name must be a string", "durationMs must be a number ≥ 0",
//  "events[0].name must be a signal name", "events[0].t must be ms ≥ 0"]
console.log(validateTake(null));                  // ["not an object"]`,
        caption: { en: 'A valid take gives an empty list; a broken one lists every problem; something that is not even an object says so.', zh: '合格的 take 得到空清單。壞掉的會列出每個問題。根本不是物件的東西會直接這麼說。' },
      },
    ],
    related: ['normalizeTake', 'TAKE_VERSION'],
    keywords: {
      en: ['validate', 'check take', 'errors', 'lint', 'take format', 'problems'],
      zh: ['驗證', '檢查 take', '錯誤', 'take 格式', '問題清單'],
    },
  },

  trimSilence: {
    group: 'record',
    summary: {
      en: 'Cuts the silence before the first key press of a take, so the first note comes at the moment you choose.',
      zh: '把一個 take 第一次按鍵之前的靜默剪掉，讓第一個音出現在你指定的時間。',
    },
    params: [
      { name: 'take', type: 'Object', en: 'The take.', zh: '這個 take。' },
      { name: 'keep', type: 'Number', optional: true, default: '0', en: 'Milliseconds of lead-in to keep before the first key-down.', zh: '第一次按鍵之前要保留幾毫秒的空白。' },
    ],
    returns: { type: 'Object', en: 'A new take. Everything moved earlier by the same amount, and `durationMs` is shorter by that amount. A take that starts at once comes back as it is.', zh: '一個新的 take。所有事件都提早同樣的量，`durationMs` 也縮短那麼多。一開始就有音的 take 會原樣回傳。' },
    description: [
      {
        en: "Everything before the first key-down is cut away, but not lost: a controller value set during the silence, such as the sustain pedal or a knob, is kept and moved to the start (to `t = 0` if it was before the cut), so the take still starts in the same state. If the take has no key-down at all, it is moved so its first event is at `keep`.",
        zh: "第一次按鍵之前的東西會被剪掉，但不會遺失：靜默裡設定的控制器數值，例如延音踏板或旋鈕，會保留，並移到開頭（剪掉的範圍內的會變成 `t = 0`），所以 take 開始時的狀態不變。如果 take 裡完全沒有按鍵，就整體移動，讓它的第一個事件落在 `keep`。",
      },
    ],
    examples: [
      {
        code: `import { trimSilence } from '@openav/record';

const take = { v: 1, name: 'riff', durationMs: 1500, events: [
  { t: 500, name: 'midi/note/on', value: { note: 60, vel: 0.8, ch: 1 } },
  { t: 900, name: 'midi/note/off', value: { note: 60, ch: 1 } },
] };
const t = trimSilence(take, { keep: 100 });
console.log(t.events.map((e) => e.t), t.durationMs);   // [100, 500] 1100`,
        caption: { en: 'A take that starts half a second late is moved earlier so its first note comes at 100 ms; its length shrinks by the 400 ms that were cut.', zh: '一個晚了半秒才開始的 take 被往前移，讓第一個音出現在 100 毫秒。長度縮短被剪掉的 400 毫秒。' },
      },
    ],
    related: ['quantizeTake', 'normalizeTake', 'TakeRecorder', 'takeStats'],
    keywords: {
      en: ['trim', 'silence', 'cut', 'lead in', 'start of take', 'remove silence'],
      zh: ['修剪', '靜默', '剪掉', '開頭', '去掉空白'],
    },
  },

  quantizeTake: {
    group: 'record',
    summary: {
      en: 'Snaps the key presses of a take to a rhythmic grid, so a loose performance lands on the beat.',
      zh: '把一個 take 的按鍵對齊到節奏格子上，讓不太準的演奏落在拍點上。',
    },
    params: [
      { name: 'take', type: 'Object', en: 'The take.', zh: '這個 take。' },
      { name: 'bpm', type: 'Number', optional: true, en: 'The tempo. Left out, it is `take.meta.bpm`, and then 120.', zh: '速度。沒給的話用 `take.meta.bpm`，再沒有就是 120。' },
      { name: 'grid', type: 'Number', optional: true, default: '4', en: 'Grid steps per beat: 4 is sixteenths, 2 is eighths, 1 is quarters.', zh: '每一拍幾格：4 是十六分音符，2 是八分音符，1 是四分音符。' },
      { name: 'strength', type: 'Number', optional: true, default: '1', en: 'How far to move, 0..1. 1 is all the way, 0.5 is half way to the grid, 0 changes nothing.', zh: '移動多少，0..1。1 是移到定位，0.5 是移一半，0 是什麼都不變。' },
      { name: 'offsetMs', type: 'Number', optional: true, default: '0', en: 'Shift the grid later by this many milliseconds, for a take that does not start on a beat.', zh: '把格子往後移這麼多毫秒，給不是從拍點開始的 take 用。' },
    ],
    returns: { type: 'Object', en: 'A new take.', zh: '一個新的 take。' },
    description: [
      {
        en: "Each key-down moves to the nearest grid line (`60000 / bpm / grid` milliseconds apart). The key-up of a note moves with it, so the length of every note is kept. Everything that is not a note (controllers, pitch bend) stays where it was. A note written in two spellings at the same time (`midi/note/on` and `midi/ch/1/note/60`) moves by the same amount in both.",
        zh: "每次按下的鍵會移到最近的格線上（格線之間隔 `60000 / bpm / grid` 毫秒）。音符放開的時間跟著一起移，所以每個音的長度不變。不是音符的東西（控制器、彎音）留在原處。同一個音符用兩種寫法同時記錄的（`midi/note/on` 和 `midi/ch/1/note/60`），兩邊移動的量一樣。",
      },
    ],
    examples: [
      {
        code: `import { quantizeTake } from '@openav/record';

const on = (t, note) => ({ t, name: 'midi/note/on', value: { note, vel: 0.8, ch: 1 } });
const off = (t, note) => ({ t, name: 'midi/note/off', value: { note, ch: 1 } });
const take = { v: 1, name: 'loose', durationMs: 1500, meta: { bpm: 120 },
  events: [on(510, 60), off(900, 60), on(1010, 64), off(1400, 64)] };

const q = quantizeTake(take, { grid: 4 });              // sixteenths at 120 bpm: a grid line every 125 ms
console.log(q.events.map((e) => e.t));                  // [500, 890, 1000, 1390]
console.log(quantizeTake(take, { grid: 4, strength: 0.5 }).events.map((e) => e.t));   // [505, 895, 1005, 1395]`,
        caption: { en: 'Two notes a little off the beat snap to 500 and 1000 ms, and each note-off moves with its note. With a strength of one half they only go halfway.', zh: '兩個稍微偏離拍點的音對齊到 500 和 1000 毫秒，每個放開的時間跟著它的音一起移。強度一半的話，它們只移一半。' },
      },
    ],
    related: ['trimSilence', 'takeStats', 'toMidiFile', 'normalizeTake'],
    keywords: {
      en: ['quantize', 'snap to grid', 'timing', 'on the beat', 'tempo', 'groove', 'clean up playing'],
      zh: ['量化', '對齊格子', '節奏', '對拍', '速度', '律動', '修正演奏'],
    },
  },

  takeStats: {
    group: 'record',
    summary: {
      en: 'Counts what is in a take: notes, events, length, the channels used, and the lowest and highest note.',
      zh: '數出一個 take 裡有什麼：音符數、事件數、長度、用到的頻道，以及最低和最高的音。',
    },
    params: [
      { name: 'take', type: 'Object', en: 'The take.', zh: '這個 take。' },
    ],
    returns: { type: 'Object', en: '`{ notes, events, durationMs, channels, low, high }`. `notes` counts key-downs, once each even when the take holds two spellings of them. `channels` is a sorted list of MIDI channels. `low` and `high` are MIDI note numbers, or `null` for a take without notes.', zh: '`{ notes, events, durationMs, channels, low, high }`。`notes` 數的是按下的鍵，每個音只算一次，即使 take 裡有兩種寫法。`channels` 是排好序的 MIDI 頻道清單。`low` 和 `high` 是 MIDI 音符號碼，沒有音符的 take 是 `null`。' },
    description: [
      {
        en: "Good for showing what a take is before it is played or saved. Notes are counted through [`midiEventsOf()`](#midiEventsOf), which picks one naming family, so the count is the number of keys pressed.",
        zh: "適合在播放或儲存一個 take 之前，顯示它是什麼。音符是透過 [`midiEventsOf()`](#midiEventsOf) 數的，它只選一種名稱寫法，所以數字就是按過幾個鍵。",
      },
    ],
    examples: [
      {
        code: `import { takeStats } from '@openav/record';

const take = { v: 1, name: 'riff', durationMs: 1500, events: [
  { t: 500, name: 'midi/note/on', value: { note: 60, vel: 0.8, ch: 1 } },
  { t: 900, name: 'midi/note/off', value: { note: 60, ch: 1 } },
  { t: 1010, name: 'midi/note/on', value: { note: 64, vel: 0.5, ch: 1 } },
  { t: 1400, name: 'midi/note/off', value: { note: 64, ch: 1 } },
] };
console.log(takeStats(take));   // { notes: 2, events: 4, durationMs: 1500, channels: [1], low: 60, high: 64 }`,
        caption: { en: 'Two notes, four events, one channel, from C4 to E4.', zh: '兩個音符、四個事件、一個頻道，從 C4 到 E4。' },
      },
    ],
    related: ['midiEventsOf', 'normalizeTake', 'noteOf'],
    keywords: {
      en: ['stats', 'statistics', 'count notes', 'range', 'summary of take', 'length'],
      zh: ['統計', '音符數', '音域', '摘要', 'take 的內容', '長度'],
    },
  },

  noteOf: {
    group: 'record',
    summary: {
      en: 'Tells whether a recorded event is a key going down or up, whatever its spelling, and which note on which channel.',
      zh: '告訴你一個錄下來的事件是不是鍵按下去或放開，不管它用哪一種寫法，以及是哪個頻道的哪個音。',
    },
    params: [
      { name: 'ev', type: 'Object', en: 'An event `{ name, value }` of a take.', zh: 'take 的一個事件 `{ name, value }`。' },
    ],
    returns: { type: 'Object | null', en: '`{ key, on, note, ch, family, vel }`, or `null` if it is not a note event. `key` is `\'<ch>:<note>\'`, `on` is true for a key-down, `family` says which spelling it came in, `vel` is 0..127.', zh: '`{ key, on, note, ch, family, vel }`，不是音符事件就是 `null`。`key` 是 `\'<ch>:<note>\'`，`on` 是 true 表示按下，`family` 說明它用哪一種寫法，`vel` 是 0..127。' },
    description: [
      {
        en: "A hardware keyboard publishes the same note under several names, and this function knows them all: `midi/note/on` and `midi/note/off` (family `legacy`, with `value: { note, vel, ch }`), `midi/ch/<ch>/note/<note>` (family `channel`, a number, 0 for off), `midi/<device>/note/on|off` (family `slug:<device>`) and raw bytes on `midi/virtual` (family `virtual`, `{ data: [status, note, vel] }`). A key-down with velocity 0 in raw bytes counts as off. A channel of 0, as the on-screen piano says, counts as channel 1.",
        zh: "硬體鍵盤會把同一個音符用好幾種名字發布，這個函式全部認得：`midi/note/on` 和 `midi/note/off`（寫法 `legacy`，內容是 `{ note, vel, ch }`）、`midi/ch/<ch>/note/<note>`（寫法 `channel`，是數字，0 表示放開）、`midi/<device>/note/on|off`（寫法 `slug:<device>`），以及 `midi/virtual` 上的原始位元組（寫法 `virtual`，`{ data: [status, note, vel] }`）。原始位元組裡力度是 0 的按下算放開。頻道是 0 的（螢幕鋼琴會這樣）當作頻道 1。",
      },
    ],
    examples: [
      {
        code: `import { noteOf } from '@openav/record';

console.log(noteOf({ name: 'midi/note/on', value: { note: 60, vel: 0.8, ch: 1 } }));
// { key: '1:60', on: true, note: 60, ch: 1, family: 'legacy', vel: 102 }
console.log(noteOf({ name: 'midi/ch/1/note/60', value: 0 }).on);                   // false
console.log(noteOf({ name: 'midi/virtual', value: { data: [0x90, 60, 100] } }).on);  // true
console.log(noteOf({ name: 'midi/cc/1', value: 1 }));                                // null`,
        caption: { en: 'The same key in three spellings, and a controller that is not a note.', zh: '同一個鍵的三種寫法，和一個不是音符的控制器。' },
      },
    ],
    related: ['noteOffFor', 'midiEventsOf', 'TakePlayer', 'TakeRecorder'],
    keywords: {
      en: ['note on', 'note off', 'midi event', 'key down', 'parse note', 'families', 'spellings'],
      zh: ['音符開', '音符關', 'midi 事件', '按下', '解析音符', '寫法'],
    },
  },

  noteOffFor: {
    group: 'record',
    summary: {
      en: 'Gives the events that release a sounding note, in the same spelling it was played in.',
      zh: '給出能放開一個正在響的音的事件，用的是它當初被彈出來的那種寫法。',
    },
    params: [
      { name: 'n', type: 'Object', en: 'The result of [`noteOf()`](#noteOf): `{ note, ch, family }`.', zh: '[`noteOf()`](#noteOf) 的結果：`{ note, ch, family }`。' },
    ],
    returns: { type: 'Object[]', en: 'A list of `{ name, value }` events (one, or none for an unknown family).', zh: '`{ name, value }` 事件的清單（一個，不認得的寫法則是空的）。' },
    description: [
      {
        en: "This is how a [`TakePlayer`](#TakePlayer) and a [`TakeRecorder`](#TakeRecorder) make sure no note is left sounding: for `legacy` it is `midi/note/off`, for `channel` it is `midi/ch/<ch>/note/<note>` with 0, for `virtual` it is a raw note-off byte triple, for a device family `midi/<device>/note/off`.",
        zh: "[`TakePlayer`](#TakePlayer) 和 [`TakeRecorder`](#TakeRecorder) 就是這樣確保沒有音一直響著：`legacy` 是 `midi/note/off`，`channel` 是值為 0 的 `midi/ch/<ch>/note/<note>`，`virtual` 是原始的放開位元組，裝置寫法則是 `midi/<device>/note/off`。",
      },
    ],
    examples: [
      {
        code: `import { noteOf, noteOffFor } from '@openav/record';

const down = noteOf({ name: 'midi/ch/3/note/60', value: 0.5 });
console.log(noteOffFor(down));      // [{ name: 'midi/ch/3/note/60', value: 0 }]
const legacy = noteOf({ name: 'midi/note/on', value: { note: 60, vel: 0.8, ch: 1 } });
console.log(noteOffFor(legacy));    // [{ name: 'midi/note/off', value: { note: 60, ch: 1 } }]`,
        caption: { en: 'The release of the same key depends on how it was played: the per-channel spelling releases with a zero, the classic one with a note-off.', zh: '同一個鍵怎麼放開要看它當初怎麼彈：每頻道的寫法用 0 放開，傳統的用 note-off。' },
      },
    ],
    related: ['noteOf', 'TakePlayer', 'TakeRecorder'],
    keywords: {
      en: ['note off', 'release', 'stuck notes', 'panic', 'matching off event'],
      zh: ['音符關', '放開', '卡音', '對應的放開事件'],
    },
  },

  midiEventsOf: {
    group: 'record',
    summary: {
      en: 'Reads a take as plain MIDI events (note on and off, controllers, pitch bend), picking one naming family so nothing is counted twice.',
      zh: '把一個 take 讀成單純的 MIDI 事件（音符開關、控制器、彎音），只選一種名稱寫法，所以不會重複算。',
    },
    params: [
      { name: 'take', type: 'Object', en: 'The take.', zh: '這個 take。' },
    ],
    returns: { type: 'Object[]', en: 'A list in the shape of `@openav/midi`: `{ t, type: \'noteon\', ch, note, vel }`, `noteoff`, `{ t, type: \'cc\', ch, cc, value }`, `{ t, type: \'pitchbend\', ch, value }` (0..16383), `chanat` and `polyat`. `vel` and `value` are 0..127.', zh: '`@openav/midi` 的格式：`{ t, type: \'noteon\', ch, note, vel }`、`noteoff`、`{ t, type: \'cc\', ch, cc, value }`、`{ t, type: \'pitchbend\', ch, value }`（0..16383）、`chanat`、`polyat`。`vel` 和 `value` 是 0..127。' },
    description: [
      {
        en: "A take made on hardware holds the same note several times, under several names. This picks one family for the notes: `midi/note/*` if present, else `midi/ch/*`, else one device's `midi/<device>/note/*`, else raw `midi/virtual` bytes. Controllers and pitch bend come from `midi/ch/*` if present, else the classic names (as channel 1), else one device's. [`toMidiFile()`](#toMidiFile) and [`takeStats()`](#takeStats) are built on it.",
        zh: "在硬體上錄的 take，同一個音會用好幾個名字記好幾次。這裡替音符選一種寫法：有 `midi/note/*` 就用它，沒有就用 `midi/ch/*`，再沒有就用某一個裝置的 `midi/<device>/note/*`，最後是 `midi/virtual` 的原始位元組。控制器和彎音：有 `midi/ch/*` 就用，沒有就用傳統名稱（當作頻道 1），再沒有就用某一個裝置的。[`toMidiFile()`](#toMidiFile) 和 [`takeStats()`](#takeStats) 都是建立在它上面。",
      },
    ],
    examples: [
      {
        code: `import { midiEventsOf } from '@openav/record';

const take = { v: 1, name: 'x', durationMs: 600, events: [
  { t: 100, name: 'midi/note/on', value: { note: 60, vel: 0.8, ch: 1 } },
  { t: 100, name: 'midi/ch/1/note/60', value: 0.8 },        // the same key, spelled the other way
  { t: 400, name: 'midi/note/off', value: { note: 60, ch: 1 } },
  { t: 400, name: 'midi/ch/1/note/60', value: 0 },
] };
console.log(midiEventsOf(take));
// [{ t: 100, type: 'noteon', ch: 1, note: 60, vel: 102 }, { t: 400, type: 'noteoff', ch: 1, note: 60, vel: 0 }]`,
        caption: { en: 'Four recorded events are one key pressed and released, spelled twice; the result has just the two MIDI events.', zh: '四個錄下來的事件其實是一個鍵按下又放開，寫了兩次。結果只有兩個 MIDI 事件。' },
      },
    ],
    related: ['toMidiFile', 'takeStats', 'noteOf', 'signalsOfMidi'],
    keywords: {
      en: ['midi events', 'note on', 'cc', 'pitch bend', 'convert take', 'families', 'deduplicate'],
      zh: ['midi 事件', '音符開', '控制器', '彎音', '轉換 take', '寫法', '去重複'],
    },
  },

  signalsOfMidi: {
    group: 'record',
    summary: {
      en: 'Turns one MIDI event into the signal events a keyboard playing it would publish, so a file can drive a work like live playing.',
      zh: '把一個 MIDI 事件轉成鍵盤彈它時會發布的訊號事件，讓一個檔案能像現場演奏那樣驅動作品。',
    },
    params: [
      { name: 'ev', type: 'Object', en: 'A MIDI event `{ type, ch, note?, vel?, cc?, value? }`. `type` is `noteon`, `noteoff`, `cc`, `pitchbend` (`value` 0..16383), `chanat` or `polyat`; velocities and values are 0..127.', zh: 'MIDI 事件 `{ type, ch, note?, vel?, cc?, value? }`。`type` 是 `noteon`、`noteoff`、`cc`、`pitchbend`（`value` 是 0..16383）、`chanat` 或 `polyat`，力度和數值是 0..127。' },
      { name: 'families', type: "'both' | 'legacy' | 'channel'", optional: true, default: "'both'", en: 'Which spellings to make: the classic names (`midi/note/on`, `midi/cc/64`, `midi/bend`), the per-channel ones (`midi/ch/1/note/60`, `midi/ch/1/cc/64`…), or both, as hardware does.', zh: '要做哪幾種寫法：傳統名稱（`midi/note/on`、`midi/cc/64`、`midi/bend`）、每頻道的（`midi/ch/1/note/60`、`midi/ch/1/cc/64`…），或兩種都做，就像硬體一樣。' },
      { name: 'device', type: 'String', optional: true, default: 'null', en: 'A device name to put in the classic note events.', zh: '要放進傳統音符事件的裝置名稱。' },
    ],
    returns: { type: 'Object[]', en: 'A list of `{ name, value }`. Note velocity becomes 0..1 (`vel` and `velocity` for the classic spelling), controllers 0..1, pitch bend -1..1. `chanat` and `polyat` exist only in the per-channel spelling.', zh: '`{ name, value }` 的清單。音符力度變成 0..1（傳統寫法有 `vel` 和 `velocity`），控制器是 0..1，彎音是 -1..1。`chanat` 和 `polyat` 只有每頻道的寫法。' },
    description: [
      {
        en: "It is what [`fromMidiFile()`](#fromMidiFile) uses to build a take from a `.mid` file: each event of the file becomes the signals a keyboard would have published, so [`TakePlayer`](#TakePlayer) can play it into a show. Call it yourself when you have MIDI events from somewhere else and want them on a [`Signals`](#Signals) bus.",
        zh: "[`fromMidiFile()`](#fromMidiFile) 用它把 `.mid` 檔做成 take：檔案裡每個事件都變成鍵盤本來會發布的訊號，這樣 [`TakePlayer`](#TakePlayer) 就能把它播進演出裡。如果你有別處來的 MIDI 事件，想放到 [`Signals`](#Signals) 匯流排上，就自己呼叫它。",
      },
    ],
    examples: [
      {
        code: `import { signalsOfMidi } from '@openav/record';

const ev = { type: 'noteon', ch: 1, note: 60, vel: 100 };
console.log(signalsOfMidi(ev));
// [{ name: 'midi/note/on', value: { note: 60, vel: 0.787402, velocity: 100, ch: 1 } },
//  { name: 'midi/ch/1/note/60', value: 0.787402 }]
console.log(signalsOfMidi(ev, { families: 'channel' }));   // [{ name: 'midi/ch/1/note/60', value: 0.787402 }]
console.log(signalsOfMidi({ type: 'cc', ch: 1, cc: 64, value: 127 }, { families: 'legacy' }));
// [{ name: 'midi/cc/64', value: 1 }]`,
        caption: { en: 'One note-on becomes two signals (the two spellings), or one when you pick a family. The sustain pedal at full is a 1.', zh: '一個 note-on 變成兩個訊號（兩種寫法），挑一種寫法就只有一個。踩到底的延音踏板是 1。' },
      },
    ],
    related: ['fromMidiFile', 'midiEventsOf', 'TakePlayer', 'Signals'],
    keywords: {
      en: ['midi to signals', 'convert', 'midi event', 'note on', 'cc', 'pitch bend', 'signal names'],
      zh: ['midi 轉訊號', '轉換', 'midi 事件', '音符開', '控制器', '彎音', '訊號名稱'],
    },
  },

  toMidiFile: {
    group: 'record',
    summary: {
      en: 'Writes a take as a Standard MIDI File (type 0) that opens in any DAW.',
      zh: '把一個 take 寫成標準 MIDI 檔（type 0），任何 DAW 都能開。',
    },
    params: [
      { name: 'take', type: 'Object', en: 'The take.', zh: '這個 take。' },
      { name: 'ppq', type: 'Number', optional: true, default: '960', en: 'Ticks per quarter note.', zh: '每四分音符幾個 tick。' },
      { name: 'bpm', type: 'Number', optional: true, en: 'The tempo written in the file. Left out, it is `take.meta.bpm`, and then 120.', zh: '寫進檔案的速度。沒給的話用 `take.meta.bpm`，再沒有就是 120。' },
    ],
    returns: { type: 'Uint8Array', en: 'The bytes of the `.mid` file.', zh: '`.mid` 檔的位元組。' },
    description: [
      {
        en: "One track holds note on and off with velocity, controllers (the sustain pedal is CC 64), pitch bend, and channel and poly aftertouch, each on its own channel; channel 10 stays the drums. The take's name becomes the track name, and a 4/4 time signature is written only so a DAW's grid looks sane. Times are kept to the millisecond whatever the tempo, so the file plays like the take. Only one naming family of the take is used, so nothing doubles ([`midiEventsOf()`](#midiEventsOf)). To save it, wrap it in a `Blob` of type `audio/midi`.",
        zh: "一條音軌裡有音符開關（含力度）、控制器（延音踏板是 CC 64）、彎音，以及頻道和單音的觸後，各自在自己的頻道。頻道 10 還是鼓。take 的名字會變成音軌名稱，另外寫了 4/4 拍的拍號，只是讓 DAW 的格線看起來正常。不管速度是多少，時間都精確到毫秒，所以檔案播出來跟 take 一樣。只會用 take 裡的一種名稱寫法，所以不會重複（[`midiEventsOf()`](#midiEventsOf)）。要存檔的話，把它包成型別是 `audio/midi` 的 `Blob`。",
      },
    ],
    examples: [
      {
        code: `import { toMidiFile, fromMidiFile } from '@openav/record';

const take = { v: 1, name: 'riff', durationMs: 1500, meta: { bpm: 120 }, events: [
  { t: 500, name: 'midi/note/on', value: { note: 60, vel: 0.8, ch: 1 } },
  { t: 900, name: 'midi/note/off', value: { note: 60, ch: 1 } },
] };
const bytes = toMidiFile(take);
console.log(bytes.constructor.name, String.fromCharCode(...bytes.slice(0, 4)));   // Uint8Array MThd
console.log(fromMidiFile(bytes).name);                                            // riff

const a = document.getElementById('app').appendChild(document.createElement('a'));
a.href = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
a.download = 'riff.mid'; a.textContent = 'Download riff.mid';`,
        caption: { en: 'Writes a two-event take as a MIDI file, reads it back by its name, and offers it as a download link on the page.', zh: '把只有兩個事件的 take 寫成 MIDI 檔，用名字確認讀得回來，並在頁面上提供下載連結。' },
      },
    ],
    related: ['fromMidiFile', 'midiEventsOf', 'TakeRecorder', 'quantizeTake'],
    keywords: {
      en: ['midi file', 'smf', '.mid', 'export', 'save midi', 'daw', 'download midi', 'standard midi file'],
      zh: ['midi 檔', 'smf', '.mid', '匯出', '存成 midi', 'daw', '下載 midi', '標準 midi 檔'],
    },
  },

  fromMidiFile: {
    group: 'record',
    summary: {
      en: 'Reads a Standard MIDI File into a take whose events are the signals a keyboard playing that file would publish.',
      zh: '把標準 MIDI 檔讀成 take，裡面的事件就是鍵盤彈這個檔案時會發布的訊號。',
    },
    params: [
      { name: 'bytes', type: 'Uint8Array | ArrayBuffer | Number[]', en: 'The bytes of the `.mid` file, for example `await file.arrayBuffer()`.', zh: '`.mid` 檔的位元組，例如 `await file.arrayBuffer()`。' },
      { name: 'name', type: 'String', optional: true, en: 'The name of the take. Left out, it is the track name in the file, then `\'take\'`.', zh: 'take 的名字。沒給的話用檔案裡的音軌名稱，再沒有就是 `\'take\'`。' },
      { name: 'families', type: "'both' | 'legacy' | 'channel'", optional: true, default: "'both'", en: 'Which signal spellings to produce, as in [`signalsOfMidi()`](#signalsOfMidi). The default is both, like hardware.', zh: '要產生哪幾種訊號寫法，跟 [`signalsOfMidi()`](#signalsOfMidi) 一樣。預設兩種都有，就像硬體。' },
    ],
    returns: { type: 'Object', en: 'A take. `meta.bpm` is the first tempo in the file (not set for SMPTE time).', zh: '一個 take。`meta.bpm` 是檔案裡第一個速度（SMPTE 時間的檔案不設）。' },
    description: [
      {
        en: "It reads type 0 and type 1 files (the tracks are merged), running status, tempo changes and SMPTE time division; system exclusive messages are skipped. A file that is not a MIDI file throws a `TypeError` (`fromMidiFile: not a MIDI file (no MThd)`), and one that ends early a `RangeError`. Play the result into a show with [`TakePlayer`](#TakePlayer): it drives a work like someone playing the file on a keyboard.",
        zh: "它讀 type 0 和 type 1 的檔案（音軌會合併）、running status、速度變化，和 SMPTE 時間單位。系統專用訊息會被略過。不是 MIDI 的檔案會丟出 `TypeError`（`fromMidiFile: not a MIDI file (no MThd)`），中途結束的檔案會丟出 `RangeError`。用 [`TakePlayer`](#TakePlayer) 把結果播進演出：它驅動作品的方式，就像有人在鍵盤上彈這個檔案。",
      },
    ],
    examples: [
      {
        code: `import { toMidiFile, fromMidiFile } from '@openav/record';

const take = { v: 1, name: 'riff', durationMs: 1500, meta: { bpm: 120 }, events: [
  { t: 500, name: 'midi/note/on', value: { note: 60, vel: 0.8, ch: 1 } },
  { t: 900, name: 'midi/note/off', value: { note: 60, ch: 1 } },
] };
const back = fromMidiFile(toMidiFile(take));
console.log(back.name, back.durationMs, back.meta.bpm, back.events.length);   // riff 1500 120 4
console.log(fromMidiFile(toMidiFile(take), { families: 'legacy' }).events.map((e) => e.name));
// ['midi/note/on', 'midi/note/off']
try { fromMidiFile(new Uint8Array([1, 2, 3, 4, 5])); } catch (e) { console.log(e.message); }
// fromMidiFile: not a MIDI file (no MThd)`,
        caption: { en: 'A round trip: the two notes come back as four events (both spellings), or two with `families: \'legacy\'`. Bytes that are not a MIDI file are refused.', zh: '來回一趟：兩個音符變回四個事件（兩種寫法），用 `families: \'legacy\'` 則是兩個。不是 MIDI 檔的位元組會被拒絕。' },
      },
    ],
    related: ['toMidiFile', 'signalsOfMidi', 'TakePlayer', 'normalizeTake'],
    keywords: {
      en: ['midi file', 'import midi', 'smf', '.mid', 'load midi', 'parse midi file', 'tempo'],
      zh: ['midi 檔', '匯入 midi', 'smf', '.mid', '載入 midi', '解析 midi 檔', '速度'],
    },
  },

  TakeRecorder: {
    group: 'record',
    summary: {
      en: 'Records what you play: it listens to every midi/* signal on a bus from start() to stop() and gives you a take.',
      zh: '錄下你彈的東西：從 start() 到 stop() 聽匯流排上每個 midi/* 訊號，然後給你一個 take。',
    },
    params: [
      { name: 'signals', type: 'Signals', optional: false, en: 'The [`Signals`](#Signals) bus to listen to.', zh: '要聽的 [`Signals`](#Signals) 匯流排。' },
      { name: 'filter', type: 'RegExp | Function', optional: true, default: '/^midi\\//', en: 'Which signals are the take: a pattern for the name, or `filter(name, value, meta)`.', zh: '哪些訊號算進 take：名稱的正規表達式，或 `filter(name, value, meta)`。' },
      { name: 'name', type: 'String', optional: true, default: "'take'", en: 'The name of the take.', zh: 'take 的名字。' },
      { name: 'meta', type: 'Object', optional: true, default: '{}', en: 'Free fields copied into the take: `{ bpm, device, notes }`. The device is found from the events if you leave it out.', zh: '複製進 take 的自由欄位：`{ bpm, device, notes }`。沒給裝置的話，會從事件裡找。' },
      { name: 'overdub', type: 'Boolean', optional: true, default: 'false', en: 'Also record what a [`TakePlayer`](#TakePlayer) is playing back right now. Off, a recorder ignores playback.', zh: '連 [`TakePlayer`](#TakePlayer) 正在播放的也錄下來。關著的時候，錄影器會忽略播放的內容。' },
      { name: 'throttleMs', type: 'Number', optional: true, default: '0', en: 'For continuous signals (knobs, aftertouch): at most one event per name in this many milliseconds.', zh: '對連續訊號（旋鈕、觸後）：每個名字在這麼多毫秒內最多一個事件。' },
      { name: 'now', type: 'Function', optional: true, default: 'performance.now', en: 'The clock, in milliseconds.', zh: '時鐘，單位是毫秒。' },
    ],
    description: [
      {
        en: "A `TakeRecorder` is an [`EventLog`](#EventLog) that listens to `midi/*` on a bus. Press record: `rec.start()`. Play. Press stop: `const take = rec.stop()`. The take is plain data, so it can be saved as JSON, turned into a `.mid` ([`toMidiFile()`](#toMidiFile)) or played back ([`TakePlayer`](#TakePlayer)). It has every member of `EventLog` (`mark()`, `between()`, `toJSON()`…).",
        zh: "`TakeRecorder` 是一個聽匯流排上 `midi/*` 的 [`EventLog`](#EventLog)。按下錄音：`rec.start()`。彈。按下停止：`const take = rec.stop()`。take 是單純的資料，所以可以存成 JSON、轉成 `.mid`（[`toMidiFile()`](#toMidiFile)），或播回去（[`TakePlayer`](#TakePlayer)）。`EventLog` 的所有成員它都有（`mark()`、`between()`、`toJSON()`…）。",
      },
      {
        en: "No stuck notes: a recorder stopped in the middle of a chord closes the keys that are still held (and a sustain pedal that is still down) in the take itself, at the stop time. The events are the signals as they were published, so a take from hardware holds both naming families (`midi/note/on` and `midi/ch/1/note/60`) and the device names, and playback publishes all of them. Pass `recorder.t0` of a video [`Recorder`](#Recorder) to `start()` to line the take up with the video.",
        zh: "不會有卡住的音：在彈和弦的中間停止錄影，還按著的鍵（和還踩著的延音踏板）會在停止的時間，於 take 本身裡被放開。事件就是訊號被發布時的原樣，所以從硬體錄的 take 兩種名稱寫法（`midi/note/on` 和 `midi/ch/1/note/60`）和裝置名稱都在，播放時全部發布出去。把影片 [`Recorder`](#Recorder) 的 `recorder.t0` 傳給 `start()`，就能讓 take 跟影片對齊。",
      },
    ],
    members: {
      start: { en: 'Clears the take and starts listening. `at` is the clock time of t = 0 (default now), for example `recorder.t0`. Returns the recorder.', zh: '清空 take 並開始聽。`at` 是 t = 0 的時鐘時間（預設現在），例如 `recorder.t0`。回傳錄影器本身。' },
      add: { en: 'Adds one event by hand, like `EventLog.add()` (see [`EventLog`](#EventLog)), and keeps track of which keys and pedals are held so `stop()` can release them.', zh: '手動加一個事件，跟 `EventLog.add()` 一樣（見 [`EventLog`](#EventLog)），並記錄哪些鍵和踏板按著，好讓 `stop()` 能放開它們。' },
      stop: { en: 'Stops listening, releases the keys and pedal still down, and returns the take `{ v: 1, name, createdAt, durationMs, events, meta }`.', zh: '停止聽，放開還按著的鍵和踏板，並回傳 take `{ v: 1, name, createdAt, durationMs, events, meta }`。' },
      toTake: { en: 'The take so far, as `EventLog.toTake()` does, with `meta.device` filled in from the events when it is missing.', zh: '到目前為止的 take，跟 `EventLog.toTake()` 一樣，沒有 `meta.device` 時會從事件裡補上。' },
    },
    examples: [
      {
        code: `import { TakeRecorder } from '@openav/record';
import { Signals } from '@openav/core';

const signals = new Signals();
let clock = 0;
const rec = new TakeRecorder({ signals, now: () => clock, meta: { bpm: 100 } });
rec.start();
clock = 100; signals.pulse('midi/note/on', { note: 60, vel: 0.9, ch: 1 });
clock = 400; signals.pulse('midi/note/off', { note: 60, ch: 1 });
clock = 450; signals.pulse('midi/note/on', { note: 62, vel: 0.5, ch: 1 });   // still held when we stop
clock = 600; signals.set('audio/rms', 0.2);                                  // not a midi/* signal
const take = rec.stop();
console.log(take.events.map((e) => e.t + ' ' + e.name).join(' | '));
// 100 midi/note/on | 400 midi/note/off | 450 midi/note/on | 600 midi/note/off
console.log(take.durationMs, take.meta);   // 600 { bpm: 100 }`,
        caption: { en: 'Records four events from a bus on a clock moved by hand. The last note was still held, so the take closes it at the stop time; the `audio/rms` signal is not part of the take.', zh: '用手動撥動的時鐘，從匯流排錄四個事件。最後一個音還按著，所以 take 在停止的時間把它放開。`audio/rms` 訊號不屬於這個 take。' },
      },
    ],
    related: ['TakePlayer', 'EventLog', 'toMidiFile', 'trimSilence', 'Recorder'],
    keywords: {
      en: ['record midi', 'take', 'record what you play', 'capture performance', 'looper', 'midi recorder', 'stop', 'overdub'],
      zh: ['錄 midi', 'take', '錄下彈的東西', '擷取演奏', '循環錄音', 'midi 錄音', '停止', '疊錄'],
    },
  },

  TakePlayer: {
    group: 'record',
    summary: {
      en: 'Plays a take back into a bus at the right times, so the work, its sound and its chord detector cannot tell it from you playing.',
      zh: '把一個 take 在對的時間播回匯流排，讓作品、它的聲音和和弦偵測器分不出這是播放還是你在彈。',
    },
    params: [
      { name: 'signals', type: 'Signals', optional: true, default: 'null', en: 'The [`Signals`](#Signals) bus to publish into. It also defines `take/playing` (0 or 1) and `take/position` (0..1).', zh: '要發布訊號的 [`Signals`](#Signals) 匯流排。它也會定義 `take/playing`（0 或 1）和 `take/position`（0..1）。' },
      { name: 'take', type: 'Object | String', optional: true, default: 'null', en: 'A take or its JSON. You can `load()` another one later.', zh: '一個 take 或它的 JSON。之後可以用 `load()` 換別的。' },
      { name: 'loop', type: 'Boolean', optional: true, default: 'true', en: 'Start again at the end. Off, it stops there.', zh: '到結尾就從頭再來。關掉的話，就停在結尾。' },
      { name: 'speed', type: 'Number', optional: true, default: '1', en: 'Playback speed: 0.5 is half speed.', zh: '播放速度：0.5 是一半的速度。' },
      { name: 'yieldToLive', type: 'Boolean', optional: true, default: 'false', en: 'Fall silent when someone plays live: a key-down that the player did not send (hardware, the on-screen piano, a phone) pauses the take and releases its notes.', zh: '有人現場彈的時候就安靜下來：播放器沒送出的按鍵（硬體、螢幕鋼琴、手機）會暫停 take 並放開它的音。' },
      { name: 'resumeAfter', type: 'Number', optional: true, default: '0', en: 'Seconds without live playing before a take that gave way resumes. 0 means it stays paused.', zh: '被讓位的 take 要等多少秒沒有現場演奏才恢復。0 表示維持暫停。' },
      { name: 'isLive', type: 'Function', optional: true, default: 'any key-down', en: '`isLive(name, value)`, what counts as live playing. The default is any key-down that did not come from the player; knobs do not count.', zh: '`isLive(name, value)`，什麼算現場演奏。預設是任何不是播放器送出的按鍵。旋鈕不算。' },
      { name: 'chase', type: 'Boolean', optional: true, default: 'true', en: 'When you `seek()`, send again the last value of every controller before that point (the sustain pedal, knobs), so the take is in the state it would have been in.', zh: '`seek()` 的時候，把那個時間點之前每個控制器的最後一個值再送一次（延音踏板、旋鈕），讓 take 處在原本該有的狀態。' },
      { name: 'clock', type: "'raf' | 'timer' | 'manual'", optional: true, en: 'Who drives the time: `\'raf\'` (`requestAnimationFrame`, the default in a page), `\'timer\'` (a 10 ms timer: tighter for sound and it keeps going, slower, in a background tab) or `\'manual\'` (you call `update(dt)` or `tick()`; the default where there is no `requestAnimationFrame`).', zh: '誰來帶動時間：`\'raf\'`（`requestAnimationFrame`，頁面裡的預設）、`\'timer\'`（10 毫秒的計時器：對聲音比較準，背景分頁也會繼續只是比較慢），或 `\'manual\'`（你呼叫 `update(dt)` 或 `tick()`，沒有 `requestAnimationFrame` 的環境預設是這個）。' },
      { name: 'maxStepMs', type: 'Number', optional: true, default: '250', en: 'The longest time one step may move forward. After a gap (a frozen tab) the take slows down instead of firing a burst of notes.', zh: '一步最多往前走多久。遇到空檔（分頁凍結）的時候，take 會變慢，而不是一口氣打出一堆音。' },
      { name: 'onEvent', type: 'Function', optional: true, default: 'null', en: '`onEvent({ t, name, value }, player)`, for every event as it is played.', zh: '`onEvent({ t, name, value }, player)`，每個事件播出時都呼叫。' },
      { name: 'onState', type: 'Function', optional: true, default: 'null', en: '`onState(state, reason)`, when it changes: `\'playing\'`, `\'paused\'`, `\'yielded\'` or `\'stopped\'`.', zh: '`onState(state, reason)`，狀態改變時呼叫：`\'playing\'`、`\'paused\'`、`\'yielded\'` 或 `\'stopped\'`。' },
      { name: 'now', type: 'Function', optional: true, default: 'performance.now', en: 'The clock, in milliseconds.', zh: '時鐘，單位是毫秒。' },
    ],
    description: [
      {
        en: "Give it a bus and a take, call `play()`, and it publishes the take's events into the bus at their times: the same signals a keyboard would have, so a work's visuals, its sound ([`Sound`](#Sound)) and its chord detector respond exactly as to your hands. That is what lets a work's preview play itself. Pass `clock: 'manual'` and call `player.update(dt)` from your loop for full control.",
        zh: "給它一個匯流排和一個 take，呼叫 `play()`，它就會在對的時間把 take 的事件發布到匯流排上：跟鍵盤會發的訊號一樣，所以作品的畫面、它的聲音（[`Sound`](#Sound)）和和弦偵測器的反應，跟面對你的雙手時完全一樣。這就是作品的預覽可以自己演奏的原因。傳 `clock: 'manual'` 並在你的迴圈裡呼叫 `player.update(dt)`，就能完全自己掌控。",
      },
      {
        en: "No stuck notes, ever: the player remembers every key it pressed, in the spelling it pressed it, and the sustain pedal, and lets go of them on pause, stop, seek and every loop wrap. With `yieldToLive`, playing a key yourself makes the take fall silent; with `resumeAfter: 8` it comes back 8 seconds after you stop. Its state is `\'playing\'`, `\'paused\'`, `\'yielded\'` or `\'stopped\'`, and `position` (milliseconds), `loops`, `playing` and `yielded` are plain properties.",
        zh: "絕不會卡音：播放器記得它按下的每個鍵（用它按下時的寫法）和延音踏板，並在暫停、停止、跳轉和每次循環回到開頭的時候放開它們。有 `yieldToLive` 的話，你自己彈一個鍵，take 就會安靜下來。有 `resumeAfter: 8` 的話，你停手 8 秒後它會回來。它的狀態是 `'playing'`、`'paused'`、`'yielded'` 或 `'stopped'`，`position`（毫秒）、`loops`、`playing`、`yielded` 是普通屬性。",
      },
    ],
    members: {
      duration: { en: 'Getter. The length of the loaded take, in milliseconds (0 without one).', zh: 'Getter。載入的 take 的長度，單位是毫秒（沒有就是 0）。' },
      progress: { en: 'Getter. How far through the take, 0..1.', zh: 'Getter。播到 take 的哪裡，0..1。' },
      state: { en: 'Getter. `\'playing\'`, `\'yielded\'` (gave way to live playing), `\'paused\'` (anywhere after the start, also at the end of a take that does not loop) or `\'stopped\'` (at the start). The `onState` callback still says `\'stopped\'` with the reason `\'end\'` when a take that does not loop ends.', zh: 'Getter。`\'playing\'`、`\'yielded\'`（讓位給現場演奏）、`\'paused\'`（開頭之後的任何位置，不循環的 take 播到結尾時也是）或 `\'stopped\'`（在開頭）。不循環的 take 播完時，`onState` 回呼仍然會說 `\'stopped\'`，原因是 `\'end\'`。' },
      load: { en: 'Replaces the take (stopping the current one and releasing its notes) and goes back to the start. `null` clears it. Returns the player.', zh: '換成另一個 take（會先停掉目前的並放開它的音），回到開頭。`null` 是清空。回傳播放器本身。' },
      play: { en: 'Plays from where it is, from the start after the end, or from `from` milliseconds: `play({ from })`. Returns `false` when there is nothing to play (no take, or an empty one), otherwise `true`.', zh: '從目前的位置播，在結尾之後則從頭播，或用 `play({ from })` 從 `from` 毫秒開始。沒有東西可以播（沒有 take 或是空的）就回傳 `false`，否則回傳 `true`。' },
      pause: { en: 'Pauses where it is and releases the sounding notes. Returns the player.', zh: '停在目前的位置並放開正在響的音。回傳播放器本身。' },
      stop: { en: 'Stops, rewinds to the start and releases the sounding notes. Returns the player.', zh: '停止，倒回開頭並放開正在響的音。回傳播放器本身。' },
      seek: { en: 'Jumps to `ms` milliseconds (held between 0 and the length), releasing the sounding notes, and with `chase` sends the controllers\' values at that point. Returns the player.', zh: '跳到 `ms` 毫秒（限制在 0 到長度之間），放開正在響的音，有 `chase` 的話會送出那個時間點的控制器數值。回傳播放器本身。' },
      update: { en: 'Advances by `dt` seconds. For `clock: \'manual\'`: call it with the seconds since the last frame from your loop.', zh: '前進 `dt` 秒。給 `clock: \'manual\'` 用：在你的迴圈裡用距離上一個畫面的秒數呼叫它。' },
      tick: { en: 'Advances to the clock time `nowMs` (default `now()`): what the `raf` and `timer` clocks call. The first call only records the time.', zh: '前進到時鐘時間 `nowMs`（預設 `now()`）：`raf` 和 `timer` 時鐘呼叫的就是這個。第一次呼叫只會記下時間。' },
      dispose: { en: 'Stops, releases every note and stops listening to the bus.', zh: '停止、放開每個音，並不再聽匯流排。' },
    },
    examples: [
      {
        code: `import { TakePlayer } from '@openav/record';
import { Signals } from '@openav/core';

const take = { v: 1, name: 'riff', durationMs: 600, events: [
  { t: 100, name: 'midi/note/on', value: { note: 60, vel: 0.9, ch: 1 } },
  { t: 400, name: 'midi/note/off', value: { note: 60, ch: 1 } },
] };
const signals = new Signals();
const heard = [];
signals.on('midi/note/on', (v) => heard.push('on ' + v.note));
signals.on('midi/note/off', (v) => heard.push('off ' + v.note));

const player = new TakePlayer({ signals, take, loop: false, clock: 'manual' });
console.log(player.state, player.duration);                   // stopped 600
player.play();
for (let i = 0; i < 20; i++) player.update(0.05);              // one second, in 50 ms steps
console.log(heard.join(', '), player.state);                   // on 60, off 60 paused`,
        caption: { en: 'A two-event take is played by hand-cranked time into a bus: the listeners hear the note start and end, and because `loop` is off the player stays at the end of the take (`state` reads \'paused\', `position` is 600).', zh: '用手搖的時間把只有兩個事件的 take 播進匯流排：聽的人聽到音開始和結束，因為 `loop` 關著，播放器就停在 take 的結尾（`state` 是 `\'paused\'`，`position` 是 600）。' },
      },
      {
        code: `import { TakePlayer } from '@openav/record';
import { Signals } from '@openav/core';

const take = { v: 1, name: 'loop', durationMs: 800, events: [
  { t: 0, name: 'midi/note/on', value: { note: 64, vel: 0.8, ch: 1 } },
  { t: 600, name: 'midi/note/off', value: { note: 64, ch: 1 } },
] };
const signals = new Signals();
const log = [];
signals.on('midi/note/on', (v) => log.push('note ' + v.note));
const player = new TakePlayer({ signals, take, yieldToLive: true, resumeAfter: 1, clock: 'manual',
  onState: (state, reason) => log.push(state + (reason ? ' (' + reason + ')' : '')) });
player.play();
player.update(0.1);
signals.pulse('midi/note/on', { note: 72, vel: 1, ch: 1 });   // someone plays live: the take gives way
log.push('live');
for (let i = 0; i < 25; i++) player.update(0.05);              // 1.25 s of silence: it comes back
console.log(log.join(' | '));
// playing | note 64 | note 72 | yielded (live) | live | playing (resume)`,
        caption: { en: 'A looping take gives way when a key is played live and returns one second after the playing stops. The log shows the order of events.', zh: '循環播放的 take 在有人現場按鍵時讓位，現場演奏停止一秒後又回來。log 顯示事件的順序。' },
      },
    ],
    related: ['TakeRecorder', 'EventLog', 'fromMidiFile', 'noteOffFor', 'Sound', 'Signals'],
    keywords: {
      en: ['play take', 'playback', 'replay', 'loop', 'midi playback', 'preview plays itself', 'yield to live', 'seek', 'stuck notes'],
      zh: ['播放 take', '播放', '重播', '循環', 'midi 播放', '預覽自己演奏', '讓位給現場', '跳轉', '卡音'],
    },
  },
};
