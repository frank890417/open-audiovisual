// /zh/check/ 的字串，繁體中文。結構要跟 en.mjs 一模一樣（tools/build-check.mjs 不一致就不建置）。
// 凡是講到瀏覽器或平台的句子，都出自 docs/zh/ 的快速開始、疑難排解和控制器頁，那邊附有出處；這頁重述，並連過去。

export default {
  meta: {
    title: '裝置體檢 · 這台裝置能用 open-audiovisual 的哪些部分',
    description: '一頁檢查這個瀏覽器的 Web MIDI、麥克風、鏡頭、繪圖能力和本機 OSC 橋接，每一項都告訴你怎麼辦。按了按鈕才會開始。',
    ogDescription: '檢查這台裝置：Web MIDI、麥克風、鏡頭、繪圖能力和本機橋接，每一項一句建議。',
    name: '裝置體檢',
    crumb: '裝置體檢',
  },

  hero: {
    eyebrow: '裝置體檢',
    title: '這台裝置能做什麼？',
    lede: '這一頁看你的瀏覽器，告訴你哪些部分能用 open-audiovisual、哪些要多做一步、該怎麼辦。綠色是可以用，黃色是要多一步或有限制，紅色是被擋住。',
    promise: '按了按鈕才會開始，也不會把任何東西送出你的裝置。MIDI 輸入只列出名字、不會彈，也絕不會開任何 MIDI 輸出。',
    summary: '綠 {ok} · 黃 {warn} · 紅 {bad} · 還沒測 {idle}',
  },

  state: { ok: '可用', warn: '注意', bad: '被擋住', idle: '還沒測' },

  rows: {
    browser: { title: '瀏覽器與系統', idle: '檢查中…', doc: '用哪個瀏覽器' },
    secure: { title: '安全環境', idle: '檢查中…', doc: '鏡頭或麥克風啟動不了' },
    midi: { title: 'Web MIDI', idle: '檢查中…', button: '列出我的 MIDI 裝置', note: '會向瀏覽器要 MIDI 權限，並列出你的輸入名稱。絕不開輸出。', doc: '看不到任何 MIDI 裝置' },
    mic: { title: '麥克風', idle: '還沒測。按下按鈕才會要麥克風；你會看到幾秒鐘的音量，然後它就停了。', button: '測試麥克風', note: '瀏覽器會先問你。', doc: '鏡頭或麥克風啟動不了' },
    camera: { title: '鏡頭', idle: '還沒測。按下按鈕才會要鏡頭；你會看到幾秒鐘的畫面，然後它就停了。', button: '測試鏡頭', note: '瀏覽器會先問你。', doc: '鏡頭或麥克風啟動不了' },
    graphics: { title: '繪圖能力', idle: '檢查中…', doc: '全部疑難排解' },
    local: { title: '這台電腦上的橋接', idle: '還沒測。按下按鈕，才會試連這台電腦上的 OSC 橋接（連接埠 7456）和後台監看（連接埠 7457）。按之前不會連線。', button: '測試連線', note: '只連 127.0.0.1，不會連到別的地方。', doc: 'Chrome 跳出區域網路的詢問' },
  },

  docLabel: '延伸閱讀',
  actions: { copy: '複製結果', copied: '已複製', copyFailed: '請選取下面的文字，自己複製。', copyHint: '純文字，貼到聊天室或 issue 用。你貼出去之前，它都只在你的裝置上。' },
  allDocs: '全部疑難排解',
  links: { controllers: '控制器圖鑑', docs: '文件' },

  js: {
    browser: {
      is: '{os} 上的 {name} {version}。',
      chrome: 'Chrome 和 Edge 有 Web MIDI，演出請用它們。',
      firefox: 'Firefox 桌面版要先裝它的網站權限附加元件，才有 Web MIDI。',
      safari: 'Safari 沒有 Web MIDI。每一台控制器還是可以在螢幕上彈。',
      ios: 'iPhone 和 iPad 上的瀏覽器底層都是 WebKit，所以都沒有 Web MIDI。你可以在螢幕上彈，也可以把手機當控制器。',
      mobile: '手機上可以在螢幕上彈。要接實體控制器，請用電腦的 Chrome 或 Edge 開這一頁。',
      other: '不是我們拿來測試的瀏覽器。演出的話，電腦上的 Chrome 或 Edge 最保險。',
    },
    secure: {
      ok: '這一頁是安全環境（{where}），麥克風和鏡頭可以用。',
      bad: '這一頁不是安全環境（{where}）：瀏覽器會擋掉鏡頭和麥克風。請用 http://localhost 或 https://。',
      file: '這一頁是從檔案打開的。請透過 http://localhost 或 https:// 打開，鏡頭和麥克風才能用。',
      https: 'https',
      localhost: 'localhost',
    },
    midi: {
      yes: '這個瀏覽器有 Web MIDI。目前還沒問過任何權限。',
      no: '這台裝置沒有 Web MIDI，接不了實體控制器，但可以直接用手指在螢幕上彈。要接你的控制器，請用電腦的 Chrome 或 Edge 開這一頁。',
      asking: '等你在瀏覽器上回答…',
      none: '已允許，但找不到任何 MIDI 輸入。請把控制器接上；如果是頁面載入之後才接的，還是沒出現，就重新載入。',
      list: '{n} 個 MIDI 輸入：{names}。',
      denied: 'MIDI 被擋下了。在網址列允許之後，再按一次按鈕。',
      failed: '瀏覽器打不開 MIDI（{reason}）。',
    },
    media: {
      none: '這一頁拿不到{what}：瀏覽器只在 https:// 或 http://localhost 才提供。',
      asking: '等你在瀏覽器上回答…',
      micOk: '麥克風可以用：{label}。聽到的最大音量：{level}%。',
      micQuiet: '麥克風打開了，但什麼聲音都沒聽到。請出點聲音再按一次，或檢查系統用的是哪個輸入。',
      camOk: '鏡頭可以用：{label}，{size}。',
      denied: '瀏覽器擋下了{what}。在網址列為這個網站允許，再按一次。macOS 上，瀏覽器本身也要在「系統設定 → 隱私權與安全性」裡有權限。',
      missing: '這台裝置上找不到{what}。',
      busy: '{what}啟動不了（{reason}）。可能有別的程式正在用它。',
      mic: '麥克風',
      camera: '鏡頭',
      unnamed: '未命名的裝置',
    },
    graphics: {
      ok: 'WebGL 2：{gl2}。WebGPU：{gpu}。',
      weak: '只有 WebGL 1。WebGPU：{gpu}。',
      bad: '沒有 WebGL：用 WebGL 畫的世界（p5 WEBGL、WebToe）不會顯示。請換一個瀏覽器試試。',
      yes: '有',
      no: '沒有',
    },
    local: {
      testing: '正在試連 127.0.0.1…',
      bridge: 'OSC 橋接（連接埠 7456）：{r}',
      monitor: '後台監看（連接埠 7457）：{r}',
      answered: '有回應',
      silent: '沒有回應',
      ok: '這台電腦上有東西回應了。',
      none: '都沒有回應。可能是橋接和後台監看沒有在跑（npm run bridge、npm run monitor），也可能是 Chrome 問了區域網路的權限，而你選了封鎖。',
      publicPage: '這一頁是公開的 https，所以 Chrome 會先問，才讓它連到你的電腦。',
    },
    copy: { head: 'open-audiovisual 裝置體檢', ua: '瀏覽器識別字串' },
  },
};
