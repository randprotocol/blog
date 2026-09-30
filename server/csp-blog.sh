#!/usr/bin/env bash
# Print the Content-Security-Policy that fits the blog as built — the counterpart of
# randprotocol.org's server/csp-keypages.sh, for the day /blog/ is put under a policy.
# Nothing uses this today: the site sends a CSP on /account and /address only (DEPLOY.md).
#
#   pnpm build && server/csp-blog.sh [dist]
#
# It reads the built pages, so it needs a build with at least one post in it: two of the three
# inline scripts are on post pages only. The hashes change only when those scripts change
# (src/layouts/Layout.astro, src/layouts/PostDetails.astro, src/components/BackToTopButton.astro).
set -euo pipefail
cd "$(dirname "$0")/.."
DIST=${1:-dist}
[ -f "$DIST/index.html" ] || { echo "csp-blog.sh: $DIST/index.html not found; run pnpm build first." >&2; exit 1; }

if ! ls "$DIST"/posts/*/index.html >/dev/null 2>&1; then
    echo "csp-blog.sh: warning: no post pages in $DIST; the policy below lacks the two inline scripts that only post pages carry." >&2
fi

# sha256 of every executable inline <script> on any page, base64, as CSP wants it. JSON-LD
# blocks (type="application/ld+json") are data, never run, and need no hash.
hashes=$(python3 - "$DIST" <<'PY'
import base64, hashlib, pathlib, re, sys
seen = []
for page in sorted(pathlib.Path(sys.argv[1]).rglob("*.html")):
    html = page.read_text(encoding="utf-8")
    for m in re.finditer(r"<script(?![^>]*\ssrc=)([^>]*)>(.*?)</script>", html, flags=re.S):
        if "application/ld+json" in m.group(1):
            continue
        h = "'sha256-" + base64.b64encode(hashlib.sha256(m.group(2).encode("utf-8")).digest()).decode() + "'"
        if h not in seen:
            seen.append(h)
print(" ".join(seen))
PY
)

# script-src: the site's own modules, the inline scripts by hash, and WebAssembly for Pagefind.
# style-src 'unsafe-inline': KaTeX and Shiki lay out and colour with style attributes, and
#   Astro's view transitions add <style> elements; a hash cannot cover attributes.
# img-src data:: Pagefind's search icon is a data: SVG in its stylesheet.
# Everything else is same-origin: fonts, the search index (fetch), no frames, no workers.
printf "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' %s; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'\n" "$hashes"
