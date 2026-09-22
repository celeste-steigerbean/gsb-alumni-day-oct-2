import { NextResponse, type NextRequest } from "next/server";

import { BASE_PATH, COOKIE_PATH, withBase } from "@/lib/base-path";
import {
  CODE_PARAM,
  ROOM_COOKIE,
  ROOM_COOKIE_MAX_AGE,
  codeMatches,
  roomGateEnabled,
  roomToken,
  tokenIsValid,
} from "@/lib/room-access";

const VISITOR_COOKIE = "sb_board_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** The path inside the app, whether or not Next has already removed the prefix. */
function appPath(pathname: string): string {
  if (!BASE_PATH || !pathname.startsWith(BASE_PATH)) return pathname;
  return pathname.slice(BASE_PATH.length) || "/";
}

/**
 * A redirect that keeps the visitor on the address they used.
 *
 * steigerbean.com forwards to this app with a rewrite, so the browser is on
 * steigerbean.com while the host this code sees can be the vercel.app one.
 * An absolute Location naming that host would bounce the visitor off
 * steigerbean.com onto vercel.app, where the cookie just set does not exist,
 * and they would land back on the code screen.
 *
 * Next strips any redirect that points at the request's own host down to a
 * relative Location, which the browser resolves against steigerbean.com. So
 * the target is always built on the request's own origin, never a fixed one,
 * and carries the prefix exactly once. A hand-written relative Location is
 * not an option: Next parses it without a base and throws.
 */
function sameOriginRedirect(request: NextRequest, path: string, search = ""): NextResponse {
  const target = (path === "/" ? BASE_PATH : withBase(path)) || "/";
  return NextResponse.redirect(new URL(`${target}${search}`, request.nextUrl.origin), 307);
}

/**
 * Runs before every board request. Two jobs:
 *
 *  1. Mint the anonymous visitor id on first contact. Writing it onto the
 *     request as well as the response means the page rendering this same
 *     request already sees the id, so nothing waits for a second round trip.
 *  2. Hold the room gate. A QR code carrying ?code= is exchanged for a cookie
 *     and the code is stripped from the URL, so attendees never type anything
 *     and the code does not sit in the address bar to be screenshotted.
 *
 * This is the Next 16 "proxy" convention, formerly called middleware. It
 * always runs on the Node runtime.
 */
export async function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const pathname = appPath(request.nextUrl.pathname);
  const isApi = pathname.startsWith("/api/");

  // Secure follows the real protocol. A production build served over plain
  // http, which is what a phone rehearsal on the same wifi looks like, would
  // otherwise be handed a cookie the browser discards.
  const secure =
    (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
      request.nextUrl.protocol.replace(":", "")) === "https";

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: COOKIE_PATH,
  };

  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  const mintedVisitor = !visitorId;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    request.cookies.set(VISITOR_COOKIE, visitorId);
  }

  const finish = (response: NextResponse) => {
    if (mintedVisitor && visitorId) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        ...cookieOptions,
        maxAge: COOKIE_MAX_AGE,
      });
    }
    return response;
  };

  if (!roomGateEnabled()) {
    return finish(NextResponse.next({ request: { headers: request.headers } }));
  }

  // A code on the URL wins, then gets removed so it cannot leak onward.
  const supplied = searchParams.get(CODE_PARAM);
  if (supplied && (await codeMatches(supplied))) {
    const token = await roomToken();
    const clean = new URLSearchParams(searchParams);
    clean.delete(CODE_PARAM);
    const rest = clean.toString();

    const response = sameOriginRedirect(request, pathname, rest ? `?${rest}` : "");
    if (token) {
      response.cookies.set(ROOM_COOKIE, token, {
        ...cookieOptions,
        maxAge: ROOM_COOKIE_MAX_AGE,
      });
    }
    return finish(response);
  }

  if (await tokenIsValid(request.cookies.get(ROOM_COOKIE)?.value)) {
    return finish(NextResponse.next({ request: { headers: request.headers } }));
  }

  // Locked. An API caller gets a status it can act on, a person gets a form.
  if (isApi) {
    return finish(
      NextResponse.json({ error: "room_locked" }, { status: 401 }),
    );
  }

  // "next" is the path inside the app. The unlock page's redirect() and
  // router.replace() add the prefix themselves, exactly once.
  const next = new URLSearchParams({ next: pathname });
  return finish(sameOriginRedirect(request, "/unlock", `?${next.toString()}`));
}

export const config = {
  // The admin dashboard carries its own password and is deliberately outside
  // the room gate: it must stay reachable even if the room code changes.
  //
  // Written without the prefix: Next prepends basePath to every matcher.
  matcher: ["/", "/board", "/board/live", "/board/matrix", "/api/entries/:path*"],
};
