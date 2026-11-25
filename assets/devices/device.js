// /devices/<id>/: what needs a browser. A camera or an audio input is looked for and opened only when the visitor presses a
// button, through the record's own find() and open() (@openav/devices), and stopped with the Stop button; nothing is asked for
// on load. An Enttec DMX USB Pro page shows the frame encodeEnttecDmx() makes from three channels. The Copy buttons copy.
import { wireCopy } from './copy.js?v=2b72f18a';

const data = JSON.parse(document.getElementById('dev-data').textContent);
wireCopy(data);
const $ = (s) => document.querySelector(s);
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));

// ---------------------------------------------------------------- a camera or an audio input, behind buttons
const live = $('#live');
if (live) {
  const L = data.live, inputs = L.inputs[data.input];
  const status = $('#live-status'), find = $('#live-find'), open = $('#live-open'), stop = $('#live-stop'), settings = $('#live-settings');
  const say = (s) => { status.textContent = s; };
  let dev = null, stream = null, ctx = null, raf = 0;
  const handle = async () => dev || (dev = await (await import('../../packages/devices/index.js?v=2b72f18a')).device(data.device));
  const api = () => (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices ? navigator.mediaDevices : null);
  const shutdown = () => {
    if (stream) for (const t of stream.getTracks()) t.stop();
    stream = null; cancelAnimationFrame(raf);
    if (ctx) { ctx.close(); ctx = null; }
    const v = $('#live-video'); if (v) { v.srcObject = null; v.hidden = true; }
    const m = $('#live-meter'); if (m) m.hidden = true;
    settings.hidden = true; stop.disabled = true;
  };
  const showSettings = (track) => {
    const s = track.getSettings ? track.getSettings() : {};
    const keys = data.input === 'camera' ? ['width', 'height', 'frameRate'] : ['sampleRate', 'channelCount', 'echoCancellation', 'noiseSuppression', 'autoGainControl'];
    settings.innerHTML = `<div><dt>${L.settings}</dt><dd>${track.label.replace(/</g, '&lt;')}</dd></div>` + keys.filter((k) => s[k] !== undefined).map((k) => `<div><dt>${k}</dt><dd>${String(typeof s[k] === 'number' ? Math.round(s[k] * 100) / 100 : s[k])}</dd></div>`).join('');
    settings.hidden = false;
  };
  find.addEventListener('click', async () => {
    if (!api()) { say(fill(L.noApi, { inputs })); return; }
    try {
      const d = await handle();
      const hit = await d.find();
      if (hit) { say(fill(L.found, { label: hit.label })); return; }
      const all = (await navigator.mediaDevices.enumerateDevices()).filter((x) => x.kind === (data.input === 'camera' ? 'videoinput' : 'audioinput'));
      if (all.length && !all.some((x) => x.label)) { say(L.hidden); return; }
      say(fill(L.notFound, { n: all.length, inputs, names: all.length ? `: ${all.map((x) => x.label).join(', ')}` : '' }));
    } catch (e) { say(fill(L.error, { msg: e.message })); }
  });
  open.addEventListener('click', async () => {
    if (!api()) { say(fill(L.noApi, { inputs })); return; }
    shutdown();
    try {
      const d = await handle();
      stream = await d.open();
      const track = stream.getTracks()[0];
      say(fill(L.opened, { label: track.label }));
      showSettings(track);
      stop.disabled = false;
      if (data.input === 'camera') { const v = $('#live-video'); v.srcObject = stream; v.hidden = false; v.play().catch(() => {}); }
      else {
        ctx = new AudioContext();
        const an = ctx.createAnalyser(); an.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize), meter = $('#live-level');
        $('#live-meter').hidden = false;
        const tick = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x; meter.value = Math.min(1, Math.sqrt(s / buf.length) * 4); raf = requestAnimationFrame(tick); };
        tick();
      }
    } catch (e) { shutdown(); say(fill(L.error, { msg: e.message })); }
  });
  stop.addEventListener('click', () => { shutdown(); say(''); });
  addEventListener('pagehide', shutdown);
}

// ---------------------------------------------------------------- the frame an Enttec DMX USB Pro receives
const frame = $('#frame');
if (frame) {
  const [{ encodeEnttecDmx }, { Universe }] = await Promise.all([import('../../packages/dmx/protocol/enttec.js?v=2b72f18a'), import('../../packages/dmx/universe.js?v=2b72f18a')]);
  const u = new Universe(1);
  const inputs = [...frame.querySelectorAll('input[type="range"]')];
  const hex = (b) => b.toString(16).padStart(2, '0');
  const show = () => {
    for (const i of inputs) { u.set(Number(i.dataset.ch), Number(i.value)); i.nextElementSibling.textContent = i.value; }
    const f = encodeEnttecDmx(u.data);
    $('#frame-len').textContent = fill($('#frame-len').dataset.tpl, { n: f.length });
    const head = [...f.slice(0, 12)].map(hex).join(' '), tail = [...f.slice(-4)].map(hex).join(' ');
    $('#frame-bytes code').textContent = `${head} … ${tail}`;
  };
  for (const i of inputs) i.addEventListener('input', show);
  show();
}
