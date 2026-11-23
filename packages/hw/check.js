// @openav/hw · check — read a hardware spec (which parts, how they are wired), find the nets, and say in Chinese what is wrong.
// Pure functions, no DOM, no dependencies.
//
// Spec = {
//   title?, board: '<instance id of the main board>',
//   parts: { <id>: { part: '<PARTS key>', have?: bool, count?, leds?, brightness? (0..1), mAh?, addr?, avgMa?, note? } },
//   wires: [ ['mcu.4', 'acc.SDA'] | { from, to, note } ],
//   use?: { avgMa? }   (the average draw on battery, when you know it better than the parts list does)
// }
// A pin is '<instance>.<pin name or alias>' (case-insensitive aliases: 'mcu.SDA' = 'mcu.4' on a Feather).

import { PARTS } from './parts.js?v=e62939c4';

const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;
const fmtV = (v) => (Array.isArray(v) ? (v[0] === v[1] ? `${r2(v[0])} V` : `${r2(v[0])}–${r2(v[1])} V`) : v == null ? '?' : `${r2(v)} V`);
const range = (v) => (v == null ? null : Array.isArray(v) ? [v[0], v[1]] : [v, v]);

/** The part for a key, or null. */
export function partOf(key, parts = PARTS) { return (key && Object.prototype.hasOwnProperty.call(parts, key) && parts[key]) || null; }

/** '<id>.<pin>' → { inst, pin, def } or null (with the reason in `why`). */
export function resolvePin(spec, ref, parts = PARTS) {
  const m = /^([^.\s]+)\.(.+)$/.exec(String(ref || '').trim());
  if (!m) return { why: `「${ref}」不是「零件.腳位」的寫法` };
  const inst = spec.parts && spec.parts[m[1]];
  if (!inst) return { why: `沒有叫「${m[1]}」的零件（${ref}）` };
  const part = partOf(inst.part, parts);
  if (!part) return { why: `零件庫沒有「${inst.part}」（${m[1]}）` };
  const want = m[2].trim(), up = want.toUpperCase();
  for (const [name, def] of Object.entries(part.pins)) {
    if (name === want || name.toUpperCase() === up || (def.aliases || []).some((a) => a.toUpperCase() === up)) return { id: m[1], inst, part, pin: name, def, ref: `${m[1]}.${name}` };
  }
  return { why: `${part.zh || part.name} 沒有「${want}」這支腳（${ref}；有：${Object.keys(part.pins).join('、')}）` };
}

// ---------------------------------------------------------------- nets
function wiresOf(spec) {
  return (spec.wires || []).map((w, i) => (Array.isArray(w) ? { from: w[0], to: w[1], note: w[2], i } : { ...w, i }));
}

/** Union the wired pins into nets. Returns { nets, pins: Map(ref → pin), wires, errors }. */
export function netsOf(spec, parts = PARTS) {
  const errors = [], pins = new Map(), parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const add = (p) => { if (!pins.has(p.ref)) { pins.set(p.ref, p); parent.set(p.ref, p.ref); } return p.ref; };
  const wires = wiresOf(spec).map((w) => {
    const a = resolvePin(spec, w.from, parts), b = resolvePin(spec, w.to, parts);
    if (!a.ref) errors.push({ code: 'pin', text: a.why, at: [w.from] });
    if (!b.ref) errors.push({ code: 'pin', text: b.why, at: [w.to] });
    if (!a.ref || !b.ref) return { ...w, bad: true };
    const ra = add(a), rb = add(b);
    parent.set(find(ra), find(rb));
    return { ...w, a: ra, b: rb };
  });
  const groups = new Map();
  for (const ref of pins.keys()) { const root = find(ref); (groups.get(root) || groups.set(root, []).get(root)).push(ref); }
  const nets = [...groups.values()].map((refs, k) => classify(refs.map((r) => pins.get(r)), k, spec));
  const netOf = new Map(); for (const n of nets) for (const r of n.pins) netOf.set(r, n);
  for (const w of wires) if (!w.bad) w.net = netOf.get(w.a).id;
  return { nets, pins, wires, netOf, errors };
}

function sourceV(p) {
  if (p.def.kind === 'bat') { const b = p.part.battery || {}; return { v: [b.cutoff ?? b.empty ?? null, b.full ?? null], nominal: b.nominal, when: null, battery: true }; }
  if (p.def.kind === 'power-out') return { v: range(p.def.v), when: p.def.when || null };
  return null;
}

function classify(list, k, spec) {
  const refs = list.map((p) => p.ref);
  const kinds = new Set(list.map((p) => p.def.kind));
  const sources = list.map((p) => ({ p, s: sourceV(p) })).filter((x) => x.s);
  let kind = 'signal';
  if (kinds.has('gnd')) kind = 'ground';
  else if (sources.length || kinds.has('power-in') || kinds.has('power-node')) kind = 'power';
  let v = null, conditional = false, battery = false;
  if (kind === 'power' && sources.length) {
    const lo = Math.min(...sources.map((x) => x.s.v[0] ?? Infinity)), hi = Math.max(...sources.map((x) => x.s.v[1] ?? -Infinity));
    v = [Number.isFinite(lo) ? lo : null, Number.isFinite(hi) ? hi : null];
    conditional = sources.every((x) => x.s.when);
    battery = sources.some((x) => x.s.battery);
  }
  const i2c = kind === 'signal' ? (list.some((p) => p.def.kind === 'i2c-sda' || p.def.i2c === 'sda') ? 'sda' : list.some((p) => p.def.kind === 'i2c-scl' || p.def.i2c === 'scl') ? 'scl' : null) : null;
  const lead = sources[0] ? sources[0].p : list.find((p) => p.part.kind === 'board') || list[0];
  const when = conditional ? [...new Set(sources.map((x) => x.s.when))] : [];
  return { id: `n${k + 1}`, kind, v, conditional, when, battery, i2c, pins: refs, label: kind === 'ground' ? 'GND' : lead ? `${lead.def.label || lead.pin}${kind === 'power' && v ? ` ${fmtV(v)}` : ''}` : refs[0] };
}

// ---------------------------------------------------------------- electrical helpers
function vihAt(part, vdd) {
  const list = part.logic && part.logic.vih;
  if (!list || !list.length || vdd == null) return null;
  let best = null;
  for (const x of list) {
    const t = x.frac != null ? x.frac * vdd : x.v != null ? (x.atVdd ? (x.v * vdd) / x.atVdd : x.v) : null;
    if (t != null && (!best || t > best.v)) best = { v: t, rev: x.rev || null, rule: x.frac != null ? `${x.frac} × VDD` : x.atVdd ? `VDD ${x.atVdd} V 時 ${x.v} V${vdd !== x.atVdd ? '，等比例推算' : ''}` : `${x.v} V` };
  }
  return best;
}

function vinMaxAt(part, vdd) {
  const m = part.logic && part.logic.vinMax;
  if (m == null) return null;
  if (typeof m === 'number') return m;
  if (m.aboveVdd != null && vdd != null) return vdd + m.aboveVdd;
  return null;
}

function loadOf(inst, part) {
  const n = inst.count || 1;
  if (inst.avgMa != null) return { typ: inst.avgMa * n, max: inst.maxMa != null ? inst.maxMa * n : null, how: '作品自己寫的平均值' };
  if (part.perLed) {
    const leds = inst.leds || part.leds || 1, b = inst.brightness != null ? inst.brightness : 1;
    const t = part.perLed.typ, m = part.perLed.max;
    return { typ: t == null ? null : t * leds * n, max: m == null ? null : m * leds * b * n, how: `${leds} 顆 × ${m ?? '?'} mA 全白${b !== 1 ? ` × 亮度 ${b}` : ''}；平常約每顆 ${t ?? '?'} mA` };
  }
  if (part.current) return { typ: part.current.typ == null ? null : part.current.typ * n, max: part.current.max == null ? null : part.current.max * n };
  return { typ: null, max: null };
}

// ---------------------------------------------------------------- the check
/**
 * check(spec) → report
 *   { ok, title, board, nets, power: { rails, battery, charger }, i2c, issues: [{ level, code, text, at }], warnings: [], notes: [] }
 * level: 'error' (will not work, or breaks something) · 'warn' (may not work) · 'note' (know this) · 'unknown' (a value is 待查)
 */
export function check(spec, { parts = PARTS } = {}) {
  spec = spec || {};
  const issues = [];
  const say = (level, code, text, at = []) => issues.push({ level, code, text, at });
  const { nets, pins, wires, netOf, errors } = netsOf(spec, parts);
  for (const e of errors) say('error', e.code, e.text, e.at);
  const inst = spec.parts || {};
  for (const [id, x] of Object.entries(inst)) if (!partOf(x && x.part, parts)) say('error', 'part', `零件「${id}」用的「${x && x.part}」不在零件庫裡。`, [id]);
  const boardId = spec.board && inst[spec.board] ? spec.board : Object.keys(inst).find((id) => partOf(inst[id].part, parts)?.kind === 'board');
  const board = boardId ? { id: boardId, ...inst[boardId], def: partOf(inst[boardId].part, parts) } : null;
  if (!board || !board.def) say('error', 'board', '沒有主板：spec.board 要指向一塊 kind 為 board 的零件。');
  const pinsOf = (id) => [...pins.values()].filter((p) => p.id === id);
  const nameOf = (id) => { const p = partOf(inst[id] && inst[id].part, parts); return `${id}（${p ? p.zh || p.name : '?'}）`; };

  // --- each part's supply: which net feeds its power-in pin
  const supplyOf = new Map();
  for (const id of Object.keys(inst)) {
    const part = partOf(inst[id].part, parts);
    if (!part) continue;
    const ins = pinsOf(id).filter((p) => p.def.kind === 'power-in');
    const pin = ins.find((p) => netOf.get(p.ref) && netOf.get(p.ref).kind === 'power') || ins[0];
    const gnd = pinsOf(id).some((p) => p.def.kind === 'gnd');
    if (pin) supplyOf.set(id, { pin, net: netOf.get(pin.ref) });
    if (part.kind !== 'board' && Object.values(part.pins).some((d) => d.kind === 'power-in') && !pin && pinsOf(id).length) say('warn', 'unpowered', `${nameOf(id)} 的電源腳沒有接。`, [id]);
    if (part.kind !== 'board' && pinsOf(id).length && !gnd && Object.values(part.pins).some((d) => d.kind === 'gnd')) say('warn', 'no-ground', `${nameOf(id)} 的 GND 沒有接到板子的地線：訊號沒有共同的參考，讀不到也推不動。`, [id]);
  }
  const vddOf = (id) => {
    const part = partOf(inst[id] && inst[id].part, parts);
    if (part && part.kind === 'board') return range(part.logic && part.logic.v);
    const s = supplyOf.get(id);
    if (!s || !s.net) return null;
    // a breakout with its own regulator runs its logic at that regulator's voltage
    const reg = part && Object.values(part.pins).find((d) => d.kind === 'power-out' && d.from);
    if (reg && part.kind !== 'light') return range(reg.v);
    return s.net.v;
  };

  // --- supply range per part
  for (const [id, s] of supplyOf) {
    const part = partOf(inst[id].part, parts);
    if (!s.net || part.kind === 'board') continue;
    const sup = part.supply, v = s.net.v;
    if (part.resistance) continue;
    if (!sup || (sup.min == null && sup.max == null)) { say('unknown', 'supply-tbd', `${nameOf(id)} 的供電範圍待查，看不出 ${fmtV(v)} 可不可以。`, [s.pin.ref]); continue; }
    if (!v || v[0] == null) { say('unknown', 'rail-tbd', `${nameOf(id)} 接的電源（${s.net.label}）看不出電壓：要接到板子的電源腳或電池。`, [s.pin.ref]); continue; }
    if (sup.max != null && v[1] > sup.max) say('error', 'overvolt', `${nameOf(id)} 最多只能吃 ${fmtV(sup.max)}，現在接在 ${s.net.label}：會燒掉。`, [s.pin.ref]);
    else if (sup.min != null && v[0] < sup.min) {
      if (s.net.battery) say('warn', 'undervolt-battery', `${nameOf(id)} 規格最低要 ${fmtV(sup.min)}，電池從 ${fmtV(v[1])} 用到 ${fmtV(v[0])}：電量低於 ${fmtV(sup.min)} 之後可能不穩、顏色不準或不亮。`, [s.pin.ref]);
      else say('warn', 'undervolt', `${nameOf(id)} 規格最低要 ${fmtV(sup.min)}，現在接在 ${s.net.label}。`, [s.pin.ref]);
    }
    if (s.net.conditional) {
      const why = s.net.when.map((w) => (w === 'usb' ? '插著 USB' : w === 'charger' ? '放在無線充電座上' : w)).join(' 或 ');
      say('warn', 'conditional-rail', `${nameOf(id)} 接在 ${s.net.label}：這條電源只有${why}時才有電，拿起來（只剩電池）它就沒電。`, [s.pin.ref]);
    }
  }

  // --- signal nets: drivers, receivers, levels, double use
  for (const net of nets.filter((n) => n.kind === 'signal')) {
    const list = net.pins.map((r) => pins.get(r));
    const boardPins = list.filter((p) => p.part.kind === 'board');
    const others = list.filter((p) => p.part.kind !== 'board');
    // double use: one board pin, several kinds of job
    const jobs = new Set(others.map((p) => jobOf(p.def.kind)));
    if (boardPins.length && jobs.size > 1) say('error', 'double-use', `${boardPins.map((p) => p.ref).join('、')} 同時接了 ${others.map((p) => `${p.ref}（${jobLabel(jobOf(p.def.kind))}）`).join('、')}：一支腳只能做一種事，分開接到不同的腳。`, net.pins);
    if (others.some((p) => p.def.kind === 'i2c-sda') && others.some((p) => p.def.kind === 'i2c-scl')) say('error', 'i2c-swap', `SDA 和 SCL 接在同一條線上（${net.pins.join('、')}）：多半是接反了。`, net.pins);
    if (boardPins.length > 1) say('warn', 'board-short', `${boardPins.map((p) => p.ref).join('、')} 被接在一起。`, net.pins);
    if (boardPins.length === 0 && others.length) say('note', 'no-board', `${net.pins.join('、')} 沒有接到主板。`, net.pins);
    const drivers = list.filter((p) => isDriver(p, list));
    const outs = others.filter((p) => p.def.kind === 'data-out' || p.def.kind === 'spi-miso');
    if (outs.length > 1) say('warn', 'two-drivers', `${outs.map((p) => p.ref).join('、')} 都是輸出，接在同一條線上會互相打架。`, net.pins);
    // I²C: levels go through pull-ups; only the 5 V question matters here
    if (net.i2c) {
      for (const p of others) {
        const bl = board && board.def && board.def.logic ? board.def.logic.v : null;
        if (bl != null && bl > 3.6 && p.part.logic && p.part.logic.fiveVoltSafe === false) say('error', 'i2c-5v', `${p.ref} 不耐 5 V，主板的 I²C 是 ${fmtV(bl)}：要用電平轉換。`, [p.ref]);
        else if (bl != null && bl > 3.6 && p.part.logic && p.part.logic.fiveVoltSafe == null) say('unknown', 'i2c-5v-tbd', `${p.ref} 能不能直接接 ${fmtV(bl)} 的 I²C 待查（模組上拉接哪個電壓不確定）。`, [p.ref]);
      }
      continue;
    }
    for (const d of drivers) {
      const dl = d.part.logic || {};
      for (const r of list.filter((p) => p !== d && isReceiver(p))) {
        const rid = r.id, vdd = vddOf(rid);
        const vddMax = vdd ? vdd[1] : null;
        const at = [d.ref, r.ref];
        // too high for the receiver
        // an input may go a little above its own supply, never above what the supply itself may be
        const vcap = r.part.supply && r.part.supply.max != null && vddMax != null ? Math.min(vddMax, r.part.supply.max) : vddMax;
        const vmax = r.def.vmax != null ? r.def.vmax : vinMaxAt(r.part, vcap);
        if (dl.v != null && vmax != null && dl.v > vmax + 1e-9) {
          say('error', 'overdrive', `${d.ref} 送出 ${fmtV(dl.v)}，${r.ref} 最多只能 ${fmtV(vmax)}${r.part.kind === 'board' ? '' : '（' + (r.part.zh || r.part.name) + '）'}：會燒掉或量不準，要分壓或電平轉換。`, at);
          continue;
        }
        if (r.def.kind === 'analog-in' || r.def.analog) continue;
        // too low for the receiver
        const vih = vihAt(r.part, vddMax);
        if (dl.v == null) { if (vih) say('unknown', 'level-tbd', `${d.ref} 的輸出電壓待查，看不出 ${r.ref} 讀不讀得到。`, at); continue; }
        if (!vih) { if (r.part.kind !== 'board' && r.part.logic && r.part.logic.vih == null && r.part.logic.fiveVoltSafe == null) say('unknown', 'level-tbd', `${r.ref} 的輸入門檻待查。`, at); continue; }
        if (dl.v < vih.v - 1e-9) {
          const what = r.part.kind === 'light' ? '燈可能亂閃、顏色亂掉或完全不亮' : '可能讀不到 1';
          const fix = r.part.kind === 'light' ? '加一顆電平轉換（74AHCT125 或 74HCT245，Adafruit 建議），或改用電池電壓（約 3.7 V）供電，3.3 V 資料就夠（Adafruit）' : '加電平轉換';
          say('warn', 'level-low', `邏輯電壓不合：${d.ref} 只有 ${fmtV(dl.v)}，${r.ref} 用 ${fmtV(vddMax)} 供電時要 ≥ ${fmtV(vih.v)} 才算高電位（${vih.rev ? vih.rev + ' ' : ''}規格書：${vih.rule}）。${what}。解法：${fix}。`, at);
        } else if (dl.vohMin != null && dl.vohMin < vih.v - 1e-9) {
          say('note', 'level-margin', `${d.ref} 典型 ${fmtV(dl.v)}、保證最低 ${fmtV(dl.vohMin)}，${r.ref} 要 ≥ ${fmtV(vih.v)}：平常可以，餘裕不大，線拉長或電壓變高時先懷疑這裡。`, at);
        }
      }
    }
  }

  // --- analog: a potentiometer's wiper carries the voltage across its ends
  for (const [id, x] of Object.entries(inst)) {
    const part = partOf(x.part, parts);
    if (!part || !part.resistance) continue;
    const ends = pinsOf(id).filter((p) => p.def.kind === 'power-in').map((p) => netOf.get(p.ref));
    const top = Math.max(...ends.map((n) => (n && n.v ? n.v[1] : 0)), 0);
    const wiper = pinsOf(id).find((p) => p.def.kind === 'analog-out');
    if (!wiper) continue;
    const wnet = netOf.get(wiper.ref);
    for (const r of wnet.pins.map((ref) => pins.get(ref)).filter((p) => p.part.kind === 'board')) {
      const vmax = r.def.vmax;
      if (vmax != null && top > vmax + 1e-9) say('error', 'analog-over', `${id} 兩端接到 ${fmtV(top)}，轉到底時 ${r.ref} 會吃到 ${fmtV(top)}，但它最多 ${fmtV(vmax)}${r.part.kind === 'board' && r.def.note ? '（' + r.def.note + '）' : ''}：加分壓電阻，或讓電位器上端接更低的電壓。`, [wiper.ref, r.ref]);
      if (r.def.kind === 'io' && !r.def.analog && r.def.kind !== 'analog-in') say('warn', 'analog-digital', `${r.ref} 不是類比輸入腳，讀不到電位器的連續值。`, [wiper.ref, r.ref]);
    }
  }

  // --- boot pins (ESP8266) and the serial port
  if (board && board.def && board.def.boot) {
    for (const p of pinsOf(board.id)) {
      const b = p.def.boot && board.def.boot[p.def.boot];
      if (!b) continue;
      const net = netOf.get(p.ref);
      const lvl = p.def.boot === 'gpio0' || p.def.boot === 'tx' || p.def.boot === 'rx' || p.def.boot === 'gpio15' ? 'warn' : 'note';
      say(lvl, 'boot-pin', `${p.ref}（GPIO${p.def.gpio}）：${b}`, net ? net.pins : [p.ref]);
    }
  }

  // --- I²C addresses
  const buses = [];
  for (const net of nets.filter((n) => n.i2c === 'sda')) {
    const devs = net.pins.map((r) => pins.get(r)).filter((p) => p.def.kind === 'i2c-sda').map((p) => {
      const x = inst[p.id], part = p.part;
      const addr = String(x.addr || (part.i2c && part.i2c.default) || '').toLowerCase() || null;
      if (!addr) say('unknown', 'i2c-addr-tbd', `${nameOf(p.id)} 的 I²C 位址待查。`, [p.ref]);
      return { id: p.id, part: x.part, addr, options: (part.i2c && part.i2c.addr) || [], select: part.i2c && part.i2c.select };
    });
    const seen = new Map();
    for (const d of devs) {
      if (!d.addr) continue;
      if (d.options.length && !d.options.map((a) => a.toLowerCase()).includes(d.addr)) say('error', 'i2c-addr', `${nameOf(d.id)} 的位址只能是 ${d.options.join(' 或 ')}，寫了 ${d.addr}。`, [d.id]);
      if (seen.has(d.addr)) {
        const o = devs.find((x) => x.id === seen.get(d.addr));
        const alt = (o.options.concat(d.options)).filter((a) => a.toLowerCase() !== d.addr);
        say('error', 'i2c-clash', `I²C 位址撞號：${nameOf(seen.get(d.addr))} 和 ${nameOf(d.id)} 都是 ${d.addr}。${alt.length ? `把其中一個改成 ${[...new Set(alt)].join(' 或 ')}（${d.select || o.select || '看模組的位址腳'}）。` : '這兩個不能放在同一條 I²C 上。'}`, [seen.get(d.addr), d.id]);
      } else seen.set(d.addr, d.id);
    }
    const scl = nets.find((n) => n.i2c === 'scl' && n.pins.some((r) => devs.some((d) => r.startsWith(d.id + '.'))));
    buses.push({ sda: net.id, scl: scl ? scl.id : null, devices: devs });
    for (const d of devs) if (!scl || !scl.pins.some((r) => r.startsWith(d.id + '.'))) say('error', 'i2c-scl-missing', `${nameOf(d.id)} 接了 SDA 但 SCL 沒接。`, [d.id]);
  }

  // --- power budget, battery, charging
  const rails = [];
  const loadNets = new Map();   // net id → [{ id, typ, max, how }]
  for (const [id, s] of supplyOf) {
    const part = partOf(inst[id].part, parts);
    if (!s.net || part.kind === 'board') continue;
    let l;
    if (part.resistance) { const v = s.net.v ? s.net.v[1] : null; l = { typ: v == null ? null : r2((v / part.resistance) * 1000), max: v == null ? null : r2((v / part.resistance) * 1000), how: `${fmtV(v)} ÷ ${part.resistance / 1000} kΩ` }; }
    else l = loadOf(inst[id], part);
    (loadNets.get(s.net.id) || loadNets.set(s.net.id, []).get(s.net.id)).push({ id, ...l });
  }
  const sum = (xs, k) => (xs.some((x) => x[k] == null) ? null : r1(xs.reduce((a, x) => a + x[k], 0)));
  const hasNull = (xs, k) => xs.some((x) => x[k] == null);
  // board regulator rails: the board itself draws from its regulated output
  const railLoad = (netId, seen = new Set()) => {
    if (seen.has(netId)) return [];
    seen.add(netId);
    const out = [...(loadNets.get(netId) || [])];
    const net = nets.find((n) => n.id === netId);
    if (!net) return out;
    for (const ref of net.pins) {
      const p = pins.get(ref);
      if (p.part.kind === 'board' && p.def.kind === 'power-out' && p.def.from && !p.def.when) out.push({ id: p.id, ...loadOf({}, p.part), how: '板子本身（平均；最大取規格書 Wi-Fi 傳送的典型值）' });
    }
    // regulators fed by this net (a board's 3V from BAT/USB, a breakout's 3Vo from VIN)
    if (board && board.def) {
      for (const [name, def] of Object.entries(board.def.pins)) {
        if (def.kind !== 'power-out' || !def.from) continue;
        const outRef = `${board.id}.${name}`;
        const outNet = netOf.get(outRef);
        if (def.from.some((f) => net.pins.includes(`${board.id}.${f}`))) {
          if (outNet) out.push(...railLoad(outNet.id, seen));
          else out.push({ id: board.id, ...loadOf({}, board.def), how: '板子本身（平均；最大取規格書 Wi-Fi 傳送的典型值）' });
        }
      }
    }
    return out;
  };
  for (const net of nets.filter((n) => n.kind === 'power')) {
    const srcPins = net.pins.map((r) => pins.get(r)).filter((p) => p.def.kind === 'power-out' || p.def.kind === 'bat');
    if (!srcPins.length) continue;
    let loads = railLoad(net.id);
    loads = loads.filter((x, i) => loads.findIndex((y) => y.id === x.id) === i);
    const outs = srcPins.filter((p) => p.def.kind === 'power-out');
    const typ = sum(loads, 'typ'), max = sum(loads, 'max');
    for (const sp of outs) rails.push({ net: net.id, source: sp.ref, label: `${sp.ref}${sp.def.v != null ? ' ' + fmtV(sp.def.v) : ''}`, v: net.v, when: sp.def.when || null, limitMa: sp.def.limitMa ?? null, recMa: sp.def.recMa ?? null, typMa: typ, maxMa: max, loads });
    const limited = outs.filter((p) => p.def.limitMa != null);
    if (outs.length && !limited.length && loads.length) say('unknown', 'limit-tbd', `${outs.map((p) => p.ref).join('、')} 可以供多少電流待查，看不出 ${loads.map((l) => l.id).join('、')} 加起來夠不夠。`, outs.map((p) => p.ref));
    for (const sp of limited) {
      const limit = sp.def.limitMa, rec = sp.def.recMa ?? null;
      if (max != null && max > limit) say(sp.def.when ? 'warn' : 'error', 'over-current', `${sp.ref} 最多 ${limit} mA，接在上面的 ${loads.map((l) => l.id).join('、')} 照已知的最大值加起來約 ${max} mA：${sp.def.when === 'charger' ? '放在充電座上全亮時供不起，會邊充邊掉電或充不進去。' : '會過熱或電壓掉下來，板子可能一直重開。'}降低亮度上限、減少燈數，或另外供電。`, [sp.ref, ...loads.map((l) => l.id)]);
      else if (rec != null && typ != null && typ > rec) say('warn', 'over-current-rec', `${sp.ref} 建議持續低於 ${rec} mA，平常約用 ${typ} mA。`, [sp.ref]);
    }
    if (limited.length && hasNull(loads, 'max')) say('unknown', 'load-tbd', `${loads.filter((l) => l.max == null).map((l) => nameOf(l.id)).join('、')} 的最大電流待查：${limited.map((p) => p.ref).join('、')} 的負載只算了已知的部分。`, limited.map((p) => p.ref));
  }

  // battery: what runs off it once the board is off the charger (conditional rails are dark then)
  let battery = null;
  const batInst = Object.entries(inst).find(([, x]) => partOf(x.part, parts)?.battery);
  if (batInst) {
    const [bid, bx] = batInst, bpart = partOf(bx.part, parts);
    const plus = pinsOf(bid).find((p) => p.def.kind === 'bat');
    const bnet = plus && netOf.get(plus.ref);
    const mAh = bx.mAh || bpart.mAh;
    if (!bnet) say('warn', 'battery-open', `電池 ${bid} 的 + 沒有接。`, [bid]);
    else {
      let loads = railLoad(bnet.id);
      loads = loads.filter((x, i) => loads.findIndex((y) => y.id === x.id) === i);
      const typ = spec.use && spec.use.avgMa != null ? spec.use.avgMa : sum(loads, 'typ');
      const max = sum(loads, 'max');
      const hours = { typ: typ ? r1(mAh / typ) : null, max: max ? r1(mAh / max) : null };
      battery = { id: bid, mAh, v: bnet.v, typMa: typ, maxMa: max, hours, loads, avgFrom: spec.use && spec.use.avgMa != null ? 'spec.use.avgMa' : 'parts' };
      const offCharger = nets.filter((n) => n.kind === 'power' && n.conditional && (loadNets.get(n.id) || []).length);
      const dark = offCharger.flatMap((n) => (loadNets.get(n.id) || []).map((l) => l.id));
      battery.excludes = dark;
      const unless = dark.length ? `（不含 ${dark.join('、')}：接在只有充電時才有電的 ${offCharger.map((n) => n.label).join('、')}，拿起來就不亮）` : '';
      if (typ == null) say('unknown', 'battery-tbd', `電池 ${mAh} mAh：有零件的電流待查，算不出撐多久。`, [bid]);
      else say('note', 'battery-hours', `電池 ${mAh} mAh，平均約 ${typ} mA → 大約 ${hours.typ} 小時${max ? `；照已知的最大值（約 ${max} mA）約 ${hours.max} 小時` : ''}${unless}。沒算穩壓器損耗和電池老化，實際會短一些。${loads.length ? `（${loads.map((l) => `${l.id} ${l.typ ?? '?'} mA`).join('、')}）` : ''}`, [bid]);
      if (max && (bpart.battery || {}).maxMa == null) say('unknown', 'battery-max-tbd', `${nameOf(bid)} 最大放電電流待查（產品頁沒寫），這個接法最大約 ${max} mA，供不供得起要看你買的那顆電池。`, [bid]);
      if (dark.length) say('note', 'battery-dark', `${dark.join('、')} 不吃電池：接在只有充電時才有電的 ${offCharger.map((n) => n.label).join('、')}，上面的電池時數是它不亮的情況。`, [bid]);
    }
    say('note', 'jst-polarity', bpart.bomNote || '電池接頭的極性先用電表確認。', [bid]);
    // charging
    const chg = board && board.def && board.def.charger;
    if (chg && chg.mA) {
      battery && (battery.charge = { by: `${board.id}（${chg.part}）`, mA: chg.mA, hours: r1(mAh / chg.mA) });
      say('note', 'charge-time', `${board.id} 的充電 IC（${chg.part}）約 ${chg.mA} mA：${mAh} mAh 從空到滿粗估 ${r1(mAh / chg.mA)} 小時以上（最後一段會變慢）。`, [bid]);
      const supply = rails.find((r) => r.when === 'charger');
      if (supply && supply.limitMa != null && supply.maxMa != null && supply.maxMa <= supply.limitMa && supply.maxMa + chg.mA > supply.limitMa) say('warn', 'charge-budget', `放在充電座上時 ${supply.source} 只有 ${supply.limitMa} mA，要同時供 ${supply.loads.map((l) => l.id).join('、')}（最大約 ${supply.maxMa} mA）再加充電 ${chg.mA} mA：燈全亮時電池會充不進去。`, [supply.source]);
    }
  }

  // parts that are not wired at all, and 待查 values worth knowing
  for (const id of Object.keys(inst)) if (partOf(inst[id].part, parts) && !pinsOf(id).length) say('note', 'unwired', `${nameOf(id)} 還沒有接任何線。`, [id]);
  const order = { error: 0, warn: 1, unknown: 2, note: 3 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  return {
    ok: !issues.some((x) => x.level === 'error'),
    title: spec.title || null,
    board: board && board.def ? { id: board.id, part: board.part, name: board.def.zh || board.def.name } : null,
    nets, wires,
    power: { rails, battery },
    i2c: buses,
    issues,
    warnings: issues.filter((x) => x.level === 'error' || x.level === 'warn').map((x) => x.text),
    notes: issues.filter((x) => x.level === 'note' || x.level === 'unknown').map((x) => x.text),
  };
}

function jobOf(kind) {
  if (kind === 'i2c-sda' || kind === 'i2c-scl') return kind;
  if (kind.startsWith('spi-')) return kind;
  if (kind === 'data-in') return 'data-in';
  if (kind === 'data-out') return 'data-out';
  if (kind === 'analog-out') return 'analog';
  return kind;
}
function jobLabel(j) { return ({ 'i2c-sda': 'I²C SDA', 'i2c-scl': 'I²C SCL', 'data-in': '資料輸入', 'data-out': '輸出', analog: '類比', 'spi-sck': 'SPI SCK', 'spi-mosi': 'SPI MOSI', 'spi-miso': 'SPI MISO', 'spi-cs': 'SPI CS' })[j] || j; }
// a board pin drives a net that has inputs on it; a part's output drives a board pin
function isDriver(p, list) {
  if (p.part.kind === 'board') return list.some((q) => q !== p && ['data-in', 'spi-sck', 'spi-mosi', 'spi-cs', 'reset'].includes(q.def.kind));
  return p.def.kind === 'data-out' || p.def.kind === 'spi-miso';
}
function isReceiver(p) {
  if (p.part.kind === 'board') return true;
  return ['data-in', 'spi-sck', 'spi-mosi', 'spi-cs', 'reset'].includes(p.def.kind);
}
