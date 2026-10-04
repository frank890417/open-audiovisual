# 簡介

open-audiovisual（OAV）是一套在瀏覽器裡跑的 JavaScript 框架，給現場影音表演用。它只用原生的 ES module：不用建置、沒有相依套件、不用註冊帳號。把 repo clone 下來，跑一個檔案，打開一個網頁，就可以開始了。

每一場演出都要從頭重做的那一塊，由它來處理：MIDI 的底層接線、把輸入變成參數、有場景的時間軸、導演控台、給演奏者的演出模式，以及給舞台監督的後台頁面。你只要寫*世界*，也就是作品本身。框架的介紹、一台即時在跑的樂器，還有九件範例作品，都在[首頁](https://openaudiovisual.com/)。

## 給誰用

- **演奏者**用 MIDI 鍵盤、麥克風、鏡頭、手機或螢幕鋼琴來彈範例，從控台操作一場演出。
- **寫程式的人**大約二十行就能寫好一個世界，呼叫一次 `createShow()`，輸入、映射、時間軸、控台、聲音和後台就都有了。
- **AI 代理**先讀 [AGENTS.md](../../AGENTS.md)，接上 repo 內附的 MCP 伺服器，在一個已經能跑的底盤裡寫世界。見[給 AI 代理](agents.md)。

## 四層與兩條主軸

```text
L1 INPUT     "what is happening"       midi · audio · chord · pose · keys · drums · phones
               → every input publishes named SIGNALS: midi/cc/74, chord/consonance, audio/rms
L2 MAPPING   "what it means"           routes: signal → param, with curve, range, smoothing, learn
L3 WORLD     "how the system behaves"  your piece; reads PARAMS, never inputs; any renderer
L4 OUTPUT    "how it leaves"           screen · in-browser sound · MIDI out · OSC to UDP

spines       timeline (automation, scenes, cues) · monitor (backstage over WebSocket)
around them  console (the director's desk) · relay, surface, remote (phones as controllers)
```

每一層只做一件事，各有一份寫明的介面約定（[架構](architecture.md)），所以換掉任何一層，都不用動到其他層。能一直這樣，靠的是兩條規則，寫在[核心概念](concepts.md#the-two-rules)。

## 從哪裡來

框架的核心是從 **《The Last Input 終局之前》**（吳哲宇，2026）抽出來的。那是台北 IRCAM 聲鬥陣 × C-LAB 台灣聲響實驗室駐村的一場演出，鋼琴和一個活著的數位世界同台，喇叭穹頂有 49.4 聲道。時間軸、和弦語意、多對多的 MIDI learn、OSC 批次傳送，都先撐過一整場十四個場景的真實演出，才在這裡整理成通用的框架。從那之後就定了一條規則：真實演出要求過的功能，框架才長。

映射層的想法，承接 [libmapper](http://libmapper.github.io/) 對訊號命名空間的研究。姊妹專案 [WebToe](https://github.com/frank890417/WebToe) 是節點式的資料流引擎，可以匯入 TouchDesigner 專案。WebToe 是引擎，open-audiovisual 是演出。

## 怎麼讀這本手冊

- 第一次來：先讀[快速開始](getting-started.md)，再讀[核心概念](concepts.md)，然後是[寫一個世界](writing-a-world.md)。
- 要做一場演出：[輸入](inputs.md)、[映射](mapping.md)、[演出控制](show-control.md)、[手機、中繼與控制面板](remote.md)。
- 要查東西：[訊號一覽](signals.md)和[套件一覽](packages.md)。
- 出問題了：[疑難排解](troubleshooting.md)。

這裡寫的每一件事，都對照過 [packages/](../../packages/) 裡的原始碼。這一頁和程式碼對不上時，以程式碼為準，那就是這一頁的 bug，請開一個 issue。
