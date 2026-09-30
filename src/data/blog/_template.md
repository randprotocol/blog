---
# Copy this file to src/data/blog/<slug>.md and edit it. The file name is the
# slug: foo.md is published at https://randprotocol.org/blog/posts/foo/ .
# This file is never published, because its name starts with an underscore.
# The schema is in src/content.config.ts.

# Required. The post's heading, and the text of its social image.
title: "A title in sentence case"

# Required. One or two sentences: shown on the index, in the feed, in search
# results and as the page's meta description.
description: "What the post says, in a sentence a reader can decide on."

# Required. ISO 8601 with a time zone. A post dated more than 15 minutes ahead
# stays off the index, the tag pages and the feed until that time has passed
# and the site is rebuilt. Its page is still built, so do not rely on the date
# to keep a post private; use `draft` for that.
pubDatetime: 2026-10-01T09:00:00Z

# Optional. Set it when the post changes in substance; it is shown as "Updated"
# and moves the post up the list. Leave it out otherwise.
# modDatetime: 2026-10-08T09:00:00Z

# Optional. Defaults to "Rand Protocol" (SITE.author in src/config.ts).
# author: "Rand Protocol"

# Optional. Defaults to ["others"]. Each tag gets a page at /blog/tags/<tag>/ .
tags:
  - engineering

# Optional. true lists the post under "Featured" on the home page.
featured: false

# Optional. true keeps the post out of the build altogether.
draft: false

# Optional. A social image of your own, 1200x630: a path relative to this
# file for an image under src/ (for example ../../assets/images/foo.png), or a
# full URL. Without it one is drawn from the title.
# ogImage: ../../assets/images/foo.png

# Optional. Only when the post first appeared somewhere else.
# canonicalURL: https://example.org/original-post

# Optional. true hides the "Edit page" link on this post.
# hideEditPost: false

# Optional. An IANA zone for displaying the dates. Defaults to UTC.
# timezone: UTC
---

Open with the point of the post: what was built or found, and why a reader
should care. This first paragraph is what people see before they decide to go on.

## Table of contents

## Headings

The heading above this one is filled in with a collapsed table of contents when
the site is built; delete it if the post is short. Start the sections at `##`,
since the title is the page's only `#`.

## Links and images

Link to another post as `/blog/posts/<slug>/`. A link that starts with `/` is
resolved against randprotocol.org, not against the blog, so `/docs` is the main
site's documentation: [the docs](/docs).

Put an image under `src/assets/images/` and refer to it by a path relative to
this file, `![Alt text](../../assets/images/foo.png)`, so that it is optimised
at build time.

## Mathematics

Inline mathematics goes between single dollar signs: a commitment
$C = \mathrm{Com}(m; r)$ hides $m$ as long as $r$ is uniform.

Displayed mathematics goes between double dollar signs, on lines of their own:

$$
\Pr\bigl[\mathcal{A}(C) = m\bigr] \le \frac{1}{|\mathcal{M}|} + \mathrm{negl}(\lambda)
$$

## Code

Name the language after the fence. `file="..."` adds the file name above the
block:

```rust file="src/commit.rs"
/// Commit to `message` with blinding factor `r`.
pub fn commit(message: &[u8], r: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Hasher::new();
    hasher.update(r);
    hasher.update(message);
    hasher.finalize()
}
```

Inline code is written `like_this()`.

## Tables

| Parameter | Value | Note                     |
| :-------- | ----: | :----------------------- |
| `n`       |   256 | Aligned left, then right |
| `q`       |  3329 | Numbers read best right  |

## Closing

End with what follows from the post: what changes, what is next, where the code is.
