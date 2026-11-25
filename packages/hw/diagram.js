// @openav/hw · diagram — a wiring diagram as an SVG string: the board in the middle, power parts on the left, everything else
// on the right; every wire runs from the board pin to the part pin in its own lane. Colours: power red, ground dark grey,
// I²C blue, data green, SPI purple, analog orange. A wire a check complains about is dashed and marked.
// Pure: builds a string, touches no DOM. Every text that comes from the spec is escaped.

import { check, partOf } from './check.js?v=cedb93fa';
import { PARTS } from './parts.js?v=cedb93fa';

export const COLORS = { power: '#d6336c', ground: '#343a40', i2c: '#1c7ed6', data: '#2f9e44', spi: '#7048e8', analog: '#e8590c', other: '#868e96' };
const LEGEND = [['power', '電源'], ['ground', '地線'], ['i2c', 'I²C'], ['data', '資料'], ['spi', 'SPI'], ['analog', '類比']];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function colorOf(net, pinDefs) {
  if (net.kind === 'power') return 'power';
  if (net.kind === 'ground') return 'ground';
  if (net.i2c) return 'i2c';
  const kinds = pinDefs.map((d) => d.kind);
  if (kinds.some((k) => k.startsWith('spi-'))) return 'spi';
  if (kinds.some((k) => k === 'analog-in' || k === 'analog-out') || pinDefs.some((d) => d.analog)) return 'analog';
  if (kinds.some((k) => k === 'data-in' || k === 'data-out')) return 'data';
  return 'other';
}

/** diagram(spec, { report, parts }) → '<svg …>…</svg>' */
export function diagram(spec, { report, parts = PARTS, width } = {}) {
  spec = spec || {};
  const rep = report || check(spec, { parts });
  const inst = spec.parts || {};
  const boardId = rep.board ? rep.board.id : null;
  const PIN_H = 22, PART_W = 178, BOARD_W = 200, HEAD = 34, TOP = 64, VGAP = 22;
  const pinDef = (ref) => { const [id, pin] = splitRef(ref); const p = partOf(inst[id] && inst[id].part, parts); return p && p.pins[pin] ? p.pins[pin] : { kind: 'other' }; };
  const used = new Map();   // part id → Set(pin)
  for (const n of rep.nets) for (const r of n.pins) { const [id, pin] = splitRef(r); (used.get(id) || used.set(id, new Set()).get(id)).add(pin); }
  const sideOf = (id) => (partOf(inst[id] && inst[id].part, parts)?.kind === 'power' ? 'L' : 'R');
  const cols = { L: [], R: [] };
  for (const id of Object.keys(inst)) if (id !== boardId) cols[sideOf(id)].push(id);

  // problems: which pins a warning or error points at
  const flagged = new Map();
  for (const i of rep.issues) if (i.level === 'error' || i.level === 'warn') for (const r of i.at || []) if (String(r).includes('.')) { const prev = flagged.get(r); if (!prev || i.level === 'error') flagged.set(r, i.level); }

  // edges: every non-board pin to the board pin on its net (or to the previous pin when the net has no board pin)
  const edges = [];
  for (const n of rep.nets) {
    const bpin = n.pins.find((r) => splitRef(r)[0] === boardId);
    const defs = n.pins.map(pinDef);
    const color = colorOf(n, defs);
    const others = n.pins.filter((r) => splitRef(r)[0] !== boardId);
    others.forEach((r, k) => {
      const lvl = flagged.get(r) || (bpin && flagged.get(bpin) && n.kind === 'signal' ? flagged.get(bpin) : null);
      edges.push({ net: n, color, from: bpin || (k ? others[k - 1] : null), to: r, side: sideOf(splitRef(r)[0]), level: lvl });
    });
  }

  // part boxes
  const box = new Map();
  const colX = { L: 24, R: 0 };
  for (const side of ['L', 'R']) {
    let y = TOP;
    for (const id of cols[side]) {
      const part = partOf(inst[id].part, parts);
      const pins = part ? Object.keys(part.pins).filter((p) => used.get(id)?.has(p)) : [];
      const h = HEAD + Math.max(1, pins.length) * PIN_H + 6;
      box.set(id, { id, part, side, y, h, pins });
      y += h + VGAP;
    }
  }
  const colH = (side) => cols[side].reduce((a, id) => a + box.get(id).h + VGAP, 0);
  const pinY = (id, pin) => { const b = box.get(id); return b.y + HEAD + b.pins.indexOf(pin) * PIN_H + PIN_H / 2; };

  // board pins per side, sorted by the height of what they reach
  const bpins = { L: [], R: [] };
  for (const side of ['L', 'R']) {
    const m = new Map();
    for (const e of edges.filter((x) => x.side === side && x.from && splitRef(x.from)[0] === boardId)) {
      const [id, pin] = splitRef(e.to);
      (m.get(e.from) || m.set(e.from, []).get(e.from)).push(pinY(id, pin));
    }
    bpins[side] = [...m.entries()].map(([ref, ys]) => ({ ref, y: ys.reduce((a, b) => a + b, 0) / ys.length })).sort((a, b) => a.y - b.y).map((x) => x.ref);
  }
  const lanes = { L: edges.filter((e) => e.side === 'L').length, R: edges.filter((e) => e.side === 'R').length };
  const gap = (side) => 56 + lanes[side] * 10;
  const boardX = colX.L + (cols.L.length ? PART_W : 0) + gap('L');
  colX.R = boardX + BOARD_W + gap('R');
  const boardRows = Math.max(bpins.L.length, bpins.R.length, 2);
  const boardH = HEAD + boardRows * PIN_H + 14;
  const contentH = Math.max(colH('L'), colH('R'), boardH + VGAP);
  const boardY = TOP + Math.max(0, (contentH - VGAP - boardH) / 2);
  const W = Math.max(width || 0, colX.R + (cols.R.length ? PART_W : 0) + 24, 24 + LEGEND.reduce((a, [, l]) => a + 50 + textWidth(l), 0) + 260);
  const legendY = TOP + contentH + 8;
  const H = legendY + 34;
  const bpinY = (side, ref) => boardY + HEAD + bpins[side].indexOf(ref) * PIN_H + PIN_H / 2;

  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" width="${Math.round(W)}" height="${Math.round(H)}" font-family="system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif" font-size="12" role="img" aria-label="${esc((spec.title || '接線圖'))}">`);
  out.push(`<rect width="100%" height="100%" fill="#fbfaf7"/>`);
  out.push(`<text x="24" y="30" font-size="16" font-weight="700" fill="#212529">${esc(spec.title || '接線圖')}</text>`);
  const nErr = rep.issues.filter((i) => i.level === 'error').length, nWarn = rep.issues.filter((i) => i.level === 'warn').length;
  out.push(`<text x="24" y="50" fill="#495057">${esc(rep.board ? rep.board.name : '沒有主板')}${nErr || nWarn ? ` · ${nErr ? `${nErr} 個錯誤 ` : ''}${nWarn ? `${nWarn} 個警告` : ''}` : ' · 檢查沒有問題'}</text>`);

  // wires first (under the boxes)
  const laneIdx = { L: 0, R: 0 };
  const sorted = [...edges].sort((a, b) => (a.side === b.side ? endY(a) - endY(b) : a.side < b.side ? -1 : 1));
  function endY(e) { const [id, pin] = splitRef(e.to); return box.has(id) ? pinY(id, pin) : 0; }
  for (const e of sorted) {
    const [tid, tpin] = splitRef(e.to);
    if (!box.has(tid)) continue;
    const tb = box.get(tid);
    const px = e.side === 'L' ? colX.L + PART_W : colX.R, py = pinY(tid, tpin);
    let d;
    if (e.from && splitRef(e.from)[0] === boardId) {
      const bx = e.side === 'L' ? boardX : boardX + BOARD_W, by = bpinY(e.side, e.from);
      const k = laneIdx[e.side]++;
      const lx = e.side === 'L' ? boardX - 28 - k * 10 : boardX + BOARD_W + 28 + k * 10;
      d = `M${bx} ${by} H${lx} V${py} H${px}`;
    } else if (e.from) {
      const [fid, fpin] = splitRef(e.from);
      if (!box.has(fid)) continue;
      const fb = box.get(fid);
      const fx = fb.side === 'L' ? colX.L + PART_W : colX.R, fy = pinY(fid, fpin);
      const bulge = (tb.side === 'L' ? 1 : -1) * 40;
      d = `M${fx} ${fy} C${fx + bulge} ${fy} ${px + bulge} ${py} ${px} ${py}`;
    } else continue;
    const c = COLORS[e.color] || COLORS.other;
    out.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${e.net.kind === 'signal' ? 2 : 2.4}"${e.level ? ' stroke-dasharray="6 4"' : ''} stroke-linejoin="round"><title>${esc(`${e.net.label}：${e.net.pins.join(' · ')}`)}</title></path>`);
    if (e.level) out.push(`<text x="${e.side === 'L' ? px + 8 : px - 16}" y="${py - 4}" font-size="12" fill="${e.level === 'error' ? '#c92a2a' : '#e67700'}">⚠</text>`);
  }

  // the board
  out.push(`<rect x="${boardX}" y="${boardY}" width="${BOARD_W}" height="${boardH}" rx="10" fill="#1f3b2d" stroke="#0b1f15"/>`);
  out.push(`<text x="${boardX + BOARD_W / 2}" y="${boardY + 22}" text-anchor="middle" fill="#f8f9fa" font-weight="700">${esc(rep.board ? `${rep.board.id} · ${rep.board.name}` : '主板')}</text>`);
  for (const side of ['L', 'R']) for (const ref of bpins[side]) {
    const y = bpinY(side, ref), [, pin] = splitRef(ref);
    const def = pinDef(ref);
    const x = side === 'L' ? boardX : boardX + BOARD_W;
    out.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="#f8f9fa" stroke="#0b1f15"/>`);
    out.push(`<text x="${side === 'L' ? x + 9 : x - 9}" y="${y + 4}" text-anchor="${side === 'L' ? 'start' : 'end'}" fill="#e9ecef">${esc(def.label || pin)}</text>`);
  }

  // parts
  for (const b of box.values()) {
    const x = b.side === 'L' ? colX.L : colX.R;
    const x0 = inst[b.id] || {};
    const buy = x0.have ? '' : ' · 要買';
    out.push(`<rect x="${x}" y="${b.y}" width="${PART_W}" height="${b.h}" rx="8" fill="#ffffff" stroke="${x0.have ? '#495057' : '#adb5bd'}"${x0.have ? '' : ' stroke-dasharray="4 3"'}/>`);
    out.push(`<text x="${x + 10}" y="${b.y + 16}" font-weight="700" fill="#212529">${esc(b.id)}</text>`);
    out.push(`<text x="${x + 10}" y="${b.y + 29}" font-size="10.5" fill="#868e96">${esc(clip((b.part ? b.part.zh || b.part.name : x0.part) + buy, PART_W - 20, 10.5))}</text>`);
    for (const pin of b.pins) {
      const y = pinY(b.id, pin), def = b.part.pins[pin];
      const ax = b.side === 'L' ? x + PART_W : x;
      out.push(`<circle cx="${ax}" cy="${y}" r="3.5" fill="#fff" stroke="#495057"/>`);
      out.push(`<text x="${b.side === 'L' ? ax - 9 : ax + 9}" y="${y + 4}" text-anchor="${b.side === 'L' ? 'end' : 'start'}" fill="#343a40">${esc(def.label || pin)}</text>`);
    }
  }

  // legend
  let lx = 24;
  for (const [k, label] of LEGEND) {
    out.push(`<line x1="${lx}" y1="${legendY + 12}" x2="${lx + 22}" y2="${legendY + 12}" stroke="${COLORS[k]}" stroke-width="3"/><text x="${lx + 28}" y="${legendY + 16}" fill="#495057">${esc(label)}</text>`);
    lx += 28 + textWidth(label) + 22;
  }
  out.push(`<line x1="${lx}" y1="${legendY + 12}" x2="${lx + 22}" y2="${legendY + 12}" stroke="#495057" stroke-width="2" stroke-dasharray="6 4"/><text x="${lx + 28}" y="${legendY + 16}" fill="#495057">檢查有意見</text>`);
  lx += 28 + textWidth('檢查有意見') + 22;
  out.push(`<rect x="${lx}" y="${legendY + 4}" width="22" height="16" rx="3" fill="#fff" stroke="#adb5bd" stroke-dasharray="4 3"/><text x="${lx + 28}" y="${legendY + 16}" fill="#495057">虛線框＝要買</text>`);
  out.push(`</svg>`);
  return out.join('\n');
}

function splitRef(ref) { const s = String(ref), i = s.indexOf('.'); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]; }
// rough text width at font-size 12: CJK and full-width ≈ 12 px, the rest ≈ 6.8 px
export function textWidth(s, size = 12) { let w = 0; for (const ch of String(s)) w += /[\u2E80-\uFFEF]/.test(ch) ? size : size * 0.57; return w; }
function clip(s, px, size = 12) { s = String(s); if (textWidth(s, size) <= px) return s; let out = ''; for (const ch of s) { if (textWidth(out + ch + '…', size) > px) break; out += ch; } return out + '…'; }
