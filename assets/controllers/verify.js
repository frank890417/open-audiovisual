// /controllers/verify/ — joins the page to VerifySession. Everything that decides anything is in
// packages/midi/verify-session.js; this file only moves bytes in and writes text out.
// Nothing asks for MIDI until the Connect button is pressed, and only the Read button asks for SysEx.
// window.oavVerify is there for devtools and scripted checks, like window.openav in the examples.

import '../../packages/midi/element.js?v=dd4a4d59';
import { PROFILES } from '../../packages/midi/profiles/index.js?v=060a5708';
import { Midi, matchProfile, pickPort, loadProfile, DEVICE_INQUIRY, parseDeviceInquiry } from '../../packages/midi/index.js?v=060a5708';
import { VerifySession, applyVerification, verificationReport, messageText, portMethod } from '../../packages/midi/verify-session.js?v=060a5708';

const T = JSON.parse(document.getElementById('ctl-i18n').textContent);
const S = T.s, E = T.end, U = T.setup;
const $ = (id) => document.getElementById(id);
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
const byId = new Map(PROFILES.map((p) => [p.id, p]));
const QUIET = 260, QUIET_ENCODER = 650;   // ms without a message before a hand counts as stopped; an encoder gets time for a turn back

let midi = null, session = null, raw = null, simulated = false, portName = '', timer = 0, unlisten = null, offUi = null, result = null;
const ctl = $('vf-ctl');

// ------------------------------------------------------------------ setup
const params = new URLSearchParams(location.search);
if (T.files[params.get('profile')]) $('vf-model').value = params.get('profile');

function status(text, bad = false) { $('vf-status').textContent = text; if (bad) $('vf-status').setAttribute('data-bad', ''); else $('vf-status').removeAttribute('data-bad'); }

/** The chosen profile. An imported one is fetched the first time it is picked. */
async function chosen() {
  const id = $('vf-model').value;
  if (!byId.has(id)) byId.set(id, await loadProfile(id));
  return byId.get(id);
}

async function fillPorts() {
  const sel = $('vf-port'), list = midi.devices(), p = await chosen();
  sel.replaceChildren(...list.map((d) => Object.assign(document.createElement('option'), { value: d.name, textContent: d.name })));
  sel.hidden = !list.length;
  $('vf-start').disabled = !list.length;
  if (!list.length) return status(U.noPorts, true);
  const best = pickPort(list, p) || list.find((d) => matchProfile(d.name, [p]));
  if (best) sel.value = best.name;
  status(best ? fill(U.found, { port: best.name }) : U.pickPort);
}

$('vf-connect').addEventListener('click', async () => {
  status(U.asking);
  midi = new Midi({ filterOut: null, echoWindow: 0 });   // every port: a virtual one is how this page is tried without a device
  if (!(await midi.enable())) { midi = null; return status(U.noMidi, true); }
  midi.onDevices(() => { if (!session) fillPorts(); });
  $('vf-connect').textContent = U.connected;
  fillPorts();
});
$('vf-model').addEventListener('change', () => { if (midi) fillPorts(); });

// ------------------------------------------------------------------ the run
async function begin({ sim }) {
  simulated = sim;
  raw = await chosen();
  session = new VerifySession(raw, { only: $('vf-scope').value });
  if (!session.steps.length) { session = null; return status(U.nothing, true); }
  portName = sim ? '' : $('vf-port').value;
  $('vf-setup').hidden = true; $('vf-end').hidden = true; $('vf-run').hidden = false;
  $('vf-sim-tag').hidden = !sim; $('vf-wrong').hidden = !sim;
  ctl.setAttribute('profile', raw.id);
  ctl.ready.then(() => {
    offUi?.();
    // in the simulator the on-screen control is the hand; on hardware the screen only shows, it never answers
    offUi = sim ? ctl.controller.onMessage(({ bytes, source }) => { if (source === 'ui') hear(bytes); }) : null;
    ctl.view?.clearMarks(); paint();
  });
  unlisten?.();
  unlisten = midi && !sim ? midi.listen((data, port) => { if (port.name === portName) { ctl.ingest(Array.from(data)); hear(data); } }) : null;
  $('vf-run').scrollIntoView({ block: 'start' });
}
$('vf-form').addEventListener('submit', (e) => { e.preventDefault(); begin({ sim: false }); });
$('vf-sim').addEventListener('click', () => begin({ sim: true }));

const promptFor = (st) => {
  const name = st.control.label && st.control.label !== st.control.id ? st.control.label : st.control.id;
  if (st.key) return fill(S.prompt[st.key === 'low' ? 'keysLow' : 'keysHigh'], { name });
  return fill(S.prompt[st.control.type] || S.prompt.button, { name });
};
const expectText = (st) => messageText(st.expected);
const MARK = { match: 'ok', corrected: 'fixed', mismatch: 'bad', absent: 'bad' };

function paintMarks() {
  const v = ctl.view; if (!v) return;
  v.clearMarks();
  for (const s of session.steps.slice(0, session.at)) { const m = session.markOf(s.id); v.mark(s.id, m ? MARK[m] : 'skip'); }
  if (session.current) v.mark(session.current.id, 'now');
}

function paint() {
  paintMarks();
  const st = session.current, c = session.counts();
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 100;
  $('vf-bar').style.width = pct + '%';
  $('vf-bar').parentElement.setAttribute('aria-valuenow', String(pct));
  $('vf-count').textContent = fill(S.count, { n: Math.min(c.done + 1, c.total), total: c.total, ok: c.match, fixed: c.corrected, bad: c.mismatch + c.absent });
  if (!st) return end();
  $('vf-prompt').textContent = promptFor(st);
  $('vf-expected').textContent = expectText(st);
  if (session.state !== 'differs') { $('vf-diff').hidden = true; $('vf-actions').hidden = false; }
  $('vf-back').disabled = session.at === 0;
}

function hear(bytes) {
  const r = session?.feed(bytes);
  if (!r || r.kind === 'ignored') return;
  $('vf-heard').textContent = r.kind === 'differs' ? messageText(r.got) : messageText(session.current.expected);
  if (r.kind === 'differs') return showDiff(r);
  clearTimeout(timer);
  timer = setTimeout(settle, session.current.control.type === 'encoder' ? QUIET_ENCODER : QUIET);
}
function settle() {
  const r = session.settle();
  if (!r) return;
  if (r.kind === 'differs') return showDiff(r);
  $('vf-heard').textContent = '–';
  paint();
}

function showDiff(r) {
  clearTimeout(timer);
  const st = r.step;
  $('vf-diff').hidden = false; $('vf-actions').hidden = true;
  $('vf-was').textContent = messageText(st.expected) + (r.encoding ? ` · ${st.control.relative ?? 'absolute'}` : '');
  $('vf-got').textContent = messageText(r.got) + (r.encoding ? ` · ${r.got.relative === false ? 'absolute' : r.got.relative}` : '');
  const owner = r.owner ? (r.owner.label || r.owner.id) : '';
  $('vf-diff-title').textContent = r.encoding ? S.diffEncoding : r.owner ? fill(r.confirmed ? S.diffOwnerDone : S.diffOwner, { owner }) : S.diffNew;
  $('vf-accept').hidden = !!(r.owner && r.confirmed);
  $('vf-accept').textContent = r.owner ? fill(S.acceptSwap, { owner }) : S.accept;
  if (ctl.view) ctl.view.mark(st.id, 'bad');
}

const act = (id, fn) => $(id).addEventListener('click', () => { if (session && fn()) { clearTimeout(timer); $('vf-heard').textContent = '–'; paint(); } });
act('vf-accept', () => session.accept());
act('vf-retry', () => session.retry());
act('vf-reject', () => session.reject());
act('vf-skip', () => session.skip());
act('vf-absent', () => session.absent());
act('vf-back', () => session.back());
$('vf-finish').addEventListener('click', () => end());
$('vf-wrong').addEventListener('click', () => hear([0xbf, 119, 10]));   // a message no shipped control claims: what a real difference looks like

// ------------------------------------------------------------------ the end
const today = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
function guessEnv() {
  const ua = navigator.userAgent, ch = /(?:Edg|Chrome|Firefox|Version)\/([\d]+)/.exec(ua);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  const os = /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  return { browser: browser ? `${browser} ${ch ? ch[1] : ''}`.trim() : '', os };
}
const meta = () => ({
  date: today(), by: $('vf-by').value.trim(), method: portMethod(portName, { simulated, attested: $('vf-attest').checked }),
  firmware: $('vf-firmware').value.trim(), os: $('vf-os').value.trim(), browser: $('vf-browser').value.trim(), port: portName, tool: T.tool,
});

function end() {
  clearTimeout(timer);
  $('vf-run').hidden = true; $('vf-end').hidden = false;
  const c = session.counts(), env = guessEnv();
  if (!$('vf-os').value) $('vf-os').value = env.os;
  if (!$('vf-browser').value) $('vf-browser').value = env.browser;
  $('vf-tally').replaceChildren(...[[E.tally.match, c.match], [E.tally.corrected, c.corrected], [E.tally.mismatch, c.mismatch], [E.tally.absent, c.absent], [E.tally.skipped, c.total - c.match - c.corrected - c.mismatch - c.absent]].map(([k, v]) => {
    const d = document.createElement('div'); d.innerHTML = '<dd></dd><dt></dt>'; d.firstChild.textContent = v; d.lastChild.textContent = k; return d;
  }));
  const rows = Object.entries(session.results()).filter(([, r]) => typeof r === 'object' && r.got);
  $('vf-diffs-wrap').hidden = !rows.length;
  $('vf-diffs').replaceChildren(...rows.map(([id, r]) => {
    const tr = document.createElement('tr');
    for (const text of [id, E.tally[r.result], messageText(r.was || session.p.controls.find((x) => x.id === id)), messageText(r.got)]) { const td = document.createElement('td'); td.textContent = text; tr.appendChild(td); }
    return tr;
  }));
  $('vf-attest-row').hidden = simulated;
  $('vf-fw-row').hidden = simulated || !midi;
  refresh();
  $('vf-end').scrollIntoView({ block: 'start' });
}

/** The output, rebuilt whenever a field changes: nothing is offered that does not pass validateProfile. */
function refresh() {
  if (!session) return;
  const m = meta();
  $('vf-method').textContent = E.method[m.method];
  $('vf-method').dataset.method = m.method;
  const needs = m.method === 'hardware' ? ['by', 'firmware', 'os', 'browser'] : ['by'];
  const missing = needs.filter((k) => !m[k]);
  result = missing.length ? null : applyVerification(raw, session, m);
  const problems = missing.length ? [fill(E.missing, { fields: missing.map((k) => E[k === 'by' ? 'byShort' : k]).join(' · ') })] : result.problems;
  $('vf-problems').hidden = !problems.length;
  $('vf-problems').textContent = problems.join(' ');
  const ok = !problems.length;
  for (const id of ['vf-download', 'vf-copy']) $(id).disabled = !ok;
  $('vf-issue').href = `${T.repo}/issues/new?title=${encodeURIComponent(`Verified: ${raw.name} (${raw.id})`)}&body=${encodeURIComponent(verificationReport(raw, session, m))}`;
  $('vf-pr').href = `${T.repo}/edit/main/${T.dir}/${T.files[raw.id]}`;
}
for (const id of ['vf-by', 'vf-firmware', 'vf-os', 'vf-browser', 'vf-attest']) $(id).addEventListener('input', refresh);

// the one place on this page that asks for SysEx, and only when pressed: the Universal Device Inquiry names the firmware
$('vf-read-fw').addEventListener('click', async () => {
  const say = (text) => { $('vf-fw-status').textContent = text; };
  if (!midi || !(await midi.requestSysex())) return say(E.readDenied);
  const out = midi.outputFor(portName) || pickPort(midi.outputs, raw);
  if (!out) return say(E.readNoOut);
  let off = null;
  const late = setTimeout(() => { off?.(); say(E.readNoReply); }, 1500);
  off = midi.listen((data) => {
    const r = parseDeviceInquiry(data); if (!r) return;
    clearTimeout(late); off();
    $('vf-firmware').value = r.text; refresh(); say(fill(E.readDone, { version: r.text }));
  });
  midi.sendSysex(DEVICE_INQUIRY, { output: out });
});

const json = () => JSON.stringify(result.profile, null, 1) + '\n';
$('vf-download').addEventListener('click', () => {
  if (!result) return;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json()], { type: 'application/json' })), download: T.files[raw.id].split('/').pop() });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('vf-copy').addEventListener('click', async () => {
  if (!result) return;
  try { await navigator.clipboard.writeText(json()); $('vf-copy').textContent = E.copied; setTimeout(() => { $('vf-copy').textContent = E.copy; }, 1400); } catch { /* the Download button still works */ }
});
$('vf-again').addEventListener('click', () => {
  session = null; unlisten?.(); unlisten = null; offUi?.(); offUi = null;
  $('vf-end').hidden = true; $('vf-setup').hidden = false;
  if (midi) fillPorts();
  $('vf-setup').scrollIntoView({ block: 'start' });
});

addEventListener('beforeunload', (e) => { if (session && session.marks.size) e.preventDefault(); });   // a long run is not worth losing to a stray ⌘R

window.oavVerify = { get session() { return session; }, feed: hear, settle, get result() { return result; }, refresh };
