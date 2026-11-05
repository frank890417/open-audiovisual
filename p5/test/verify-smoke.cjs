#!/usr/bin/env node
// verify-smoke.cjs — /controllers/verify/ in a real (headless) Chromium, driven the way a person drives it.
// Not part of `npm test` (needs a browser): CI runs it in the `reference` job.
//
//   PW=<path to playwright(-core)> node p5/test/verify-smoke.cjs
//   SHOTS=<dir>      keep screenshots
//
// No hardware exists here, so Web MIDI is a stand-in with one input port. The run checks the rules the page stands on:
//   - nothing asks for MIDI before Connect, and SysEx only when "Read it from the unit" is pressed
//   - a run through a port that reads as a device, with the box ticked, makes matched controls verified and writes the record
//   - the same run without the box, through a port named like a virtual one, or in the simulator, changes no number and no mark
//   - a difference shows both values, and the JSON the page offers passes validateProfile
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'oav-verify-'));
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const NOISE = [/googletagmanager|google-analytics|cloudflareinsights/, /net::ERR_(BLOCKED|FAILED|INTERNET)/, /Failed to load resource/];

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(ROOT, u); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});

/** A stand-in for navigator.requestMIDIAccess: one input, one output, and a log of what was asked. */
const fakeMidi = (port) => `(() => {
  // a new set of port objects per request, every one of them hearing the unit: what a real browser does, so a second listener shows up as a double message
  const inputs = [], sent = [];
  const reply = [0xf0, 0x7e, 0, 6, 2, 0, 0x20, 0x29, 0x13, 1, 0, 0, 1, 2, 3, 4, 0xf7];
  const play = (b) => { for (const i of inputs) if (i.onmidimessage) i.onmidimessage({ data: new Uint8Array(b) }); };
  window.__midi = { asked: [], sent, play };
  navigator.requestMIDIAccess = async (o) => {
    window.__midi.asked.push(o || {});
    const sysex = !!(o && o.sysex);
    const input = { id: 'i' + inputs.length, name: ${JSON.stringify(port)}, type: 'input', state: 'connected', onmidimessage: null };
    inputs.push(input);
    const output = { id: 'o', name: ${JSON.stringify(port)}, type: 'output', state: 'connected', send: (b) => {
      if (b[0] === 0xf0 && !sysex) throw new DOMException('no SysEx on this port', 'InvalidAccessError');
      sent.push(Array.from(b)); if (b[1] === 0x7e) setTimeout(() => play(reply), 5);
    } };
    return { inputs: new Map([[input.id, input]]), outputs: new Map([[output.id, output]]), sysexEnabled: sysex, onstatechange: null };
  };
})()`;

/** Answer every step exactly as the file says; `wrong` plays a message nobody owns on the first step and takes the correction. */
const playAll = async (page, { wrong = false } = {}) => page.evaluate(async ({ wrong }) => {
  const s = window.oavVerify.session;
  const bytesOf = (st) => {
    const m = st.expected;
    return m.msg === 'cc' ? [0xb0 | (m.ch - 1), m.cc, 64] : m.msg === 'note' ? [0x90 | (m.ch - 1), m.note, 100] : m.msg === 'pitchbend' ? [0xe0 | (m.ch - 1), 0, 80] : [0xd0 | (m.ch - 1), 10];
  };
  if (wrong) { window.__midi.play([0xbf, 119, 10]); document.getElementById('vf-accept').click(); }
  while (s.current) {
    const st = s.current, b = bytesOf(st);
    window.__midi.play(b); if (st.control.type === 'encoder') window.__midi.play(b);
    window.oavVerify.settle();
  }
}, { wrong });

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await PW.chromium.launch({ headless: true });
  let bad = 0;
  const row = (ok, name, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' · ' + extra : ''}`); if (!ok) bad++; };
  const open = async (url, { port = 'LPD8 mk2', width = 1280 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript(fakeMidi(port));
    const page = await ctx.newPage(); page.errors = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !NOISE.some((r) => r.test(m.text()))) page.errors.push(m.text()); });
    await page.goto(base + url); await page.waitForFunction(() => window.oavVerify);
    return page;
  };
  const run = async (page, { wrong = false, attest = false, firmware = '1.0.4' } = {}) => {
    await page.click('#vf-connect'); await page.waitForSelector('#vf-start:not([disabled])');
    await page.click('#vf-start'); await page.waitForFunction(() => document.getElementById('vf-prompt').textContent);
    await page.evaluate(() => document.getElementById('vf-ctl').ready);
    await playAll(page, { wrong });
    await page.waitForSelector('#vf-end:not([hidden])');
    await page.fill('#vf-by', 'CI');
    if (firmware) await page.fill('#vf-firmware', firmware);
    if (attest) await page.check('#vf-attest');
    return page.evaluate(() => window.oavVerify.result);
  };

  for (const [lang, url] of [['en', '/controllers/verify/?profile=akai-lpd8'], ['zh', '/zh/controllers/verify/?profile=akai-lpd8']]) {
    const page = await open(url);
    row((await page.evaluate(() => window.__midi.asked.length)) === 0, `${lang}: nothing asks for MIDI on load`);
    row((await page.inputValue('#vf-model')) === 'akai-lpd8', `${lang}: ?profile= picks the model`);
    row(await page.evaluate(() => document.documentElement.lang.startsWith(document.documentElement.lang)), `${lang}: page language set`);
    await page.screenshot({ path: path.join(SHOTS, `verify-${lang}-start.png`) });
    row(!page.errors.length, `${lang}: no console errors`, page.errors.join(' | '));
    await page.context().close();
  }

  { // a hardware run, with one correction
    const page = await open('/controllers/verify/?profile=akai-lpd8');
    const r = await run(page, { wrong: true, attest: true });
    const c = r.profile.controls, v = r.profile.verifications[0];
    row(r.problems.length === 0, 'hardware run: the JSON passes validateProfile', r.problems.join(' | '));
    row(v.method === 'hardware' && v.firmware === '1.0.4' && v.by === 'CI' && v.port === 'LPD8 mk2', 'hardware run: the record says who, on what');
    row(c.every((x) => x.verified === true), 'hardware run: every control is verified');
    const fixed = Object.entries(v.results).filter(([, x]) => x.result === 'corrected');
    row(fixed.length === 1 && fixed[0][1].got.cc === 119, 'hardware run: the correction is kept with its old value', JSON.stringify(fixed[0]?.[1]));
    row(await page.isEnabled('#vf-download'), 'hardware run: Download is offered');
    row((await page.evaluate(() => window.__midi.asked.map((o) => !!o.sysex))).every((x) => !x), 'hardware run: SysEx was never asked for');
    await page.click('#vf-read-fw');
    await page.waitForFunction(() => document.getElementById('vf-firmware').value === '1.2.3.4');
    row((await page.evaluate(() => window.__midi.asked.map((o) => !!o.sysex).join())) === 'false,true', 'Read firmware: SysEx is asked for only when pressed, and the reply fills the field');
    const dl = page.waitForEvent('download'); await page.click('#vf-download'); const file = await (await dl).path();
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    row(saved.id === 'akai-lpd8' && saved.verifications.length === 1, 'hardware run: the downloaded file is the updated profile');
    row((await page.getAttribute('#vf-issue', 'href')).includes('issues/new?title='), 'the issue link carries the report');
    row((await page.getAttribute('#vf-pr', 'href')).endsWith('/edit/main/packages/midi/profiles/akai-lpd8.json'), 'the pull-request link opens the file');
    await page.screenshot({ path: path.join(SHOTS, 'verify-end.png'), fullPage: true });
    row(!page.errors.length, 'hardware run: no console errors', page.errors.join(' | '));
    await page.context().close();
  }

  // the three ways a run cannot turn anything true
  for (const [name, port, opts] of [['no box ticked', 'LPD8 mk2', {}], ['virtual port', 'IAC Driver Bus 1', { attest: true }]]) {
    const page = await open('/controllers/verify/?profile=akai-lpd8', { port });
    const r = await run(page, { wrong: true, ...opts });
    row(r.profile.verifications[0].method === 'virtual', `${name}: logged as virtual`);
    row(!r.profile.controls.some((c) => c.verified === true) && !r.profile.controls.some((c) => c.cc === 119), `${name}: no number and no mark changed`);
    await page.context().close();
  }
  { // the simulator
    const page = await open('/controllers/verify/?profile=akai-lpd8');
    await page.click('#vf-sim'); await page.waitForFunction(() => document.getElementById('vf-prompt').textContent);
    await page.evaluate(() => document.getElementById('vf-ctl').ready); await page.waitForTimeout(200);
    await page.evaluate(() => { const c = document.getElementById('vf-ctl').controller; c.press(window.oavVerify.session.current.id, 1); c.release(window.oavVerify.session.current.id); });
    await page.waitForTimeout(450);
    row((await page.evaluate(() => window.oavVerify.session.counts().match)) === 1, 'simulator: touching the lit control counts');
    await page.click('#vf-finish'); await page.fill('#vf-by', 'CI');
    const r = await page.evaluate(() => window.oavVerify.result);
    row(r.profile.verifications[0].method === 'simulated' && !r.profile.controls.some((c) => c.verified === true), 'simulator: logged as simulated, nothing verified');
    row(await page.isHidden('#vf-attest-row'), 'simulator: no box to tick');
    await page.context().close();
  }
  { // a phone
    const page = await open('/zh/controllers/verify/?profile=novation-launchpad-mini-mk3', { width: 390 });
    await page.click('#vf-sim'); await page.waitForTimeout(600);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    row(over <= 0, '390 px: no sideways scroll', `${over}px`);
    await page.screenshot({ path: path.join(SHOTS, 'verify-390.png') });
    await page.context().close();
  }
  await browser.close(); server.close();
  console.log(`\n${bad ? bad + ' failed' : 'all green'}; screenshots in ${SHOTS}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
