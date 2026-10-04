// 文件頁字串，繁體中文（台灣），輸出到 /zh/docs/。
// 結構必須和 en.mjs 一模一樣（每個 key），tools/build-docs.mjs 會檢查。
// 頂部導覽與頁尾的字串來自首頁字串表（tools/home/zh.mjs），整站只翻一次。

export default {
  meta: {
    title: '文件｜open-audiovisual',
    description: 'open-audiovisual 使用手冊：快速開始、核心概念、寫一個世界、輸入、映射、演出控制、MIDI 控制器、手機，每一個訊號與套件的說明，以及 AI 代理怎麼使用它。',
    ogDescription: '一頁讀完每一章：用 open-audiovisual 在瀏覽器裡做一場現場影音演出。',
  },
  ldLanguage: 'zh-Hant-TW',

  eyebrow: '文件',
  title: 'open-audiovisual 使用手冊',
  lede: '跑起來、寫作品、上台演出需要知道的事，都在這一頁。這裡寫到的 API 名稱、選項和訊號，都對照過原始碼，兩者對不上時，以程式碼為準。',
  stats: '{chapters} 章 · {sections} 節 · v{version}',
  sourceNote: '內容以 Markdown 寫在 <code>docs/zh/</code>，這一頁由它產生。',
  llmsNote: '給語言模型：<a href="{llms}">/llms.txt</a> · <a href="{llmsFull}">/llms-full.txt</a>',

  tocTitle: '本頁目錄',
  tocLabel: '文件目錄',
  tocButton: '目錄',
  tocClose: '關閉目錄',
  chapterSource: '原始檔',
  editOnGitHub: '在 GitHub 上編輯',
  backToTop: '回到頂端',

  copy: '複製',
  copied: '已複製',
  linkCopied: '已複製連結',
  anchorLabel: '這一節的連結',
  alerts: { note: '說明', tip: '提示', important: '重要', warning: '注意', caution: '小心', done: '已完成', open: '尚未完成' },

  untranslated: '這一章還沒有中文版，以下是英文原文。',
  placeholder: {
    controllers: `# MIDI 控制器與嵌入

> [!NOTE]
> 這一章正在撰寫。在那之前，請先看[控制器頁面](https://openaudiovisual.com/controllers/)、範例
> [09-midi-controllers](../../examples/09-midi-controllers/main.js)，以及
> [packages/midi](../../packages/midi/) 裡的原始碼。
`,
  },
};
