// "Was I run directly?" — the check every command in tools/ makes before it does anything (tools/site/is-main.mjs).
// build-home.mjs and build-docs.mjs compared import.meta.url with `file://${process.argv[1]}`, export-controller.mjs with
// new URL(import.meta.url).pathname: on Windows neither ever matched, so they exited 0 having done nothing (issue #8).
// Nobody here has a Windows machine, so the Windows case is read with path.win32 and { windows: true } on this one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain } from '../tools/site/is-main.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELPER = pathToFileURL(path.join(ROOT, 'tools/site/is-main.mjs')).href;

// the two checks it replaced, as they were written
const oldTemplate = (url, argv1) => url === `file://${argv1}`;
const oldPathname = (url, argv1, p = path) => p.resolve(argv1) === new URL(url).pathname;

test('a Windows path with spaces: the old checks never match, isMain does', () => {
  const argv1 = 'C:\\Users\\Ana Gu\\open audiovisual\\tools\\build-home.mjs';
  const url = 'file:///C:/Users/Ana%20Gu/open%20audiovisual/tools/build-home.mjs';   // what Node gives that file on Windows
  assert.equal(pathToFileURL(argv1, { windows: true }).href, url, 'the URL is the one Node makes');
  assert.equal(oldTemplate(url, argv1), false, 'file://${argv1}: backslashes and a space');
  assert.equal(oldPathname(url, argv1, path.win32), false, '.pathname: /C:/… and %20');
  assert.equal(isMain(url, argv1, { windows: true }), true);
  assert.equal(isMain(url, 'c:\\Users\\Ana Gu\\open audiovisual\\tools\\build-docs.mjs', { windows: true }), false, 'another file is not this one');
  assert.equal(isMain(url, 'tools\\build-home.mjs', { windows: true }), false, 'a relative path resolves against the working directory, not the URL');
  assert.equal(isMain(url, undefined, { windows: true }), false, 'no argv[1]: node -e, a REPL, an import');
  assert.equal(isMain(url, '', { windows: true }), false);
});

test('this system\'s own paths: a space, relative, through a symlink', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oav is main '));
  try {
    const file = path.join(dir, 'cli.mjs');
    fs.writeFileSync(file, '');
    const real = fs.realpathSync(file);                       // macOS: /var/… is /private/var/…, and Node runs the real path
    const url = pathToFileURL(real).href;
    assert.match(url, /%20/);
    assert.equal(oldTemplate(url, file), false, 'the space is %20 in the URL');
    assert.equal(isMain(url, file), true, 'absolute');
    assert.equal(isMain(url, path.relative(process.cwd(), file)), true, 'relative to the working directory');
    assert.equal(isMain(url, path.join(dir, 'other.mjs')), false);
    const link = path.join(dir, 'link to cli.mjs');
    let linked = true;
    try { fs.symlinkSync(file, link); } catch (e) { if (e.code !== 'EPERM') throw e; linked = false; }   // Windows: a file symlink needs Developer Mode
    if (linked) assert.equal(isMain(url, link), true, 'through a symlink');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('in a real process: run, it is main; imported, it is not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oav is main '));
  try {
    fs.writeFileSync(path.join(dir, 'cli.mjs'), `import { isMain } from ${JSON.stringify(HELPER)};\nexport const main = isMain(import.meta.url);\nif (main) console.log('main');\n`);
    fs.writeFileSync(path.join(dir, 'user.mjs'), `import { main } from './cli.mjs';\nconsole.log(main ? 'main' : 'imported');\n`);
    assert.equal(execFileSync(process.execPath, [path.join(dir, 'cli.mjs')], { encoding: 'utf8' }).trim(), 'main');
    assert.equal(execFileSync(process.execPath, ['cli.mjs'], { cwd: dir, encoding: 'utf8' }).trim(), 'main', 'started with a relative path');
    assert.equal(execFileSync(process.execPath, [path.join(dir, 'user.mjs')], { encoding: 'utf8' }).trim(), 'imported');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the commands from issue #8 run from a folder whose name has a space', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oav-cli-'));
  const repo = path.join(dir, 'open audiovisual');
  try {
    fs.symlinkSync(ROOT, repo, 'junction');                  // a junction on Windows (no privilege needed), a plain symlink elsewhere
    const run = (...a) => execFileSync(process.execPath, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    // --check reads and compares, writes nothing; before the fix both printed nothing at all
    for (const f of ['build-home.mjs', 'build-docs.mjs']) {
      let out = '';
      try { out = run(path.join(repo, 'tools', f), '--check'); } catch (e) { out = String(e.stdout) + String(e.stderr); }   // stale pages exit 1: still ran
      assert.match(out, /up to date|stale/, `${f} ran`);
    }
    const into = path.join(dir, 'out dir');
    run(path.join(repo, 'tools/export-controller.mjs'), 'akai-lpd8', '--to', 'qxi', '--out', into);
    assert.ok(fs.existsSync(path.join(into, 'akai-lpd8.qxi')), 'export-controller wrote its file');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------ nobody writes the old checks again
const BAD = [
  [/`file:\/\/\$\{[^`]*argv/, 'a file URL made by pasting file:// before argv[1]'],
  [/['"]file:\/\/['"]\s*\+\s*process\.argv/, 'a file URL made by pasting file:// before argv[1]'],
  [/new URL\(\s*import\.meta\.url\s*\)\.pathname/, 'new URL(import.meta.url).pathname as a file path'],
];
const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');   // whole-line comments may quote the old lines
const offences = (src) => BAD.filter(([re]) => re.test(code(src))).map(([, why]) => why);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.(mjs|js|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('the scan catches the old lines', () => {
  assert.deepEqual(offences('if (import.meta.url === `file://${process.argv[1]}`) {'), [BAD[0][1]]);
  assert.deepEqual(offences("if (import.meta.url === 'file://' + process.argv[1]) {"), [BAD[1][1]]);
  assert.deepEqual(offences('if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) process.exit(main());'), [BAD[2][1]]);
  assert.deepEqual(offences('if (isMain(import.meta.url)) {'), []);
  assert.deepEqual(offences("const here = new URL('./data/', import.meta.url);"), [], 'a URL next to the module is fine');
});

test('no command in tools/ or in a package\'s Node scripts checks "run directly" the old way', () => {
  const nodeScripts = walk(path.join(ROOT, 'packages')).filter((f) => /process\.argv\[1\]/.test(fs.readFileSync(f, 'utf8')));
  assert.ok(nodeScripts.length >= 4, 'the bridges, the relay and the MCP server are found');
  for (const f of [...walk(path.join(ROOT, 'tools')), ...nodeScripts, path.join(ROOT, 'serve.js')]) {
    const src = fs.readFileSync(f, 'utf8'), rel = path.relative(ROOT, f);
    assert.deepEqual(offences(src), [], rel);
    // in tools/, argv[1] is read in one place: every command asks isMain()
    if (rel.startsWith('tools' + path.sep) && rel !== path.join('tools', 'site', 'is-main.mjs')) assert.doesNotMatch(src, /process\.argv\[1\]/, `${rel}: use isMain(import.meta.url) from tools/site/is-main.mjs`);
  }
});
