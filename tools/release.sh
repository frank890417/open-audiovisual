#!/usr/bin/env bash
# release — the one way to put this repo on openaudiovisual.com (GitHub Pages serves main).
#
#   tools/release.sh "what this release is"      # build, test, commit, stamp, push main, verify live
#   tools/release.sh --dry-run                    # build and test only: no commit, no push
#   tools/release.sh "…" --no-push                # everything up to the push, then stop
#
# Why a script: the order matters and every hand-run slip has broken the site once.
#   • a generator rewrites pages without ?v= stamps; pushed like that, a visitor keeps the
#     old JS for 4 hours under new HTML (2026-10-15, the controller gallery);
#   • sitemap lastmod comes from git, so it is only right after the commit that carries the
#     sources (a merge regenerated before its commit left two pages without a date);
#   • tests piped into `| tail` exit 0 even when they fail.
# So: generators → tests → commit → generators again (lastmod converges in one round) →
# stamp → commit → tests → push → wait for Pages → tools/seo-check.sh on the live site.
#
# Undo a release: git revert <first>^..<last> && tools/release.sh "revert …"
# (the commits of one release are printed at the end).
set -euo pipefail
cd "$(dirname "$0")/.."

MSG=""; DRY=0; PUSH=1
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --no-push) PUSH=0 ;;
    -*) echo "unknown flag $a" >&2; exit 2 ;;
    *) MSG="$a" ;;
  esac
done
[[ $DRY == 1 || -n "$MSG" ]] || { echo 'usage: tools/release.sh "message" [--no-push] | --dry-run' >&2; exit 2; }

say() { printf '\n▸ %s\n' "$*"; }
LOG=$(mktemp -t oav-release.XXXXXX)
trap 'rm -f "$LOG"' EXIT

build_all() {
  # every tools/build-*.mjs, home last (it also writes llms-full.txt from the others' output)
  local b
  for b in $(ls tools/build-*.mjs | grep -v build-home.mjs) tools/build-home.mjs; do
    node "$b" > "$LOG" 2>&1 || { cat "$LOG"; echo "✗ $b failed" >&2; exit 1; }
  done
}
check_all() {
  local b
  for b in tools/build-*.mjs; do
    node "$b" --check > "$LOG" 2>&1 || { cat "$LOG"; echo "✗ $b --check: generated files are stale" >&2; exit 1; }
  done
}
run_tests() {
  local rc=0
  node --test tests/*.test.js > "$LOG" 2>&1 || rc=$?
  grep -E '^# (tests|pass|fail)' "$LOG" || true
  [[ $rc == 0 ]] || { grep -E '^not ok' "$LOG" | head -20; echo "✗ tests failed" >&2; exit 1; }
}
guard_untracked() {
  # untracked files are committed only where the site lives; anything else stops the release
  local bad
  bad=$(git ls-files --others --exclude-standard | grep -vE '^(\.github|assets|check|controllers|docs|embed|examples|p5|packages|tests|tools|webtoe|zh)/|^[^/]+\.(html|txt|xml|webmanifest|ico|svg|png|md|json)$' || true)
  [[ -z "$bad" ]] || { echo "✗ untracked files outside the site, not committing:" >&2; echo "$bad" >&2; exit 1; }
}
commit_if_changed() {
  guard_untracked
  git add -A
  if git diff --cached --quiet; then return 0; fi
  git commit -q -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  echo "  commit $(git rev-parse --short HEAD) · $1"
}

if [[ $DRY == 0 ]]; then
  [[ ! -f .git/MERGE_HEAD && ! -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]] || { echo "✗ a merge is in progress: commit it first" >&2; exit 1; }
  say "origin/main must already be in this branch"
  git fetch -q origin
  git merge-base --is-ancestor origin/main HEAD || { echo "✗ origin/main has commits this branch lacks: git merge origin/main, then rerun" >&2; exit 1; }
  # START = what the site serves now. Commits made on this branch before the script ran are part of the release too,
  # so the log and the undo range start at origin/main, not at HEAD (0.4.0 printed c71ff42.. and left two commits out).
  START=$(git rev-parse origin/main)
fi

say "generators"; build_all
say "tests"; run_tests
[[ $DRY == 1 ]] && { check_all; say "dry run: built and tested, nothing committed"; git status --short | head -20; exit 0; }

say "commit"; commit_if_changed "$MSG"
say "generators again (lastmod after the commit)"; build_all
commit_if_changed "sitemap and llms: lastmod after the release commit"
say "stamp"; node tools/stamp-version.mjs > "$LOG" 2>&1 || { cat "$LOG"; exit 1; }; tail -1 "$LOG"
commit_if_changed "stamp module URLs for the deploy: $MSG"
say "check and tests on what will ship"; check_all; run_tests

if [[ $PUSH == 0 ]]; then say "--no-push: stopped before the push"; git log --oneline "$START"..HEAD; exit 0; fi

say "push main"
git push origin HEAD:main
SHA=$(git rev-parse HEAD); st=""
say "waiting for GitHub Pages to deploy ${SHA:0:7}"
for i in $(seq 1 60); do
  st=$(gh run list --repo frank890417/open-audiovisual --workflow pages-build-deployment --limit 5 \
        --json headSha,status,conclusion --jq ".[] | select(.headSha==\"$SHA\") | \"\(.status) \(.conclusion)\"" 2>/dev/null | head -1)
  case "$st" in
    "completed success") echo "  deployed"; break ;;
    completed*) echo "✗ Pages deploy: $st" >&2; exit 1 ;;
  esac
  sleep 10
done
[[ "$st" == "completed success" ]] || { echo "✗ Pages did not finish in 10 minutes ($st)" >&2; exit 1; }

say "live checks (Cloudflare items marked [CF] wait for the dashboard)"
bash tools/seo-check.sh https://openaudiovisual.com --no-repo || true

say "this release"
git log --oneline "$START"..HEAD
echo "undo: git revert ${START:0:7}..${SHA:0:7} && tools/release.sh \"revert\""
