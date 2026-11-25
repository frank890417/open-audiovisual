#!/usr/bin/env node
// check-align-layout — read an align layout in the venue before anything goes on the wall.
//
//   node tools/check-align-layout.mjs packages/align/layouts/room-corner.json [more.json …]
//
// Prints the errors (the layout is refused), the warnings (accepted, look at them: a pitch warning is usually one number
// copied wrong), what the mapping comes to, the stacks and blend bands, the masks, and the venue questions still open
// (params with status "assumed" and whom to ask). Exit 1 when any file has an error.

import fs from 'node:fs';
import { validateLayout, computeMapping, analyzeOverlaps } from '../packages/align/index.js';
import { isMain } from './site/is-main.mjs';

/** One layout (an object) → { ok, lines }: what the command prints for it. */
export function checkLayout(L, label = L?.id ?? '(no id)') {
  const lines = [];
  const v = validateLayout(L);
  lines.push(`${v.ok ? '✓' : '✗'} ${label} (${L?.id ?? 'no id'})`);
  for (const e of v.errors) lines.push(`  error: ${e}`);
  for (const w of v.warnings) lines.push(`  warning: ${w}`);
  if (!v.ok) return { ok: false, lines };
  const M = computeMapping(L);
  const o = analyzeOverlaps(M);
  lines.push(`  art ${M.art.w}×${M.art.h}${M.art.meters ? ` (${M.art.meters.w} m × ${M.art.meters.h} m)` : ''} → desktop ${M.desktop.w}×${M.desktop.h}: ${M.outputs.length} output(s), ${M.segments.length} segment(s), ${M.tiles.length} tile(s)`);
  for (const t of M.tiles) {
    const scaled = t.scale.x !== 1 || t.scale.y !== 1 ? ` scaled ${t.scale.x.toFixed(3)}×${t.scale.y.toFixed(3)}` : '';
    lines.push(`  ${t.name.padEnd(6)} art x ${t.src.x}–${t.src.x + t.src.w}${t.src.y ? ` y ${t.src.y}–${t.src.y + t.src.h}` : ''} → ${t.output} desktop (${t.dst.x},${t.dst.y}) ${t.dst.w}×${t.dst.h}${scaled}${t.rotate ? ` turned ${t.rotate}°` : ''}${t.visible ? ` visible ${t.visible.w}` : ''}`);
  }
  if (o.stacks.length) lines.push(`  stacked: ${o.stacks.map((s) => `${s.segment} (${s.tiles.join(' + ')})`).join(', ')}`);
  if (o.bands.length) lines.push(`  blend bands: ${o.bands.map((b) => `${b.a}∩${b.b} x ${b.rect.x}–${b.rect.x + b.rect.w}`).join(', ')}`);
  const masks = M.tiles.filter((t) => t.masks).map((t) => `${t.name}: ${t.masks.map((m) => m.label ?? 'mask').join(', ')}`);
  if (masks.length) lines.push(`  masks: ${masks.join('; ')}`);
  const assumed = Object.entries(L.params || {}).filter(([, p]) => p.status === 'assumed');
  if (assumed.length) {
    lines.push(`  ${assumed.length} assumed param(s), waiting for an answer:`);
    for (const [k, p] of assumed) lines.push(`    ${k} = ${JSON.stringify('value' in p ? p.value : p.default)}   ask: ${p.ask}`);
  }
  return { ok: true, lines };
}

if (isMain(import.meta.url)) {
  const files = process.argv.slice(2).filter((f) => !f.endsWith('index.json'));
  if (!files.length) { console.error('usage: node tools/check-align-layout.mjs <layout.json> [more.json …]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    let L;
    try { L = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`✗ ${f}: ${e.message}`); bad++; continue; }
    const r = checkLayout(L, f);
    console.log(r.lines.join('\n') + '\n');
    if (!r.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}
