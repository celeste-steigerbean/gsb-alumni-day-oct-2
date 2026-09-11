import type { NextRequest } from "next/server";

import { buildBoardPayload } from "@/lib/board-payload";
import { readVisitorId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** How often the stream looks for a change. */
const TICK_MS = 1_200;
/** Comment frame that keeps proxies from closing an idle connection. */
const HEARTBEAT_MS = 12_000;
/**
 * The stream retires itself well inside the platform function limit and lets
 * EventSource reconnect. A clean handover beats a truncated response.
 */
const MAX_LIFETIME_MS = 45_000;

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") === "live" ? "live" : "submit";
  const visitorId = await readVisitorId();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastVersion: string | null = null;
      let lastSend = Date.now();
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // Already torn down by the platform.
        }
      };

      const write = (chunk: string) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          close();
          return false;
        }
      };

      request.signal.addEventListener("abort", close);

      // Ask the browser to come straight back when this stream retires.
      write("retry: 1000\n\n");

      const tick = async () => {
        if (closed) return;

        if (Date.now() - startedAt > MAX_LIFETIME_MS) {
          write("event: cycle\ndata: {}\n\n");
          close();
          return;
        }

        try {
          const payload = await buildBoardPayload({ visitorId, mode });
          if (payload.version !== lastVersion) {
            lastVersion = payload.version;
            if (!write(`data: ${JSON.stringify(payload)}\n\n`)) return;
            lastSend = Date.now();
          } else if (Date.now() - lastSend > HEARTBEAT_MS) {
            if (!write(": keep-alive\n\n")) return;
            lastSend = Date.now();
          }
        } catch (error) {
          console.error("[api/entries/stream] read failed", error);
          write("event: soft-error\ndata: {}\n\n");
        }

        if (!closed) timer = setTimeout(tick, TICK_MS);
      };

      await tick();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // Stops nginx style proxies from buffering the stream into silence.
      "x-accel-buffering": "no",
    },
  });
}
