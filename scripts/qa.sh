#!/usr/bin/env bash
set -u
fail=0
check() { # description, command that should print nothing
  out=$(eval "$2" 2>/dev/null)
  if [ -n "$out" ]; then echo "FAIL: $1"; echo "$out" | head -20; fail=1; fi
}
SRC="apps/web/src apps/web/public apps/web/index.html README.md design.md techstack.md architecture.md"
check "non-ASCII characters (em dash, en dash, emoji)" "grep -rnIP '[^\\x00-\\x7F]' $SRC"
check "gradients or purple" "grep -rniE 'gradient|purple|violet|indigo' apps/web/src apps/web/public apps/web/index.html"
check "pill buttons" "grep -rniE 'rounded-full|border-radius: *9999|rounded-\\[999' apps/web/src"
check "banned copy" "grep -rniE 'revolutioni|seamless|cutting-edge|next-generation|unlock|leverage|empower|supercharge|game-chang|effortless|elevate|harness|delve|tapestry' apps/web/src apps/web/public apps/web/index.html"
check "AI tags or fake social proof" "grep -rniE 'made with ai|built with ai|powered by ai|testimonial|trusted by' apps/web/src apps/web/public apps/web/index.html"
check "scroll animation or cursor effects" "grep -rniE 'IntersectionObserver|scroll-timeline|animation-timeline|cursor: *url|mousemove' apps/web/src"
if [ -d apps/web/dist ]; then
  [ -f apps/web/dist/404.html ] || { echo "FAIL: dist/404.html missing"; fail=1; }
  [ -f apps/web/dist/robots.txt ] || { echo "FAIL: robots.txt missing"; fail=1; }
  [ -f apps/web/dist/sitemap.xml ] || { echo "FAIL: sitemap.xml missing"; fail=1; }
  [ -f apps/web/dist/favicon.svg ] || { echo "FAIL: favicon.svg missing"; fail=1; }
  dups=$(find apps/web/dist -name '*.html' -exec grep -ohP '(?<=<title>)[^<]*' {} \; | sort | uniq -d)
  [ -z "$dups" ] || { echo "FAIL: duplicate titles:"; echo "$dups"; fail=1; }
  dh1=$(find apps/web/dist -name '*.html' -exec grep -ohP '(?<=<h1)[^>]*>[^<]*' {} \; | sort | uniq -d)
  [ -z "$dh1" ] || { echo "FAIL: duplicate H1:"; echo "$dh1"; fail=1; }
  nodesc=$(find apps/web/dist -name '*.html' -exec grep -L 'name="description"' {} \;)
  [ -z "$nodesc" ] || { echo "FAIL: missing meta description:"; echo "$nodesc"; fail=1; }
fi
[ $fail -eq 0 ] && echo "QA passed" || exit 1
