// @openav/surface · theme — ONE look for every control.
//
// A performance controller is used in the dark, fast, half-looking. So the
// aesthetic is a set of rules, not decoration:
//   - dark cards on near-black; the ONLY saturated thing on screen is a value
//   - every touch target ≥ 44 px (--oav-touch-min); the layout grid enforces it
//     by making cells share the viewport, widgets never shrink below it
//   - the number you are changing is always on screen, tabular, mono
//   - pressed = the card's border and glow take the widget's color (you can
//     see which control your thumb is on, peripherally)
// Everything is a CSS custom property on :root, so a work can re-skin the
// whole surface by overriding six variables — never by editing widget code.

export const THEME_VARS = {
  '--oav-bg': '#0a0c11',
  '--oav-surface': '#141922',
  '--oav-surface-2': '#1b2230',
  '--oav-line': '#283044',
  '--oav-text': '#e8ecf5',
  '--oav-dim': '#8691a8',
  '--oav-accent': '#7ea6ff',
  '--oav-ok': '#3ddc84', '--oav-warn': '#f5a524', '--oav-bad': '#e5484d',
  '--oav-radius': '14px',
  '--oav-gap': '8px',
  '--oav-touch-min': '44px',
  '--oav-font': "system-ui, -apple-system, 'Helvetica Neue', sans-serif",
  '--oav-mono': "ui-monospace, 'SF Mono', Menlo, monospace",
};

export const COLOR_NAMES = ['cyan', 'amber', 'magenta', 'lime', 'violet', 'coral', 'white'];

export const THEME_CSS = `
:root { ${Object.entries(THEME_VARS).map(([k, v]) => `${k}: ${v};`).join(' ')} }
.oav-surface { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--oav-bg); color: var(--oav-text);
  font: 13px/1.25 var(--oav-font); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  touch-action: none; overflow: hidden; -webkit-tap-highlight-color: transparent; }
.oav-surface * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.oav-tabs { display: flex; gap: 6px; padding: 6px 8px 0; flex: none; overflow-x: auto; }
.oav-tab { flex: none; min-height: 34px; padding: 0 16px; border-radius: 10px; border: 1px solid var(--oav-line); background: var(--oav-surface);
  color: var(--oav-dim); font: 600 12px var(--oav-font); letter-spacing: .04em; cursor: pointer; }
.oav-tab.on { color: var(--oav-text); border-color: var(--oav-accent); background: var(--oav-surface-2); }
.oav-pages { position: relative; flex: 1; min-height: 0; }
.oav-page { position: absolute; inset: 0; display: none; }
.oav-page.on { display: block; }
.oav-cell { position: absolute; padding: calc(var(--oav-gap) / 2); }
.oav-w { container-type: inline-size; --c: var(--oav-accent); position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden;
  background: var(--oav-surface); border: 1px solid var(--oav-line); border-radius: var(--oav-radius);
  transition: border-color .12s, box-shadow .12s; }
.oav-w.active { border-color: var(--c); box-shadow: 0 0 0 1px var(--c) inset, 0 0 22px -8px var(--c); }
.oav-w[data-color=cyan] { --c: #35d4e6; } .oav-w[data-color=amber] { --c: #ffb547; } .oav-w[data-color=magenta] { --c: #ff5fb3; }
.oav-w[data-color=lime] { --c: #7be25b; } .oav-w[data-color=violet] { --c: #a58bff; } .oav-w[data-color=coral] { --c: #ff6b57; }
.oav-w[data-color=white] { --c: #e8ecf5; }
.oav-head { display: flex; justify-content: space-between; gap: 6px; padding: 7px 10px 0; flex: none; pointer-events: none;
  font: 600 10.5px var(--oav-font); letter-spacing: .08em; text-transform: uppercase; color: var(--oav-dim); white-space: nowrap; }
.oav-head .lbl { overflow: hidden; text-overflow: ellipsis; }
/* narrow cards (a 1-column fader on a phone): value on top, label under it — never truncate the number */
@container (max-width: 120px) { .oav-head { flex-direction: column-reverse; justify-content: flex-end; align-items: center; gap: 2px; padding: 8px 4px 0; }
  .oav-head .lbl { max-width: 100%; font-size: 9.5px; } }
.oav-val { font: 600 12px var(--oav-mono); letter-spacing: 0; text-transform: none; color: var(--c); font-variant-numeric: tabular-nums; }
.oav-body { position: relative; flex: 1; min-height: 0; margin: 6px 8px 8px; }
.oav-w.nohead .oav-body { margin-top: 8px; }

/* fader */
.oav-fader .trk { position: absolute; inset: 0; border-radius: 10px; background: var(--oav-surface-2); overflow: hidden; }
.oav-fader .fill { position: absolute; left: 0; right: 0; bottom: 0; height: 100%; transform-origin: 50% 100%; transform: scaleY(var(--v, 0));
  background: linear-gradient(to top, color-mix(in srgb, var(--c) 45%, transparent), color-mix(in srgb, var(--c) 85%, transparent)); }
.oav-fader .cap { position: absolute; left: 0; right: 0; height: 4px; bottom: calc(var(--v, 0) * 100% - 2px); background: #fff; border-radius: 2px; box-shadow: 0 0 8px var(--c); }
.oav-fader .def { position: absolute; left: 0; width: 8px; height: 2px; bottom: calc(var(--d, 0) * 100%); background: rgba(255,255,255,.35); }
.oav-fader.h .fill { top: 0; right: auto; width: 100%; height: auto; transform-origin: 0 50%; transform: scaleX(var(--v, 0));
  background: linear-gradient(to right, color-mix(in srgb, var(--c) 45%, transparent), color-mix(in srgb, var(--c) 85%, transparent)); }
.oav-fader.h .cap { top: 0; bottom: 0; height: auto; width: 4px; left: calc(var(--v, 0) * 100% - 2px); right: auto; }
.oav-fader.h .def { left: calc(var(--d, 0) * 100%); bottom: 0; width: 2px; height: 8px; }

/* knob / encoder */
.oav-knob .body svg, .oav-body.svg svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.oav-knob .bigval { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center;
  font: 600 clamp(12px, 3.4vmin, 20px) var(--oav-mono); color: var(--oav-text); pointer-events: none; font-variant-numeric: tabular-nums; }
.oav-knob .arc-bg { fill: none; stroke: var(--oav-surface-2); stroke-width: 9; stroke-linecap: round; }
.oav-knob .arc-v { fill: none; stroke: var(--c); stroke-width: 9; stroke-linecap: round; }
.oav-knob .dot { fill: #fff; }

/* buttons */
.oav-btn .face { position: absolute; inset: 0; border-radius: 10px; display: grid; place-items: center; background: var(--oav-surface-2);
  font: 700 clamp(13px, 2.6vmin, 18px) var(--oav-font); letter-spacing: .05em; text-transform: uppercase; transition: background .06s, transform .06s; pointer-events: none; text-align: center; padding: 0 6px; }
.oav-btn.active .face { background: var(--c); color: #0a0c11; transform: scale(.97); }
.oav-toggle .face { justify-content: center; }
.oav-toggle .sw { position: absolute; left: 50%; top: 50%; width: 52px; height: 28px; margin: -14px 0 0 -26px; border-radius: 14px; background: var(--oav-line); transition: background .12s; pointer-events: none; }
.oav-toggle .sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: transform .12s; }
.oav-toggle.on .sw { background: var(--c); } .oav-toggle.on .sw::after { transform: translateX(24px); }

/* xy */
.oav-xy .pad { position: absolute; inset: 0; border-radius: 10px; background: var(--oav-surface-2);
  background-image: linear-gradient(var(--oav-line) 1px, transparent 1px), linear-gradient(90deg, var(--oav-line) 1px, transparent 1px);
  background-size: 25% 25%; background-position: -1px -1px; overflow: hidden; }
.oav-xy .hx, .oav-xy .hy { position: absolute; background: color-mix(in srgb, var(--c) 60%, transparent); pointer-events: none; }
.oav-xy .hx { left: 0; right: 0; height: 1px; top: calc((1 - var(--y, .5)) * 100%); }
.oav-xy .hy { top: 0; bottom: 0; width: 1px; left: calc(var(--x, .5) * 100%); }
.oav-xy .puck { position: absolute; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; left: calc(var(--x, .5) * 100%); top: calc((1 - var(--y, .5)) * 100%);
  border: 2px solid var(--c); background: color-mix(in srgb, var(--c) 25%, transparent); pointer-events: none; }
.oav-xy.down .puck { background: var(--c); box-shadow: 0 0 20px var(--c); }

/* bank */
.oav-bank .chs { position: absolute; inset: 0; display: flex; gap: 3px; }
.oav-bank .ch { position: relative; flex: 1; border-radius: 6px; background: var(--oav-surface-2); overflow: hidden; }
.oav-bank .ch .fill { position: absolute; left: 0; right: 0; bottom: 0; height: 100%; transform-origin: 50% 100%; transform: scaleY(var(--v, 0));
  background: linear-gradient(to top, color-mix(in srgb, var(--c) 45%, transparent), color-mix(in srgb, var(--c) 85%, transparent)); }
.oav-bank .ch .n { position: absolute; left: 0; right: 0; bottom: 3px; text-align: center; font: 600 10px var(--oav-mono); color: rgba(255,255,255,.7); pointer-events: none; mix-blend-mode: difference; }

/* radio */
.oav-radio .opts { position: absolute; inset: 0; display: flex; gap: 4px; }
.oav-radio.col .opts { flex-direction: column; }
.oav-radio .opt { flex: 1; display: grid; place-items: center; border-radius: 9px; background: var(--oav-surface-2); color: var(--oav-dim);
  font: 600 clamp(11px, 2.2vmin, 15px) var(--oav-font); text-align: center; padding: 0 4px; transition: background .06s; min-width: 0; overflow: hidden; }
.oav-radio .opt.on { background: var(--c); color: #0a0c11; }

/* pads */
.oav-pads .grid { position: absolute; inset: 0; display: grid; gap: 5px; }
.oav-pads .pd { position: relative; border-radius: 10px; background: var(--oav-surface-2); overflow: hidden; display: grid; place-items: center;
  font: 600 10px var(--oav-mono); color: var(--oav-dim); }
.oav-pads .pd::before { content: ''; position: absolute; inset: 0; background: var(--c); opacity: 0; transition: opacity .35s ease-out; }
.oav-pads .pd.hit::before { opacity: calc(.35 + var(--vel, .5) * .65); transition: none; }
.oav-pads .pd span { position: relative; }

/* keyboard */
.oav-kb .bar { display: flex; gap: 6px; flex: none; margin: 4px 8px 0; align-items: center; }
.oav-kb .bar .b { min-width: var(--oav-touch-min); height: 34px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--oav-line); background: var(--oav-surface-2);
  color: var(--oav-text); font: 700 12px var(--oav-mono); display: grid; place-items: center; touch-action: none; }
.oav-kb .bar .b.active { background: var(--c); color: #0a0c11; border-color: var(--c); }
.oav-kb .bar .oct { font: 600 12px var(--oav-mono); color: var(--c); min-width: 44px; text-align: center; }
.oav-kb .rows { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 6px; }
.oav-kb .row { position: relative; flex: 1; min-height: 0; }
.oav-kb .row .oav-keys { position: absolute; inset: 0; height: 100%; }
.oav-kb .pk-lbl { display: none; }
.oav-kb .pk-nm { font-size: 10px; bottom: 6px; color: #667; }
.oav-kb .pk-key { border-radius: 0 0 6px 6px; border-color: #222a3b; }
.oav-kb .pk-black { border-radius: 0 0 5px 5px; }
.oav-kb .pk-key.on { background: color-mix(in srgb, var(--c) 80%, #fff); }
.oav-kb .pk-black.on { background: var(--c); }

/* number / text */
.oav-num .nb { position: absolute; inset: 0; display: flex; gap: 6px; align-items: stretch; }
.oav-num .nb button { width: var(--oav-touch-min); border: 0; border-radius: 9px; background: var(--oav-surface-2); color: var(--oav-text); font: 700 20px var(--oav-mono); touch-action: none; }
.oav-num .nb button:active { background: var(--c); color: #0a0c11; }
.oav-surface input.in { flex: 1; min-width: 0; border: 1px solid var(--oav-line); border-radius: 9px; background: var(--oav-bg); color: var(--oav-text);
  font: 600 clamp(14px, 3vmin, 20px) var(--oav-mono); text-align: center; padding: 0 8px; user-select: text; -webkit-user-select: text; touch-action: manipulation; }
.oav-surface input.in:focus { outline: none; border-color: var(--c); }
.oav-text .tb { position: absolute; inset: 0; display: flex; gap: 6px; }
.oav-text .tb input.in { text-align: left; font-family: var(--oav-font); }
.oav-text .tb button { width: 56px; border: 0; border-radius: 9px; background: var(--c); color: #0a0c11; font: 700 16px var(--oav-font); touch-action: none; }

/* label / meter */
.oav-label .txt { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; color: var(--oav-text); font: 600 clamp(13px, 3vmin, 22px) var(--oav-font); pointer-events: none; overflow: hidden; }
.oav-label { background: transparent; border-color: transparent; }
.oav-meter .trk { position: absolute; inset: 0; border-radius: 8px; background: var(--oav-surface-2); overflow: hidden; }
.oav-meter .fill { position: absolute; inset: 0; clip-path: inset(calc((1 - var(--v, 0)) * 100%) 0 0 0);
  background: linear-gradient(to top, var(--oav-ok), var(--oav-warn) 75%, var(--oav-bad)); }
.oav-meter .peak { position: absolute; left: 0; right: 0; height: 3px; bottom: calc(var(--p, 0) * 100% - 1.5px); background: #fff; opacity: .85; }
.oav-meter.h .fill { clip-path: inset(0 calc((1 - var(--v, 0)) * 100%) 0 0); background: linear-gradient(to right, var(--oav-ok), var(--oav-warn) 75%, var(--oav-bad)); }
.oav-meter.h .peak { top: 0; bottom: 0; left: calc(var(--p, 0) * 100% - 1.5px); right: auto; width: 3px; height: auto; }
`;

let injected = false;
/** Inject the theme once. Safe to call from every component. */
export function injectTheme() {
  if (injected || typeof document === 'undefined') return;
  if (document.getElementById('openav-surface-css')) { injected = true; return; }
  const s = document.createElement('style');
  s.id = 'openav-surface-css';
  s.textContent = THEME_CSS;
  document.head.appendChild(s);
  injected = true;
}
