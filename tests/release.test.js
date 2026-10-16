// tools/release.sh on a release that crosses midnight (0.8.0, 2026-10-16): the release commit is made yesterday, the stamp
// commit today. The stamp commit touches every example, docs and controller page, so their sitemap <lastmod> (the date of
// the last commit that touched them) becomes today; the old script had already written the sitemap and stopped, and the
// last test round (tests/site.test.js, "lastmod is real") failed. The script now generates and re-stamps once more after
// the stamp commit.
//
// The test runs the script itself in a throwaway clone of HEAD, with a `git` in front of PATH that dates every commit
// yesterday except the stamp commit (today) and with RELEASE_SKIP_TESTS=1 (the script would otherwise run this test again).
// RELEASE_SH=<an older tools/release.sh> runs the same check against it: that is how the red run of the old script is made.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('release.sh across midnight: the sitemap lastmod settles after the stamp commit', { timeout: 600000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oav-release-'));
  const work = path.join(tmp, 'clone');
  const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: work, encoding: 'utf8', ...opts });
  execFileSync('git', ['clone', '-q', '--local', '--no-hardlinks', ROOT, work]);
  const git = (...a) => execFileSync('git', a, { cwd: work, encoding: 'utf8' }).trim();
  git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'test');
  // the script under test (and the stamp tool it calls) from this working tree
  fs.copyFileSync(process.env.RELEASE_SH || path.join(ROOT, 'tools/release.sh'), path.join(work, 'tools/release.sh'));
  fs.copyFileSync(path.join(ROOT, 'tools/stamp-version.mjs'), path.join(work, 'tools/stamp-version.mjs'));
  // something to release: one handbook line (every example, docs and controller page shares the stamp commit)
  const intro = path.join(work, 'docs/introduction.md');
  fs.appendFileSync(intro, '\nA line added by tests/release.test.js.\n');
  // a git that dates commits: yesterday, except the stamp commit
  const yesterday = new Date(Date.now() - 36 * 3600e3).toISOString();
  const today = new Date().toISOString();
  const real = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const bin = path.join(tmp, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/bash
if [[ " $* " == *" commit "* ]]; then
  if [[ "$*" == *"stamp module URLs"* ]]; then export GIT_COMMITTER_DATE="${today}" GIT_AUTHOR_DATE="${today}"; else export GIT_COMMITTER_DATE="${yesterday}" GIT_AUTHOR_DATE="${yesterday}"; fi
fi
exec ${real} "$@"
`, { mode: 0o755 });
  const clean = { ...process.env }; delete clean.NODE_TEST_CONTEXT;   // a nested `node --test` inside a test run reports nothing and exits 0
  const env = { ...clean, PATH: `${bin}:${process.env.PATH}`, RELEASE_SKIP_TESTS: '1' };
  const r = sh('bash', ['tools/release.sh', 'test release', '--no-push'], { env });
  assert.equal(r.status, 0, 'the release script ran to the end\n' + (r.stdout + r.stderr).slice(-1500));
  // what the last round of a real release runs: the sitemap's lastmod is the last commit of each page's sources
  const t = sh('node', ['--test', 'tests/site.test.js'], { env: { ...clean, PATH: `${bin}:${process.env.PATH}` } });
  const bad = (t.stdout.match(/^not ok .*$/gm) || []).join('\n');
  assert.match(t.stdout, /^# tests \d+/m, 'site.test.js ran');
  assert.equal(t.status, 0, 'tests/site.test.js on what the release would push:\n' + bad + '\n' + (t.stdout.match(/error: .*$/gm) || []).slice(0, 3).join('\n'));
  if (!process.env.KEEP) fs.rmSync(tmp, { recursive: true, force: true }); else console.log('KEPT ' + tmp);
});
