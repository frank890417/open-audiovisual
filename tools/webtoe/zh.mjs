// /zh/webtoe/ 字串，繁體中文（台灣）。結構必須和 en.mjs 一模一樣，
// tools/build-webtoe.mjs 會檢查。字串可以含 inline HTML。數字、程式碼與網址放在 page.mjs，兩種語言共用。
// 事實來自 WebToe 的 README（github.com/frank890417/WebToe），內容要跟著它更新。

export default {
  meta: {
    title: 'WebToe｜open-audiovisual 背後的引擎',
    description: 'WebToe 是網頁原生、節點式的即時影像資料流引擎。在瀏覽器裡像用 TouchDesigner 一樣接運算子，跑在 WebGL2 或 WebGPU 上，沒有任何執行期相依套件，還能打開真的 TouchDesigner 專案。透過 @openav/world-webtoe，一張 WebToe 網路就能變成 open-audiovisual 的世界。',
    ogDescription: 'WebToe 負責引擎，open-audiovisual 負責演出。',
    ld: '網頁原生、節點式的即時影像資料流引擎與編輯器，操作方式接近 TouchDesigner，跑在 WebGL2 與 WebGPU 上，沒有執行期相依套件，可以匯入 TouchDesigner 的 .toe 與 .tox 專案。',
  },

  hero: {
    eyebrow: '姊妹專案 · 引擎',
    sub: '瀏覽器裡的節點式即時影像引擎。',
    lede: '像在 TouchDesigner 裡一樣接運算子：ramp 接 transform 再接 composite，LFO 透過算式推動參數，每個節點都有即時預覽。WebToe 是從零開始為網頁寫的引擎，跑在 WebGL2 和 WebGPU 上，也能打開你手上現有的 TouchDesigner 專案。',
    tagline: '<strong>WebToe 負責引擎，open-audiovisual 負責演出。</strong>一張 WebToe 網路可以當成 open-audiovisual 的世界來演奏，有名字的訊號也很自然就能對上 CHOP 的通道。',
    doorsLabel: '打開 WebToe',
    doors: [
      { who: '打開', what: '編輯器直接在瀏覽器裡跑，什麼都不用裝' },
      { who: '閱讀', what: 'WebToe 文件' },
      { who: '原始碼', what: 'GitHub 上的 frank890417/WebToe，MIT 授權' },
      { who: '試試看', what: '一個 2022 年的原始 .toe 檔，直接在瀏覽器裡解開' },
    ],
    shotAlt: 'WebToe 編輯器正在跑 lfo garden 範例：三組 ramp 和 transform 接到 composite、hsv adjust 和 out，每個節點都有即時預覽，右邊是輸出畫面。',
    shotCaption: '範例 03 lfo garden：三組 ramp 由 LFO 透過算式帶著旋轉，疊合之後再偏移色相。每個節點都即時預覽。',
  },

  engine: {
    eyebrow: '01 · 引擎',
    title: '開一個分頁，直接接線',
    lede: '節點編輯器、即時 GPU 引擎，還有一個參數面板，每個數值都可以寫成算式。不用安裝，也不用建置。',
    stats: [
      '整個 app 的 JavaScript 就這麼大，沒有任何執行期相依套件',
      '兩套 GPU 後端功能對齊，共用同一份 pass 介面',
      '60 個真實 TouchDesigner 專案、28,698 個節點裡能直接跑的比例，也就是實測的語料覆蓋率',
      '個內附的範例專案，打開就能跑，其中兩個是 TouchDesigner 在 2022 年存下的原始 .toe 檔',
    ],
    statsSource: '數字來自 WebToe 的 README，都是在真實專案上量的。',
    points: [
      { head: '邊接邊看。', text: '按 Tab 新增運算子，拖曳接線，點進容器裡面。每個節點都有即時預覽，全部由同一個 GPU 合成器負責畫，不掉格。' },
      { head: '到處都能寫算式。', text: '任何參數都可以是一條算式：<code>op(\'lfo1\')[\'chan1\']</code>、<code>parent().par.speed</code>、<code>time.seconds * 0.2</code>。' },
      { head: '即時的 GPU 引擎。', text: '用拉取式的 cook 迴圈運作。TOP 在 GPU 上算，CHOP 推動參數：回授、模糊、合成、位移、邊緣偵測、鏡頭與影片輸入，還有一條 3D 管線，包含幾何、攝影機、燈光和 render TOP。' },
      { head: '六個運算子家族。', text: 'TOP、CHOP、SOP、MAT、COMP、DAT。專案可以無損存成 <code>.webtoe.json</code>，這是 WebToe 自己的格式，帶有版本號。' },
    ],
    shotAlt: 'WebToe 編輯器裡的範例 02 feedback trails：rectangle、transform、composite、blur、out 幾個運算子，另有一組 feedback 和 level 繞回 composite。',
    shotCaption: '範例 02 feedback trails。滑鼠在輸出畫面上移動，方塊就會透過回授迴圈拖出殘影。',
  },

  stack: {
    eyebrow: '02 · 搭配 open-audiovisual',
    title: 'WebToe 負責引擎，open-audiovisual 負責演出',
    lede: 'open-audiovisual 管輸入、映射、時間軸和後台，WebToe 負責畫。轉接套件 <code>@openav/world-webtoe</code> 把一張 WebToe 網路變成一個世界，旋鈕、和弦或一隻手都能演奏它。',
    steps: [
      { name: '訊號', text: '舞台上發生了一件事：按下一個琴鍵，轉了一顆旋鈕。它會變成一個有名字的訊號。' },
      { name: '參數', text: '映射器把訊號接到世界的參數上，可以設曲線和平滑。時間軸也能推同一個參數。' },
      { name: '訊息', text: '世界用 iframe 把 WebToe 嵌進來。參數一動，就把新的數值傳進去。' },
      { name: '網路', text: '在 WebToe 網路裡，寫了 <code>ext()</code> 的參數會跟著動。第二個數字是預設值，還沒接上任何東西時就用它。' },
    ],
    showTitle: '演出端：世界就是一張 WebToe 網路',
    showText: '範例 04 的精簡版。參數的 key 就是網路裡在聽的名字。專案檔透過 <code>?project=</code> 交給 WebToe。',
    patchTitle: '網路端：會聽的參數',
    patchText: '範例 <code>garden.webtoe.json</code> 裡的兩條算式。任何參數只要寫進 <code>ext()</code>，就能拿來演奏。',
    messageTitle: '從任何網頁來控制',
    messageText: '這些都是一般的 <code>postMessage</code> 呼叫，任何嵌入 WebToe 的網頁都能用。數值必須是有限的數字。<code>webtoe:load</code> 可以換一個專案，不用重新載入 iframe。',
    links: { example: '打開範例 04 WebToe 舞台', source: '@openav/world-webtoe 原始碼', docs: '文件裡的轉接套件說明' },
  },

  import: {
    eyebrow: '03 · TouchDesigner 專案',
    title: '拖進 .toe 就能打開',
    lede: '不用安裝，也不用先跑指令。WebToe 直接在瀏覽器裡解開 TouchDesigner 的檔案。支援的運算子會即時跑起來，其他的留成替身節點，名字、接線、版面、參數和 Python 程式碼都保留著，匯入報告會列出處理結果。',
    factsTitle: '跟 toeexpand 逐一比對過',
    facts: [
      '個正式專案檔，從 3 KB 到 151 MB，解出來的檔案逐位元組完全相同（共 553,230 個檔案）',
      '是原生解碼全部 125 個檔案的時間，TouchDesigner 自己的 <code>toeexpand</code> 要 266.5 s',
      '解開一個 151 MB 的演出檔。一件每日創作只要幾毫秒。',
      '一個 20 MB、14,710 個節點的真實演出檔，從拖進來到整張網路跑起來',
    ],
    tryLink: '用一個 2022 年的原始專案檔試試看',
    shotAlt: 'WebToe 匯入一個 213 個節點的正式專案後的 TouchDesigner 匯入報告：71 個節點能跑，142 個留成替身，9 條算式完成轉換。',
    shotCaption: '一個 213 個節點的正式專案的匯入報告：哪些能跑、哪些留成替身、哪些算式轉換成功。',
    researchLabel: '僅供研究用途',
    research: '<strong>原生 .toe 解碼僅供研究用途。</strong>這個功能用來研究你自己擁有的專案檔怎麼互通，和 Derivative Inc. 沒有關係，也沒有得到它的背書，TouchDesigner 任何一次改版都可能讓它失效。Derivative 已經宣布會推出官方的 JSON 專案格式，WebToe 的專案載入介面也已經準備好接上它。',
    formatLink: '格式筆記與驗證方式（TOE-FORMAT.md）',
    bridgeTitle: '參考路徑：你自己的 TouchDesigner',
    bridgeText: '原生解碼失敗時，WebToe 會改用每套 TouchDesigner 都附的官方工具 <code>toeexpand</code>，透過一支小小的橋接程式在你的電腦上執行。橋接只聽 127.0.0.1，沒有任何相依套件，專案檔不會離開你的電腦。',
  },

  legal: 'WebToe 是獨立的開源專案，和 Derivative Inc. 沒有關係，也沒有得到它的背書。TouchDesigner 是 Derivative Inc. 的商標。WebToe 不含任何 Derivative 的程式碼、執行檔或素材。',
};
