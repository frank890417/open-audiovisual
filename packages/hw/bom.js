// @openav/hw · bom — the parts list of a spec, split into what is already on the shelf (`have: true`) and what to buy.
// No prices and no shop links: what a part costs and where to get it is a person's call, not this file's.

import { partOf } from './check.js?v=6b091ec6';
import { PARTS } from './parts.js?v=6b091ec6';

/**
 * bom(spec, { parts }) → { have: [row], buy: [row], unknown: [row], count }
 * row = { id, part, name, zh, qty, kind, size, connector, notes: [], tbd: [] }
 */
export function bom(spec, { parts = PARTS } = {}) {
  spec = spec || {};
  const out = { have: [], buy: [], unknown: [], count: 0 };
  for (const [id, x] of Object.entries(spec.parts || {})) {
    const p = partOf(x && x.part, parts);
    const qty = (x && x.count) || 1;
    out.count += qty;
    if (!p) { out.unknown.push({ id, part: x && x.part, name: null, zh: null, qty, kind: null, size: null, connector: null, notes: [`零件庫沒有「${x && x.part}」。`], tbd: [] }); continue; }
    const notes = [];
    if (p.bomNote) notes.push(p.bomNote);
    if (x.mAh || p.mAh) notes.push(`容量 ${x.mAh || p.mAh} mAh`);
    if (p.leds) notes.push(`${x.leds || p.leds} 顆燈`);
    if (x.note) notes.push(String(x.note));
    const variant = p.variants && p.variants[x.mAh || p.mAh];
    const row = { id, part: x.part, name: p.name, zh: p.zh || p.name, qty, kind: p.kind, size: (variant && variant.size) || p.size || null, connector: p.connector || null, notes, tbd: p.tbd || [] };
    (x.have ? out.have : out.buy).push(row);
  }
  return out;
}
