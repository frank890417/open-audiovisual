// /fixtures/<id>/: the virtual fixture. The sliders are properties (dimmer, colour, pan, tilt, zoom, strobe, and any other
// channel by its key), they go through the same Patch a show uses (its colour split, its 3 Hz strobe cap), and the swatch and
// the byte table are read back from the BYTES, the way the light would read them (fixtureLook of the DMX monitor). Nothing is
// sent anywhere, and the swatch never flashes: a strobe says its rate in words.
import { Patch } from '../../packages/dmx/patch.js?v=7229c5d3';
import { fixtureLook, cssColor } from '../../packages/dmx/monitor.js?v=7229c5d3';
import { wireCopy } from './copy.js?v=7229c5d3';

const data = JSON.parse(document.getElementById('fx-data').textContent);
const T = data.t, profile = data.profile;
wireCopy(data);

const $ = (s) => document.querySelector(s);
const modeSel = $('#vfx-mode'), addrIn = $('#vfx-address'), sliders = $('#vfx-sliders');
const swatch = $('#vfx-swatch'), state = $('#vfx-state'), body = $('#vfx-bytes'), aim = $('#vfx-aim'), dot = $('#vfx-dot');
const words = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
const same = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');   // "colorWheel" and "Color Wheel" are one name

let patch, rec, values, last = [];

/** The controls a mode has: the properties the Patch drives, then every other channel that is not a control or a fine byte. */
function controlsOf(r) {
  const L = r.layout, out = [];
  const lit = L.intensities.length || L.colors.length;
  if (lit) out.push({ key: 'dimmer', label: T.dimmer, v: 1 });
  if (L.colors.some((s) => ['red', 'green', 'blue'].includes(s.color))) out.push({ key: 'r', label: T.red, v: 1 }, { key: 'g', label: T.green, v: 0.5 }, { key: 'b', label: T.blue, v: 0 });
  else if (L.colors.length) out.push({ key: 'r', label: T.red, v: 1 }, { key: 'g', label: T.green, v: 1 }, { key: 'b', label: T.blue, v: 1 });
  for (const k of ['pan', 'tilt', 'zoom']) if (L[k]) out.push({ key: k, label: T[k], v: 0.5 });
  if (L.strobe) out.push({ key: 'strobe', label: T.strobe, v: 0 });
  const others = r.mode.slots.filter((s) => !s.fine && !L.claimed.has(s.key) && !['control', 'intensity', 'strobe'].includes(s.type) && !(s.type === 'color'));
  const extraLight = r.mode.slots.filter((s) => !s.fine && ((s.type === 'intensity' && s !== L.intensity) || (s.type === 'strobe' && s !== L.strobe) || (s.type === 'color' && !['red', 'green', 'blue', 'white', 'warmWhite', 'coldWhite', 'amber'].includes(s.color))));
  const rest = [...extraLight, ...others];
  if (rest.length) out.push({ head: T.others });
  for (const s of rest) out.push({ key: s.key, label: profile.channels[s.key].name || words(s.key), v: s.type === 'strobe' ? 0 : s.default / 255, other: true });
  return out;
}

function build() {
  const address = Math.max(1, Math.min(512, Math.round(Number(addrIn.value) || 1)));
  patch = new Patch({ profiles: [profile] });
  const mode = profile.modes.find((m) => m.id === modeSel.value) || profile.modes[0];
  const fp = mode.channels.length;
  const at = Math.min(address, 513 - fp);
  if (at !== address) addrIn.value = at;
  rec = patch.add({ id: 'light', profile: profile.id, mode: mode.id, address: at });
  values = {};
  sliders.textContent = '';
  for (const c of controlsOf(rec)) {
    if (c.head) { const h = document.createElement('h4'); h.textContent = c.head; sliders.append(h); continue; }
    values[c.key] = c.v;
    const label = document.createElement('label'); label.className = 'vfx-slider';
    const name = document.createElement('span'); name.textContent = c.label;
    const input = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: 1, step: 0.001, value: c.v });
    input.dataset.key = c.key;
    const out = document.createElement('output'); out.textContent = Math.round(c.v * 100) + '%';
    input.addEventListener('input', () => { values[c.key] = Number(input.value); out.textContent = Math.round(values[c.key] * 100) + '%'; render(); });
    label.append(name, input, out);
    sliders.append(label);
  }
  aim.style.display = rec.layout.pan || rec.layout.tilt ? '' : 'none';   // an <svg> does not take the hidden attribute
  last = [];
  render();
}

/** What a strobe channel's byte does now: open, closed, strobing at a rate, or not said. */
function shutterOf(slot, byte) {
  const r = (slot.ranges || []).find((x) => byte >= x.from && byte <= x.to);
  if (!r) return slot.ranges ? null : 'open';
  if (r.is === 'closed') return 'closed';
  if (r.is === 'strobe') {
    if (!r.hz) return 'strobeAny';
    const hz = r.hz[0] + ((byte - r.from) / Math.max(1, r.to - r.from)) * (r.hz[1] - r.hz[0]);
    return hz <= 0 ? 'open' : { hz };
  }
  return 'open';
}

function rangeText(slot, byte) {
  if (slot.fine) return '';
  const r = (slot.ranges || []).find((x) => byte >= x.from && byte <= x.to);
  if (!r) return '';
  const is = T.is[r.is] || words(r.is);
  return `${is}${r.label && r.label.toLowerCase() !== String(is).toLowerCase() ? ` (${r.label})` : ''}`;
}

function render() {
  const props = {};
  for (const [k, v] of Object.entries(values)) if (!['r', 'g', 'b'].includes(k)) props[k] = v;
  if ('r' in values) props.color = [values.r, values.g, values.b];
  const U = patch.render({ light: props }, { maxFlashHz: 3 });
  const data = U.bytes(rec.universe);
  const look = fixtureLook(rec, data);
  const L = rec.layout;
  // the shutter: a closed strobe channel darkens the light whatever its colour says
  let shut = 'open';
  for (const s of L.strobes) {
    const st = shutterOf(s, data[rec.address - 1 + s.offset]);
    if (st === 'closed') { shut = 'closed'; break; }
    if (st && st !== 'open') shut = st;
  }
  const color = shut === 'closed' ? [0, 0, 0] : look.color;
  swatch.style.backgroundColor = cssColor(color);
  swatch.style.setProperty('--glow', cssColor(color.map((x) => x * 0.6)));
  swatch.dataset.state = typeof shut === 'object' || shut === 'strobeAny' ? 'strobe' : shut;
  state.textContent = shut === 'closed' ? T.shut.closed : typeof shut === 'object' ? T.shut.strobe.replace('{hz}', shut.hz.toFixed(1)) : shut === 'strobeAny' ? T.shut.strobeAny : `${cssColor(color)} · ${T.shut.open}`;
  if (aim.style.display !== 'none') { dot.setAttribute('cx', String(4 + (look.pan ?? 0.5) * 92)); dot.setAttribute('cy', String(4 + (1 - (look.tilt ?? 0.5)) * 92)); }
  const rows = rec.mode.slots.map((s, i) => {
    const b = data[rec.address - 1 + i];
    const name = profile.channels[s.key].name || '';
    return `<tr${last.length && last[i] !== b ? ' data-changed' : ''}><td class="n">${rec.address + i}</td><td><code>${s.key}</code>${name && same(name) !== same(s.key) ? ` ${name.replace(/</g, '&lt;')}` : ''}</td><td class="b">${b}</td><td>${rangeText(s, b).replace(/</g, '&lt;')}</td></tr>`;
  });
  body.innerHTML = rows.join('');
  last = [...data.slice(rec.address - 1, rec.address - 1 + rec.footprint)];
}

modeSel.addEventListener('change', build);
addrIn.addEventListener('change', build);
build();
