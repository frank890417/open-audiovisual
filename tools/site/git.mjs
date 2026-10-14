// When did a page's source last change, according to git? That date is the sitemap's <lastmod>: an honest
// one (a page edited today and a page untouched for a month must differ), never the time of the build.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const memo = new Map();

/**
 * Date (YYYY-MM-DD) of the last commit that touched a file or directory, or the newest over a list.
 * '' when git cannot say: no git, or nothing committed yet (a new, uncommitted file gets no lastmod
 * rather than an invented one).
 */
export function lastmodOf(rel) {
  const list = Array.isArray(rel) ? rel : [rel];
  const dates = list.map((r) => {
    if (!memo.has(r)) {
      let out = '';
      try { out = execFileSync('git', ['log', '-1', '--format=%cs', '--', r], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* no git */ }
      memo.set(r, /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : '');
    }
    return memo.get(r);
  }).filter(Boolean);
  return dates.sort().pop() || '';
}
