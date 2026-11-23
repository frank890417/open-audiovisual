// @openav/hw — the parts library, the checks, the wiring diagram and the parts list, on small hand-written specs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hw, HW_PARTS } from '../packages/hw/index.js';
import { check, resolvePin } from '../packages/hw/check.js';
import { diagram } from '../packages/hw/diagram.js';
import { bom } from '../packages/hw/bom.js';

const codes = (r, level) => r.issues.filter((i) => !level || i.level === level).map((i) => i.code);
const issue = (r, code) => r.issues.find((i) => i.code === code);

// the "flip the box" lamp as first drawn: Feather + LIS3DH + a 12-LED ring on the 5 V USB pin + LiPo + Qi
const BOX = () => ({
  title: '方盒',
  board: 'mcu',
  parts: {
    mcu: { part: 'feather-huzzah-esp8266', have: true },
    acc: { part: 'lis3dh-breakout' },
    ring: { part: 'neopixel-ring-12' },
    bat: { part: 'lipo-1s', mAh: 1200 },
    qi: { part: 'qi-receiver' },
  },
  wires: [
    ['mcu.3V', 'acc.VIN'], ['mcu.GND', 'acc.GND'], ['mcu.SDA', 'acc.SDA'], ['mcu.SCL', 'acc.SCL'],
    ['mcu.USB', 'ring.5V'], ['mcu.GND', 'ring.GND'], ['mcu.2', 'ring.DIN'],
    ['bat.+', 'mcu.BAT'], ['bat.-', 'mcu.GND'],
    ['qi.V+', 'mcu.USB'], ['qi.GND', 'mcu.GND'],
  ],
});

test('library: every part names its sources, every pin has a known kind, 待查 is null, not a guess', () => {
  const KINDS = new Set(['gnd', 'power-out', 'power-in', 'bat', 'power-node', 'io', 'i2c-sda', 'i2c-scl', 'spi-sck', 'spi-mosi', 'spi-miso', 'spi-cs', 'data-in', 'data-out', 'analog-in', 'analog-out', 'reset']);
  for (const want of ['feather-huzzah-esp8266', 'arduino-leonardo', 'arduino-uno-r3', 'rc522', 'pir-hc-sr501', 'pot-10k', 'lis3dh-breakout', 'mpu6050-gy521', 'ws2812b', 'sk6812', 'neopixel-ring-12', 'lipo-1s', 'tp4056-usbc', 'qi-receiver']) assert.ok(HW_PARTS[want], want);
  for (const [id, p] of Object.entries(HW_PARTS)) {
    assert.ok(p.sources.length && p.sources.every((s) => /^https:\/\//.test(s.url) && s.title), `${id}: sources`);
    assert.ok(Object.keys(p.pins).length, `${id}: pins`);
    for (const [name, d] of Object.entries(p.pins)) assert.ok(KINDS.has(d.kind), `${id}.${name}: kind ${d.kind}`);
    assert.ok(Array.isArray(p.tbd), `${id}: tbd is a list`);
  }
  assert.equal(HW_PARTS['feather-huzzah-esp8266'].logic.fiveVoltSafe, false);
  assert.equal(HW_PARTS['feather-huzzah-esp8266'].pins.A0.vmax, 1.0);
  assert.equal(HW_PARTS['qi-receiver'].pins['V+'].limitMa, 500);
  assert.equal(HW_PARTS.sk6812.perLed.max, null, 'SK6812 per-LED current is 待查, not invented');
  assert.equal(Hw.parts, HW_PARTS);
});

test('pins resolve by name or alias; a wrong one says what exists', () => {
  const s = BOX();
  assert.equal(resolvePin(s, 'mcu.SDA').ref, 'mcu.4');
  assert.equal(resolvePin(s, 'mcu.gpio2').ref, 'mcu.2');
  assert.equal(resolvePin(s, 'ring.5v').ref, 'ring.VDD');
  assert.match(resolvePin(s, 'mcu.D7').why, /沒有「D7」/);
  assert.match(resolvePin(s, 'nope.X').why, /沒有叫「nope」/);
  const r = check({ ...s, wires: [...s.wires, ['mcu.99', 'acc.SDA']] });
  assert.equal(r.ok, false);
  assert.ok(codes(r, 'error').includes('pin'));
});

test('the box: 3.3 V data into a ring powered at 5 V is caught, and so is the rail that only exists on the charger', () => {
  const r = check(BOX());
  const low = issue(r, 'level-low');
  assert.ok(low, 'logic level warning');
  assert.equal(low.level, 'warn');
  assert.deepEqual(low.at, ['mcu.2', 'ring.DIN']);
  assert.match(low.text, /3\.3 V/);
  assert.match(low.text, /74AHCT125/);
  assert.ok(issue(r, 'conditional-rail'), 'USB pin is dark off the charger');
  const oc = issue(r, 'over-current');
  assert.ok(oc && /qi\.V\+ 最多 500 mA/.test(oc.text), 'Qi 500 mA cannot feed 12 LEDs at full white');
  assert.equal(issue(r, 'boot-pin').level, 'note');
  assert.match(issue(r, 'boot-pin').text, /GPIO2/);
  assert.ok(issue(r, 'jst-polarity'));
  // the battery only feeds what is on BAT and the 3V regulator: the board (80 mA average) and the accelerometer
  assert.equal(r.power.battery.mAh, 1200);
  assert.equal(r.power.battery.typMa, 80);
  assert.equal(r.power.battery.hours.typ, 15);
  assert.deepEqual(r.power.battery.excludes, ['ring'], 'the hours are with the ring dark');
  assert.match(issue(r, 'battery-hours').text, /不含 ring/);
  assert.equal(r.i2c.length, 1);
  assert.deepEqual(r.i2c[0].devices.map((d) => d.addr), ['0x18']);
  assert.ok(r.warnings.length >= 3 && r.warnings.every((w) => typeof w === 'string'));
});

test('ring on the battery instead: 3.3 V data is fine (with a margin note), the LEDs warn about a low cell', () => {
  const s = BOX();
  s.wires = s.wires.map((w) => (w[1] === 'ring.5V' ? ['mcu.BAT', 'ring.5V'] : w));
  const r = check(s);
  assert.ok(!issue(r, 'level-low'));
  assert.ok(issue(r, 'level-margin'), '2.64 V guaranteed vs 0.7 × 4.2 V');
  assert.equal(issue(r, 'undervolt-battery').level, 'warn');
  assert.ok(!issue(r, 'conditional-rail'));
  assert.ok(r.power.battery.typMa > 300, 'the ring now drains the battery');
  assert.deepEqual(r.power.battery.excludes, []);
  assert.equal(r.power.battery.hours.typ, 3.8);
  assert.equal(issue(r, 'battery-max-tbd').level, 'unknown');
});

test('boot pins: GPIO15 and GPIO0 warn, the serial pins warn', () => {
  const r = check({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266' }, l: { part: 'ws2812b' }, p: { part: 'pir-hc-sr501' } },
    wires: [['m.15', 'l.DIN'], ['m.BAT', 'l.VDD'], ['m.GND', 'l.GND'], ['p.OUT', 'm.0'], ['p.VCC', 'm.USB'], ['p.GND', 'm.GND']] });
  const boot = r.issues.filter((i) => i.code === 'boot-pin');
  assert.ok(boot.some((i) => i.level === 'warn' && /GPIO15/.test(i.text)));
  assert.ok(boot.some((i) => i.level === 'warn' && /GPIO0/.test(i.text)));
  const r2 = check({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266' }, l: { part: 'ws2812b' } }, wires: [['m.TX', 'l.DIN'], ['m.GND', 'l.GND'], ['m.BAT', 'l.VDD']] });
  assert.ok(r2.issues.some((i) => i.code === 'boot-pin' && i.level === 'warn' && /TX/.test(i.text)));
});

test('one pin, two jobs; SDA and SCL swapped', () => {
  const s = BOX();
  s.wires.push(['mcu.4', 'ring.DIN']);
  const r = check(s);
  assert.equal(issue(r, 'double-use').level, 'error');
  assert.equal(r.ok, false);
  const t = check({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266' }, a: { part: 'lis3dh-breakout' }, b: { part: 'mpu6050-gy521' } },
    wires: [['m.4', 'a.SDA'], ['m.4', 'b.SCL'], ['m.5', 'a.SCL'], ['m.5', 'b.SDA']] });
  assert.ok(codes(t, 'error').includes('i2c-swap'));
});

test('I²C: two accelerometers at the same address clash; moving one to 0x19 fixes it; a bad address is refused', () => {
  const two = (addr) => ({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266' }, a: { part: 'lis3dh-breakout' }, b: { part: 'lis3dh-breakout', ...(addr ? { addr } : {}) } },
    wires: [['m.3V', 'a.VIN'], ['m.3V', 'b.VIN'], ['m.GND', 'a.GND'], ['m.GND', 'b.GND'], ['m.SDA', 'a.SDA'], ['m.SDA', 'b.SDA'], ['m.SCL', 'a.SCL'], ['m.SCL', 'b.SCL']] });
  const clash = issue(check(two()), 'i2c-clash');
  assert.ok(clash && /0x18/.test(clash.text) && /0x19/.test(clash.text));
  assert.ok(!issue(check(two('0x19')), 'i2c-clash'));
  assert.ok(issue(check(two('0x42')), 'i2c-addr'));
  const noScl = check({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266' }, a: { part: 'lis3dh-breakout' } }, wires: [['m.SDA', 'a.SDA']] });
  assert.ok(issue(noScl, 'i2c-scl-missing'));
});

test('current: 16 LEDs on the Feather 3V regulator are over its 500 mA, and too low a voltage for them', () => {
  const r = check({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266' }, r: { part: 'neopixel-ring-16' } }, wires: [['m.3V', 'r.VDD'], ['m.GND', 'r.GND'], ['m.13', 'r.DIN']] });
  const oc = issue(r, 'over-current');
  assert.equal(oc.level, 'error');
  assert.match(oc.text, /500 mA/);
  assert.ok(issue(r, 'undervolt'));
  // brightness caps the maximum
  const dim = check({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266' }, r: { part: 'ws2812b', leds: 4, brightness: 0.5 } }, wires: [['m.3V', 'r.VDD'], ['m.GND', 'r.GND'], ['m.13', 'r.DIN']] });
  assert.ok(!issue(dim, 'over-current'));
  assert.equal(dim.power.rails[0].maxMa, 170 + 4 * 60 * 0.5);
});

test('5 V boards: UNO into a 3.3 V RC522 is an error both ways (supply and SPI), the PIR output reads fine', () => {
  const r = check({ board: 'u', parts: { u: { part: 'arduino-uno-r3' }, rf: { part: 'rc522' }, pir: { part: 'pir-hc-sr501' } },
    wires: [['u.5V', 'rf.3.3V'], ['u.GND', 'rf.GND'], ['u.D13', 'rf.SCK'], ['u.D11', 'rf.MOSI'], ['u.D12', 'rf.MISO'], ['u.D10', 'rf.SDA'],
      ['u.5V', 'pir.VCC'], ['u.GND', 'pir.GND'], ['pir.OUT', 'u.D2']] });
  assert.ok(codes(r, 'error').includes('overvolt'));
  assert.ok(r.issues.some((i) => i.code === 'overdrive' && i.at.includes('rf.SCK')));
  assert.ok(!r.issues.some((i) => i.at.includes('pir.OUT') && (i.code === 'level-low' || i.code === 'overdrive')), '3.3 V ≥ 0.6 × 5 V');
  const ok = check({ board: 'u', parts: { u: { part: 'arduino-uno-r3' }, rf: { part: 'rc522' } }, wires: [['u.3V3', 'rf.3.3V'], ['u.GND', 'rf.GND']] });
  assert.ok(!issue(ok, 'overvolt'));
});

test('a potentiometer across 3.3 V into the Feather A0 (1.0 V max) is caught', () => {
  const r = check({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266', have: true }, k: { part: 'pot-10k', have: true } }, wires: [['k.1', 'm.GND'], ['k.3', 'm.3V'], ['k.2', 'm.A0']] });
  const a = issue(r, 'analog-over');
  assert.equal(a.level, 'error');
  assert.match(a.text, /1 V/);
});

test('unknown values stay unknown: an SK6812 strip has no per-LED current, so the budget says 待查', () => {
  const r = check({ board: 'm', parts: { m: { part: 'feather-huzzah-esp8266' }, s: { part: 'sk6812', leds: 30 } }, wires: [['m.3V', 's.VDD'], ['m.GND', 's.GND'], ['m.13', 's.DIN']] });
  assert.ok(r.issues.some((i) => i.level === 'unknown' && i.code === 'load-tbd'));
  assert.ok(!issue(r, 'over-current'), 'not a pass, not a fail: unknown');
});

test('bom: on the shelf vs to buy, no prices, no shop links; the battery carries the JST-PH polarity note', () => {
  const b = bom(BOX());
  assert.deepEqual(b.have.map((x) => x.id), ['mcu']);
  assert.deepEqual(b.buy.map((x) => x.id), ['acc', 'ring', 'bat', 'qi']);
  const text = JSON.stringify(b);
  assert.doesNotMatch(text, /https?:\/\//);
  assert.doesNotMatch(text, /price|NT\$|USD|\$\d/i);
  assert.match(b.buy.find((x) => x.id === 'bat').notes.join(' '), /JST-PH/);
  assert.deepEqual(bom({ parts: { x: { part: 'flux-capacitor' } } }).unknown.map((x) => x.id), ['x']);
});

test('diagram: one SVG with every part, coloured wires, the flagged wire dashed, and spec text escaped', () => {
  const s = BOX();
  s.title = '<script>alert(1)</script> & "box"';
  s.parts['x<y'] = { part: 'pot-10k' };
  const svg = diagram(s);
  assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /<\/svg>$/);
  for (const id of ['mcu', 'acc', 'ring', 'bat', 'qi']) assert.ok(svg.includes(`>${id}<`) || svg.includes(`>${id} ·`), id);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /x&lt;y/);
  assert.match(svg, /stroke="#1c7ed6"/, 'I²C wires are blue');
  assert.match(svg, /stroke="#d6336c"/, 'power is red');
  assert.match(svg, /stroke-dasharray="6 4"/, 'a flagged wire');
  assert.equal(Hw.diagram(BOX()), diagram(BOX()));
});
