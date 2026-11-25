# 投影與影像輸出

把舞台送上投影機、第二個螢幕、OBS 或 TouchDesigner。`@openav/output`（0.12.0 起）會開一個顯示舞台的輸出視窗，把畫面彎過去，讓沒有正對牆面的投影機投出來還是長方形（四角校正），把一張畫布切給並排的好幾台投影機，並讓每個輸出都有黑場和亮度兩個參數。每一場演出也都有一個乾淨網址 `?output`：同一個頁面，只剩黑底上的舞台，給 kiosk 瀏覽器、OBS 的瀏覽器來源或 TouchDesigner 的 Web Render TOP 用。世界完全不知道這些事。範例 [29 投影輸出](https://openaudiovisual.com/examples/29-projector-output/) 在一個螢幕上就能跑完全部。

## 輸出視窗

在載入時宣告一次輸出，在點擊時開視窗（瀏覽器只在使用者有動作之後才開視窗）：

```js
import { createShow } from '@openav/show';
import { createOutputs } from '@openav/output';      // in the import map: "@openav/output": "../../packages/output/index.js"

const show = await createShow({ world });
const outputs = createOutputs(show, { outputs: [{ name: 'main' }], aspect: 16 / 9 });
button.onclick = () => outputs.open('main');
```

`createOutputs` 會馬上加好 `output/main/blackout` 和 `output/main/brightness` 兩個參數，把這個頁面上的舞台框成 16:9（置中，四周黑色），讓世界畫出投影機的形狀，並在控台放一個 **L4 · Output** 面板：每個輸出有 **Open**（鏡像視窗）、**Page**（第二個頁面，見下面）、**Edit** 和 **Grid**，顯示它開著沒、多大，最下面是 **Export layout**、**Import layout** 和 **Lead**。不想先宣告的話，`openOutput(show, { name })` 對單一個輸出做一樣的事（參數在開視窗時才出現）。

視窗是黑的，沒有控台，滑鼠兩秒不動游標就消失。視窗裡的按鍵：

| 按鍵 | 做什麼 |
|---|---|
| F | 全螢幕（再按一次離開） |
| E | 編輯四個角（見下面），做完再按 E 或 Esc |
| G | 測試圖：格線、十字、圓，四個邊各一種顏色（上紅、右綠、下藍、左黃） |
| B | 黑場開或關：它寫的是參數 `output/<name>/blackout`，所以控台看得到，按 ✕ 就清掉 |
| I | 說明卡 |

這些按鍵屬於輸出視窗。演出本身的按鍵（空白鍵、方向鍵、R）收不到它們，輸出視窗的按鍵也從來不會動到演出。

### 鏡像或頁面

填滿一個輸出有兩種方式，世界哪一種都不需要知道。

| | 鏡像（預設） | 頁面 |
|---|---|---|
| 怎麼做 | 舞台的畫布用 `canvas.captureStream()` 放進這個頁面開的視窗裡的 `<video>` | 這個頁面的乾淨網址 `?output=<name>&follow=oav-output`，當成一個 [同步](show-control.md#several-pages-one-show) 的從屬端 |
| 看到什麼 | 跟舞台完全一樣：每個滑桿、每個音符、每顆隨機的粒子 | 同一個世界再畫一次：時鐘一樣，被握住的值一樣（滑桿、MIDI 旋鈕、黑場），訊號、隨機數和累加 `dt` 的東西不一樣 |
| 解析度 | 舞台畫布在操作者頁面上的大小 | 輸出視窗自己的大小，自己的 GPU 運算 |
| 時間 | 大約晚一幀（沒有在投影機上量過） | 跟著時鐘：同一台機器差一兩幀，跨機器差大約一趟網路 |
| 機器 | 同一台機器、同一個瀏覽器 | 同一個來源的任何頁面，或經過 `node serve.js` 的中繼到別的瀏覽器、別台機器 |
| 演出頁面重新整理時 | 視窗停在最後一個畫面：從頁面再開一次（會回到同一個視窗） | 那個頁面照最後的速度自己跑，等主控端回來 |
| 演出頁面被藏起來時 | 降到 Loop 在背景分頁的速度：只有一個螢幕時，全螢幕的輸出蓋住演出頁面，就會藏起來 | 不受影響 |
| DOM 或 SVG 的世界 | 沒辦法鏡像（視窗會說明） | 可以 |

預設是鏡像，因為它對畫面永遠是對的：只算一次，表演者彈什麼，觀眾就看到什麼。在 headless Chromium 151 量過：影片的大小跟畫布一模一樣，單色區塊的顏色差 0（沒有偏色）。頁面適合第二台機器、比操作者畫布還大的輸出，或不是畫布的世界。用 `outputs.open('main', { mode: 'page' })`，或按 **Page**。

## 投影機上的全螢幕

只有一個螢幕時，輸出就是一個視窗：在裡面按 F。接了投影機或第二個螢幕，就把視窗拖過去再按 F。瀏覽器有 Window Management API（`window.getScreenDetails`，Chromium 有），而且電腦回報不只一個螢幕時，視窗的說明卡還會有 **Find the screens…**：瀏覽器會問一次這個網站能不能在你所有螢幕上擺視窗，接著列出每個螢幕（`名稱 · 寬×高`），點哪一個就用 `requestFullscreen({ screen })` 在那個螢幕全螢幕。權限只會在輸出視窗裡點擊時才詢問，不會自己跳出來，之前允許過的話會直接列出螢幕，不再問。被拒絕，或沒有這個 API（Safari、Firefox）時，說明卡會寫出一定可行的作法：把視窗拖過去，按 F。（[MDN：Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API/Using)、[Element.requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)：全螢幕需要使用者的動作，所以這裡每一次全螢幕，都是輸出視窗自己的按鍵或點擊。）

## 四角校正

投影機沒有正對牆面，投出來就是梯形。在輸出視窗按 E，把四個有編號的把手拖到螢幕的四個角（或牆上你要的範圍），畫面就會彎過去，投出來是長方形。用 1 到 4（或 Tab）選一個角，用方向鍵一次移 1 px，按住 Shift 一次 10 px。調的時候打開測試圖（G）：角對了，格線是直的，每一格一樣大。

| 按鍵（編輯中） | |
|---|---|
| 拖把手，或 1–4、Tab 加方向鍵 | 移動一個角（Shift 乘以 10） |
| H、V | 左右鏡像（背投）、上下鏡像（倒吊又不能自己翻的投影機） |
| O、Shift+O | 畫面順時針轉 90°、轉回來（側放的投影機） |
| [ ] | 黑邊，每次每邊 0.5 %，最多 45 %（overscan：把掉出螢幕的邊拉回來） |
| R、Shift+R | 四個角回到視窗的四個角、全部回到預設 |

四個點剛好決定一個投影轉換（單應矩陣，homography）。`cornerPin(corners, width, height)` 算出它，`toMatrix3d()` 把它寫成 CSS 的 `matrix3d(…)`，瀏覽器就用 GPU 把整個輸出彎過去，畫面和測試圖一起彎，什麼都不用重畫。投影機投不出來的四邊形（一個角被推進去、兩條邊交叉、三個角在同一條線上）會被拒絕：那個角停在原處。柔邊（`soft`，0 到 0.5）讓畫面的邊在每邊這個比例內淡到黑，它是淡出，不是邊緣融合。

### 設定檔

每個改動都存在這個瀏覽器裡，鍵是 `oav-output:<name>`，所以場地的設定重新整理後還在，同一個瀏覽器裡同名的乾淨頁面也會用它。**Export layout** 把每個輸出的場地設定寫成一個檔案，帶到下一次排練，**Import layout** 先檢查檔案，再存下來，套用到開著的視窗：

```json
{ "format": "open-audiovisual/output@1",
  "saved": "2026-12-01T09:30:00.000Z",
  "outputs": {
    "main": { "corners": [[0.02, 0.01], [0.97, 0.03], [0.99, 0.98], [0.01, 0.96]],
              "flipX": false, "flipY": false, "rotate": 0, "overscan": 0, "soft": 0 } } }
```

檔案記的是場地，程式碼記的是演出：檔案只存場地對每個輸出做了什麼（四個角，是輸出視窗的 0 到 1，翻轉、旋轉、黑邊、柔邊），從來不存它顯示什麼。裁切寫在程式碼裡。`parseOutputLayout()` 拒絕一個檔案時，會用一則訊息列出所有問題（`outputs.main.rotate: must be 0, 90, 180 or 270`），一次就能改好。

## 黑場與亮度

規則一：被演奏的東西都經過參數。每個輸出有兩個參數，在任何視窗打開之前就宣告好：

| 參數 | 範圍 | |
|---|---|---|
| `output/<name>/blackout` | 0 或 1 | 1：這個輸出全黑，不管它在顯示什麼 |
| `output/<name>/brightness` | 0 到 1，預設 1 | 蓋在畫面上的一層黑紗（蓋 `1 - brightness`），不是投影機的燈泡 |

所以控台的滑桿、MIDI 推桿、時間軸和手機，推投影機的方式跟推世界一樣。範例 29 在時間軸的最後 8 秒把投影機淡出，也把它交給任何控制器的音量推桿：

```js
timeline: { total: 48, automation: { 'output/main/brightness': [[0, 1], [40, 1], [48, 0]] } },
routes: [{ source: 'midi/cc/7', target: 'output/main/brightness' }],
```

## 一張畫布給兩台投影機

一張寬畫布，兩台投影機並排：宣告兩個輸出，各自裁切舞台的一塊（`{ x, y, w, h }`，0 到 1），再把舞台的形狀設成兩台加起來的形狀。

```js
const outputs = createOutputs(show, {
  outputs: [{ name: 'left', crop: { x: 0, y: 0, w: 0.5, h: 1 } }, { name: 'right', crop: { x: 0.5, y: 0, w: 0.5, h: 1 } }],
  aspect: 32 / 9,                 // two 16:9 projectors
});
```

每個輸出有自己的四個角、自己的參數和自己的視窗（各自用一次點擊打開：瀏覽器一個動作只開一個視窗）。形狀不同時，`fit` 決定裁切的畫面怎麼放進視窗：`contain`（預設，留黑邊）、`cover`（填滿，切掉多的）或 `stretch`。範例 29 加上 `?pair` 就是這樣。兩個畫面接起來的地方是一條硬接縫：邊緣融合（兩台投影機重疊、用對好的柔和斜坡和亮度接起來）不在這個套件裡。用一張照片拼出一整面投影牆是另一件事，另外有一個 pull request 在做（`@openav/tile`）。

## 乾淨網址

任何用 `createShow()` 做的頁面，網址說要的時候就變成乾淨的輸出。控台、鋼琴、提示、MIDI 按鈕、手機卡片、範例的導覽卡，以及演出自己標上 `oav-operator` 這個 class 的東西都不顯示，控台的按鍵也關掉。舞台在黑底上填滿視窗，用這個瀏覽器替那個輸出名字存下的四個角，按鍵跟輸出視窗一樣（E、G、F、B、I）。世界的作品署名留著：署名永遠不藏。

| 鍵 | 例子 | |
|---|---|---|
| `output` | `?output`、`?output=front` | 這個頁面是乾淨的輸出，名字是 `main` 或 `front` |
| `crop` | `&crop=0,0,0.5,1` | 舞台的 x、y、w、h，0 到 1。沒寫就用程式碼替那個名字宣告的裁切 |
| `aspect` | `&aspect=32:9` | 舞台的形狀。沒寫就用程式碼的 `aspect` |
| `fit` | `&fit=cover` | `contain`（預設）、`cover`、`stretch` |
| `follow` | `&follow=oav-output` | 跟著演出頁面的時鐘和被握住的值，自己不收輸入 |
| `via` | `&via=relay`、`&via=ws://10.0.0.5:8080/relay` | 經過這台伺服器的 `/relay`（別的瀏覽器或別台機器）跟隨，而不是 BroadcastChannel |
| `play` | `&play` | 一載入就播放時間軸：在 OBS 或 TouchDesigner 裡沒人能按空白鍵 |

`outputs.url('main', { follow: 'oav-output', via: true })` 會替你寫出網址，面板上的 **Lead** 也會。頁面要能跟隨，演出頁面必須當主控端：按面板上的 **Lead**、在程式碼裡呼叫 `outputs.lead()`，或用 `?lead` 打開範例 29。跨瀏覽器（OBS 和 TouchDesigner 各自跑自己的瀏覽器）或跨機器時要經過中繼：在演出的機器上跑 `node serve.js`，用 `via=relay`。

不跟隨的乾淨頁面會自己跑整場演出：它的時間軸只在有 `&play` 時才播，輸入是演出宣告的那些，但沒有人在操作。跟隨的乾淨頁面不收輸入（鍵盤鋼琴、MIDI、麥克風、鏡頭、手機都關掉），顯示演出頁面的時鐘和被握住的值說的內容，在演出頁面彈的音符不會傳到它那裡。要一模一樣地帶出現場演奏，就用鏡像（見上面），或擷取演出頁面的視窗（OBS，見下面）。

## 做法：一般投影機

檢查過的：輸出視窗、它的按鍵、四角校正、重新整理後設定還在、乾淨網址，都在一台機器上的 headless Chromium 151 裡。還沒有：真的投影機、第二個實體螢幕，以及選螢幕時的權限詢問。

1. 從這台機器跑演出：`node serve.js`，再用 Chrome 打開 `http://localhost:8080/examples/29-projector-output/`（或你的演出）。
2. 接上投影機，把電腦設成延伸桌面（不是鏡像顯示）。
3. 按 **Open output window**。把視窗拖到投影機上，在視窗裡按 F（或按 **Find the screens…**，點投影機）。
4. 按 G，再按 E。把四個角拖到螢幕的四個角，直到格子看起來一樣大。按 E 結束。
5. 再按一次 G 回到演出畫面。設定已經存好：重新整理、再開一次視窗，都落在同一個位置。
6. 按 **Export layout**，把檔案跟演出放在一起：下次在這個場地排練時匯入它。
7. 觀眾進場前：試一次 B（黑場）和它的推桿，以及時間軸的結尾。

只負責投影的機器（kiosk），用 Chrome 的 kiosk 模式打開乾淨網址。`--kiosk` 是「Enable kiosk mode」（不是 Chrome OS 的 kiosk 模式），`--autoplay-policy=no-user-gesture-required` 讓頁面的聲音不用點擊就能開始，`--user-data-dir` 是瀏覽器存放所有狀態的資料夾，給它一個自己的資料夾，kiosk 存下的四個角和權限就跟你平常用的設定檔分開：

```bash
# macOS; the Chrome path differs on Windows and Linux. To be confirmed on the venue machine.
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --kiosk --autoplay-policy=no-user-gesture-required \
  --user-data-dir="$HOME/oav-kiosk" "http://localhost:8080/examples/29-projector-output/?output&play"
```

這些參數出自 Chromium 的參數列表（[peter.sh](https://peter.sh/experiments/chromium-command-line-switches/)），自動播放的參數出自 [Chrome 的自動播放政策](https://developer.chrome.com/blog/autoplay)（靜音的自動播放永遠允許，這個參數解除聲音要有使用者動作的規定）。kiosk 視窗開在 Chrome 選的螢幕上：是哪一個，以及 `--start-fullscreen` 或 `--window-position` 能不能把它移到投影機上，要在場地的機器上確認。kiosk 設定檔的四個角要在那個設定檔裡設：先不加 `--kiosk` 用它打開乾淨網址，按 E，或在那個設定檔的一般頁面匯入設定檔。

場地檢查清單，在 [演出前檢查清單](show-control.md#pre-show-checklist) 之外再加上：

- [ ] 顯示器是延伸桌面，投影機自己的梯形校正關掉或歸零（只在一個地方校正），解析度是它的原生解析度
- [ ] 電腦不會睡眠、變暗或跳通知，投影機自己的休眠也關掉
- [ ] 演出從這台機器跑（`node serve.js`），不從網路跑：演出時不需要網路
- [ ] 設定檔匯出了，也試過重新整理
- [ ] 黑場從控台、從它的推桿，以及在輸出視窗按 B 都試過
- [ ] 演出頁面重新整理時怎麼辦：再開一次輸出（鏡像），或什麼都不用做（頁面）
- [ ] 用 kiosk iPad 或手機當遙控器：見 [手機](remote.md)，在封閉的網路裡用這台機器的中繼

## 做法：TouchDesigner

檢查過的：下面的參數名稱，出自 Derivative 的 Web Render TOP 頁面（[docs.derivative.ca/Web_Render_TOP](https://docs.derivative.ca/Web_Render_TOP)，以及 TouchDesigner 2025.33230 離線說明裡的同一頁），以及乾淨網址在 headless Chromium 裡的表現。沒有在 TouchDesigner 裡跑過：這裡的每一步都要在軟體裡確認。TouchDesigner 2025.33230 內附 Chromium Embedded Framework 132.3.1、Chromium 132.0.6834.83（從安裝的程式讀出來的），Web Render TOP 接上 Info DAT 會列出它實際用的版本。

1. 在演出的機器上跑 `node serve.js`，用中繼上的主控端打開演出頁面：範例 29 用 `http://localhost:8080/examples/29-projector-output/?lead`（或按控台上的 **Lead**，或在程式碼裡用 `via: true` 呼叫 `outputs.lead()`）。
2. 在 TouchDesigner 加一個 **Web Render TOP**。在它的 Web Render 頁把 **URL or File** 設成會跟隨的乾淨網址：`http://localhost:8080/examples/29-projector-output/?output&follow=oav-output&via=relay`。**Active** 保持開著。
3. 在它的 Common 頁把 **Output Resolution** 設成 **Custom Resolution**，**Resolution** 設成你要的大小（1920 × 1080）。頁面會用這個大小畫，有 `?output` 時舞台會填滿它。
4. **Audio Options**：只要畫面就保持 **Off**（演出的聲音留在演出的機器上），要在 TouchDesigner 裡拿到聲音就選 **Route to Audio Web Render CHOPs**。改這個選項會重新啟動瀏覽器程序（文件這樣寫）。
5. **Maximum Render Frame Rate**：頁面在 TouchDesigner 裡的影格率（文件說可以設超過 60，但不保證做得到）。**Cook Always** 讓它每一格都 cook。

在裡面不能用的，就框架這邊能判斷的：

- **Web MIDI。** Derivative 的頁面沒有提到它。`navigator.requestMIDIAccess` 在 Web Render TOP 裡存不存在、會不會詢問，要確認。加上 `&follow` 時頁面根本不會要 MIDI（從屬端的輸入是關的）。MIDI 請直接接進 TouchDesigner，或在演出頁面上彈。
- **鏡頭和麥克風。** Web Render TOP 有 **Enable Media Stream**（「Allows the web render instance to use the mic and the camera」）。會不會跳出權限詢問、能不能回答，要確認。從屬端的頁面兩個都不會要。
- **點擊和按鍵。** 在裡面沒有人會點：你自己 Chrome 裡存的四個角，在 TouchDesigner 的瀏覽器裡不存在（它有自己的儲存空間 **User Cache Directory**，預設是暫時的）。請在 TouchDesigner 裡校正畫面：**Corner Pin TOP** 能移動影像的四個角點（[Corner Pin TOP](https://docs.derivative.ca/Corner_Pin_TOP)），palette 裡也有做投影映射的 **stoner**。時間軸從演出頁面開始播（或在不跟隨的頁面加上 `&play`）。
- **彈出視窗。** 頁面的彈出視窗會被忽略，或用 **Redirect Popups** 在原地換過去：沒辦法從裡面開輸出視窗。

另一個方向已經有了：演出的訊號經過橋接程式用 OSC 送進 TouchDesigner（[OSC 輸出](show-control.md#osc-output)、[TouchDesigner 當接收端](show-control.md#touchdesigner-as-the-receiver)）。畫面走 Web Render TOP、控制走 OSC，兩條可以同時跑。

## 做法：OBS

檢查過的：下面的屬性和按鈕名稱，出自安裝的 OBS Studio 33.0.2（它自己的英文和繁體中文介面文字），以及 OBS 關於 [瀏覽器來源](https://obsproject.com/kb/browser-source) 和 [虛擬相機](https://obsproject.com/kb/virtual-camera-guide) 的頁面，NDI 出自 [DistroAV](https://github.com/DistroAV/DistroAV)。沒有在 OBS 裡跑過：這裡的每一步都要在軟體裡確認。OBS 33.0.2 的瀏覽器來源內附 Chromium 150.0.7871.287（從安裝的程式讀出來的）。寫這一章的機器沒有裝 DistroAV。

**瀏覽器來源。** 在演出的機器上跑 `node serve.js`，用主控端打開演出頁面（`…/29-projector-output/?lead`）。在 OBS 加一個 **瀏覽器** 來源：

1. **網址**：`http://localhost:8080/examples/29-projector-output/?output&follow=oav-output&via=relay`。
2. **寬度** 和 **高度**：畫面的大小，1920 × 1080（OBS 的預設是 800 × 600）。有 `?output` 時舞台會填滿它。
3. **使用自訂的畫面速率** 和 **FPS (影格率)**：60 fps 的畫布就設 60（OBS 的預設是 30）。
4. **使用 OBS 控制音訊**：OBS 裡處理頁面聲音的開關。它對演出有什麼作用要確認：演出的聲音要點擊才開始，從屬端的頁面自己也不出聲，所以只要畫面時沒有差別。
5. **自訂CSS**：OBS 的預設會把背景變透明，乾淨頁面會自己塗黑，保持原樣就好。
6. **不可見時關閉來源**：關掉，切到別的場景時頁面才會繼續跟隨。

**從 OBS 送出去。** **啟動虛擬相機**（在 控制項 停駐視窗）把 OBS 的節目畫面、一個場景或一個來源變成一台相機，給 Zoom、瀏覽器或 TouchDesigner 用（旁邊的齒輪選要哪一個）。NDI 用 DistroAV 外掛（OBS 31.1.1 以上、NDI Runtime 6.3 以上，macOS 用 `brew install --cask distroav/tap/distroav`），它加上送出節目畫面的 **NDI Output**，以及送出單一來源的 **NDI Filter**。它們在 OBS 選單裡的哪個位置，要裝了外掛再確認。

**改用視窗擷取。** 要一模一樣地送出表演者彈的東西（音符、粒子、鏡像），就擷取視窗，不要再載入一次頁面：**macOS 螢幕擷取**（或 **視窗擷取**），對準輸出視窗。輸出視窗沒有控台，游標也會藏起來，所以擷取出來是乾淨的。讓它留在某個螢幕上（被藏起來的視窗可能不會畫），需要的話用來源的 **裁剪** 切掉多的部分。

## 檢查了什麼

headless Chromium 151（Playwright 1.62），一台機器，沒有給任何權限（沒有 MIDI、序列埠、鏡頭、麥克風，也沒有視窗管理）：

- 範例 29 載入時沒有主控台錯誤（`ws://…7457` 後台監看的警告是預期的），舞台框成 16:9
- **Open output window** 在點擊時開出視窗，影片的大小跟畫布一模一樣，影格一直往前走，單色區塊的顏色完全沒有差別
- E 顯示四個把手，拖兩個角、用按鍵推第三個角，視窗的 `matrix3d` 跟著變，存下來的正好是那幾個角。G 顯示測試圖。B 寫入 `output/main/blackout`，黑紗變全黑。從控台把亮度設成 0.4，黑紗是 0.6。輸出視窗的按鍵從來沒有動到演出
- 演出頁面重新整理後，輸出在同一個視窗裡再打開，四個角一樣，畫面繼續動
- **Page** 用乾淨網址開出一個從屬端：它跟著演出頁面的時鐘（差 0.08 秒）和被握住的值
- 乾淨網址不顯示控台、鋼琴、提示、導覽卡或操作按鈕，用的是存下來的四個角。`?pair&output=left` 用視窗兩倍寬畫 32:9 的舞台，只露出左半邊

沒有檢查：真的投影機、第二個實體螢幕、Window Management 的權限詢問和在指定螢幕全螢幕、Chrome 的 kiosk 模式、TouchDesigner、OBS、NDI。
