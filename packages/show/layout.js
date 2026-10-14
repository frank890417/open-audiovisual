// @openav/show · layout — the shell's CSS and the one rule that decides when it stacks.
//
//   wide (desktop, tablet, any phone on its side):  [ stage | 340px side panel ]
//   stacked (a phone or small tablet held upright):  stage on top (58% of the window), the panel below it, scrolling
//
// Before this, an upright phone got a 340px panel next to a 50px-wide stage. The rule is one media query,
// and `isStacked()` is the same rule as a pure function, so a test can hold the two together.

/** Upright and no wider than a small tablet. (A phone on its side is ≥ 568px wide but never taller than wide.) */
export const STACK_MAX_WIDTH = 820;
export const STACK_QUERY = `(max-width: ${STACK_MAX_WIDTH}px) and (orientation: portrait)`;
/** How much of the window height the stage keeps when stacked (vh — the stage must stay the main thing). */
export const STAGE_SHARE = 58;

/** The same decision as STACK_QUERY, from a window size. */
export function isStacked(width, height) {
  return width <= STACK_MAX_WIDTH && height > width;
}

/** Stage height in px for a window of this height when stacked. */
export function stageHeight(height) {
  return Math.round(height * STAGE_SHARE / 100);
}

export const SHELL_CSS = `
  body { margin: 0; background: #000; height: 100vh; display: grid;
    grid-template-columns: minmax(0, 1fr) 340px; overflow: hidden; }
  .oav-stage { position: relative; min-width: 0; overflow: hidden; }
  .oav-side { height: 100vh; display: flex; flex-direction: column; min-width: 0; }
  .oav-keys-slot { padding: 8px 10px; background: #0d1017; border-bottom: 1px solid #1c2334; overflow-x: auto; flex: none; }
  .oav-desk { flex: 1; overflow-y: auto; min-height: 0; }
  .oav-hint { position: absolute; left: 12px; bottom: 10px; color: #445; z-index: 2;
    font: 11px ui-monospace, monospace; pointer-events: none; }
  .oav-credit { position: absolute; right: 12px; bottom: 10px; color: #556; z-index: 2;
    font: 10px ui-monospace, monospace; text-align: right; pointer-events: none; }
  .oav-credit b { color: #8892a8; }
  @media ${STACK_QUERY} {
    body { height: 100vh; height: 100dvh; grid-template-columns: minmax(0, 1fr);
      grid-template-rows: ${STAGE_SHARE}vh minmax(0, 1fr); grid-template-rows: ${STAGE_SHARE}dvh minmax(0, 1fr); }
    .oav-side { height: auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch; border-top: 1px solid #1c2334; }
    .oav-desk { flex: none; overflow: visible; }
  }
`;
