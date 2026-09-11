import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "sb_board_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Mints the anonymous visitor id on first contact. Writing it onto the request
 * as well as the response means the page rendering this same request already
 * sees the id, so nothing has to wait for a second round trip.
 *
 * This is the Next 16 "proxy" convention, formerly called middleware.
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  if (existing) return NextResponse.next();

  const id = crypto.randomUUID();
  request.cookies.set(VISITOR_COOKIE, id);

  // Secure follows the real protocol. A production build served over plain
  // http, which is what a phone rehearsal on the same wifi looks like, would
  // otherwise be handed a cookie the browser discards.
  const secure =
    (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
      request.nextUrl.protocol.replace(":", "")) === "https";

  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

export const config = {
  matcher: ["/", "/board/:path*", "/api/entries/:path*"],
};
