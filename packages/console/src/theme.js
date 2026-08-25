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
.oav-scrub { position: relative; height: 34px; background: #131826; border-radius: 6px;
  cursor: crosshair; overflow: hidden; }
.oav-scrub .blk { position: absolute; top: 0; bottom: 0; border-left: 1px solid #2a3348;
  display: flex; align-items: center; padding-left: 5px; color: #8892a8; font-size: 10px;
  overflow: hidden; white-space: nowrap; }
.oav-scrub .blk.cur { background: rgba(46,109,246,.18); color: #cfd6e4; }
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
.oav-layers .lay { display: grid; grid-template-columns: 88px 1fr; gap: 8px; padding: 2px 0;
  font-size: 11px; align-items: baseline; }
.oav-layers b { font-weight: 600; }
.oav-layers .l1 { color: #37c978; } .oav-layers .l2 { color: #7ea6ff; }
.oav-layers .l3 { color: #ffd166; } .oav-layers .l4 { color: #b47ee6; }
.oav-layers .v { color: #8892a8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oav-midimeter { width: 100%; display: none; background: #0b0e15; border-radius: 6px; margin-top: 6px; }
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
.oav-perf { position: fixed; inset: 0; background: #000; color: #fff; z-index: 999;
  display: none; flex-direction: column; justify-content: center; padding: 6vw;
  font: 600 4.5vw/1.35 ui-monospace, monospace; }
.oav-perf.on { display: flex; }
.oav-perf .next { color: #556; font-size: 2.2vw; margin-top: 3vh; }
.oav-perf .clockline { position: absolute; top: 3vh; right: 4vw; font-size: 2.4vw; color: #ffd166; }
`;
