import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isStacked, stageHeight, STACK_QUERY, STACK_MAX_WIDTH, STAGE_SHARE, SHELL_CSS } from '../packages/show/layout.js';

test('layout: an upright phone stacks (stage above the panel); a phone on its side, a laptop and a TV do not', () => {
  assert.equal(isStacked(390, 844), true, 'iPhone 14, upright');
  assert.equal(isStacked(360, 740), true, 'Android, upright');
  assert.equal(isStacked(768, 1024), true, 'iPad mini, upright');
  assert.equal(isStacked(844, 390), false, 'iPhone on its side');
  assert.equal(isStacked(667, 375), false, 'iPhone SE on its side');
  assert.equal(isStacked(1440, 900), false);
  assert.equal(isStacked(1080, 1920), false, 'a portrait TV is wider than a tablet: the side panel fits');
  assert.equal(isStacked(820, 821), true); assert.equal(isStacked(821, 1200), false, 'the width limit is inclusive');
  assert.equal(isStacked(800, 800), false, 'square is not upright');
});

test('layout: the stage keeps at least 55% of the window when stacked (390×844 → ≥ 464px, was ~50px wide)', () => {
  assert.ok(STAGE_SHARE >= 55);
  assert.ok(stageHeight(844) >= 464 && stageHeight(844) <= 844 * 0.7, String(stageHeight(844)));
  assert.equal(stageHeight(844), 490);
});

test('layout: the CSS uses the same query as isStacked, on both vh and dvh, and leaves the wide layout alone', () => {
  assert.equal(STACK_QUERY, `(max-width: ${STACK_MAX_WIDTH}px) and (orientation: portrait)`);
  const [wide, stacked] = SHELL_CSS.split(`@media ${STACK_QUERY}`);
  assert.ok(stacked, 'the stacked block is behind the query');
  assert.match(wide, /grid-template-columns: minmax\(0, 1fr\) 340px/, 'wide: stage | 340px panel, unchanged');
  assert.match(wide, /\.oav-side \{ height: 100vh;/);
  assert.match(stacked, new RegExp(`grid-template-rows: ${STAGE_SHARE}vh minmax\\(0, 1fr\\)`));
  assert.match(stacked, new RegExp(`grid-template-rows: ${STAGE_SHARE}dvh minmax\\(0, 1fr\\)`), 'dvh follows the phone address bar');
  assert.match(stacked, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(stacked, /\.oav-side \{[^}]*overflow-y: auto/, 'the panel scrolls under the stage');
});

test('layout: example 14 (its own layout) stacks under the same rule, and createShow takes its CSS from layout.js', () => {
  const html = fs.readFileSync(new URL('../examples/14-timeline/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`@media ${STACK_QUERY}`), '14 uses STACK_QUERY');
  assert.match(html, /height: 58svh/);
  const show = fs.readFileSync(new URL('../packages/show/index.js', import.meta.url), 'utf8');
  assert.match(show, /import \{ SHELL_CSS \} from '\.\/layout\.js/); assert.ok(!/const SHELL_CSS/.test(show));
});
