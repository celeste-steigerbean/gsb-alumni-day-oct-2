/**
 * The prefix this app lives under on steigerbean.com. Defined once in
 * next.config.ts and inlined here at build time, so server, proxy and browser
 * code all agree.
 *
 * Next adds it on its own to <Link>, router calls, server redirect() and
 * assets. It does not add it to a raw fetch(), EventSource, <a href> or a
 * Location header written by hand, which is what withBase() is for.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}

/**
 * Cookies are scoped to the app's own path. Left at "/", every page of
 * steigerbean.com would be sent the board's cookies, including the admin one.
 */
export const COOKIE_PATH = BASE_PATH || "/";
