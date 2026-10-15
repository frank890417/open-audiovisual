// 首頁字串，繁體中文（台灣），輸出到 /zh/。
// 結構必須和 en.mjs 一模一樣（每個 key、每個陣列長度），tools/build-home.mjs 會檢查。
// 字串可以含 inline HTML。程式碼、訊號名稱與網址放在 page.mjs，兩種語言共用。

import { getFacts, zhWords, minor } from '../site/facts.mjs';
const facts = getFacts();

export default {
  lang: 'zh',
  htmlLang: 'zh-Hant-TW',
  hreflang: 'zh-Hant',
  ogLocale: 'zh_TW',
  ldLanguage: 'zh-Hant-TW',

  meta: {
    title: 'open-audiovisual｜網頁原生的影音表演框架',
    description: '零建置的 JavaScript 框架：MIDI 控制器、麥克風、手勢和手機變成訊號，驅動瀏覽器裡的 p5.js、WebGL 或 WebToe 世界。MIT 授權。',
    definition: 'open-audiovisual 是零建置的 JavaScript 框架：把 MIDI 控制器、麥克風、手勢與手機變成訊號，驅動瀏覽器裡的 p5.js、WebGL 或 WebToe 世界，用於現場影音表演。MIT 授權。',
    ogDescription: 'Hydra 給你即興，cables 給你平台，Tone 給你聲音。open-audiovisual 給你一場演出。',
    ld: '網頁原生、零建置、零相依的 JavaScript 影音表演框架：MIDI、音訊、和弦、肢體姿態與手機等輸入發出有名字的訊號，映射層把訊號接到參數，演算的世界依參數產生畫面與聲音，另有時間軸、導演控台與後台監看。',
  },

  seo: {
    ogImageAlt: 'open-audiovisual：網頁原生的影音表演框架。訊號、映射、參數、世界。MIDI、音訊、和弦、手勢、手機。字標旁有一團橘色的諧波圖。',
  },

  ui: {
    skip: '跳到主要內容',
    navLabel: '頁面區塊',
    nav: { play: '彈奏', how: '運作方式', works: '作品', start: '開始', controllers: '控制器', docs: '文件', webtoe: 'WebToe', agents: '給 AI 代理' },
    langLabel: '語言',
    copy: '複製',
    copied: '已複製',
    open: '開啟',
    source: '原始碼',
    home: 'open-audiovisual 首頁',
    // 兩個版本並列，網站上寫到版本的地方（首頁、/p5/、/docs/）都用這一句，連到 /zh/changelog/
    versions: `oav-p5 ${minor(facts.p5Version)} · 框架 ${minor(facts.version)}`,
  },

  hero: {
    eyebrow: 'MIT 授權 · 零建置 · 零相依',
    sub: '網頁原生的影音表演框架。',
    lede: '琴鍵、旋鈕、人聲、手勢、手機，都會變成有名字的<em>訊號</em>（signal）。<em>映射</em>（mapping）把訊號接到<em>參數</em>（param），你的<em>世界</em>（world）讀這些參數，變成畫面和聲音。在瀏覽器分頁、投影機、舞台上都一樣。',
    doorsLabel: '從哪裡開始',
    doors: [
      { who: '我做表演', what: `看看它做得出什麼，直接玩${zhWords(facts.exampleCount)}件作品`, href: '#works' },
      { who: '我寫程式', what: '一分鐘跑起來，再寫自己的世界', href: '#start' },
      { who: '我是 AI 代理', what: '先讀 /llms.txt，再讀 AGENTS.md', href: 'llms.txt' },
      { who: '我用 p5.js／OpenProcessing', what: '加一行，就有控制器、聲音、鼓機和錄影', href: 'zh/p5/' },
    ],
  },

  inst: {
    eyebrow: '01 · 彈奏',
    title: '這台樂器就是框架本身在跑',
    stageLabel: 'L3 世界 · 擺錘繪圖機',
    canvasLabel: '擺錘繪圖機：你彈的每個音，會依音高擺動一支擺錘。和諧的和弦畫出乾淨的圖形，音堆畫出糾纏的線。',
    noscript: '這台樂器是框架即時在跑的樣子，開啟 JavaScript 就能彈。',
    statusSim: '模擬演奏者正在彈。換你了：點琴鍵，或按電腦鍵盤 A 到 L。',
    statusYou: '現在是你在彈。在畫面上拖曳，可以改色相和扭轉。',
    statusIdle: '點琴鍵或畫面，或按電腦鍵盤 A 到 L，就能彈。',
    controlsLabel: '樂器開關',
    btnAuto: '自動演奏',
    btnSound: '聲音',
    btnMidi: 'MIDI',
    btnMic: '麥克風',
    keysHint: 'A 到 L 彈奏 · Z／X 換八度 · 拖曳畫面',
    keysLabel: '琴鍵',
    midiNone: '找不到 MIDI 裝置。接上之後，再按一次 MIDI。',
    midiOn: 'MIDI 已開啟，{n} 個裝置。調變輪（CC 1）也會帶動扭轉。',
    micOn: '麥克風已開啟，音量現在帶動能量。',
    micDenied: '這個瀏覽器擋下了麥克風。',
    soundLoading: '正在載入聲音引擎…',
    soundOn: '聲音已開啟，可以在開關下方換樂器。',
    consonance: '協和度',
    voices: '聲部',
    bayTitle: '跳線盤',
    bayLive: '即時',
    srcHead: '訊號',
    srcNote: '正在發生什麼',
    dstHead: '參數',
    dstNote: '世界在聽什麼',
    eventTarget: '世界（事件）',
    waiting: '變暗的線：等裝置接上',
    legend: '每一條線都是映射器裡的一條路由（route），照它真正的資料畫出來。世界只讀右邊那一欄，左邊怎麼重接，世界都不用改。',
    caption: '舞台上的世界是一台擺錘繪圖機（harmonograph），用擺錘把音程畫成圖形的老機器。你彈的每個音，會依音高擺動一支擺錘。和弦分析器讀你按住的音，把協和度經過一條路由 <code>chord/consonance → order</code> 送進世界：三和弦畫出乾淨的圖形，音堆畫出一團糾纏的線。',
    sourceLink: '看這台樂器的原始碼',
  },

  how: {
    eyebrow: '02 · 運作方式',
    title: '四層，各自分開',
    lede: '一場表演有四個部分：發生了什麼、它代表什麼、世界怎麼反應、結果怎麼離開瀏覽器。open-audiovisual 讓這四層各自分開，換掉其中一層，其他三層照常運作。',
    layers: [
      { name: '輸入', quote: '正在發生什麼', text: 'MIDI 琴鍵、麥克風、一個和弦、鏡頭前的一隻手、在空中傾斜的手機。每一種都會變成<em>訊號</em>：一個名字加一個數值，通常在 0 到 1 之間。' },
      { name: '映射', quote: '它代表什麼', text: '路由把訊號接到<em>參數</em>，每一條都能設曲線、範圍和平滑。一顆旋鈕可以同時推三個參數。按下 learn，隨便動一樣東西，線就接好了。' },
      { name: '世界', quote: '系統怎麼表現', text: '你的作品。它只讀參數，不碰輸入，用什麼畫都可以：canvas、p5、three.js、WebToe 節點網路。' },
      { name: '輸出', quote: '怎麼離開瀏覽器', text: '螢幕，還有聲音：頁面裡的樂器、送到硬體和 DAW 的 MIDI、送到 Spat、Reaper、TouchDesigner 或燈光的 OSC。' },
    ],
    specimenLabel: '數值來自上面那台樂器',
    spinesTitle: '四層之外',
    spines: [
      { name: '時間軸 Timeline', text: '整場演出的樂譜：參數自動化、場景與 cue。手一抓住控制，樂譜就讓位。' },
      { name: '控台 Console', text: '導演桌：播放控制、推桿、learn、儀表，按 T 進入演出模式。' },
      { name: '後台監看 Monitor', text: '同一個網路裡的手機或筆電都能當後台：時鐘、場景、每個訊號、FPS，舞台畫面斷線時會警示。' },
      { name: '手機 Phones', text: '手機和 iPad 當控制器：傾斜和敲擊感測、琴鍵，還有依世界的參數自動長出來的控制面板。' },
    ],
    rulesTitle: '兩條規則',
    rules: [
      { head: '訊號是輸入唯一的通用貨幣。', text: '一顆旋鈕、一隻舉起的手、一個和弦的協和度，在框架裡地位相同，各有名字。所以它們可以混在一起用。' },
      { head: '世界永遠不知道誰在演奏它。', text: '世界只讀參數。同一個世界，可以由鋼琴家、舞者，或一條自動化曲線來演奏。' },
    ],
    glossaryTitle: '這一頁用到的詞',
    glossary: [
      { term: '訊號 Signal', def: '一個有名字的數值，說明正在發生什麼，例如 <code>midi/cc/74</code>、<code>audio/rms</code>。通常在 0 到 1 之間。脈衝訊號（pulse）帶的是事件，例如一個音被按下。' },
      { term: '參數 Param', def: '世界在聽的數值，例如 <code>hue</code>、<code>bloom</code>。由世界宣告，由時間軸、推桿或路由來設定。' },
      { term: '映射、路由 Mapping, route', def: '一條從訊號接到參數的線，可以設曲線、範圍和平滑。路由本身就是資料，存成 JSON，接線方式可以帶到下一個場地。' },
      { term: '世界 World', def: '作品本身：一個帶有 <code>params</code>、<code>init</code>、<code>update</code>、<code>render</code>、<code>dispose</code> 的物件。整套框架裡，唯一一定要自己寫的部分。' },
      { term: '時間軸 Timeline', def: '隨時間變化的自動化與場景。手和旋鈕一動，就會蓋過它。' },
      { term: '演出 Show', def: '一個世界，加上一次 <code>createShow()</code> 呼叫，輸入、映射、時間軸、控台、聲音和後台就一起組好。' },
    ],
  },

  works: {
    eyebrow: '03 · 作品',
    title: `${zhWords(facts.exampleCount)}件作品，現在就能打開`,
    lede: '每個範例都不需要硬體。螢幕鋼琴、電腦鍵盤、模擬演奏者或鼓機，可以先代替樂器。進到任何一個範例：空白鍵播放時間軸，T 是演出模式，F 是全螢幕。',
    playsWith: '演奏方式',
    all: '依路線瀏覽所有範例',
    note: '05 到 07 是吳哲宇 2020 到 2023 年的作品，在這裡當作示範。框架採 MIT 授權，作品的著作權仍屬藝術家，保留一切權利。',
  },

  webtoe: {
    eyebrow: '姊妹專案',
    title: 'WebToe<br>背後的引擎',
    text: '做即時影像的節點式資料流引擎。在瀏覽器裡就能像用 TouchDesigner 那樣接運算子，跑在 WebGL2 或 WebGPU 上，沒有執行期相依套件，還能打開真的 TouchDesigner 專案。透過 <code>@openav/world-webtoe</code>，一張網路就能變成可以演奏的世界。WebToe 負責引擎，open-audiovisual 負責演出。',
    more: '認識 WebToe',
    open: '打開編輯器',
    alt: 'WebToe 編輯器：ramp 和 transform 運算子接到 composite、hsv adjust 和 out，每個節點都有即時預覽，右邊是輸出畫面。',
  },

  start: {
    eyebrow: '04 · 開始',
    title: '一分鐘跑起來',
    lede: '不用安裝、不用建置、沒有相依套件。clone 下來，跑一個檔案，打開瀏覽器。要用 Web MIDI 和鏡頭，請用 Chrome 或 Edge。',
    after: '接著打開 <code>http://localhost:8080/examples/01-hello-particles/</code>，讀它的 <code>main.js</code>。',
    companions: '需要的話，各開一個終端機：後台監看伺服器，以及把 OSC 送到 UDP 的橋接。',
    worldTitle: '你只需要寫一個世界',
    worldText: '宣告作品能被什麼演奏（參數），對事件做反應，然後畫出來。交給 <code>createShow()</code>，其他部分一起到位：鋼琴、映射、時間軸、控台、聲音、後台。旁邊放一個帶 import map 的 <code>index.html</code>，照範例 01 的寫法。',
    worldLink: '怎麼寫一個世界',
    packagesTitle: `${zhWords(facts.packageCount)}個套件，依層分類`,
    packagesLede: '全部是原生 ES module。用 import map 引入需要的套件，或交給 <code>createShow()</code> 組裝。',
    groups: ['輸入', '映射', '世界', '輸出', '時間軸、控台、監看', '手機與平板', '核心與代理'],
    packages: {
      midi: 'Web MIDI 輸入與輸出，支援多台裝置與螢幕上的控制器',
      audio: '麥克風分析：音量、頻段、亮度、起音、鼓點',
      chord: '為演出設計的和弦偵測：協和度、三和弦、音堆',
      pose: '用鏡頭追蹤身體與手的 21 個點，全部在本機運算',
      keys: '螢幕鋼琴、電腦鍵盤演奏，以及模擬演奏者',
      drums: '合成鼓組與步進音序器，發出和音訊分析同樣形狀的訊號',
      leap: '透過本機的小橋接，把 Leap Motion 的手變成 21 點手部訊號',
      mapping: '訊號到參數的路由：曲線、平滑、多對多、learn',
      stage: '世界的外殼：管生命週期和參數，不限定繪圖方式',
      'world-webtoe': '把 WebToe 節點網路當成世界來演奏',
      sound: '頁面裡的樂器（Salamander 鋼琴、敲擊琴、弦樂、風琴、合成器音色），加一個檔案就能放進自己的聲音',
      osc: '透過一支小小的 Node 橋接，把 OSC 從瀏覽器送到 UDP',
      record: '演出影片：作品疊在鏡頭畫面上、連同作品自己的聲音錄成一個檔；MIDI 演奏可錄下再重播',
      out: '把網頁作品的參數經一支本機橋接送到 WLED 燈條、序列埠馬達板和 OSC，斷線時看門狗退回安全值',
      fab: '做得出來嗎？對任何網格做 3D 列印檢查（水密、懸空、最薄壁、重量），匯出 STL、OBJ、GLB、STEP',
      timeline: '參數自動化、場景與 cue：整場演出的時鐘',
      score: '把演出寫成段落長度：版本、cue、hold，還有模組壞掉時讓演出不中斷的導演',
      pattern: '一行字寫節奏：TidalCycles／Strudel 式的 mini-notation 解析成每一小節的鼓點（歐幾里得節奏、每小節輪替、有種子的隨機）',
      console: '導演控台與演出模式',
      monitor: '網路裡任何裝置都能看的後台畫面',
      relay: '零相依的房間中繼，讓手機和 iPad 連進來',
      surface: '類似 TouchOSC 的控制元件，以及 autoSurface(params)',
      remote: '手機與 iPad 端的 app：感測器、琴鍵、控制面板',
      core: 'Signals、Params、Loop：每一層共用的語言',
      show: 'createShow()：一次呼叫組好整個外殼',
      mcp: '給程式代理用的 MCP 伺服器：列出、閱讀、建立、檢查',
    },
    docsTitle: '文件',
    docs: {
      architecture: '每一層的介面約定，完整說明',
      world: '世界的介面，以及最常被打破的那條規則',
      signals: '內建輸入會發出的所有訊號',
      show: '時間軸、場景、演出模式、後台監看、OSC',
      roadmap: '真實演出接下來要求的功能',
      agents: '給 AI 程式代理的約定',
    },
    docsNote: '',
    docNames: { architecture: '架構', world: '寫一個世界', signals: '訊號一覽', show: '演出控制', roadmap: '路線圖', agents: 'AGENTS.md' },
  },

  // ─────────────── 常見問題（AEO）：可見的問與答。每一則答案只由網站、README 或文件裡已經存在的句子組成：每一段用 `src`
  // 標出來源檔，並逐字引用；tests/examples-faq.test.js 會檢查引文真的在那個檔案裡。Google 已不再顯示 FAQ 豐富結果，
  // 所以不加 FAQPage 標記，只留讀者與爬蟲都看得到的文字。
  faq: {
    eyebrow: '常見問題',
    title: '大家常問的',
    more: '延伸閱讀',
    items: [
      // 出處：tools/home/zh.mjs meta.definition（這一頁自己的定義句）
      { q: 'open-audiovisual 是什麼？', more: { label: '運作方式', href: '#how' }, a: [
        { src: 'tools/home/zh.mjs', code: false, text: 'open-audiovisual 是零建置的 JavaScript 框架：把 MIDI 控制器、麥克風、手勢與手機變成訊號，驅動瀏覽器裡的 p5.js、WebGL 或 WebToe 世界，用於現場影音表演。MIT 授權。' },
      ] },
      // 出處：docs/zh/p5.md 開頭一段（那句話與那一行）、同一段後面的「setup() 裡不用呼叫任何東西」
      { q: '可以用 MIDI 控制器玩 p5.js 草圖嗎？', more: { label: 'p5.js 一行接上', href: 'p5/' }, a: [
        { src: 'docs/zh/p5.md', code: false, text: '任何一份 p5.js 草圖（OpenProcessing、p5 編輯器、你自己的網頁）在最前面加一行，就能用 MIDI 控制器、螢幕上的控制器或手機來彈。' },
        { src: 'docs/zh/p5.md', code: true, text: "document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));" },
        { src: 'docs/zh/p5.md', code: false, text: 'p5 1.x、2.x 的全域模式都能用，`setup()` 裡不用呼叫任何東西。' },
      ] },
      // 出處：這一頁 works.lede（前兩句）；docs/zh/getting-started.md「不用硬體也能彈」最後一段
      { q: '沒有硬體也能用嗎？', more: { label: '範例', href: 'examples/' }, a: [
        { src: 'tools/home/zh.mjs', code: false, text: '每個範例都不需要硬體。螢幕鋼琴、電腦鍵盤、模擬演奏者或鼓機，可以先代替樂器。' },
        { src: 'docs/zh/getting-started.md', code: false, text: '這些送出的訊號都跟真實硬體一樣，所以下游分不出差別。' },
      ] },
      // 出處：docs/zh/getting-started.md「用哪個瀏覽器」前兩點；docs/zh/p5.md「三種輸入」最後一段
      { q: '哪些瀏覽器支援 MIDI？', more: { label: '快速開始', href: 'docs/#quick-start-which-browser' }, a: [
        { src: 'docs/zh/getting-started.md', code: false, text: 'Chrome 和 Edge 有。演出請用它們。' },
        { src: 'docs/zh/p5.md', code: false, text: 'Safari 和 iPad 沒有 Web MIDI，螢幕上的控制器和手機照樣能用。' },
        { src: 'docs/zh/getting-started.md', code: false, text: '鏡頭和麥克風只在安全環境（secure context）裡能用：`http://localhost` 或 `https://`。' },
      ] },
      // 出處：docs/zh/controllers.md 開頭一段（兩句）
      { q: '支援哪些 MIDI 控制器？每台的 CC 對照表在哪？', more: { label: 'MIDI 控制器圖鑑', href: 'controllers/' }, a: [
        { src: 'docs/zh/controllers.md', code: false, text: 'open-audiovisual 把 MIDI 控制器寫成資料：每台裝置一個 JSON 檔，記下面板配置、每個控制項送出的 MIDI 訊息、LED 回饋、怎麼認出它的埠，以及每個數字出自哪一份文件。' },
        { src: 'docs/zh/controllers.md', code: false, text: '同一個檔案可以變成螢幕上能彈的控制器，接上實體裝置時跟著動，也能放進任何網頁。' },
      ] },
      // 出處：docs/zh/controllers.md「放進網頁」（那兩行 HTML、「這樣就接好了。」、Web MIDI 那一句）
      { q: '可以把控制器嵌進我自己的網站嗎？', more: { label: 'MIDI 控制器與嵌入', href: 'docs/#controllers-play-one-in-a-page' }, a: [
        { src: 'docs/zh/controllers.md', code: true, text: '<script type="module" src="https://openaudiovisual.com/packages/midi/element.js"></script>\n<oav-controller profile="akai-lpd8" readout></oav-controller>' },
        { src: 'docs/zh/controllers.md', code: false, text: '這樣就接好了。沒有 Web MIDI 的瀏覽器（Safari、iPad）一樣能彈、一樣送出事件，只有硬體和 MIDI 輸出這兩項會顯示無法使用。' },
      ] },
      // 出處：這一頁 agents.lede 與 agents.mcpText 的第一句
      { q: 'AI 代理可以幫我做世界嗎？', more: { label: '給 AI 代理', href: '#agents' }, a: [
        { src: 'tools/home/zh.mjs', code: false, text: '世界就是程式碼，程式代理（coding agent）很會寫程式。人用文字描述一場表演，代理寫出世界，框架把演出跑起來。' },
        { src: 'tools/home/zh.mjs', code: false, text: 'repo 內附一個零相依、走 stdio 的 MCP 伺服器。' },
      ] },
      // 出處：這一頁 footer.license 與 footer.artworks
      { q: '要錢嗎？授權是什麼？', more: { label: 'GitHub 上的授權', href: 'https://github.com/frank890417/open-audiovisual/blob/main/LICENSE' }, a: [
        { src: 'tools/home/zh.mjs', code: false, text: 'MIT 授權。' },
        { src: 'tools/home/zh.mjs', code: false, text: '範例 05 到 07 收錄吳哲宇的作品，著作權屬藝術家，保留一切權利。' },
      ] },
    ],
  },

  agents: {
    eyebrow: '05 · 給 AI 代理',
    title: '給 AI 代理',
    lede: '世界就是程式碼，程式代理（coding agent）很會寫程式。人用文字描述一場表演，代理寫出世界，框架把演出跑起來。',
    promptTitle: '把這段貼給 Claude Code、Cursor 或任何程式代理',
    prompt: [
      'Clone https://github.com/frank890417/open-audiovisual，先讀 AGENTS.md。',
      '執行 `node serve.js`，打開 http://localhost:8080/examples/01-hello-particles/，看最小的完整演出長什麼樣子。',
      `把 01-hello-particles 複製成 examples/${facts.nextExampleNumber}-<名稱>/（或呼叫 openav MCP 的 scaffold_world 工具），在它的 main.js 為這件作品寫一個 World：`,
      '',
      '  <描述這場表演，例如「一個遇到和諧和弦就綻放的水母世界」>',
      '',
      'AGENTS.md 的規則：連續控制一律走參數，由 mapper 把訊號接過去。不要為了讓某個範例好看去改 packages/*。',
      '完成的條件：npm test 通過，新範例載入時主控台零錯誤。',
    ],
    mcpTitle: '接上 MCP 伺服器',
    mcpText: 'repo 內附一個零相依、走 stdio 的 MCP 伺服器。在 repo 裡打開 Claude Code，會自動從 <code>.mcp.json</code> 讀到它。其他客戶端，把路徑指到這個檔案：',
    toolsTitle: '工具',
    tools: {
      list_examples: '有哪些作品，每件附一行摘要',
      read_doc: '架構、寫一個世界、訊號、演出控制、代理約定',
      scaffold_world: '拿一個範例當底，建立新的編號範例',
      run_checks: '跑測試，和 CI 是同一道關卡',
      list_controllers: '所有 MIDI 控制器設定檔，附控制項組成與未確認數量',
      read_profile: '讀一台完整的設定檔，附好讀的 MIDI 對照',
      validate_profile: '檢查設定檔 JSON，抓出和內建機型的衝突',
      scaffold_profile: '為新控制器產一份合法骨架，每個數字都標未確認',
    },
    filesTitle: '給機器讀的',
    files: {
      llms: '這是什麼、核心概念、所有文件與範例，llmstxt.org 格式',
      llmsFull: 'README、AGENTS.md 和所有文件合成一個檔',
      agentsMd: '每一層的介面約定，以及代理不能打破的兩條規則',
      skill: 'Claude Code 技能：從一段描述建立一個世界',
      ld: '這一頁帶有 SoftwareSourceCode 的 JSON-LD',
      alt: '這一頁的英文版',
    },
  },

  lineage: {
    eyebrow: '06 · 來歷',
    title: '從一場演出裡抽出來',
    p1: 'open-audiovisual 的核心來自<a href="https://cheyuwu.com/zh/exhibition/the-last-input">《The Last Input 終局之前》</a>（吳哲宇，2026），IRCAM 聲鬥陣 × C-LAB 在台北的 49.4 聲道空間聲響演出，演奏者用鋼琴餵養一個活著的數位世界。時間軸、和弦語意、多對多的 MIDI learn、OSC 批次傳送，都先撐過一整場十四個場景的演出，才整理成這裡的通用框架。從那之後的規則：框架只長真實演出要求過的功能。',
    p2: '映射層的想法，承接 <a href="http://libmapper.github.io/">libmapper</a> 對訊號命名空間的研究。姊妹專案 <a href="https://github.com/frank890417/WebToe">WebToe</a> 是節點式的資料流引擎，可以匯入 TouchDesigner 專案。WebToe 負責引擎，open-audiovisual 負責演出。',
    quote: 'Hydra 給你即興，cables 給你平台，Tone 給你聲音。<strong>open-audiovisual 給你一場演出。</strong>',
    quoteCite: 'README',
    nextTitle: '接下來，摘自路線圖',
    next: [
      '錄下一場演出完整的訊號流，再播給任何一個世界',
      '發布 npm 套件，用這套框架本身做文件網站',
      'WebGPU 世界轉接，給粒子與群體代理類的世界',
      'NDI 閘道，讓瀏覽器的畫面進入專業影像流程',
      '多台電腦透過 WebRTC 共用同一個訊號空間',
      '訂閱訊號、和人一起演奏的 AI 演奏者',
    ],
    roadmapLink: '完整路線圖',
  },

  footer: {
    pages: '頁面',
    homeLink: '首頁',
    examples: '範例',
    p5: 'p5.js 一行接上',
    changelog: '更新紀錄',
    license: 'MIT 授權。<a href="https://cheyuwu.com/zh/">吳哲宇 Che-Yu Wu</a> 製作。',
    artworks: '範例 05 到 07 收錄吳哲宇的作品，著作權屬藝術家，保留一切權利。',
    machine: '給機器讀的',
  },
};
