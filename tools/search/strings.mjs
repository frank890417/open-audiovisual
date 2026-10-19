// What the search dialog says, in both languages (it is written into assets/search/index.json, so the dialog needs no strings of
// its own and a new language is one more key here). The button in the top bar says its own words: tools/home/{en,zh}.mjs ui.search*.
export const UI = {
  en: {
    placeholder: 'Search the API reference, handbook, examples…',
    loading: 'Loading the index…',
    failed: 'The search index did not load. The API reference has its own search box.',
    none: 'Nothing for “{q}”. Try a shorter word, a name like micLevel, or a word in Chinese.',
    hint: 'Type a name or a word. Chinese works too: 麥克風 finds micLevel.',
    seeAll: 'All {n} matches in the API reference →',
    close: 'Close',
    keys: '↑ ↓ move · Enter open · Esc close',
    otherLang: { en: 'EN', zh: '中文' },
    groups: { ref: 'API reference', doc: 'Handbook', ex: 'Examples', ctl: 'MIDI controllers', page: 'Pages' },
    kinds: { variable: 'variable', function: 'function', event: 'event', class: 'class', constant: 'constant', option: 'option', object: 'object', tool: 'tool' },
    example: 'Example {n}',
  },
  zh: {
    placeholder: '搜尋 API 參考、手冊、範例…',
    loading: '正在載入索引…',
    failed: '搜尋索引沒有載入。API 參考頁有自己的搜尋框。',
    none: '找不到「{q}」。換短一點的字、直接打名稱（像 micLevel），或用英文試試。',
    hint: '打名稱或一個字。中文也行：搜「麥克風」會找到 micLevel。',
    seeAll: '在 API 參考裡看全部 {n} 條 →',
    close: '關閉',
    keys: '↑ ↓ 移動 · Enter 開啟 · Esc 關閉',
    otherLang: { en: 'EN', zh: '中文' },
    groups: { ref: 'API 參考', doc: '手冊', ex: '範例', ctl: 'MIDI 控制器', page: '頁面' },
    kinds: { variable: '變數', function: '函式', event: '事件', class: '類別', constant: '常數', option: '選項', object: '物件', tool: '工具' },
    example: '範例 {n}',
  },
};
