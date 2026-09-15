import { buildBoardPayload, type BoardPayload } from "@/lib/board-payload";
import { REQUIRED_SUBMISSIONS } from "@/lib/entries-constants";
import { LiveBoard } from "./live-board";

export const dynamic = "force-dynamic";

const EMPTY: BoardPayload = {
  version: "boot",
  total: 0,
  unlocked: true,
  remaining: 0,
  required: REQUIRED_SUBMISSIONS,
  ownIds: [],
  ownEntries: [],
  entries: [],
  samples: [],
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/**
 * The projection screen. Three URL flags exist so the room can be tuned
 * without a redeploy:
 *   ?scale=1.15   every size on the board, for a smaller or further screen
 *   ?speed=26     loop scroll speed in pixels per second
 *   ?transport=poll   skip SSE and poll instead
 */
export default async function LiveBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const scale = clamp(Number(read("scale")), 0.7, 2, 1);
  const speed = clamp(Number(read("speed")), 4, 120, 20);
  const forcePolling = read("transport") === "poll";

  let initial = EMPTY;
  try {
    initial = await buildBoardPayload({ visitorId: "", mode: "live", fresh: true });
  } catch (error) {
    // Never blank the projector. The client reconnects on its own.
    console.error("[/board/live] initial load failed", error);
  }

  return (
    <LiveBoard initial={initial} scale={scale} speed={speed} forcePolling={forcePolling} />
  );
}
