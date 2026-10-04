# 給 AI 代理

世界就是一段畫出畫面的程式碼，而程式代理很會寫程式碼。人描述一場表演（「一個遇到和諧和弦就綻放的水母世界」），代理寫出這個世界，放進已經處理好 MIDI、映射、時間軸、控台和後台的外殼裡。代理要把這件事做好，需要知道的東西都在這一章。

## 兩條規則

1. **連續控制一律走參數，離散事件可以用訊號。** 不要在 `update()` 裡用 `signals.get(…)` 讀連續變化的東西。宣告一個參數，讓路由把訊號接過去。
2. **外殼永遠不知道作品。** 不要為了讓某一個範例好看，去改 `packages/*`。改框架，就要讓每一件作品都變好。

背後的道理寫在[核心概念](concepts.md#the-two-rules)。

## 從 AGENTS.md 開始

repo 根目錄的 [AGENTS.md](../../AGENTS.md) 就是任務簡報：框架是什麼、兩條規則、怎麼建立新作品、怎麼驗證改動，以及各項慣例。慣例包括原生 ESM + JSDoc、沒有建置步驟、沒有執行期相依套件、訊號名稱用路徑風格並以 `signals.define` 宣告，還有註解要寫演出上的考量（為什麼這顆旋鈕這樣才順手），不用解釋語法。

## MCP 伺服器

repo 內附一個 Model Context Protocol（MCP，讓 AI 工具呼叫外部功能的標準協定）伺服器：`packages/mcp/server.js`，零相依，在 stdio 上跑 JSON-RPC 2.0，一行一則 JSON 訊息。在 repo 裡打開 Claude Code，它會自動從 `.mcp.json` 讀到這個伺服器。其他客戶端這樣設定：

```json
{
  "mcpServers": {
    "openav": {
      "command": "node",
      "args": ["/path/to/open-audiovisual/packages/mcp/server.js"]
    }
  }
}
```

它回應 `initialize`、`tools/list` 和 `tools/call`。`initialize` 回報伺服器名稱 `openav`、版本 0.1.0，協定版本照客戶端給的回送，客戶端沒給就用 `2024-11-05`。結果包成單一個文字項目回傳，物件會編碼成 JSON。呼叫失敗時，回傳代碼 −32000 的 JSON-RPC 錯誤，附一段訊息。

| 工具 | 引數 | 回傳 |
|---|---|---|
| `list_examples` | 無 | `[{ dir, title, summary }]`：每個範例的資料夾、它 `index.html` 的 `<title>`，以及它 `main.js` 的第一行註解 |
| `read_doc` | `doc`（必填）：`architecture`、`writing-a-world`、`signals`、`show-control`、`roadmap`、`agents`、`readme` | Markdown 文字。`agents` 是 AGENTS.md，`readme` 是 README，其他的是 `docs/<name>.md` |
| `scaffold_world` | `slug`（必填，kebab-case）、`donor`（預設 `01-hello-particles`） | `{ created, next_steps }`。把 `examples/<donor>/` 的每個檔案複製到 `examples/<next number>-<slug>/` |
| `run_checks` | 無 | 執行 `node --test tests/*.test.js`（逾時 60 秒）得到的 `{ pass, fail, ok }`，或是附上失敗那幾行的 `{ ok: false, output }` |

適合給 `scaffold_world` 當底的範例：`01-hello-particles`（最精簡的 2D canvas）、`02-chord-garden`（和弦驅動）、`03-pose-field`（鏡頭、手）、`05-prebiotic-flake`（p5 加聲音）。先 `read_doc agents`，再 `read_doc writing-a-world`。

## llms.txt 與 llms-full.txt

- [/llms.txt](../../llms.txt) 是 [llmstxt.org](https://llmstxt.org/) 格式的簡短索引：這是什麼、核心概念、怎麼開始、每一份文件和每一個範例。
- [/llms-full.txt](../../llms-full.txt) 把 README、AGENTS.md 和所有文件合成一個檔，給喜歡一次讀完的代理。
- 這本手冊在 `/docs/` 是純 HTML（繁體中文版在 `/zh/docs/`），不開 JavaScript 也讀得到每一個字。每一節都有固定的錨點，例如 `/docs/#mapping-curves`。

## create-world 技能

`.claude/skills/create-world/SKILL.md` 是一個 Claude Code 技能，把一段描述變成可以執行的範例。它的步驟：抽出輸入、3 到 6 個可演奏的參數、事件和幕 → 複製一個當底的範例 → 寫世界 → 把組裝接起來 → 在瀏覽器裡驗證 → 交回網址、參數清單、場景清單，以及世界會反應的訊號。

## 探查執行中的演出

每個用 `createShow()` 做出來的演出，都會把 `window.openav` 設成整個演出物件，所以操作瀏覽器的代理可以檢查它、操控它：

```js
openav.signals.list()                                   // every signal, its value and range
openav.params.resolve(openav.timeline.state())          // the current param values
openav.signals.pulse('midi/note/on', { note: 60, vel: 0.8, ch: 1 });   // play a note
openav.timeline.seek(40); openav.timeline.play();       // jump to a scene and play
openav.mapper.routes                                    // the wiring
```

## 一段可以直接貼上的提示詞

```text
Clone https://github.com/frank890417/open-audiovisual and read AGENTS.md first.
Run `node serve.js` and open http://localhost:8080/examples/01-hello-particles/ to see the smallest complete show.
Create examples/10-<name>/ by copying 01-hello-particles (or call the openav MCP tool scaffold_world), then write a World in its main.js for this piece:

  <describe the performance, e.g. "a jellyfish world that blooms on consonant chords">

Rules from AGENTS.md: continuous control goes through params, and the mapper routes signals to them. Never edit packages/* to make one example look right.
Done means: npm test passes, and the new example loads with zero console errors.
```

## 交回之前

- `npm test` 通過（或 `run_checks` 回報 `ok`）。
- 範例載入時，主控台零錯誤。`ws://…:7457` 的連線被拒（因為沒有開後台監看）是預期中的。
- 不接硬體，用螢幕鋼琴或電腦鍵盤彈，它也有反應。
- 按 <kbd>Space</kbd> 播放時間軸，畫面裡有東西隨時間變化。
- 回報網址、參數（哪些該接到旋鈕）、場景，以及世界在聽的訊號。
