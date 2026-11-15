// tools/usage-ledger.mjs: the pure parts of the weekly "who uses this" row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { externalRepos, countWorks, countVerified, toMarkdown } from '../tools/usage-ledger.mjs';

test('code search: the owner\'s own repositories are not "someone else uses it"', () => {
  const hits = [{ repository: { nameWithOwner: 'frank890417/open-audiovisual' } }, { repository: { nameWithOwner: 'frank890417/notes' } },
    { repository: { nameWithOwner: 'someone/show' } }, { repository: { nameWithOwner: 'someone/show' } }];
  assert.deepEqual(externalRepos(hits), { total: 1, repos: ['someone/show'] });
  assert.deepEqual(externalRepos(null), { total: 0, repos: [] });
});

test('works: how many, and how many by someone other than the author', () => {
  assert.deepEqual(countWorks({ works: [{ by: 'Che-Yu Wu' }, { by: 'Miffy' }] }), { works: 2, byOthers: 1 });
});

test('verified: only a hardware entry in the log counts', () => {
  assert.equal(countVerified([{ verifications: [{ method: 'virtual' }] }, { verifications: [{ method: 'hardware' }] }, {}]), 1);
});

test('the Markdown row has as many cells as its header', () => {
  const row = { date: '2026-11-15', github: { stars: 1, forks: 0, views14d: null, clones14d: 2 }, code: { total: 0 }, jsdelivr: { month: null }, madeWith: { works: 2, byOthers: 0 }, controllers: { verified: 0 } };
  const [head, , line] = toMarkdown(row, true).split('\n');
  assert.equal(head.split('|').length, line.split('|').length);
  assert.match(line, /–/);
});
