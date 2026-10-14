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
| 6 | every generator with `--check`, then the tests again | anything stale or red |
| 7 | `git push origin HEAD:main` | |
| 8 | wait for the `pages-build-deployment` run of that commit | the deploy fails or takes over 10 minutes |
| 9 | `tools/seo-check.sh https://openaudiovisual.com --no-repo` | reported, not fatal: `[CF]` items wait for the Cloudflare dashboard |

## Why the order is fixed

- **Stamps.** The generators write pages without `?v=` stamps. GitHub Pages caches JavaScript for 4 hours and HTML for 10
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

- Cloudflare settings (AI crawler policy, Email Obfuscation, Always Use HTTPS, cache rules): dashboard only.
- Search Console sitemap resubmission and URL Inspection, Bing import, IndexNow submission.
- Posting on GitHub issues or anywhere public.
