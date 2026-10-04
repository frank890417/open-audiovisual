// The backstage feed only auto-connects where a relay can actually be reached:
// an http page (localhost or the LAN). On https the browser blocks ws:// and a
// published site has no relay, so it stays quiet unless given a wss:// url.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMonitorUrl, MonitorFeed } from '../packages/monitor/index.js';

test('http page → ws://<host>:7457', () => {
  assert.equal(defaultMonitorUrl({ protocol: 'http:', hostname: '192.168.1.20' }), 'ws://192.168.1.20:7457');
});

test('https page → no default (no mixed-content error, no relay on a public site)', () => {
  assert.equal(defaultMonitorUrl({ protocol: 'https:', hostname: 'openaudiovisual.com' }), null);
});

test('no url → connect() is a no-op; an explicit wss url is kept', () => {
  const quiet = new MonitorFeed({ url: null });
  assert.equal(quiet.url, null);
  quiet.connect();
  assert.equal(quiet.ws, null);
  assert.equal(new MonitorFeed({ url: 'wss://show.example:7457' }).url, 'wss://show.example:7457?role=stage');
});
