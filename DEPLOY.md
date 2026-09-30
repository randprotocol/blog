# Deploying the blog

The blog is a static build served at <https://randprotocol.org/blog/> by the same
nginx, on the same droplet, as the main site (the randprotocol.org repository's
`DEPLOY.md` describes that machine). There are two parts:

1. **Once:** tell nginx where `/blog/` lives (`server/nginx-blog.conf`).
2. **Every time:** `./deploy.sh`, which builds and rsyncs `dist/`.

Nothing in this repository changes DNS or Cloudflare settings; `/blog/` is a path on a
host that is already served.

|              |                                                                   |
| ------------ | ----------------------------------------------------------------- |
| URL          | `https://randprotocol.org/blog/`                                  |
| Droplet      | the main site's; its address is `$RANDPROTOCOL_DROPLET_IP`        |
| Files        | `/var/www/randprotocol-blog/blog/`, owned by `deploy`             |
| nginx        | `location ^~ /blog/` in `/etc/nginx/sites-available/randprotocol` |
| Deploy       | `./deploy.sh` (`pnpm build`, then `rsync -a --delete`)            |
| Needs reload | only the one-time nginx change; never a deploy                    |

## Why the blog has its own directory

The main site deploys with `rsync -a --delete dist/ deploy@…:/var/www/randprotocol/`.
A `blog/` directory inside that webroot is not in the main site's `dist/`, so the next
deploy of the main site would delete it. The blog therefore lives beside the webroot, in
`/var/www/randprotocol-blog/blog/`, and nginx is given `root /var/www/randprotocol-blog`
for `/blog/`. The inner `blog/` is there so that the URI maps onto the path with `root`
and no `alias`.

## One-time setup

### 1. Create the directory

`/var/www` belongs to root, so the directory is made once with sudo and handed to
`deploy`:

```bash
ssh deploy@$RANDPROTOCOL_DROPLET_IP '
  sudo mkdir -p /var/www/randprotocol-blog/blog &&
  sudo chown -R deploy:deploy /var/www/randprotocol-blog'
```

### 2. Add the location blocks to the vhost

`server/nginx-blog.conf` holds the blocks: `location = /blog` (adds the slash) and
`location ^~ /blog/` with a nested `location /blog/_astro/`. They go **inside** the
`server { listen 443 … }` block of `/etc/nginx/sites-available/randprotocol`, before
`location / {`, next to the API locations.

```bash
scp server/nginx-blog.conf deploy@$RANDPROTOCOL_DROPLET_IP:/tmp/
ssh deploy@$RANDPROTOCOL_DROPLET_IP
# on the droplet:
sudo cp /etc/nginx/sites-available/randprotocol ~/randprotocol.vhost.bak-$(date +%Y%m%d)
sudo nano /etc/nginx/sites-available/randprotocol   # paste /tmp/nginx-blog.conf before `location / {`
sudo nginx -t && sudo systemctl reload nginx
```

Keep the backup out of `sites-enabled/`: nginx loads every file there, and a copy of
the vhost left in it is read as a second server block (the main `DEPLOY.md` records that
this has happened).

What the blocks do:

- `/blog` redirects to `/blog/`.
- `/blog/…` is served from `/var/www/randprotocol-blog/blog/…`. `try_files $uri $uri/ =404`
  serves a file, or a directory's `index.html`; a directory asked for without its slash
  (`/blog/posts/foo`) is redirected to `/blog/posts/foo/`.
- A missing page gets the blog's own `404.html` with status 404.
- `/blog/_astro/` (hashed CSS, JS and fonts) is sent with
  `Cache-Control: public, max-age=31536000, immutable`.
- Everything else (HTML, `rss.xml`, the sitemap, the Pagefind index, OG images) is sent
  with `Cache-Control: no-cache`, so a cache revalidates it and a deploy is visible at
  once.
- The vhost's four security headers are repeated in both blocks, because an `add_header`
  in a location replaces the server's set.

The prefix is `^~` so that no regex location in the vhost is tried for a `/blog/`
request. That keeps the key pages' CSP snippet, and anything added later, from taking
one.

## Content-Security-Policy

**Nothing has to be added for the blog.** The site sends a `Content-Security-Policy`
only from the two generated regex locations for `/account` and `/address`
(`server/nginx-csp-keypages.conf` in the main repository); there is no policy on the
server block, and on 2026-09-30 `https://randprotocol.org/` and `/docs/` answered with
no CSP header. The `/blog/` location matches neither regex, and `server/nginx-blog.conf`
sets no policy, so the blog is served without one, like the rest of the site.

The key pages' policy must **not** be copied onto `/blog/` as it stands. Served under
it, a post page logged these violations in Chrome:

| The blog uses                                                 | The key-page policy says                     | Result                                                       |
| ------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Three inline scripts (theme before paint; two on post pages)  | `script-src 'self'` plus that page's hashes  | Blocked: theme flash, no copy buttons, no heading links      |
| `style` attributes from KaTeX and Shiki; view-transition CSS  | `style-src 'self' …` without `unsafe-inline` | Blocked: KaTeX's layout and Shiki's colours are in them     |
| Pagefind's WebAssembly                                        | `'wasm-unsafe-eval'` is present              | Allowed                                                      |
| Fonts and KaTeX's stylesheet, all under `/blog/_astro/`       | `font-src 'self'`, `style-src 'self'`        | Allowed; the blog loads nothing from another host            |
| The search index, fetched from `/blog/pagefind/`              | `connect-src 'self'`                         | Allowed                                                      |
| Pagefind's search icon, a `data:` SVG in its stylesheet       | `img-src 'self' data:`                       | Allowed                                                      |
| Web workers                                                   | `worker-src 'self' blob:`                    | None used                                                    |

If `/blog/` is ever put under a policy, this is the one that fits it. It differs from
the key pages' in three places: its own script hashes, `'unsafe-inline'` in `style-src`,
and no third-party hosts.

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-fRtNdPvCfkUXTJuJAS13TT4OCVo62chpQl+2jD8e8+8=' 'sha256-IOFx3la5gcS0V8lz2gHca9rHsJvlyx7L7dWJoYIhUpc=' 'sha256-LaV9zRZTHlrnhvcfM5if9ZKBD+kTgTwZ50XzQr14GDo='; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

It would go in **both** blocks of `server/nginx-blog.conf`, as
`add_header Content-Security-Policy "…" always;`.

- The three hashes are the theme script in `src/layouts/Layout.astro`, the script in
  `src/layouts/PostDetails.astro` and the one in `src/components/BackToTopButton.astro`.
  They change only when those scripts are edited. `server/csp-blog.sh` prints the
  policy from a build, so run it after such an edit (with at least one post in the
  build, since two of the scripts are on post pages only).
- The JSON-LD block on each page is data, not a script that runs, and needs no hash.
- `img-src 'self' data:` assumes a post's images are in the repository. A post that
  embeds an image from another host would need that host added.

This policy was tested on 2026-09-30 by serving a build with it as a response header and
loading a post, the search page with a query, the home page followed by a click through
to a post, a tag page, the archive and the about page in headless Chrome: no violation
was reported and math, code colours, copy buttons, the theme switch and search all
worked.

## Deploy

```bash
./deploy.sh              # pnpm build, then rsync dist/ to the droplet
./deploy.sh --dry-run    # pnpm build, then list what rsync would change
```

`deploy.sh` needs the droplet's address in `RANDPROTOCOL_DROPLET_IP` (already exported
in `~/.zshrc` on the machine that deploys the main site) or in `WEB`, the name the main
site's `server/deploy-site.sh` uses. It stops with a message if neither is set. The
address is not written in this repository, which is public.

It connects as `deploy` with the key your ssh agent or `~/.ssh/config` offers for the
host, as the main site's deploy does. It then:

1. runs `pnpm build` (type-check, build, search index);
2. refuses to go on unless the pages load their assets from `/blog/_astro/`, so a build
   made without the base cannot be shipped;
3. runs `rsync -a --delete dist/ deploy@$WEB:/var/www/randprotocol-blog/blog/`.

`--delete` removes files on the droplet that are no longer in `dist/`, so a post that
was deleted or renamed goes away. nginx is not reloaded; it does not need to be.

`BLOG_ROOT` overrides `/var/www/randprotocol-blog`; if you change it, change `root` in
the nginx block to match.

## Verify

After the one-time setup and a deploy:

```bash
# The home page, and the slash redirect
curl -sI https://randprotocol.org/blog/  | head -1          # HTTP/2 200
curl -sI https://randprotocol.org/blog   | grep -i -E '^HTTP|^location'
#   HTTP/2 301, location: …/blog/

# HTML is revalidated, hashed assets are immutable
curl -sI https://randprotocol.org/blog/ | grep -i cache-control      # no-cache
asset=$(curl -s https://randprotocol.org/blog/ | grep -o '/blog/_astro/[^"]*\.css' | head -1)
curl -sI "https://randprotocol.org$asset" | grep -i -E '^HTTP|cache-control'
#   HTTP/2 200, cache-control: public, max-age=31536000, immutable

# The security headers are still there, and there is no CSP
curl -sI https://randprotocol.org/blog/ | grep -i -E 'x-content-type|referrer-policy|x-frame|strict-transport|content-security'

# The feed, the sitemap, the search index and the social image
for p in rss.xml sitemap-index.xml pagefind/pagefind.js og.png; do
  printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "https://randprotocol.org/blog/$p"
done

# A missing page: status 404, and the blog's own page
curl -s -o /dev/null -w '%{http_code}\n' https://randprotocol.org/blog/no-such-page/   # 404
curl -s https://randprotocol.org/blog/no-such-page/ | grep -o '<title>[^<]*</title>'  # 404 Not Found | Rand Protocol Blog

# A post, with and without the slash
curl -sI https://randprotocol.org/blog/posts/<slug>/ | head -1       # HTTP/2 200
curl -sI https://randprotocol.org/blog/posts/<slug>  | grep -i -E '^HTTP|^location'   # 301 to the slash form

# The main site is untouched
curl -sI https://randprotocol.org/ | head -1                         # HTTP/2 200
curl -sI https://randprotocol.org/account/ | grep -i -c content-security-policy   # 1
```

To check the origin without Cloudflare in the path, add
`--resolve randprotocol.org:443:$RANDPROTOCOL_DROPLET_IP` to any of these.

Before the first deploy the same checks can be made locally: `pnpm build && pnpm preview`
serves the build at <http://localhost:4321/blog/>.

## Search engines

`/blog/sitemap-index.xml` lists every page. Crawlers only read `robots.txt` at the root
of a host, so the `/blog/robots.txt` this build writes is not consulted, and the main
site has no `robots.txt` today. Submit `https://randprotocol.org/blog/sitemap-index.xml`
in Search Console, or add a `Sitemap:` line to a root `robots.txt` when the main site
gets one.

## Rollback

The deploy is a copy of `dist/`. To go back, check out the commit that was live and run
`./deploy.sh` again. To take the blog down, remove the two location blocks from the
vhost and reload nginx; `/blog/` then answers 404 from the main site, as it did before.
