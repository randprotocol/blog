#!/usr/bin/env bash
# Build the blog and ship it to the randprotocol.org droplet, where nginx serves it at /blog/
# (server/nginx-blog.conf, installed once; see DEPLOY.md).
#
#   ./deploy.sh              # build, then rsync dist/ to the droplet
#   ./deploy.sh --dry-run    # build, then list what rsync would change; nothing is written
#
# The droplet's address comes from the environment, as for the main site: WEB if it is set
# (randprotocol.org's server/deploy-site.sh), else RANDPROTOCOL_DROPLET_IP (its DEPLOY.md, set
# in ~/.zshrc). This repository is public, so no address is written here as a default.
#
# The files go as the `deploy` user, over ssh with whatever key your ssh agent or ~/.ssh/config
# offers for that host, as the main site's deploy does. Nothing here needs root, and nginx needs
# no reload: a deploy only replaces static files.
set -euo pipefail
cd "$(dirname "$0")"

WEB=${WEB:-${RANDPROTOCOL_DROPLET_IP:-}}
if [ -z "$WEB" ]; then
    echo "deploy.sh: no droplet address. Set RANDPROTOCOL_DROPLET_IP (or WEB) and run again, e.g." >&2
    echo "    RANDPROTOCOL_DROPLET_IP=<origin ip> ./deploy.sh" >&2
    exit 1
fi

# The blog's own directory, outside the main site's webroot: the main site deploys with
# `rsync --delete` into /var/www/randprotocol/, which would remove a blog/ placed inside it.
# nginx uses BLOG_ROOT as `root` for /blog/, so the files live in $BLOG_ROOT/blog/.
BLOG_ROOT=${BLOG_ROOT:-/var/www/randprotocol-blog}

RSYNC_FLAGS=(-a --delete)
case "${1:-}" in
    "") ;;
    -n | --dry-run) RSYNC_FLAGS+=(--dry-run --itemize-changes) ;;
    *) echo "usage: ./deploy.sh [--dry-run]" >&2; exit 2 ;;
esac

pnpm build

# Refuse to ship a build that is not the /blog build: every page must load its assets from
# /blog/_astro/. A build with the base missing would work nowhere once it is under /blog/.
[ -f dist/index.html ] || { echo "deploy.sh: dist/index.html is missing; the build did not produce a site." >&2; exit 1; }
if ! grep -q '"/blog/_astro/' dist/index.html || grep -rqE '(href|src)="/_astro/' dist --include='*.html'; then
    echo "deploy.sh: dist/ was not built for /blog/ (asset URLs are not under /blog/_astro/). Not deploying." >&2
    exit 1
fi

rsync "${RSYNC_FLAGS[@]}" dist/ "deploy@$WEB:$BLOG_ROOT/blog/"

if [ "${1:-}" = "" ]; then
    echo "deployed to $WEB:$BLOG_ROOT/blog/ — check with: curl -sI https://randprotocol.org/blog/ | head -1"
else
    echo "dry run against $WEB:$BLOG_ROOT/blog/ — nothing was written"
fi
