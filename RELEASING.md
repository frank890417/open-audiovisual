# Releasing open-audiovisual

openaudiovisual.com is GitHub Pages serving `main`, behind Cloudflare. A push to `main` is a deploy.
There is one way to do it:

```bash
tools/release.sh "what this release is"     # build, test, commit, stamp, push main, wait for Pages, check the live site
tools/release.sh --dry-run                   # build and test only
tools/release.sh "…" --no-push               # everything up to the push
```

## What the script does, in order

| step | command | stops the release when |
|---|---|---|
| 0 | `git fetch` and `git merge-base --is-ancestor origin/main HEAD` | `main` moved on: merge `origin/main` first |
| 1 | every `tools/build-*.mjs` (home last) | a generator throws |
| 2 | `node --test tests/*.test.js` | any test fails |
| 3 | commit (untracked files only inside the site's folders) | a stray file sits outside them |
| 4 | the generators again, commit if anything moved | (sitemap `lastmod` comes from git, so it is right only after the commit that carries the sources) |
| 5 | `node tools/stamp-version.mjs`, commit | |
| 5b | the generators and the same stamp again, commit if anything moved (up to 3 rounds) | `lastmod` does not settle. The stamp commit touches the pages, so on a release that crosses midnight their date is now today (`tests/release.test.js` runs this script in a clone with the stamp commit a day later) |
| 6 | every generator with `--check`, then the tests again | anything stale or red |
| 7 | `git push origin HEAD:main` | |
| 8 | wait for the `pages-build-deployment` run of that commit | the deploy fails or takes over 10 minutes |
| 9 | `tools/seo-check.sh https://openaudiovisual.com --no-repo` | reported, not fatal: `[CF]` items wait for the Cloudflare dashboard |

## Why the order is fixed

- **Stamps.** The generators write pages without `?v=` stamps. Browsers keep JavaScript for 4 hours (the zone's Cloudflare Browser Cache TTL, 14400 s, over GitHub Pages' own 600 s) and HTML for 10
  minutes, so new HTML with an unstamped module URL can run old JavaScript for hours. Stamping is always the last write
  before the push.
- **lastmod.** The sitemap's dates are the last commit of each page's sources. Regenerating before that commit (for example
  in the middle of a merge) writes no date; one more round after the commit settles it.
- **Exit codes.** `npm test | tail` exits with `tail`'s code. The script captures the test runner's own exit code.

## Undo

The script prints the commits of the release and the revert command:

```bash
git revert <first>..<last> && tools/release.sh "revert …"
```

## Not in the script (need a person)

- Cloudflare settings (AI crawler policy, Email Obfuscation, Always Use HTTPS, cache rules): dashboard or the `cf` CLI, by a person or with their go-ahead.
- Search Console sitemap resubmission and URL Inspection, Bing import, IndexNow submission.
- Posting on GitHub issues or anywhere public.

## Caching of the entry scripts

Pages outside this site load OAV by URLs without a stamp: `/p5/oav-p5.js` (the one line in a p5 sketch) and
`/packages/**/*.js` (`<oav-controller>`, `packages/midi/index.js`). Under the zone default they were kept 4 hours, so the
0.4.0 release (2026-10-15) still served 0.3.0 to that line until the file was purged by hand.

One Cloudflare cache rule (zone ruleset `http_request_cache_settings`, rule
`8f5df2025a4f4b0980f9a79feeadc8fa`, added 2026-10-15) covers them:

```
(http.request.uri.path eq "/p5/oav-p5.js")
or (starts_with(http.request.uri.path, "/packages/") and ends_with(http.request.uri.path, ".js") and http.request.uri.query eq "")
→ cache, edge TTL 60 s, browser TTL 60 s (override origin)
```

Measured right after: the rule asks for 60 s, but browsers get GitHub Pages' own `max-age=600` (it was 14400 before), so
a release reaches every sketch within about ten minutes; the edge copy is at most a minute old. Modules loaded with `?v=` are untouched.
In a hurry (a fix during a live class): purge the one file.

```bash
cf cache purge -z openaudiovisual.com --force --body '{"files":["https://openaudiovisual.com/p5/oav-p5.js"]}'
```

To check: `curl -sI https://openaudiovisual.com/p5/oav-p5.js | grep -iE 'cache-control|cf-cache-status|age'`.
To remove the rule: `cf rulesets rules delete <ruleset-id> 8f5df2025a4f4b0980f9a79feeadc8fa -z openaudiovisual.com`
(`cf rulesets entrypoint get http_request_cache_settings -z openaudiovisual.com` shows the ruleset id).

