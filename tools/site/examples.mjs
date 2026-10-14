// One-line copy for every example, for llms.txt (English and Traditional Chinese).
//
// Until the examples get their own manifest (tools/examples/manifest.mjs, with titles, summaries and
// thumbnails for the /examples/ index), this is where an example's one-liner lives. An example with no entry
// here still appears in llms.txt: its line is taken from the first comment of its main.js, the same line the
// MCP server's list_examples prints. tests/site.test.js fails when an example is missing from llms.txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const COPY = {
  '01-hello-particles': ['the smallest complete app; read main.js top to bottom.', '最小的完整作品，從上讀到下就懂整個框架。'],
  '02-chord-garden': ['chord semantics; triads bloom, clusters decay.', '和弦語意：三和弦開花，音堆凋零。'],
  '03-pose-field': ['hand instrument; pinches and fists via the camera.', '手勢樂器：用鏡頭抓捏合與握拳。'],
  '04-webtoe-stage': ['a WebToe node patch performed as a world.', '把 WebToe 節點網路當成世界來演奏。'],
  '05-prebiotic-flake': ['a 2023 MIDI sketch with the Tone.js audio branch.', '2023 年的 MIDI 草圖，接上 Tone.js 音訊支線。'],
  '06-cylinder-earth': ['microphone bands and the drum machine drive WebGL towers.', '麥克風頻段與鼓機驅動 WebGL 圓柱塔。'],
  '07-firework-festival': ['pinch to launch fireworks (21-landmark hands).', '捏合手指放煙火（21 點手部追蹤）。'],
  '08-remote-surface': ['a phone/iPad control surface grown from the world\'s params (needs `node serve.js` on the LAN).', '從世界的參數長出來的手機／iPad 控制面板（區網內要跑 `node serve.js`）。'],
  '09-midi-controllers': ['on-screen MiniLab 3, LPD8, Launchpad, nanoKONTROL2 that mirror real hardware.', '螢幕上的 MiniLab 3、LPD8、Launchpad、nanoKONTROL2，和真機同步。'],
  '10-record': ['a performance video: the work above the webcam in one vertical 1080×1920 to 4K file with the work\'s own sound; MIDI takes recorded and played back.', '演出影片：作品疊在鏡頭畫面上，連同作品自己的聲音錄成一個直式 1080×1920 到 4K 的檔案；MIDI 演奏可錄下再重播。'],
  '11-controller-video': ['the performance video without a camera: the MIDI controller being played (MiniLab 3, any profile) drawn live under the work; replayed takes animate it too.', '不用鏡頭的演出影片：作品下方即時畫出正在彈的 MIDI 控制器（MiniLab 3 或任何設定檔），重播的演奏也會動。'],
  '12-leap-hands': ['a Leap Motion as an instrument through the local bridge (`node packages/leap/bridge/leap-bridge.mjs`, `--mock` without a sensor); the mouse simulates hands when no bridge runs.', '把 Leap Motion 當樂器，經本機橋接（`node packages/leap/bridge/leap-bridge.mjs`，沒有感測器用 `--mock`）；沒開橋接時用滑鼠模擬手。'],
  '13-score-director': ['a show with structure: "A day of sky" written once as segment lengths; a Director runs one module per segment, `?cut=<id>` picks a version, Space continues a hold.', '有結構的演出：「一天的天空」只寫一次段落長度；導演為每段跑一個模組，`?cut=<id>` 選版本，空白鍵放行 hold。'],
  '15-p5-one-line': ['p5.js in one line: a plain p5 sketch whose first line loads oav-p5.js, then plays from a MIDI controller, an on-screen controller or a phone.', 'p5.js 一行指令：一份普通的 p5 草圖，第一行載入 oav-p5.js，就能用 MIDI 控制器、螢幕上的控制器或手機彈。'],
};

/** "NN · title — summary." from the first comment line of examples/<id>/main.js, '' when there is none. */
function firstComment(id) {
  try {
    const first = fs.readFileSync(path.join(ROOT, 'examples', id, 'main.js'), 'utf8').split('\n')[0];
    const m = /^\/\/\s*\d+\s*·\s*(.+)$/.exec(first);
    return m ? m[1].replace(/\s+—\s+/, ': ').replace(/\.$/, '') + '.' : '';
  } catch { return ''; }
}

/** The one-liner for an example in a language. */
export function exampleLine(id, locale) {
  const c = COPY[id];
  if (c) return c[locale === 'zh' ? 1 : 0];
  return firstComment(id) || id;
}
