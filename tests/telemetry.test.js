// Usage telemetry, as documented in packages/midi/telemetry.js and packages/midi/README.md:
// one anonymous hit per page, never from dev/LAN hosts or the project's own site,
// always switchable off, and the site's GA tag only on the site's own pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { quietHost, telemetryAllowed, hitUrl, hostOrigin, track, MEASUREMENT_ID } from '../packages/midi/telemetry.js';
import { parseEmbedOptions } from '../packages/midi/embed.js';
import { GA_SNIPPET, GA_ID } from '../tools/site/chrome.mjs';

test('quiet hosts: localhost, LAN, the project site', () => {
  for (const h of ['localhost', 'app.localhost', 'mac.local', '127.0.0.1', '192.168.1.20', '10.0.0.5', '172.20.3.4', '[::1]', 'openaudiovisual.com', 'webtoe.openaudiovisual.com', ''])
    assert.equal(quietHost(h), true, h);
  for (const h of ['cheyuwu.com', 'lab.cheyuwu.com', 'example.org', '172.32.0.1', 'codepen.io'])
    assert.equal(quietHost(h), false, h);
});

test('allowed only on http(s), not when switched off, not under DNT / GPC', () => {
  const ok = { protocol: 'https:', host: 'example.org' };
  assert.equal(telemetryAllowed(ok), true);
  assert.equal(telemetryAllowed({ ...ok, flag: false }), false);
  assert.equal(telemetryAllowed({ ...ok, dnt: '1' }), false);
  assert.equal(telemetryAllowed({ ...ok, gpc: true }), false);
  assert.equal(telemetryAllowed({ protocol: 'file:', host: '' }), false);
});

test('the hit carries the documented params and nothing about the page beyond its origin', () => {
  const u = new URL(hitUrl({ event: 'oav_embed_load', params: { oav_kind: 'element', oav_profile: 'akai-lpd8', oav_host: 'https://example.org' }, cid: '1.2', sid: 2, origin: 'https://example.org' }));
  assert.equal(u.searchParams.get('tid'), MEASUREMENT_ID);
  assert.equal(u.searchParams.get('en'), 'oav_embed_load');
  assert.equal(u.searchParams.get('dl'), 'https://example.org/');
  assert.equal(u.searchParams.get('ep.oav_kind'), 'element');
  assert.equal(u.searchParams.get('ep.oav_profile'), 'akai-lpd8');
  assert.ok(u.searchParams.get('ep.oav_version'));
  assert.equal(u.searchParams.get('dt'), null);
});

test('iframe reports its parent page origin, other kinds their own', () => {
  const g = { location: { origin: 'https://openaudiovisual.com', ancestorOrigins: ['https://blog.example', 'https://x.example'] }, document: { referrer: 'https://y.example/a?b' } };
  assert.equal(hostOrigin('iframe', g), 'https://blog.example');
  assert.equal(hostOrigin('element', g), 'https://openaudiovisual.com');
  assert.equal(hostOrigin('iframe', { location: { origin: 'https://openaudiovisual.com' }, document: { referrer: 'https://y.example/a?b' } }), 'https://y.example');
});

test('track() is a no-op outside a browser', () => {
  assert.equal(track('oav_embed_load', { oav_kind: 'headless', oav_profile: 'x' }), false);
});

test('telemetry attribute / query: on unless "off"', () => {
  assert.equal(parseEmbedOptions({}).telemetry, true);
  assert.equal(parseEmbedOptions({ telemetry: 'off' }).telemetry, false);
  assert.equal(parseEmbedOptions(new URLSearchParams('telemetry=0')).telemetry, false);
  assert.equal(parseEmbedOptions({ telemetry: 'on' }).telemetry, true);
});

test('site GA: same id as the embed hits, on every example page, never in the iframe embed', () => {
  assert.equal(GA_ID, MEASUREMENT_ID);
  for (const d of fs.readdirSync('examples')) {
    const f = `examples/${d}/index.html`;
    if (fs.existsSync(f)) assert.ok(fs.readFileSync(f, 'utf8').includes(GA_SNIPPET), f);
  }
  assert.ok(!fs.readFileSync('embed/controller/index.html', 'utf8').includes('googletagmanager'));
  assert.ok(fs.readFileSync('embed/controller/index.html', 'utf8').includes('data-oav-kind="iframe"'));
});
