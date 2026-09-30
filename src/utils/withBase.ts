/**
 * The blog is served under a sub-path (https://randprotocol.org/blog/), set as
 * Astro's `base` in astro.config.ts. Astro prefixes the assets it bundles, but
 * not the links a component writes by hand, so every internal href goes
 * through `withBase`.
 */

/** The base without a trailing slash: "/blog", or "" when served at the root. */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/**
 * Prefix a site-relative path with the base.
 * @example withBase("/posts/") // "/blog/posts/"
 * @example withBase("/rss.xml") // "/blog/rss.xml"
 */
export function withBase(path: string): string {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Remove the base from a pathname, for code that reads the route.
 * @example stripBase("/blog/tags/zkvm/") // "/tags/zkvm/"
 */
export function stripBase(pathname: string): string {
  if (BASE && (pathname === BASE || pathname.startsWith(`${BASE}/`))) {
    return pathname.slice(BASE.length) || "/";
  }
  return pathname;
}

/** Give a page path its trailing slash, so a link needs no redirect. */
export function withTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}
