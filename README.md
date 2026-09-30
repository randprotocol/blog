# Rand Protocol Blog

Engineering notes from the Rand Protocol team, published at
<https://randprotocol.org/blog/>.

A static [Astro](https://astro.build/) site: Markdown posts, KaTeX for
mathematics, Shiki for code, [Pagefind](https://pagefind.app/) for search, an RSS
feed, a sitemap and a generated social image for every post.

## Writing a post

1. Copy `src/data/blog/_template.md` to `src/data/blog/<slug>.md`. The file name
   is the slug: `foo.md` is published at `https://randprotocol.org/blog/posts/foo/`.
   Files and directories whose name starts with `_` are never published.
2. Fill in the frontmatter. `title`, `description` and `pubDatetime` are required;
   the template documents the rest.
3. Write the post in Markdown. The template shows a math block, a code block
   with a file name, and a table.
4. `pnpm dev` to read it locally, `pnpm build` to check it.

A post with `draft: true` is left out of the build. A post whose `pubDatetime`
is more than 15 minutes in the future stays off the index, the tag pages, the
archive and the feed until that time has passed and the site is rebuilt, but its
page is built at its URL, so the date does not keep a post private.

Link to another post as `/blog/posts/<slug>/`. A link that starts with `/` is
resolved against randprotocol.org, so `/docs` is the main site's documentation.

## Commands

| Command             | What it does                                                         |
| :------------------ | :------------------------------------------------------------------- |
| `pnpm install`      | Install dependencies                                                 |
| `pnpm dev`          | Development server at <http://localhost:4321/blog/>                  |
| `pnpm build`        | Type-check, build to `dist/`, and build the search index             |
| `pnpm preview`      | Serve `dist/` at <http://localhost:4321/blog/>, as the droplet would |
| `pnpm format`       | Format with Prettier                                                 |
| `pnpm format:check` | Check formatting                                                     |
| `pnpm lint`         | Lint with ESLint                                                     |

The build fetches Inter from Google Fonts to draw the social images, so it needs
network access. Search only works after a build, because Pagefind indexes `dist/`.

## Deploying

`./deploy.sh` builds the site and rsyncs `dist/` to the randprotocol.org
droplet; it needs `RANDPROTOCOL_DROPLET_IP` in the environment. nginx serves the
files at `/blog/` through the location blocks in `server/nginx-blog.conf`, which
are added to the vhost once. [`DEPLOY.md`](DEPLOY.md) has the one-time setup, the
deploy, the checks to run afterwards and the Content-Security-Policy notes.

## Layout

```text
/
├── deploy.sh               build and rsync to the droplet
├── DEPLOY.md               how the blog is served and deployed
├── server/
│   ├── nginx-blog.conf     the /blog/ location blocks for the vhost
│   └── csp-blog.sh         prints the CSP that fits the built site
├── public/                 favicon.svg, icon-180.png (copied as they are)
├── src/
│   ├── assets/
│   │   ├── fonts/          Inter, JetBrains Mono, Departure Mono (self-hosted)
│   │   └── icons/
│   ├── components/
│   ├── data/blog/          the posts; _template.md is the starting point
│   ├── layouts/
│   ├── pages/              index, posts, tags, archives, search, about, rss.xml, og images
│   ├── scripts/
│   ├── styles/             global.css (colour tokens, fonts), typography.css
│   ├── utils/
│   ├── config.ts           site title, URL, author, options
│   ├── constants.ts        social and share links
│   └── content.config.ts   the frontmatter schema
└── astro.config.ts
```

## Configuration

`src/config.ts` holds the site's title, description, canonical URL
(`https://randprotocol.org/blog/`), default author and time zone (UTC).

The site is served under a sub-path. `astro.config.ts` takes `site` and `base`
(`/blog`) from `SITE.website`, and components build internal links with
`withBase()` from `src/utils/withBase.ts`; a link written as a bare `/posts/`
in a component would point at the main site.

`PUBLIC_GOOGLE_SITE_VERIFICATION` is optional. When it is set in the build
environment, the pages carry a `google-site-verification` meta tag.

## Design

The look is randprotocol.org's: the same colour tokens (ink by default, paper as
the light theme, cobalt as the one accent), Inter for text, JetBrains Mono for
code, and the Rand mark and wordmark. The tokens are in `src/styles/global.css`.
The theme choice is kept in `localStorage` under the same key the main site
uses, so it carries from one to the other.

## Credits and licence

The site is built on [AstroPaper](https://github.com/satnaing/astro-paper)
5.5.1 by [Sat Naing](https://satnaing.dev), used under the MIT licence; the
theme's licence and copyright notice are kept in [`LICENSE`](LICENSE). The layout
and typography scale are AstroPaper's.

The fonts are under the SIL Open Font License 1.1; their sources and licences
are in `src/assets/fonts/`.
