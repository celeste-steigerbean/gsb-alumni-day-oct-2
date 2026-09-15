import { NextResponse, type NextRequest } from "next/server";

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
  const { pathname, searchParams } = request.nextUrl;
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
    path: "/",
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
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(CODE_PARAM);

    const response = NextResponse.redirect(clean);
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

  const unlock = request.nextUrl.clone();
  unlock.pathname = "/unlock";
  unlock.search = "";
  unlock.searchParams.set("next", pathname);
  return finish(NextResponse.redirect(unlock));
}

export const config = {
  // The admin dashboard carries its own password and is deliberately outside
  // the room gate: it must stay reachable even if the room code changes.
  matcher: ["/", "/board", "/board/live", "/board/matrix", "/api/entries/:path*"],
};
