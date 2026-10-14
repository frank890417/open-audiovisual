// llms.txt (English), zh/llms.txt (Traditional Chinese) and llms-full.txt — generated, never hand-edited.
//
//   import { llmsTxt, llmsFull, htmlToText } from '../site/llms.mjs';
//
// Everything that can go stale is read, not typed: the counts from facts.mjs, the pages from the register
// (pages.mjs), every device page from the controller profiles, every example from examples/, the handbook
// chapters from tools/docs/chapters.mjs, the package one-liners from the homepage tables. Links to documents
// point at this site (/docs/<name>.md), so a model that cites one cites openaudiovisual.com.
//
// llms-full.txt is the same material as one file: README, AGENTS.md and every chapter. Markdown that carries
// HTML (the README's <div>, <table>, <picture>, <img>, <p align>) is turned into plain text first
// (htmlToText), so a README redesign cannot pour markup into the file a model reads.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, REPO } from './chrome.mjs';
import { getFacts } from './facts.mjs';
import { registry } from './pages.mjs';
import { exampleLine } from './examples.mjs';
import { CHAPTERS } from '../docs/chapters.mjs';
import { PACKAGE_GROUPS } from '../home/page.mjs';
import { catalog, nameOf, detailUrl, PROFILE_DIR } from '../controllers/page.mjs';
import { fullName } from '../controllers/detail.mjs';
import homeEn from '../home/en.mjs';
import homeZh from '../home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };
const HOME = { en: homeEn, zh: homeZh };

// ---------------------------------------------------------------------------- copy
/** One line per handbook chapter (id = tools/docs/chapters.mjs). A new chapter without a line fails tests/site.test.js. */
export const DOC_BLURB = {
  introduction: ['what it is, who it is for, what it handles so a show does not rebuild it.', '它是什麼、給誰用、替每場演出省掉哪些重複工作。'],
  'quick-start': ['run it, play it, make a new work.', '跑起來、玩一玩、做一件新作品。'],
  concepts: ['signal, param, route, world, timeline, show, and the two rules that hold them together.', '訊號、參數、路由、世界、時間軸、演出，以及把它們綁在一起的兩條規則。'],
  architecture: ['the frame loop and every layer\'s contract.', '每一幀怎麼跑，以及每一層的契約。'],
  'writing-a-world': ['the World interface, params vs events, sound output, checklist.', 'World 介面、參數與事件、聲音輸出、檢查清單。'],
  inputs: ['every input package and the `modules` key that switches it on.', '每個輸入套件，與開啟它的 `modules` 鍵。'],
  mapping: ['routes, curves, smoothing, many-to-many and "learn".', '路由、曲線、平滑、多對多與 learn。'],
  'show-control': ['timeline, scenes, performance mode, console, monitor, OSC.', '時間軸、場景、演出模式、控台、後台監看、OSC。'],
  score: ['a show as segment lengths: cuts, cues, hold, segment modules, the prompter, score to MIDI.', '把演出寫成段落長度：版本、cue、hold、段落模組、提詞器、樂譜轉 MIDI。'],
  controllers: ['MIDI controllers as JSON profiles, the `<oav-controller>` element and the iframe embed.', '把 MIDI 控制器寫成 JSON 設定檔，以及 `<oav-controller>` 元件與 iframe 嵌入。'],
  p5: ['one line that lets any p5.js sketch play from MIDI, an on-screen controller or a phone.', '一行指令，讓任何 p5.js 草圖能用 MIDI、螢幕上的控制器或手機彈。'],
  phones: ['phones and iPads as controllers: relay, sensors, control surfaces.', '手機與 iPad 當控制器：中繼、感測器、控制面板。'],
  signals: ['every signal the built-in inputs publish, with ranges.', '內建輸入發出的每一個訊號與範圍。'],
  packages: ['every package, by layer.', '每個套件，依層分類。'],
  agents: ['conventions for AI coding agents, the two rules, how to create a work.', '給 AI 程式代理的慣例、兩條規則、怎麼做一件作品。'],
  'lab-integration': ['the `"lab"` field in package.json.', 'package.json 的 `"lab"` 欄位。'],
  troubleshooting: ['real problems found in rehearsals, and what to do about them.', '排練中遇到的真實問題，與處理方式。'],
  roadmap: ['signal recording and replay, npm publish, WebGPU worlds, NDI gateway, distributed performance, agent performers.', '訊號錄製與重播、npm 發佈、WebGPU 世界、NDI 閘道、分散式演出、代理演奏者。'],
};

const PAGE_BLURB = {
  '': ['a playable instrument, how it works, the works, quick start, for AI agents.', '能玩的樂器、運作方式、作品、快速開始、給 AI 代理。'],
  'docs/': ['the complete documentation on one page: every chapter listed below, in one HTML file. Generated from the Markdown in `docs/`.', '完整文件一頁讀完：下方列出的每一章都在同一個 HTML 檔。由 `docs/` 的 Markdown 生成。'],
  'controllers/': ['every modeled controller as a playable faceplate with its full MIDI implementation table and cited sources; embed any of them with `<oav-controller>` or an iframe (`/embed/controller/`).', '每台控制器都是能玩的面板，附完整 MIDI 實作表與引用出處；可用 `<oav-controller>` 或 iframe（`/embed/controller/`）嵌入。'],
  'examples/': ['every example, with a thumbnail and what it needs.', '所有範例，附縮圖與需要什麼。'],
  'p5/': ['load `oav-p5.js` and any p5 sketch plays from MIDI, an on-screen controller or a phone.', '載入 `oav-p5.js`，任何 p5 草圖都能用 MIDI、螢幕上的控制器或手機彈。'],
  'webtoe/': ['the sister project and the engine half of the stack: a web-native, node-based dataflow engine for real-time visuals (TouchDesigner-style, WebGL2 + WebGPU, zero runtime dependencies) that opens TouchDesigner `.toe` projects; how `@openav/world-webtoe` performs a WebToe patch as a world. Editor: https://webtoe.openaudiovisual.com/', '姊妹專案，整套的引擎那一半：網頁原生、節點式的即時影像資料流引擎（TouchDesigner 式、WebGL2 + WebGPU、零執行期相依），能打開 TouchDesigner `.toe` 專案；`@openav/world-webtoe` 如何把 WebToe 網路當世界演奏。編輯器：https://webtoe.openaudiovisual.com/'],
};
const PAGE_TITLE = {
  '': ['Homepage', '首頁'], 'docs/': ['Handbook', '手冊'], 'controllers/': ['MIDI controller library', 'MIDI 控制器圖鑑'],
  'examples/': ['Examples', '範例'], 'p5/': ['p5.js in one line', 'p5.js 一行指令'], 'webtoe/': ['WebToe', 'WebToe'],
};

const CONCEPTS = {
  en: [
    '- **Signal** — a named, normalized value saying what is happening: `midi/cc/74`, `audio/rms`, `chord/consonance`, `pose/hand/right/y`, `phone/<id>/tilt/x`. Continuous (has a value, usually 0..1) or pulse (fires an event payload, e.g. `midi/note/on` → `{note, vel}`). Signals are the only currency of input.',
    '- **Param** — a value a world listens to (`hue`, `bloom`), declared by the world as `{ key, min, max, def }`. Resolved per frame: timeline automation, overridden by a hand/knob/route.',
    '- **Mapping / route** — `{ source: \'midi/cc/74\', target: \'bloom\', curve, inMin, inMax, smooth }`. Many-to-many; "learn" binds the next signal that moves. Routes are JSON.',
    '- **World** — the piece: `{ name, params, init({container, signals, params}), update(dt, state, io), render(), dispose() }`. Reads params, never inputs; may subscribe to discrete event signals. Renderer-agnostic (canvas, p5, three.js, a WebToe patch).',
    '- **Show** — `createShow({ world, timeline, routes, modules })` from `@openav/show` assembles inputs, mapping, timeline, console, sound and backstage around one world.',
    '- **Score** — a show with structure: `createShow({ score: { cuts, modules } })` (`@openav/score`). A cut is a list of segments with *lengths* (`{ id, dur, cues, acts, linger, hold }`), never absolute seconds; a derived cut is `{ id, from, scale }`. A Director runs one module per segment (`enter / update / exit / param`), a module that throws is switched off alone, `?cut=<id>` picks the version, `hold: true` waits for Space. `window.openav.show.table()/goto()/status()`.',
    '- Two rules an agent must not break: (1) continuous control goes through params, never `signals.get()` in `update()`; (2) never edit `packages/*` to make one example look right.',
  ],
  zh: [
    '- **訊號（Signal）**：有名字、已正規化的值，說明現在發生了什麼：`midi/cc/74`、`audio/rms`、`chord/consonance`、`pose/hand/right/y`、`phone/<id>/tilt/x`。連續型（有值，通常 0..1）或脈衝型（觸發事件，例如 `midi/note/on` → `{note, vel}`）。訊號是輸入端唯一的貨幣。',
    '- **參數（Param）**：世界會去聽的值（`hue`、`bloom`），由世界宣告為 `{ key, min, max, def }`。每幀解析：時間軸自動化，被手、旋鈕或路由覆蓋。',
    '- **映射／路由（Mapping / route）**：`{ source: \'midi/cc/74\', target: \'bloom\', curve, inMin, inMax, smooth }`。多對多；learn 會綁定下一個在動的訊號。路由是 JSON。',
    '- **世界（World）**：作品本身：`{ name, params, init({container, signals, params}), update(dt, state, io), render(), dispose() }`。只讀參數、不讀輸入；可訂閱離散事件訊號。不限繪圖方式（canvas、p5、three.js、WebToe 網路）。',
    '- **演出（Show）**：`createShow({ world, timeline, routes, modules })`（`@openav/show`）把輸入、映射、時間軸、控台、聲音與後台組在一個世界周圍。',
    '- **樂譜（Score）**：有結構的演出：`createShow({ score: { cuts, modules } })`（`@openav/score`）。一個 cut 是一串有「長度」的段落（`{ id, dur, cues, acts, linger, hold }`），絕不寫絕對秒數；衍生 cut 是 `{ id, from, scale }`。導演為每段跑一個模組（`enter / update / exit / param`），拋錯的模組只關掉自己，`?cut=<id>` 選版本，`hold: true` 等空白鍵。`window.openav.show.table()/goto()/status()`。',
    '- 代理不能破壞的兩條規則：(1) 連續控制走參數，不在 `update()` 裡直接讀 `signals.get()`；(2) 不為了讓某個範例好看去改 `packages/*`。',
  ],
};

const MCP = {
  en: `The repo ships a zero-dependency MCP server over stdio (\`packages/mcp/server.js\`). Claude Code picks it up from \`.mcp.json\` when opened in the repo. Other clients:

\`\`\`json
{ "mcpServers": { "openav": { "command": "node", "args": ["/path/to/open-audiovisual/packages/mcp/server.js"] } } }
\`\`\`

Tools: \`list_examples\` (works and one-line summaries) · \`read_doc\` (architecture, writing-a-world, signals, show-control, roadmap, agents, readme) · \`scaffold_world\` (copy a donor example into a new numbered one) · \`run_checks\` (the test suite CI runs) · \`list_controllers\` / \`read_profile\` / \`validate_profile\` / \`scaffold_profile\` (MIDI controller profiles: browse, read, check, start a new one). A Claude Code skill, \`.claude/skills/create-world\`, scaffolds a world from a description.`,
  zh: `專案內附零相依的 MCP 伺服器（stdio，\`packages/mcp/server.js\`）。在專案裡開 Claude Code 會從 \`.mcp.json\` 自動載入。其他客戶端：

\`\`\`json
{ "mcpServers": { "openav": { "command": "node", "args": ["/path/to/open-audiovisual/packages/mcp/server.js"] } } }
\`\`\`

工具：\`list_examples\`（作品與一句話摘要）· \`read_doc\`（architecture、writing-a-world、signals、show-control、roadmap、agents、readme）· \`scaffold_world\`（把一個範例複製成新的編號範例）· \`run_checks\`（CI 跑的測試）· \`list_controllers\` / \`read_profile\` / \`validate_profile\` / \`scaffold_profile\`（MIDI 控制器設定檔：列出、讀取、檢查、開新檔）。Claude Code 技能 \`.claude/skills/create-world\` 可依描述建立世界。`,
};

// ---------------------------------------------------------------------------- pieces
const docUrl = (ch, locale) => `${SITE}${locale === 'zh' ? 'docs/zh/' : 'docs/'}${path.posix.basename(ch.en)}`;
const mdTitle = (rel) => { const m = /^#\s+(.+)$/m.exec(read(rel) || ''); return m ? m[1].trim() : null; };
const L = (locale) => (locale === 'zh' ? 1 : 0);

function pagesSection(locale) {
  const reg = registry();
  const has = (p) => reg.some((e) => e.path === p);
  const lines = [];
  for (const p of ['', 'docs/', 'controllers/', 'examples/', 'p5/', 'webtoe/']) {
    if (!has(p)) continue;
    const e = reg.find((x) => x.path === p);
    const en = SITE + p, zh = SITE + 'zh/' + p, both = e.langs.includes('zh');
    const main = locale === 'zh' && both ? zh : en, other = locale === 'zh' ? ['English', en] : ['繁體中文', zh];
    lines.push(`- [${PAGE_TITLE[p][L(locale)]}](${main})${both ? ` ([${other[0]}](${other[1]}))` : ''}: ${PAGE_BLURB[p][L(locale)]}`);
  }
  return lines.join('\n');
}

function docsSection(locale) {
  const l = locale === 'zh' ? 'zh' : 'en';
  const lines = [
    locale === 'zh' ? `- [AGENTS.md](${SITE}AGENTS.md)：給 AI 程式代理的慣例、兩條規則、怎麼做一件作品。先讀這份。` : `- [AGENTS.md](${SITE}AGENTS.md): conventions for AI coding agents, the two rules, how to create a work. Read first.`,
    locale === 'zh' ? `- [README](${SITE}README.md)：總覽、架構圖、範例、手機遙控。` : `- [README](${SITE}README.md): overview, architecture diagram, examples, phone remote.`,
  ];
  for (const ch of CHAPTERS) {
    const title = mdTitle(ch[l]) || mdTitle(ch.en) || ch.id;
    lines.push(`- [${title}](${docUrl(ch, locale)}): ${DOC_BLURB[ch.id][L(locale)]}`);
  }
  lines.push(`- [Patch bay design](${SITE}docs/design/patchbay.md): ${locale === 'zh' ? '多裝置 MIDI 與 patch bay 的設計。' : 'multi-device MIDI and the patch bay.'}`);
  lines.push(locale === 'zh'
    ? `- [全文](${SITE}llms-full.txt)：README、AGENTS.md 與手冊每一章，合成一個檔案。`
    : `- [Full text](${SITE}llms-full.txt): README, AGENTS.md and every handbook chapter in one file.`);
  return lines.join('\n');
}

function examplesSection(locale) {
  const f = getFacts();
  return f.examples.map((e) => `- [${e.id}](${SITE}examples/${e.id}/): ${exampleLine(e.id, locale)}`).join('\n');
}

function controllersSection(locale) {
  const cat = catalog();
  return [...cat.devices, ...cat.generic].map((d) => {
    const name = fullName(d.p, locale);
    const n = d.total;
    return `- [${name}](${detailUrl(d.p.id, locale)}): ${locale === 'zh' ? `${n} 個控制項的 MIDI 對照表` : `${n} controls, every MIDI message`}; profile ${SITE}${PROFILE_DIR}/${d.file}`;
  }).join('\n');
}

function packagesSection(locale) {
  const t = HOME[locale === 'zh' ? 'zh' : 'en'].start;
  return PACKAGE_GROUPS.map((g, gi) => `- ${t.groups[gi]}: ` + g.pkgs.map((p) => `\`${p}\` (${t.packages[p]})`).join(' · ')).join('\n');
}

// ---------------------------------------------------------------------------- llms.txt
/** llms.txt for a language (en → /llms.txt, zh → /zh/llms.txt). Format: llmstxt.org. */
export function llmsTxt(locale) {
  const f = getFacts();
  const zh = locale === 'zh';
  const t = HOME[zh ? 'zh' : 'en'];
  const T = (en, zhText) => (zh ? zhText : en);
  return [
    `# open-audiovisual`,
    ``,
    `> ${t.meta.definition}`,
    ``,
    T(
      `Inputs (MIDI, microphone, chords, body and hand pose, phones) publish named signals; a mapping layer routes signals to parameters; an algorithmic "world" reads only parameters and renders image and sound; a timeline, a director's console and a backstage monitor run the show. Plain ES modules, no build, no dependencies. Extracted from The Last Input (Che-Yu Wu, 2026), a 49.4-channel performance at the IRCAM residency × C-LAB, Taipei.`,
      `輸入（MIDI、麥克風、和弦、身體與手部姿態、手機）發出有名字的訊號；映射層把訊號接到參數；演算的「世界」只讀參數，產生畫面與聲音；時間軸、導演控台與後台監看負責把演出跑起來。原生 ES module，零建置、零相依。從《The Last Input》（吳哲宇，2026；IRCAM 駐村 × C-LAB，臺北，49.4 聲道表演）抽出來。`),
    ``,
    T(
      `Today: ${f.packageCount} packages, ${f.exampleCount} examples, ${f.controllerCount} MIDI controller profiles (${f.deviceCount} devices and ${f.genericCount} generic layouts), version ${f.version}.`,
      `目前：${f.packageCount} 個套件、${f.exampleCount} 個範例、${f.controllerCount} 份 MIDI 控制器設定檔（${f.deviceCount} 台真機與 ${f.genericCount} 種通用版型），版本 ${f.version}。`),
    ``,
    T(`Site: ${SITE} (English) · ${SITE}zh/ (繁體中文, Traditional Chinese)`, `網站：${SITE}（English）· ${SITE}zh/（繁體中文）`),
    T(`Repository: ${REPO}`, `原始碼：${REPO}`),
    T(`Author: Che-Yu Wu 吳哲宇 (https://cheyuwu.com)`, `作者：吳哲宇 Che-Yu Wu（https://cheyuwu.com）`),
    T(`How to cite: cite the canonical URL of the page you read. Code is MIT; examples 05 to 07 integrate artworks © Che-Yu Wu, all rights reserved.`,
      `引用方式：請引用你讀到的那一頁的正式網址。程式碼為 MIT 授權；範例 05 至 07 整合了吳哲宇的作品，版權所有。`),
    ``,
    `## Pages`,
    ``,
    pagesSection(locale),
    ``,
    `## Core concepts`,
    ``,
    CONCEPTS[zh ? 'zh' : 'en'].join('\n'),
    ``,
    `## Start`,
    ``,
    T(`- Run: \`git clone ${REPO}.git && cd open-audiovisual && node serve.js\` → http://localhost:8080 (no npm install; Chrome/Edge for Web MIDI and camera)`,
      `- 執行：\`git clone ${REPO}.git && cd open-audiovisual && node serve.js\` → http://localhost:8080（不用 npm install；Web MIDI 與鏡頭請用 Chrome／Edge）`),
    T(`- Make a new work: copy \`examples/01-hello-particles/\` to \`examples/${f.nextExampleNumber}-<name>/\`, write the World in \`main.js\`, open \`http://localhost:8080/examples/${f.nextExampleNumber}-<name>/\`.`,
      `- 做一件新作品：把 \`examples/01-hello-particles/\` 複製成 \`examples/${f.nextExampleNumber}-<名稱>/\`，在 \`main.js\` 寫 World，打開 \`http://localhost:8080/examples/${f.nextExampleNumber}-<名稱>/\`。`),
    T(`- Verify: \`npm test\` (node --test) passes; the example loads with zero console errors (a refused \`ws://localhost:7457\` monitor connection is expected when no monitor runs).`,
      `- 驗證：\`npm test\`（node --test）全過；範例載入時 console 沒有錯誤（沒開監看時，被拒絕的 \`ws://localhost:7457\` 連線是正常的）。`),
    ``,
    `## Docs`,
    ``,
    docsSection(locale),
    ``,
    `## MCP server`,
    ``,
    MCP[zh ? 'zh' : 'en'],
    ``,
    `## Examples`,
    ``,
    T(`Each runs in the browser without hardware (on-screen piano, QWERTY keys, simulated performer or drum machine). Live at ${SITE}examples/<dir>/, source in \`examples/<dir>/main.js\`.`,
      `每個都能在瀏覽器裡免硬體執行（螢幕鋼琴、QWERTY 鍵、模擬演奏者或鼓機）。線上位址 ${SITE}examples/<dir>/，原始碼在 \`examples/<dir>/main.js\`。`),
    ``,
    examplesSection(locale),
    ``,
    T(`Examples 05–07 integrate artworks © Che-Yu Wu (2020–2023), all rights reserved; the framework is MIT.`, `範例 05–07 整合了吳哲宇的作品（2020–2023），版權所有；框架為 MIT 授權。`),
    ``,
    `## MIDI controllers`,
    ``,
    T(`${f.controllerCount} controller profiles, one page each with every control's exact MIDI message (channel, CC or note), LED feedback and cited sources. The profile JSON is the data behind the page.`,
      `${f.controllerCount} 份控制器設定檔，每台一頁，列出每個控制項確切的 MIDI 訊息（頻道、CC 或音符）、LED 回饋與引用出處。設定檔 JSON 就是這一頁背後的資料。`),
    ``,
    controllersSection(locale),
    ``,
    `## Packages`,
    ``,
    T(`${f.packageCount} packages under \`packages/<name>/\`, imported as \`@openav/<name>\` through an import map.`, `${f.packageCount} 個套件在 \`packages/<name>/\`，透過 import map 以 \`@openav/<name>\` 引入。`),
    ``,
    packagesSection(locale),
    ``,
    `## Optional`,
    ``,
    `- [Roadmap](${SITE}docs/${zh ? 'zh/' : ''}roadmap.md): ${DOC_BLURB.roadmap[L(locale)]}`,
    `- [Lab integration](${SITE}docs/${zh ? 'zh/' : ''}lab-integration.md): ${DOC_BLURB['lab-integration'][L(locale)]}`,
    `- [WebToe](https://github.com/frank890417/WebToe): ${T('sister project, a node-based dataflow engine that imports TouchDesigner projects.', '姊妹專案，能匯入 TouchDesigner 專案的節點式資料流引擎。')}`,
    ``,
  ].join('\n');
}

// ---------------------------------------------------------------------------- HTML → plain text
const BLOCK_TAGS = 'div|p|section|article|nav|header|footer|main|figure|figcaption|ul|ol|table|thead|tbody|tfoot|center|details|blockquote|picture|video|audio|svg|dl';
const KNOWN = new RegExp(`^(?:${BLOCK_TAGS}|span|a|img|source|br|hr|b|strong|i|em|code|kbd|sup|sub|small|big|u|s|del|ins|mark|abbr|font|li|dt|dd|tr|td|th|summary|h[1-6]|pre|tt|samp|var|cite|q|time|noscript)$`, 'i');
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const attrOf = (tag, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); return m ? decode(m[1] ?? m[2]) : ''; };

/** Strip every known HTML tag out of a fragment, keeping its text (and its links as [text](url)). */
function flatten(s) {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, (m) => attrOf(m, 'alt'))
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (m, inner) => {
      const text = squash(flatten(inner)), href = attrOf(m.slice(0, m.indexOf('>') + 1), 'href');
      return text ? (href && !href.startsWith('#') ? `[${text}](${href})` : text) : '';
    })
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (m, inner) => '`' + decode(inner.replace(/<[^>]+>/g, '')) + '`')
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (m, name) => (KNOWN.test(name) ? '' : m));
}

function cleanHtmlChunk(src) {
  let s = src;
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  // <pre><code>…</code></pre> → a fenced block
  s = s.replace(/<pre\b[^>]*>\s*(?:<code\b[^>]*>)?([\s\S]*?)(?:<\/code>)?\s*<\/pre>/gi, (m, body) => '\n\n```\n' + decode(body.replace(/<[^>]+>/g, '')).replace(/^\n|\n$/g, '') + '\n```\n\n');
  // tables → one line per row, cells joined by " | "
  s = s.replace(/<table\b[\s\S]*?<\/table>/gi, (tbl) => {
    const rows = [...tbl.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(squash(flatten(c[1])))).filter(Boolean).join(' | ')).filter(Boolean);
    return '\n\n' + rows.join('\n') + '\n\n';
  });
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (m, n, inner) => `\n\n${'#'.repeat(n)} ${decode(squash(flatten(inner)))}\n\n`);
  s = s.replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi, (m, inner) => `\n\n**${squash(flatten(inner))}**\n\n`);
  s = s.replace(/<li\b[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '');
  s = s.replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, inner) => `**${squash(flatten(inner))}**`);
  s = s.replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, inner) => `*${squash(flatten(inner))}*`);
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (m, inner) => '`' + decode(inner.replace(/<[^>]+>/g, '')) + '`');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  s = s.replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n\n');
  s = flatten(s);
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Markdown with HTML in it → Markdown without. Fenced code and `inline code` are left exactly as written;
 * outside them, known HTML tags are removed (tables become "a | b" rows, links become [text](url), images
 * become their alt text, comments vanish). Unknown angle-bracket words such as <name> are text and stay.
 */
export function htmlToText(md) {
  const out = [];
  let buf = [], fence = null;
  const flush = () => {
    if (!buf.length) return;
    const raw = buf.join('\n');
    buf = [];
    if (!/<[a-zA-Z!/]/.test(raw)) { out.push(raw); return; }
    const spans = [];
    const guarded = raw.replace(/`[^`\n]+`/g, (m) => { spans.push(m); return `\u0000${spans.length - 1}\u0000`; });
    out.push(cleanHtmlChunk(guarded).replace(/\u0000(\d+)\u0000/g, (m, i) => spans[+i]));
  };
  for (const line of md.split('\n')) {
    const m = /^\s*(```+|~~~+)/.exec(line);
    if (fence) { out.push(line); if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null; continue; }
    if (m) { flush(); fence = m[1]; out.push(line); continue; }
    buf.push(line);
  }
  flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------------------- llms-full.txt
/** README + AGENTS.md, then every docs chapter in the handbook's order, so llms-full.txt and /docs/ never disagree. */
export const LLMS_SOURCES = ['README.md', 'AGENTS.md', ...CHAPTERS.map((c) => c.en)];

export function llmsFull() {
  const f = getFacts();
  const reg = registry();
  const has = (p) => reg.some((e) => e.path === p);
  const cat = catalog();
  const head = `# open-audiovisual — full text for language models

> Every document of open-audiovisual in one file: README, AGENTS.md and every chapter of the handbook (docs/).
> Generated by tools/build-home.mjs from the repository (version ${f.version}); the short index is /llms.txt (${SITE}llms.txt, Traditional Chinese: ${SITE}zh/llms.txt).
> Site: ${SITE} (English) · ${SITE}zh/ (繁體中文)
> Handbook: ${SITE}docs/ · MIDI controller library: ${SITE}controllers/ · WebToe, the sister engine: ${SITE}webtoe/${has('examples/') ? `\n> Examples: ${SITE}examples/` : ''}${has('p5/') ? `\n> p5.js in one line: ${SITE}p5/` : ''}
> Repository: ${REPO} (MIT)
> Today: ${f.packageCount} packages, ${f.exampleCount} examples, ${f.controllerCount} MIDI controller profiles (${f.deviceCount} devices, ${f.genericCount} generic layouts).

## MIDI controllers at a glance

One page and one JSON profile each; the page lists every control with its exact MIDI message.

${[...cat.devices, ...cat.generic].map((d) => `- ${fullName(d.p, 'en')}: ${d.total} controls · ${detailUrl(d.p.id, 'en')} · ${SITE}${PROFILE_DIR}/${d.file}`).join('\n')}
`;
  return head + LLMS_SOURCES.filter((src) => read(src) !== null).map((src) =>
    `\n\n---\n\n<!-- source: ${src} -->\n\n` + htmlToText(read(src)).trim()).join('') + '\n';
}
