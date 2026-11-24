// Was this file started with `node <file>`, or imported by another module? The check every command in tools/ makes
// before it does anything, in one place.
//
//   import { isMain } from './site/is-main.mjs';
//   if (isMain(import.meta.url)) main(process.argv.slice(2));
//
// It compares the way Node made import.meta.url for the file it was asked to run: argv[1] resolved against the working
// directory, through its symlinks, as a file URL. The two hand-written checks this replaces never matched on Windows and
// so did nothing, exit 0, no output (issue #8):
//   import.meta.url === `file://${process.argv[1]}`              C:\Users\…\x.mjs is not file:///C:/Users/…/x.mjs, and a
//                                                                space is %20 in a URL on every system
//   path.resolve(process.argv[1]) === new URL(import.meta.url).pathname   /C:/Users/…, %20 again
// A symlinked checkout (macOS's /var is /private/var) also failed the plain path comparison: Node runs the real path.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @param {string} importMetaUrl  the module's import.meta.url
 * @param {string} [argv1]        the file node was asked to run (process.argv[1])
 * @param {{windows?: boolean}} [o]  read argv1 as a Windows path (default: this system's kind); the tests pass true on macOS
 * @returns {boolean}
 */
export function isMain(importMetaUrl, argv1 = process.argv[1], { windows = process.platform === 'win32' } = {}) {
  if (typeof importMetaUrl !== 'string' || typeof argv1 !== 'string' || !argv1) return false;
  const abs = (windows ? path.win32 : path.posix).resolve(argv1);
  const paths = [abs];
  try { paths.push(fs.realpathSync(abs)); } catch { /* not on this disk (a Windows path read on macOS), or gone */ }
  return paths.some((p) => pathToFileURL(p, { windows }).href === importMetaUrl);
}
