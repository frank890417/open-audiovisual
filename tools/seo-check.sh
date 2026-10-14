#!/usr/bin/env bash
# seo-check — can crawlers and AI assistants read, trust and cite this site? Rerunnable, read-only (GET/HEAD only).
#
#   tools/seo-check.sh                         # the live site, https://openaudiovisual.com
#   tools/seo-check.sh http://localhost:8467   # a local `node serve.js 8467`
#   tools/seo-check.sh BASE --no-repo          # skip the repository checks (generators --check, npm test)
#
# Nine checks (spec: "OAV 官網 GEO／SEO／AEO 健檢與實作規格" §9.2). Each prints PASS / FAIL / SKIP, with the
# number it measured. A FAIL carries a tag that says who can fix it:
#   [CF]  needs a Cloudflare dashboard change (the owner): AI-crawler policy, Email Obfuscation, Always Use HTTPS
#   [EX]  waits for the examples workstream (static pages for examples/NN-*)
#   [P5]  waits for the /p5/ page workstream
#   [GH]  needs GitHub Pages setting
# Exit status: 0 when nothing FAILs, 1 otherwise. Checks that cannot mean anything locally (crawler policy,
# the http→https redirect, Cloudflare's obfuscation) say SKIP when BASE is localhost.

BASE="${1:-https://openaudiovisual.com}"
[[ "$BASE" == --* ]] && { BASE="https://openaudiovisual.com"; set -- "$BASE" "$@"; }
BASE="${BASE%/}"
REPO_CHECKS=1; for a in "$@"; do [[ "$a" == "--no-repo" ]] && REPO_CHECKS=0; done
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL=0; [[ "$BASE" =~ ^https?://(localhost|127\.0\.0\.1)(:|/|$) ]] && LOCAL=1
SITE=https://openaudiovisual.com
UA="oav-seo-check/1.0"

pass=0; fail=0; skip=0
say() { # status tag text
  case "$1" in PASS) pass=$((pass+1));; FAIL) fail=$((fail+1));; SKIP) skip=$((skip+1));; esac
  printf '%-5s %-5s %s\n' "$1" "$2" "$3"
}
get()  { curl -s -A "$UA" "$BASE$1"; }
code() { curl -s -o /dev/null -A "${2:-$UA}" -w '%{http_code}' "$BASE$1"; }
count() { grep -c "$1" 2>/dev/null || true; }
# a sitemap url (https://openaudiovisual.com/…) read from BASE instead, so a local run checks local files
rebase() { echo "${1/#$SITE/$BASE}"; }

printf 'seo-check  %s  (%s)\n\n' "$BASE" "$([[ $LOCAL == 1 ]] && echo local || echo live)"

# ---- 1. AI crawlers see what robots.txt promises (policy A: every crawler welcome → all 200)
if [[ $LOCAL == 1 ]]; then
  say SKIP '[CF]' "1  AI crawler policy: a local server does not run Cloudflare's bot rules"
else
  bad=""
  for ua in "ClaudeBot/1.0" "anthropic-ai" "Bytespider" "Amazonbot" "cohere-ai" "OAI-SearchBot" "Claude-SearchBot" "PerplexityBot" "ChatGPT-User" "Claude-User"; do
    c=$(code / "$ua"); [[ "$c" != 200 ]] && bad="$bad $ua=$c"
  done
  if [[ -z "$bad" ]]; then say PASS '' "1  AI crawlers: all 10 user agents get 200, as robots.txt says"
  else say FAIL '[CF]' "1  AI crawlers blocked while robots.txt welcomes them:$bad  (Cloudflare → Security → Bots / AI Crawl Control)"; fi
fi

# ---- 2. Cloudflare Email Obfuscation must not rewrite p5@x.y.z in code
if [[ $LOCAL == 1 ]]; then
  obf=$(get /docs/ | count 'email protected\|cdn-cgi/l/email-protection'); ver=$(get /docs/ | grep -o 'p5@[0-9][0-9.]*' | head -1)
  if [[ "$obf" == 0 && -n "$ver" ]]; then say PASS '' "2  email fence: /docs/ keeps $ver, 0 obfuscated strings (local: only the repo-side email_off fence is tested)"
  else say FAIL '' "2  email fence: obfuscated=$obf, p5 version string='${ver:-missing}'"; fi
else
  bad=""
  for p in /docs/ /zh/docs/ /controllers/akai-lpd8/; do
    n=$(get "$p" | count 'email protected\|cdn-cgi/l/email-protection'); [[ "$n" != 0 ]] && bad="$bad $p=$n"
  done
  ver=$(get /docs/ | grep -o 'p5@[0-9][0-9.]*' | head -1)
  if [[ -z "$bad" && -n "$ver" ]]; then say PASS '' "2  email obfuscation: 0 rewritten strings, /docs/ keeps $ver"
  else say FAIL '[CF]' "2  email obfuscation rewrites code ($bad ); p5 version in /docs/: '${ver:-missing}'  (Cloudflare → Scrape Shield → Email Address Obfuscation: off)"; fi
fi

# ---- 3. http → https
if [[ $LOCAL == 1 || "$BASE" != https://* ]]; then
  say SKIP '[CF]' "3  http→https: not applicable here"
else
  out=$(curl -s -o /dev/null -A "$UA" -w '%{http_code} %{redirect_url}' "http://${BASE#https://}/")
  if [[ "$out" == 301*https://* ]]; then say PASS '' "3  http→https: $out"
  else say FAIL '[CF]' "3  http://${BASE#https://}/ answers '$out', want 301 → https  (Cloudflare → SSL/TLS → Edge Certificates → Always Use HTTPS)"; fi
fi

# ---- 4. sitemap: well-formed, every url answers 200, lastmod where git has history
sm=$(get /sitemap.xml)
nloc=$(printf '%s' "$sm" | count '<loc>'); nlm=$(printf '%s' "$sm" | count '<lastmod>')
okxml=1; if command -v xmllint >/dev/null; then printf '%s' "$sm" | xmllint --noout - 2>/dev/null || okxml=0; fi
bad=""
if [[ "$nloc" -gt 0 ]]; then
  while read -r u; do c=$(code "$(rebase "$u" | sed "s#^$BASE##")"); [[ "$c" != 200 ]] && bad="$bad ${u#$SITE}=$c"; done < <(printf '%s' "$sm" | grep -o '<loc>[^<]*' | sed 's/<loc>//')
fi
# /p5/ is rendered by GitHub Pages' Jekyll; a plain static server has no such page
[[ $LOCAL == 1 ]] && bad="${bad// \/p5\/=404/}"
if [[ "$nloc" -ge 40 && "$okxml" == 1 && -z "$bad" && "$nlm" -ge $((nloc - 6)) ]]; then say PASS '' "4  sitemap: $nloc urls, $nlm with lastmod, all answer 200"
else say FAIL '' "4  sitemap: $nloc urls, $nlm lastmod, xml ok=$okxml, non-200:${bad:- none}"; fi

# ---- 5. every example page has a description and a canonical
miss=""; n=0
while read -r u; do
  [[ "$u" == */examples/*/ ]] || continue
  n=$((n+1)); h=$(get "$(rebase "$u" | sed "s#^$BASE##")")
  d=$(printf '%s' "$h" | count 'name="description"'); c=$(printf '%s' "$h" | count 'rel="canonical"')
  [[ "$d" -ge 1 && "$c" -ge 1 ]] || miss="$miss ${u##*/examples/}"
done < <(printf '%s' "$sm" | grep -o '<loc>[^<]*' | sed 's/<loc>//')
if [[ "$n" -gt 0 && -z "$miss" ]]; then say PASS '' "5  examples: all $n pages have a description and a canonical"
elif [[ "$n" == 0 ]]; then say FAIL '[EX]' "5  examples: no examples/NN-*/ urls in sitemap.xml"
else say FAIL '[EX]' "5  examples: $(echo $miss | wc -w | tr -d ' ')/$n pages lack a description or a canonical: $(echo $miss | cut -c1-110)…"; fi

# ---- 6. llms.txt is fresh, generated, and complete
en=$(get /llms.txt); zh=$(get /zh/llms.txt); full=$(get /llms-full.txt)
a=$(printf '%s' "$en" | count '13-score-director'); b=$(printf '%s' "$en" | count 'raw.githubusercontent.com')
first=$(printf '%s' "$en" | head -1); zc=$(code /zh/llms.txt)
ndetail=$(printf '%s' "$en" | count '/controllers/[a-z0-9-]*/)')
tags=$(printf '%s' "$full" | grep -c '<table\|<picture\|<div ')
if [[ "$first" == "# open-audiovisual" && "$a" -ge 1 && "$b" == 0 && "$zc" == 200 && "$ndetail" -ge 20 && "$tags" == 0 ]]; then
  say PASS '' "6  llms.txt: heading ok, 13-score-director listed, 0 GitHub-raw links, $ndetail controller pages, zh/llms.txt 200, llms-full.txt has no HTML noise"
else say FAIL '' "6  llms.txt: first line '$first', 13-score-director=$a, raw links=$b, controller pages=$ndetail, zh/llms.txt=$zc, html tags in llms-full=$tags"; fi

# ---- 7. real icon files, a manifest, and a custom 404
bad=""; for f in /favicon.ico /favicon.svg /apple-touch-icon.png /site.webmanifest /assets/icons/icon-192.png; do c=$(code $f); [[ "$c" != 200 ]] && bad="$bad $f=$c"; done
if [[ -z "$bad" ]]; then say PASS '' "7a icons: favicon.ico, favicon.svg, apple-touch-icon.png, site.webmanifest, icon-192.png all 200"
else say FAIL '' "7a icons missing:$bad"; fi
s=$(code /nonexistent-xyz/); nf=$(get /nonexistent-xyz/)
if [[ "$s" == 404 && "$nf" == *'This page is not here'* && "$nf" == *'name="robots" content="noindex"'* && "$nf" != *'GitHub Pages'* ]]; then say PASS '' "7b 404: a missing url answers 404 with the site's own noindex page, in both languages"
else say FAIL '[GH]' "7b 404: status $s, custom page=$([[ "$nf" == *'This page is not here'* ]] && echo yes || echo no)  (404.html is in the repo; it needs a deploy)"; fi

# ---- 8. /p5/ is a real page of the site, not Jekyll's default theme
if [[ $LOCAL == 1 && "$(code /p5/)" == 404 ]]; then
  say SKIP '[P5]' "8  /p5/: rendered by GitHub Pages' Jekyll from p5/README.md; a plain local server has no such page"
else
  p=$(get /p5/); j=$(printf '%s' "$p" | count 'Jekyll'); h=$(printf '%s' "$p" | grep -c 'og:url" content="http://')
  if [[ "$j" == 0 && "$h" == 0 ]]; then say PASS '' "8  /p5/: no Jekyll generator, og:url is https"
  else say FAIL '[P5]' "8  /p5/: Jekyll mentions=$j, http:// og:url=$h  (waits for the built /p5/ page)"; fi
fi

# ---- 9. the repository: generators are current, tests pass
if [[ "$REPO_CHECKS" == 1 && -f "$HERE/package.json" ]]; then
  out=""; ok=1
  for g in home docs controllers webtoe; do
    if ! o=$(cd "$HERE" && node "tools/build-$g.mjs" --check 2>&1); then ok=0; out="$out build-$g(stale)"; fi
  done
  t=$(cd "$HERE" && node --test tests/*.test.js 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ')
  [[ "$t" == *"# fail 0"* ]] || ok=0
  if [[ $ok == 1 ]]; then say PASS '' "9  repository: build-home/docs/controllers/webtoe --check are current; tests: $t"
  else say FAIL '' "9  repository:$out tests: $t"; fi
else
  say SKIP '' "9  repository checks skipped (--no-repo)"
fi

# ---- extra: robots.txt names the sitemap and llms; the home head is complete
r=$(get /robots.txt)
if [[ "$r" == *"Sitemap: $SITE/sitemap.xml"* && "$r" == *"llms.txt"* && "$r" != *'Disallow: /'$'\n'* ]]; then say PASS '' "+  robots.txt: Sitemap line, llms pointers, nothing disallowed"
else say FAIL '' "+  robots.txt: missing the Sitemap line or llms pointers, or disallows /"; fi
h=$(get /)
miss=""; for needle in 'rel="canonical"' 'hreflang="zh-Hant"' 'property="og:image:alt"' 'rel="apple-touch-icon"' 'rel="manifest"' 'application/ld+json' '"@id":"https://cheyuwu.com/#person"'; do [[ "$h" == *"$needle"* ]] || miss="$miss $needle"; done
if [[ -z "$miss" ]]; then say PASS '' "+  home <head>: canonical, hreflang, og:image:alt, icons, manifest, JSON-LD with the Person @id"
else say FAIL '' "+  home <head> lacks:$miss"; fi

printf '\n%d pass, %d fail, %d skip\n' "$pass" "$fail" "$skip"
[[ $fail == 0 ]]
