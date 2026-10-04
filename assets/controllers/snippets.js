// The embed snippets on /controllers/ — ONE source for the static page (tools/controllers/page.mjs
// renders them at build time) and the live builder (controllers.js re-renders them as you choose).
// Pure: no DOM. Code, signal names and URLs are the same in every language.

export const SITE = 'https://openaudiovisual.com/';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Builder options → the attributes an <oav-controller> needs (defaults left out). */
export function attrsOf(o) {
  const a = [['profile', o.profile]];
  if (o.layout && o.layout !== 'auto') a.push(['layout', o.layout]);
  if (o.hardware && o.hardware !== 'off') a.push(['hardware', o.hardware === 'on' ? '' : o.hardware]);
  if (o.midiOut && o.midiOut !== 'off') a.push(['midi-out', o.midiOut]);
  for (const k of ['picker', 'readout', 'learn', 'follow']) if (o[k]) a.push([k, '']);
  if (o.theme === 'light') a.push(['theme', 'light']);
  return a;
}
const attrText = (a) => a.map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${v}"`)).join('');
const query = (a) => a.map(([k, v]) => (v === '' ? k : `${k}=${encodeURIComponent(v)}`)).join('&');

/** A control id of each kind, for examples that should name real controls of the chosen device. */
export function sampleIds(profile) {
  const cs = profile.controls || [];
  const cont = cs.find((c) => ['knob', 'fader', 'strip', 'wheel'].includes(c.type) && c.msg === 'cc') || cs.find((c) => c.type !== 'keys') || cs[0];
  const hit = cs.find((c) => c.type === 'pad' || c.type === 'keys') || cs.find((c) => c.type === 'button') || cont;
  return { cont, hit };
}

/**
 * @param {object} o  { profile, layout, hardware, midiOut, picker, readout, learn, theme }
 * @param {object} p  the chosen profile (for names, ids and the iframe height)
 * @returns {{element:string, iframe:string, module:string, events:string, daw:string}}
 */
export function snippets(o, p) {
  const a = attrsOf(o);
  const { cont, hit } = sampleIds(p);
  const short = p.short;
  const ccMsg = cont.msg === 'cc' ? `{ type: 'cc', ch: ${cont.ch ?? p.channel ?? 1}, cc: ${cont.cc}, value: 64 }` : `{ type: '${cont.msg}', … }`;
  const bytes = cont.msg === 'cc' ? `[0x${(0xb0 | ((cont.ch ?? p.channel ?? 1) - 1)).toString(16)}, ${cont.cc}, 64]` : '[0xb0, 1, 64]';
  const extra = (o.picker || o.learn || o.hardware === 'ask' || o.midiOut === 'ask' ? 36 : 0) + (o.readout ? 22 : 0);
  const h = Math.round(Math.min(720 / (p.face.w / p.face.h), 720) + extra);
  const name = p.nameEn || p.name;
  const out = o.midiOut && o.midiOut !== 'off' && o.midiOut !== 'ask' ? o.midiOut : 'IAC';
  return {
    element: `<script type="module" src="${SITE}packages/midi/element.js"></script>
<oav-controller${attrText(a)}></oav-controller>`,

    iframe: `<iframe src="${SITE}embed/controller/?${query(a)}"
        width="720" height="${h}" style="border:0;max-width:100%" allow="midi"
        title="${name}"></iframe>
<script>
  // every control the visitor plays arrives here
  addEventListener('message', (e) => {
    if (e.data?.source !== 'openav' || e.data.type !== 'control') return;
    console.log(e.data.detail.signal, e.data.detail.value);
  });
</script>`,

    module: `import { createController } from '${SITE}packages/midi/index.js';

const ctl = createController('${p.id}');
ctl.mount(document.querySelector('#controller'));   // optional: headless works too
ctl.on('control', (e) => console.log(e.signal, e.value));
ctl.connectHardware();   // optional: follow the real one (asks for Web MIDI)`,

    events: `const el = document.querySelector('oav-controller');
el.addEventListener('control', (e) => {
  const { id, value, signal, message, source } = e.detail;
  // '${cont.id}'  0..1  'midi/${short}/${cont.id}'  ${ccMsg}  'ui' | 'hardware'
});
el.addEventListener('noteon', (e) => console.log(e.detail.note, e.detail.velocity));

await el.ready;
el.set('${cont.id}', 0.5);              // move a control: fires 'control', reaches MIDI out
el.set('${hit.id}', 1); el.set('${hit.id}', 0);   // strike and release
el.ingest(${bytes});   // MIDI from anywhere (a WebSocket, another tab)`,

    daw: `<!-- what you play on this controller → ${out === 'IAC' ? 'the IAC bus (macOS)' : out} → Ableton, TouchDesigner, Resolume -->
<script type="module" src="${SITE}packages/midi/element.js"></script>
<oav-controller profile="${p.id}" midi-out="${out}" readout></oav-controller>
<!-- Windows: midi-out="loopMIDI" · let the visitor pick a port: midi-out="ask" -->`,
  };
}

const KW = new Set(['import', 'from', 'const', 'let', 'await', 'export', 'return', 'new', 'function', 'if']);
/** A small highlighter for these snippets (HTML + JS): comments, strings, tags, keywords. Escapes as it goes. */
export function hl(code) {
  let out = '', i = 0, m;
  const re = /(<!--[\s\S]*?-->|\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(<\/?[a-z][\w-]*)|\b([A-Za-z_]\w*)\b/g;
  while ((m = re.exec(code))) {
    out += esc(code.slice(i, m.index));
    if (m[1]) {
      const prev = m.index ? code[m.index - 1] : '\n';
      if (m[1].startsWith('//') && !/\s/.test(prev)) { out += esc(m[1].slice(0, 2)); re.lastIndex = m.index + 2; i = re.lastIndex; continue; }  // https://
      out += `<span class="tc">${esc(m[1])}</span>`;
    } else if (m[2]) out += `<span class="ts">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tt">${esc(m[3])}</span>`;
    else if (KW.has(m[4])) out += `<span class="tk">${m[4]}</span>`;
    else out += esc(m[4]);
    i = re.lastIndex;
  }
  return out + esc(code.slice(i));
}
