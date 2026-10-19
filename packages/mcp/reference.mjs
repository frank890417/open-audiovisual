// @openav/mcp reference: the eight tools of packages/mcp/server.js. Read by tools/build-reference.mjs (see AGENTS.md,
// "Documenting a public name"). They are MCP tools, not functions: an agent calls them over stdio with a JSON-RPC
// `tools/call` request, so the examples are request bodies (lang json, static) and each tool's input fields are written
// in the description. Every behaviour below was checked by calling the server (node packages/mcp/server.js) from a script;
// scaffold_world was run in a copy of the folder layout so that no example folder was created in the checkout.

export default {
  list_examples: {
    group: 'mcp',
    summary: {
      en: 'Lists the example works of this checkout: for each one its folder, its page title and the first comment line of its `main.js`.',
      zh: '列出這份檔案庫裡的範例作品：每個範例的資料夾、頁面標題，以及它的 `main.js` 第一行註解。',
    },
    returns: { type: 'Object[]', en: '`[{ dir, title, summary }]`, one per folder in `examples/`, as JSON text. `dir` is like `examples/01-hello-particles`, `title` is the `<title>` of its `index.html`, `summary` is the first line of its `main.js` that starts with `//` (the slashes taken off). A file that is missing gives an empty string.', zh: '`[{ dir, title, summary }]`，`examples/` 底下每個資料夾一項，格式是 JSON 文字。`dir` 像 `examples/01-hello-particles`，`title` 是它的 `index.html` 的 `<title>`，`summary` 是它的 `main.js` 第一行以 `//` 開頭的內容（去掉斜線）。缺檔就給空字串。' },
    description: [
      {
        en: 'The first call an agent makes in an unfamiliar checkout: what works already exist, so it can pick a donor for [`scaffold_world`](#scaffold_world). It takes no input: send `"arguments": {}`.',
        zh: '代理進到陌生的檔案庫時的第一個呼叫：已經有哪些作品，這樣它才能替 [`scaffold_world`](#scaffold_world) 挑一個範本。它不需要任何輸入：送 `"arguments": {}`。',
      },
    ],
    needs: {
      en: 'The server running: `node packages/mcp/server.js`, which Claude Code starts from the `.mcp.json` of the repository (server name `openav`). Other clients need the same `command` and `args` in their MCP settings. An MCP client sends `initialize` once before the first call. Over stdio every message is one line of JSON: the request bodies on this page are spread over several lines to be read, and a client writes them on one line for you.',
      zh: '伺服器要在跑：`node packages/mcp/server.js`，Claude Code 會依儲存庫的 `.mcp.json` 啟動它（伺服器名稱 `openav`）。其他用戶端要在自己的 MCP 設定裡寫同樣的 `command` 和 `args`。MCP 用戶端在第一次呼叫之前會先送一次 `initialize`。透過 stdio 時每則訊息是一行 JSON：這一頁的請求內容為了好讀而分成好幾行，用戶端會替你把它們寫成一行。',
    },
    examples: [
      {
        code: `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_examples",
    "arguments": {}
  }
}`,
        lang: 'json',
        caption: { en: 'Send this to the server over stdio: the reply carries one text item, a JSON list of the examples with their folders, titles and one-line summaries.', zh: '把這個送給伺服器（透過 stdio）：回應裡有一個文字項目，是範例清單的 JSON，附上資料夾、標題和一行摘要。' },
        run: 'static',
        why: 'An MCP tool is called over stdio by an agent, not run on the page.',
      },
    ],
    related: ['scaffold_world', 'read_doc'],
    keywords: {
      en: ['list examples', 'examples', 'works', 'mcp tool', 'agent', 'what exists', 'donor'],
      zh: ['列出範例', '範例', '作品', 'mcp 工具', '代理', '有哪些', '範本'],
    },
  },

  read_doc: {
    group: 'mcp',
    summary: {
      en: 'Returns the text of one framework document: the agent briefing, a handbook chapter or the README, chosen by name.',
      zh: '回傳一份框架文件的文字：代理的簡介、手冊的某一章，或 README，用名稱選。',
    },
    returns: { type: 'String', en: 'The Markdown of the file, as it is on disk, in one text item: not JSON. The whole file comes back, which can be tens of kilobytes.', zh: '檔案原樣的 Markdown，放在一個文字項目裡，不是 JSON。整份檔案都會回來，可能有好幾十 KB。' },
    description: [
      {
        en: 'Input: `doc` (required), one of `architecture`, `writing-a-world`, `signals`, `show-control`, `score`, `roadmap`, `agents`, `readme`, `introduction`, `getting-started`, `concepts`, `inputs`, `mapping`, `controllers`, `remote`, `packages`, `agents-guide`, `troubleshooting`, `lab-integration`. The tool\'s own description tells an agent to start with `agents` (the conventions and the two unbreakable rules), then `writing-a-world`.',
        zh: '輸入：`doc`（必填），下面其中之一：`architecture`、`writing-a-world`、`signals`、`show-control`、`score`、`roadmap`、`agents`、`readme`、`introduction`、`getting-started`、`concepts`、`inputs`、`mapping`、`controllers`、`remote`、`packages`、`agents-guide`、`troubleshooting`、`lab-integration`。工具自己的說明叫代理先讀 `agents`（慣例和兩條不能破的規則），再讀 `writing-a-world`。',
      },
      {
        en: 'Most names are `docs/<name>.md`. Two are not, and they are easy to mix up: `agents` is `AGENTS.md` at the root of the repository (the briefing), `agents-guide` is `docs/agents.md` (the handbook chapter), and `readme` is `README.md`.',
        zh: '大部分名稱就是 `docs/<name>.md`。有兩個不是，而且很容易搞混：`agents` 是儲存庫根目錄的 `AGENTS.md`（簡介），`agents-guide` 是 `docs/agents.md`（手冊的章節），`readme` 則是 `README.md`。',
      },
    ],
    notes: [
      {
        en: 'A name that is not in the list, or no `doc` at all, is an error with a plain Node message (`The "path" argument must be of type string. Received undefined`), not a list of the valid names. A client that follows the input schema cannot send one: the schema has the names as an `enum`.',
        zh: '不在清單裡的名稱、或根本沒給 `doc`，會得到一個 Node 的原始錯誤訊息（`The "path" argument must be of type string. Received undefined`），而不是合法名稱的清單。照著輸入 schema 的用戶端不會送出這種值：schema 裡的名稱是 `enum`。',
      },
    ],
    examples: [
      {
        code: `{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "read_doc",
    "arguments": {
      "doc": "agents"
    }
  }
}`,
        lang: 'json',
        caption: { en: 'Asks for AGENTS.md: the reply is its Markdown text, which begins "# AGENTS.md — for AI coding agents working in this repo".', zh: '要 AGENTS.md：回應就是它的 Markdown 文字，開頭是「# AGENTS.md — for AI coding agents working in this repo」。' },
        run: 'static',
        why: 'An MCP tool is called over stdio by an agent, not run on the page.',
      },
    ],
    related: ['list_examples', 'scaffold_world'],
    keywords: {
      en: ['read doc', 'documentation', 'handbook', 'AGENTS.md', 'readme', 'architecture', 'writing a world', 'mcp tool', 'agent briefing'],
      zh: ['讀文件', '文件', '手冊', 'AGENTS.md', 'readme', '架構', '寫一個世界', 'mcp 工具', '代理簡介'],
    },
  },

  scaffold_world: {
    group: 'mcp',
    summary: {
      en: 'Creates a new numbered example by copying a donor example\'s files; then the agent edits the World in `main.js`. This tool writes to disk.',
      zh: '複製一個範本範例的檔案，建立一個新的、有編號的範例，之後代理再去編輯 `main.js` 裡的世界。這個工具會寫入磁碟。',
    },
    returns: { type: 'Object', en: '`{ created, next_steps }` as JSON text: `created` is the new folder (`examples/28-jellyfish-bloom`), `next_steps` is three lines: edit the World in `main.js`, edit the `<title>` and hint in `index.html`, then open it with `node serve.js`.', zh: '`{ created, next_steps }`，格式是 JSON 文字：`created` 是新資料夾（`examples/28-jellyfish-bloom`），`next_steps` 是三行：編輯 `main.js` 裡的世界、編輯 `index.html` 的 `<title>` 和提示文字、然後用 `node serve.js` 打開。' },
    description: [
      {
        en: 'Input: `slug` (required), a kebab-case name made of lower-case letters, digits and hyphens, such as `jellyfish-bloom`; and `donor` (optional, default `01-hello-particles`), the name of a folder in `examples/` to copy. Good donors: `01-hello-particles` (a minimal canvas), `02-chord-garden` (driven by chords), `03-pose-field` (the camera), `05-prebiotic-flake` (p5 and sound). The new folder is `examples/<number>-<slug>`, where the number is the highest one already in `examples/` plus 1, with two digits (`28`).',
        zh: '輸入：`slug`（必填），由小寫字母、數字和連字號組成的 kebab-case 名稱，例如 `jellyfish-bloom`，以及 `donor`（選填，預設 `01-hello-particles`），要複製的 `examples/` 裡的資料夾名稱。好用的範本有：`01-hello-particles`（最小的畫布）、`02-chord-garden`（由和弦驅動）、`03-pose-field`（鏡頭）、`05-prebiotic-flake`（p5 加聲音）。新資料夾是 `examples/<編號>-<slug>`，編號是 `examples/` 裡現有最大的編號加 1，兩位數（`28`）。',
      },
      {
        en: 'It copies every file of the donor folder (the donors have no sub-folders, and a sub-folder would stop the copy with an error), so the new example starts as a working copy. A `slug` with anything else in it, or an unknown `donor`, or a folder that already exists is an error (`slug must be kebab-case`, `unknown donor: …`, `already exists: …`).',
        zh: '它複製範本資料夾裡的每個檔案（現有的範本都沒有子資料夾，遇到子資料夾複製會出錯而中斷），所以新範例一開始就是能跑的副本。`slug` 含有其他字元、`donor` 不存在、或資料夾已經存在，都會是錯誤（`slug must be kebab-case`、`unknown donor: …`、`already exists: …`）。',
      },
    ],
    notes: [
      {
        en: 'Send `slug` every time. It is marked required in the input schema, but the tool does not check that it is there: without it the folder is created with the name `examples/<number>-undefined`.',
        zh: '每次都要送 `slug`。輸入 schema 把它標成必填，但工具本身沒有檢查它在不在：沒給的話，資料夾會以 `examples/<編號>-undefined` 的名字建立。',
      },
      {
        en: '`donor` is used as a folder name without further checks, so give it a plain name from `examples/`.',
        zh: '`donor` 會直接當成資料夾名稱使用，沒有再檢查，所以請給 `examples/` 裡的單純名稱。',
      },
    ],
    examples: [
      {
        code: `{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "scaffold_world",
    "arguments": {
      "slug": "jellyfish-bloom",
      "donor": "02-chord-garden"
    }
  }
}`,
        lang: 'json',
        caption: { en: 'Creates examples/<next number>-jellyfish-bloom from the chord garden; the reply says where, and what to edit next.', zh: '用和弦花園建立 examples/<下一個編號>-jellyfish-bloom，回應會說明建在哪裡，以及接下來要編輯什麼。' },
        run: 'static',
        why: 'An MCP tool is called over stdio by an agent, not run on the page (and this one writes a new folder into the checkout).',
      },
    ],
    related: ['list_examples', 'read_doc', 'run_checks'],
    keywords: {
      en: ['scaffold world', 'new example', 'create example', 'copy donor', 'jellyfish', 'start a work', 'mcp tool', 'new performance'],
      zh: ['建立世界', '新範例', '建立範例', '複製範本', '開始一件作品', 'mcp 工具', '新演出'],
    },
  },

  run_checks: {
    group: 'mcp',
    summary: {
      en: 'Runs the framework\'s whole test suite (`node --test` on every file in `tests/`), the same gate CI uses, and says whether it passed.',
      zh: '跑整個框架的測試（對 `tests/` 裡的每個檔案執行 `node --test`），也就是 CI 用的那道關卡，並回報有沒有通過。',
    },
    returns: { type: 'Object', en: 'When the run finishes cleanly: `{ pass, fail, ok }` (numbers from the report, and `ok` true only when `fail` is 0), as JSON text. Otherwise `{ ok: false, output }`, where `output` holds the lines of the report that say `not ok` or give the totals.', zh: '跑完順利的時候：`{ pass, fail, ok }`（數字取自報告，`fail` 是 0 時 `ok` 才是 true），格式是 JSON 文字。其他情況是 `{ ok: false, output }`，`output` 裡是報告中寫著 `not ok` 或給出總數的那幾行。' },
    description: [
      {
        en: 'No input: send `"arguments": {}`. An agent calls it after every change to know whether the repository is still green. It runs `node --test` over every `tests/*.test.js` of the checkout the server lives in, waits for it to finish and gives up after 60 seconds.',
        zh: '不需要輸入：送 `"arguments": {}`。代理每改一次就呼叫它，確認儲存庫還是綠的。它對伺服器所在的那份檔案庫的每個 `tests/*.test.js` 執行 `node --test`，等它跑完，60 秒就放棄。',
      },
    ],
    notes: [
      {
        en: 'At the time of writing, in the checkout this was written from, the whole suite takes about 50 seconds and prints about 3.6 MB of report, while the tool reads at most 1 MiB of it. Past that the child process is stopped, and the tool answers `{ ok: false, output }` with only the failing lines found in that first megabyte, even if every test passes. Until that changes, do not read `ok: false` with an empty `output` as a failing test: run `node --test tests/*.test.js` in a terminal.',
        zh: '寫這一條的時候，在寫它所用的那份檔案庫裡，整套測試大約要跑 50 秒，印出大約 3.6 MB 的報告，而工具最多只讀它的 1 MiB。超過之後，子行程會被停掉，工具回答 `{ ok: false, output }`，裡面只有那第一個百萬位元組裡找到的失敗行，就算每個測試都通過也一樣。在這個狀況改變之前，不要把 `ok: false` 加上空的 `output` 當成有測試失敗：請在終端機裡直接跑 `node --test tests/*.test.js`。',
      },
    ],
    examples: [
      {
        code: `{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "run_checks",
    "arguments": {}
  }
}`,
        lang: 'json',
        caption: { en: 'Runs the suite: the reply is `{ pass, fail, ok }` when it ends cleanly, or `{ ok: false, output }` with the failing lines. Allow about a minute.', zh: '跑整套測試：順利跑完時回應是 `{ pass, fail, ok }`，不然是附上失敗行的 `{ ok: false, output }`。要等大約一分鐘。' },
        run: 'static',
        why: 'An MCP tool is called over stdio by an agent, not run on the page (and this one starts the whole test suite).',
      },
    ],
    related: ['scaffold_world', 'validate_profile'],
    keywords: {
      en: ['run checks', 'run tests', 'node --test', 'ci', 'test suite', 'verify', 'green', 'mcp tool'],
      zh: ['跑檢查', '跑測試', 'node --test', 'ci', '測試', '驗證', '全綠', 'mcp 工具'],
    },
  },

  list_controllers: {
    group: 'mcp',
    summary: {
      en: 'Lists every MIDI controller profile that ships with the framework: id, name, maker, kind, control mix, how many controls are unverified, and its page URL.',
      zh: '列出框架內建的每一份 MIDI 控制器設定檔：id、名稱、廠牌、種類、控制元件的組成、還有幾個沒驗證、以及它的頁面網址。',
    },
    returns: { type: 'Object', en: '`{ count, controllers }` as JSON text. Each controller is `{ id, short, name, maker, kind, controls, unverified, url }`: `id` such as `arturia-minilab3`, `short` the signal namespace (`midi/<short>/…`), `kind` `\'device\'` or `\'generic\'`, `controls` the mix as `{ knob: 8, pad: 8, keys: 25 }` (a keyboard counts one per key), `unverified` how many of those controls still carry `"verified": false`, `url` like `https://openaudiovisual.com/controllers/<id>/`.', zh: '`{ count, controllers }`，格式是 JSON 文字。每個控制器是 `{ id, short, name, maker, kind, controls, unverified, url }`：`id` 像 `arturia-minilab3`，`short` 是訊號的命名空間（`midi/<short>/…`），`kind` 是 `\'device\'` 或 `\'generic\'`，`controls` 是組成，像 `{ knob: 8, pad: 8, keys: 25 }`（鍵盤每個鍵算一個），`unverified` 是其中還帶著 `"verified": false` 的控制元件數，`url` 像 `https://openaudiovisual.com/controllers/<id>/`。' },
    description: [
      {
        en: 'No input: send `"arguments": {}`. It reads the profiles in `packages/midi/profiles/`, the same ones the controller pages and `<oav-controller>` use. Use it to find the `id` for [`read_profile`](#read_profile), or to check that a controller is already covered before writing a new profile with [`scaffold_profile`](#scaffold_profile).',
        zh: '不需要輸入：送 `"arguments": {}`。它讀的是 `packages/midi/profiles/` 裡的設定檔，跟控制器頁面和 `<oav-controller>` 用的是同一批。用它找 [`read_profile`](#read_profile) 要的 `id`，或在用 [`scaffold_profile`](#scaffold_profile) 寫新設定檔之前，先確認這台控制器是不是已經有了。',
      },
    ],
    examples: [
      {
        code: `{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "list_controllers",
    "arguments": {}
  }
}`,
        lang: 'json',
        caption: { en: 'The reply lists every shipped profile, starting with arturia-minilab3 (8 knobs, 4 faders, 8 pads, 25 keys …), each with its page URL.', zh: '回應列出每一份內建的設定檔，從 arturia-minilab3（8 個旋鈕、4 支推桿、8 個打擊墊、25 個琴鍵 …）開始，每個都附上頁面網址。' },
        run: 'static',
        why: 'An MCP tool is called over stdio by an agent, not run on the page.',
      },
    ],
    related: ['read_profile', 'validate_profile', 'scaffold_profile'],
    keywords: {
      en: ['list controllers', 'midi controllers', 'profiles', 'minilab', 'launchpad', 'devices', 'mcp tool', 'controller list'],
      zh: ['列出控制器', 'midi 控制器', '設定檔', 'minilab', 'launchpad', '裝置', 'mcp 工具', '控制器清單'],
    },
  },

  read_profile: {
    group: 'mcp',
    summary: {
      en: 'Reads one controller profile in full, plus a readable MIDI map: for each control its type, the exact message, the signal name and whether the number is verified.',
      zh: '完整讀出一份控制器設定檔，另外附上好讀的 MIDI 對照表：每個控制元件的類型、確切的訊息、訊號名稱，以及這個號碼有沒有驗證過。',
    },
    returns: { type: 'Object', en: '`{ id, url, unverified, profile, mapping }` as JSON text. `profile` is the JSON as shipped. `mapping` has one row per control: `{ control, type, message, signal, verified }`, where `message` reads like `CC 74, ch 1`, `note 36, ch 10` or `notes 48–72 (25 keys), ch 1`, and `signal` is `midi/<short>/<id>` (for a keyboard `midi/<short>/<id>/on · /off · n<note>`); a row may also carry `led` and `note`.', zh: '`{ id, url, unverified, profile, mapping }`，格式是 JSON 文字。`profile` 是原樣的 JSON。`mapping` 每個控制元件一列：`{ control, type, message, signal, verified }`，`message` 讀起來像 `CC 74, ch 1`、`note 36, ch 10` 或 `notes 48–72 (25 keys), ch 1`，`signal` 是 `midi/<short>/<id>`（鍵盤是 `midi/<short>/<id>/on · /off · n<note>`），有的列還會帶 `led` 和 `note`。' },
    description: [
      {
        en: 'Input: `id` (required), a profile id or its `short`, for example `arturia-minilab3` or `minilab3`. Where a control says `verified: false`, its number is a placeholder or a guess that no source has confirmed yet. An unknown id is an error that lists every id it knows. [`list_controllers`](#list_controllers) shows what is there.',
        zh: '輸入：`id`（必填），設定檔的 id 或它的 `short`，例如 `arturia-minilab3` 或 `minilab3`。控制元件寫著 `verified: false` 的地方，它的號碼是還沒有任何來源證實的預留值或猜測。不認得的 id 會得到一個列出它所有已知 id 的錯誤。[`list_controllers`](#list_controllers) 可以看有哪些。',
      },
    ],
    examples: [
      {
        code: `{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "read_profile",
    "arguments": {
      "id": "minilab3"
    }
  }
}`,
        lang: 'json',
        caption: { en: 'Asks for the MiniLab 3 by its short name: the reply holds its full profile and a mapping whose first knob reads "CC …, ch 1" with the signal midi/minilab3/knob1.', zh: '用簡稱要 MiniLab 3：回應裡有完整的設定檔，還有一份對照表，其中第一個旋鈕寫成「CC …, ch 1」、訊號是 midi/minilab3/knob1。' },
        run: 'static',
        why: 'An MCP tool is called over stdio by an agent, not run on the page.',
      },
    ],
    related: ['list_controllers', 'validate_profile', 'scaffold_profile'],
    keywords: {
      en: ['read profile', 'controller profile', 'midi map', 'cc number', 'signal name', 'verified', 'minilab3', 'mcp tool'],
      zh: ['讀設定檔', '控制器設定檔', 'midi 對照表', 'cc 號碼', '訊號名稱', '驗證', 'minilab3', 'mcp 工具'],
    },
  },

  validate_profile: {
    group: 'mcp',
    summary: {
      en: 'Checks a controller profile with `validateProfile()` and against the shipped ones: same id, same short name, or port patterns that claim the same device.',
      zh: '用框架自己的 `validateProfile()` 檢查一份控制器設定檔，並跟內建的設定檔比對：id 相同、簡稱相同，或連接埠規則會搶到同一台裝置。',
    },
    returns: { type: 'Object', en: '`{ ok, problems, conflicts }` as JSON text. `problems` is a list of sentences from `validateProfile()` (`controls[0] (a): cc must be 0..127`). `conflicts` is a list of `{ with, kind, detail }`: `with` is the shipped profile, `kind` is `\'id\'`, `\'short\'` or `\'port\'`. `ok` is true only when both are empty.', zh: '`{ ok, problems, conflicts }`，格式是 JSON 文字。`problems` 是 `validateProfile()` 給的一串句子（`controls[0] (a): cc must be 0..127`）。`conflicts` 是 `{ with, kind, detail }` 的清單：`with` 是內建的那份設定檔，`kind` 是 `\'id\'`、`\'short\'` 或 `\'port\'`。兩個都是空的，`ok` 才是 true。' },
    description: [
      {
        en: 'Input: `profile` (required), the profile as an object or as a JSON string. A string that is not valid JSON does not raise an error: the answer is `{ ok: false, problems: [\'not valid JSON: …\'], conflicts: [] }`. The checks cover the id and short name (lower-case, and `short` must not be one of the reserved generic names), a name and a kind (`device` or `generic`), a source for every device profile, the port regular expressions, the faceplate size, every control (a known type and message, `cc` or `note` in 0..127, two controls never on the same message, an encoder\'s relative mode) and that every control is shown on the faceplate.',
        zh: '輸入：`profile`（必填），可以是物件，也可以是 JSON 字串。不是合法 JSON 的字串不會引發錯誤：答案是 `{ ok: false, problems: [\'not valid JSON: …\'], conflicts: [] }`。檢查的範圍有：id 和簡稱（小寫，而且 `short` 不能是保留的通用名稱）、名稱和種類（`device` 或 `generic`）、每份 device 設定檔都要有來源、連接埠的正規表示式、面板尺寸、每個控制元件（已知的類型和訊息、`cc` 或 `note` 在 0..127、兩個控制元件不能用同一則訊息、編碼器的相對模式），以及每個控制元件都有顯示在面板上。',
      },
      {
        en: 'The conflicts are what the validator cannot see by itself: `id` and `short` are taken by a shipped profile (the `short` becomes the signal namespace `midi/<short>/…`), and `port` means a regular expression in `match.ports` is identical to a shipped one or matches its name, so the framework could not tell the two devices apart when one is plugged in. A profile for a new device passes when `ok` is true; a clone of a shipped one comes back with all three kinds.',
        zh: '衝突是驗證器自己看不到的事：`id` 和 `short` 已經被內建的設定檔用掉了（`short` 會變成訊號命名空間 `midi/<short>/…`），`port` 則是 `match.ports` 裡的某條正規表示式跟內建的一模一樣、或對得上它的名稱，這樣接上其中一台時，框架分不出兩台裝置。新裝置的設定檔在 `ok` 是 true 的時候就算通過。複製一份內建設定檔去驗證，會三種衝突全都得到。',
      },
    ],
    examples: [
      {
        code: `{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "validate_profile",
    "arguments": {
      "profile": {
        "id": "Bad Id",
        "kind": "device",
        "controls": [
          {
            "id": "a",
            "type": "knob",
            "msg": "cc",
            "cc": 200
          }
        ]
      }
    }
  }
}`,
        lang: 'json',
        caption: { en: 'Sends a profile with several mistakes: the reply has `ok: false` and a list of problems, among them the id that is not lower-case and "cc must be 0..127".', zh: '送一份有好幾個錯誤的設定檔：回應是 `ok: false` 和一串問題，其中有不是小寫的 id，以及「cc must be 0..127」。' },
        run: 'static',
        why: 'An MCP tool is called over stdio by an agent, not run on the page.',
      },
    ],
    related: ['scaffold_profile', 'read_profile', 'list_controllers'],
    keywords: {
      en: ['validate profile', 'check profile', 'validateProfile', 'conflicts', 'port pattern', 'collision', 'controller profile', 'mcp tool'],
      zh: ['驗證設定檔', '檢查設定檔', 'validateProfile', '衝突', '連接埠規則', '撞名', '控制器設定檔', 'mcp 工具'],
    },
  },

  scaffold_profile: {
    group: 'mcp',
    summary: {
      en: 'Generates a valid skeleton profile for a new controller from maker, model and control counts. Every number is an unverified placeholder; nothing is written.',
      zh: '依廠牌、型號和控制元件的數量，替一台新控制器產生一份有效的設定檔骨架。每個號碼都是標成未驗證的預留值，不會寫入磁碟。',
    },
    returns: { type: 'Object', en: '`{ profile, problems, unverified, next_steps }` as JSON text, plus `warnings` when the id or short name collides with a shipped profile. `profile` is the skeleton, `problems` is what `validateProfile()` says about it (empty), `unverified` is how many controls are placeholders (all of them), `next_steps` is what to do to turn it into a real profile.', zh: '`{ profile, problems, unverified, next_steps }`，格式是 JSON 文字，id 或簡稱跟內建設定檔撞名的話還會有 `warnings`。`profile` 是骨架，`problems` 是 `validateProfile()` 對它的意見（是空的），`unverified` 是有多少控制元件是預留值（全部），`next_steps` 是把它變成正式設定檔要做的事。' },
    description: [
      {
        en: 'Input, all required: `maker` (such as `Arturia`), `model` (such as `MiniLab 3`) and `controls`, a list of `{ type, count, from? }` that describes the faceplate, for example `[{"type":"knob","count":8},{"type":"pad","count":8},{"type":"keys","count":25,"from":48}]`. `type` is one of `knob`, `encoder`, `fader`, `pad`, `button`, `keys`, `wheel`, `strip`; `count` is a whole number from 1 to 128; `from` is the lowest note of a `keys` section (default 48).',
        zh: '輸入全部必填：`maker`（例如 `Arturia`）、`model`（例如 `MiniLab 3`）和 `controls`，一串描述面板的 `{ type, count, from? }`，例如 `[{"type":"knob","count":8},{"type":"pad","count":8},{"type":"keys","count":25,"from":48}]`。`type` 是 `knob`、`encoder`、`fader`、`pad`、`button`、`keys`、`wheel`、`strip` 之一，`count` 是 1 到 128 的整數，`from` 是 `keys` 區段最低的音符（預設 48）。',
      },
      {
        en: 'The skeleton passes `validateProfile()` and it is deliberately honest: every control has `"verified": false`, the source list holds one `TODO` entry, and the numbers are placeholders. Knobs, faders and strips get consecutive CC numbers from 20, pads get notes from 36 (skipping a `keys` range), buttons get momentary CCs, encoders get relative CCs, the first wheel is a pitch bend and any further wheel falls back to a CC. The id comes from maker and model (`acme-pad-pro-16`), `short` is the model without hyphens, and `match.ports` is a pattern made of the model\'s words.',
        zh: '骨架會通過 `validateProfile()`，而且刻意很誠實：每個控制元件都是 `"verified": false`，來源清單裡只有一條 `TODO`，號碼都是預留值。旋鈕、推桿、觸控條從 20 開始依序拿 CC 號碼，打擊墊從 36 開始拿音符（會跳過 `keys` 的範圍），按鈕拿瞬間式的 CC，編碼器拿相對式的 CC，第一個滾輪是彈音，之後的滾輪改用 CC。id 由廠牌和型號組成（`acme-pad-pro-16`），`short` 是去掉連字號的型號，`match.ports` 是由型號各個字組成的規則。',
      },
      {
        en: 'Wrong input is an error with the reason: no maker or model, `controls` empty or not a list, an unknown `type`, a `count` outside 1..128, `keys` outside notes 0..127, or more controls than there are CC numbers (about 108) or pad notes. After that the agent sources every number from the maker\'s MIDI chart, runs [`validate_profile`](#validate_profile), and saves the file in `packages/midi/profiles/`; `next_steps` lists these.',
        zh: '輸入不對會得到說明原因的錯誤：沒有廠牌或型號、`controls` 是空的或不是清單、不認得的 `type`、`count` 不在 1..128、`keys` 超出音符 0..127，或控制元件多到 CC 號碼（約 108 個）或打擊墊音符不夠用。之後代理要從廠商的 MIDI 對照表查證每個號碼，跑 [`validate_profile`](#validate_profile)，再把檔案存進 `packages/midi/profiles/`。`next_steps` 列出的就是這些。',
      },
    ],
    examples: [
      {
        code: `{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "scaffold_profile",
    "arguments": {
      "maker": "Acme",
      "model": "Pad Pro 16",
      "controls": [
        { "type": "knob", "count": 8 },
        { "type": "pad", "count": 16 },
        { "type": "keys", "count": 25, "from": 48 }
      ]
    }
  }
}`,
        lang: 'json',
        caption: { en: 'Asks for a skeleton for an invented "Acme Pad Pro 16": the reply has id acme-pad-pro-16, 25 control entries (the keyboard is one entry of 25 keys, so `unverified` is 49), no problems, and the next steps.', zh: '替虛構的「Acme Pad Pro 16」要一份骨架：回應裡 id 是 acme-pad-pro-16、有 25 個控制元件項目（鍵盤是一項、含 25 個鍵，所以 `unverified` 是 49）、沒有問題，並附上接下來的步驟。' },
        run: 'static',
        why: 'An MCP tool is called over stdio by an agent, not run on the page.',
      },
    ],
    related: ['validate_profile', 'read_profile', 'list_controllers'],
    keywords: {
      en: ['scaffold profile', 'new controller', 'skeleton', 'controller profile', 'maker model', 'placeholder', 'unverified', 'mcp tool'],
      zh: ['建立設定檔', '新控制器', '骨架', '控制器設定檔', '廠牌 型號', '預留值', '未驗證', 'mcp 工具'],
    },
  },
};
