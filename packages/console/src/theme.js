// Console theme — one dark, readable-from-a-booth stylesheet. No build step.
export const css = `
.oav-console { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #cfd6e4; background: #0d1017; padding: 10px; display: flex; flex-direction: column;
  gap: 10px; box-sizing: border-box; overflow-y: auto; }
.oav-console * { box-sizing: border-box; }
.oav-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.oav-btn { background: #1a2030; color: #cfd6e4; border: 1px solid #2a3348; border-radius: 6px;
  padding: 4px 10px; cursor: pointer; font: inherit; }
.oav-btn:hover { background: #232c42; }
.oav-btn.active { background: #2e6df6; color: #fff; border-color: #2e6df6; }
.oav-clock { font-size: 16px; font-weight: 600; color: #fff; min-width: 70px; }
.oav-scene { color: #ffd166; }
.oav-scrub { position: relative; height: 34px; flex: none; background: #131826; border-radius: 6px;
  cursor: crosshair; overflow: hidden; }   /* flex: none — in a tall desk the flex column used to squash the scrubber to 0 px */
.oav-scrub .blk { position: absolute; top: 0; bottom: 0; border-left: 1px solid #2a3348;
  display: flex; align-items: center; padding-left: 5px; color: #8892a8; font-size: 10px;
  overflow: hidden; white-space: nowrap; }
.oav-scrub .blk.cur { background: rgba(46,109,246,.18); color: #cfd6e4; }
.oav-scrub .blk.hold { border-right: 2px dashed #ffd166; }
.oav-scrub .cue { position: absolute; bottom: 0; width: 7px; height: 11px; margin-left: -3px; cursor: pointer;
  background: linear-gradient(#ffd166, #ffd166) center / 1px 100% no-repeat; }
.oav-scrub .cue::after { content: ''; position: absolute; left: 0; bottom: 0; width: 7px; height: 7px;
  background: #ffd166; transform: scale(.8) rotate(45deg); }
.oav-scrub .cue:hover::after { background: #fff; }
.oav-btn.holding { background: #ffd166; color: #111; border-color: #ffd166; animation: oavPulse 1s infinite; }
.oav-scrub .head { position: absolute; top: 0; bottom: 0; width: 2px; background: #2e6df6; }
.oav-panel { background: #10141f; border: 1px solid #1c2334; border-radius: 8px; padding: 8px; }
.oav-panel h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase;
  letter-spacing: .08em; color: #667; cursor: pointer; user-select: none; }
.oav-panel h3::before { content: '▾ '; color: #445; }
.oav-panel.closed h3::before { content: '▸ '; }
.oav-panel.closed > *:not(h3) { display: none; }
.oav-sound-btn { background: #1a2030; color: #cfd6e4; border: 1px solid #2a3348;
  border-radius: 8px; padding: 6px 14px; font: 12px ui-monospace, monospace; cursor: pointer; }
.oav-sound-btn.on { background: #2e6df6; color: #fff; border-color: #2e6df6; }
.oav-sound-pick { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.oav-sound-pick [hidden] { display: none !important; }
.oav-sound-pick-row { display: flex; gap: 8px; align-items: center; color: #9aa5bd; font-size: 11px; }
.oav-sound-pick select { flex: 1; min-width: 0; background: #1a2030; color: #cfd6e4; border: 1px solid #2a3348;
  border-radius: 6px; padding: 4px 6px; font: inherit; }
.oav-sound-pick select:focus-visible { outline: 2px solid #2e6df6; outline-offset: 1px; }
.oav-sound-pick-status { display: flex; gap: 8px; align-items: center; color: #ffd166; font-size: 10px; }
.oav-sound-pick-meter { width: 80px; height: 4px; background: #131826; border-radius: 2px; overflow: hidden; flex: none; }
.oav-sound-pick-meter i { display: block; height: 100%; width: 0; background: #ffd166; transition: width .15s; }
.oav-sound-pick-credit { color: #667; font-size: 10px; }
.oav-sound-pick-credit a { color: #8892a8; }
.oav-layers .lay { display: grid; grid-template-columns: 88px 1fr; gap: 8px; padding: 2px 0;
  font-size: 11px; align-items: baseline; }
.oav-layers b { font-weight: 600; }
.oav-layers .l1 { color: #37c978; } .oav-layers .l2 { color: #7ea6ff; }
.oav-layers .l3 { color: #ffd166; } .oav-layers .l4 { color: #b47ee6; }
.oav-layers .v { color: #8892a8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oav-midimeter { width: 100%; display: none; background: #0b0e15; border-radius: 6px; margin-top: 6px; }
.oav-devrow { display: flex; gap: 6px; align-items: center; padding: 2px 0; font-size: 11px;
  color: #9aa5bd; cursor: pointer; }
.oav-devrow input { accent-color: #2e6df6; }
.oav-devrow i { color: #556; font-style: normal; margin-left: auto; }
.oav-devrow.none { color: #556; cursor: default; }
.oav-routerow { display: flex; gap: 6px; align-items: center; padding: 2px 0; font-size: 11px;
  color: #9aa5bd; }
.oav-routerow input { accent-color: #2e6df6; }
.oav-routerow span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oav-param { display: grid; grid-template-columns: 110px 1fr 52px auto auto; gap: 6px;
  align-items: center; padding: 2px 0; }
.oav-param label { color: #9aa5bd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oav-param input[type=range] { width: 100%; accent-color: #2e6df6; height: 20px; }
.oav-param .val { text-align: right; color: #fff; font-variant-numeric: tabular-nums; }
.oav-param.ovr label { color: #ffd166; }
.oav-chip { font-size: 10px; border: 1px solid #2a3348; border-radius: 10px; padding: 1px 7px;
  cursor: pointer; color: #8892a8; background: none; }
.oav-chip:hover { color: #cfd6e4; }
.oav-chip.learn { border-color: #ffd166; color: #ffd166; animation: oavPulse 1s infinite; }
.oav-chip.bound { border-color: #2e6df6; color: #7ea6ff; }
@keyframes oavPulse { 50% { opacity: .4; } }
.oav-sig { display: grid; grid-template-columns: 150px 1fr 56px; gap: 6px; align-items: center;
  padding: 1px 0; }
.oav-sig .bar { height: 8px; background: #131826; border-radius: 4px; overflow: hidden; }
.oav-sig .bar i { display: block; height: 100%; background: #37c978; transition: width .05s linear; }
.oav-sig.pulse .bar i { background: #ffd166; }
.oav-log { max-height: 110px; overflow-y: auto; color: #667; font-size: 10px; }
.oav-log .out { color: #7ea6ff; }
.oav-director .dir-cut { display: flex; gap: 6px; align-items: center; color: #8892a8; font-size: 11px; margin-bottom: 6px; }
.oav-director .dir-cut select { flex: 1; min-width: 0; background: #1a2030; color: #cfd6e4; border: 1px solid #2a3348; border-radius: 6px; padding: 3px 6px; font: inherit; }
.oav-director .dir-now { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.oav-director .dir-now b { font-size: 15px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oav-director .dir-now span { color: #ffd166; font-variant-numeric: tabular-nums; flex: none; }
.oav-director .dir-bar { height: 5px; background: #131826; border-radius: 3px; overflow: hidden; margin: 5px 0 6px; }
.oav-director .dir-bar i { display: block; height: 100%; width: 0; background: #2e6df6; }
.oav-director .dir-hold { margin: 4px 0; padding: 5px 8px; border-radius: 6px; background: #3a2f12; border: 1px solid #ffd166; color: #ffd166;
  font-weight: 600; animation: oavPulse 1.4s infinite; }
.oav-director .dir-next { color: #9aa5bd; display: flex; justify-content: space-between; gap: 8px; }
.oav-director .dir-next b { color: #cfd6e4; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oav-director .dir-next span { font-variant-numeric: tabular-nums; flex: none; }
.oav-director h4 { margin: 8px 0 2px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #667; }
.oav-director ul { margin: 0; padding-left: 16px; color: #cfd6e4; }
.oav-director .dir-cues { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.oav-director .dir-cues .oav-chip.passed { color: #37c978; border-color: #1f5136; }
.oav-director .dir-warn { margin-top: 8px; padding: 5px 8px; border-radius: 6px; background: #2a1414; border: 1px solid #a33; color: #ffb0a0; }
.oav-director .dir-warn small { display: block; color: #d99; }
.oav-wizard { margin: 4px 0 6px; padding: 6px 8px; border-radius: 6px; background: #18202f; border: 1px solid #2e6df6; color: #cfd6e4; }
.oav-wizard b { color: #ffd166; }
.oav-wizard .oav-row { margin-top: 4px; }
.oav-wizard.done { border-color: #37c978; }
.oav-perf { position: fixed; inset: 0; background: #000; color: #fff; z-index: 999;
  display: none; flex-direction: column; justify-content: center; padding: 6vw;
  font: 600 4.5vw/1.35 ui-monospace, monospace; }
.oav-perf.on { display: flex; }
.oav-perf .now { font-size: 6vw; line-height: 1.15; }
.oav-perf .note { color: #9aa5bd; font-size: 2.4vw; font-weight: 500; margin-top: 1vh; }
.oav-perf .acts { margin-top: 4vh; display: flex; flex-direction: column; gap: 1.2vh; }
.oav-perf .acts div { color: #ffd166; font-size: 3.6vw; font-weight: 600; }
.oav-perf .acts div::before { content: '▸ '; color: #8a6d1f; }
.oav-perf .hold { margin-top: 4vh; padding: 1.4vh 2vw; border: .3vw solid #ffd166; color: #ffd166; font-size: 3vw; border-radius: 1vw; align-self: flex-start; animation: oavPulse 1.4s infinite; }
.oav-perf .hold[hidden], .oav-perf .warn[hidden] { display: none; }
.oav-perf .next { color: #8892a8; font-size: 2.6vw; margin-top: 4vh; }
.oav-perf .next b { color: #cfd6e4; }
.oav-perf .warn { position: absolute; left: 4vw; bottom: 3vh; color: #ff9d8a; font-size: 1.8vw; font-weight: 500; }
.oav-perf .clockline { position: absolute; top: 3vh; right: 4vw; font-size: 2.4vw; color: #ffd166; font-variant-numeric: tabular-nums; }
.oav-perf .count { position: absolute; top: 3vh; left: 4vw; font-size: 2.4vw; color: #8892a8; }
`;
