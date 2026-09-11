import { NextResponse, type NextRequest } from "next/server";

import { buildBoardPayload } from "@/lib/board-payload";
import { readVisitorId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polling transport. The client sends the version it already holds; when
 * nothing has changed the reply is a few bytes instead of the whole board.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") === "live" ? "live" : "submit";
  const known = request.nextUrl.searchParams.get("v");

  try {
    const visitorId = await readVisitorId();
    const payload = await buildBoardPayload({ visitorId, mode });

    const body =
      known && known === payload.version
        ? { unchanged: true as const, version: payload.version }
        : payload;

    return NextResponse.json(body, {
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[api/entries] failed", error);
    return NextResponse.json(
      { error: "board_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
