// /embed/controller/ — <oav-controller> for places that only allow an <iframe>.
//
//   <iframe src="https://openaudiovisual.com/embed/controller/?profile=akai-lpd8&readout"
//           width="720" height="240" style="border:0" allow="midi" title="AKAI LPD8"></iframe>
//
// Every event the element fires is posted to the parent page:
//   { source: 'openav', v: 1, type: 'control' | 'noteon' | 'noteoff' | 'connect' | 'disconnect' | 'status'
//                               | 'profilechange' | 'ready' | 'error' | 'values', frame, detail }
// and the parent may send commands back (anything else is ignored):
//   { target: 'openav', type: 'set', id, value, note?, quiet? }   { target: 'openav', type: 'ingest', bytes: [0xb0, 70, 64] }
//   { target: 'openav', type: 'press' | 'release', id, velocity?, note? }   { target: 'openav', type: 'reset' }
//   { target: 'openav', type: 'profile', profile: 'korg-nanokontrol2' }     { target: 'openav', type: 'layout', layout: 'stack' }
//   { target: 'openav', type: 'get' }   → replies { source: 'openav', type: 'values', detail: { profile, values } }
// ?origin=https://your.site restricts both directions to that page. `allow="midi"` lets hardware / midi-out work in the frame.

import '../../packages/midi/element.js?v=32849c5';
import { parseEmbedOptions, toParent, fromParent, EMBED_ATTRS, EMBED_EVENTS } from '../../packages/midi/embed.js?v=32849c5';

const q = new URLSearchParams(location.search);
const o = parseEmbedOptions(q);
const el = document.getElementById('ctl');
const root = document.documentElement;

if (o.lang) root.lang = o.lang;
if (o.bg) root.style.setProperty('--bg', o.bg);
const pad = Number(q.get('pad'));
if (q.has('pad') && pad >= 0 && pad <= 64) root.style.setProperty('--pad', pad + 'px');
for (const a of EMBED_ATTRS) if (q.has(a)) el.setAttribute(a, q.get(a));
if (!q.has('midi-out') && q.has('midiout')) el.setAttribute('midi-out', q.get('midiout'));
if (o.theme === 'light' && !o.bg) root.style.setProperty('--bg', '#f2f0ea');

const parent = window.parent !== window ? window.parent : null;
const target = o.origin || '*';
const post = (type, detail) => { if (parent) parent.postMessage(toParent(type, detail, { frame: o.frame }), target); };

for (const name of EMBED_EVENTS) el.addEventListener(name, (e) => post(name, e.detail));

addEventListener('message', async (e) => {
  if (e.source !== parent || (o.origin && e.origin !== o.origin)) return;
  const cmd = fromParent(e.data);
  if (!cmd) return;
  await el.ready;
  try {
    switch (cmd.type) {
      case 'set': el.set(cmd.id, cmd.value, { note: cmd.note, quiet: cmd.quiet }); break;
      case 'press': el.press(cmd.id, cmd.velocity, cmd.note); break;
      case 'release': el.release(cmd.id, cmd.note); break;
      case 'ingest': el.ingest(cmd.bytes); break;
      case 'reset': el.reset(); break;
      case 'profile': el.profile = cmd.profile; break;
      case 'layout': el.layout = cmd.layout; break;
      case 'get': post('values', { profile: el.status?.profile, values: el.values() }); break;
    }
  } catch (err) { post('error', { message: String(err && err.message ? err.message : err), command: cmd.type }); }
});

window.openav = { element: el };
