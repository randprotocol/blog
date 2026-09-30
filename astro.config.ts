import { defineConfig, envField } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";

// The blog is served under a sub-path of the main site. SITE.website is the
// one place that says where ("https://randprotocol.org/blog/"); `site` and
// `base` are its two halves, so canonical URLs, the sitemap, the feed and the
// bundled assets all land under the base.
const website = new URL(SITE.website);

// https://astro.build/config
export default defineConfig({
  site: website.origin,
  base: website.pathname.replace(/\/+$/, "") || "/",
  integrations: [
    sitemap({
      filter: page => SITE.showArchives || !/\/archives\/?$/.test(page),
    }),
  ],
  markdown: {
    remarkPlugins: [
      remarkMath,
      remarkToc,
      [remarkCollapse, { test: "Table of contents" }],
    ],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      // The main site's pair (randprotocol.org astro.config.mjs). Both are
      // emitted as CSS variables; typography.css picks one by theme.
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    build: {
      // Never inline a small asset as a data: URI (Vite's default does so
      // under 4 kB, which catches one KaTeX font): every font stays a file
      // under _astro/, so a `font-src 'self'` policy is enough.
      assetsInlineLimit: 0,
    },
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    preserveScriptOrder: true,
  },
});
