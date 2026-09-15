import { buildBoardPayload, type BoardPayload } from "@/lib/board-payload";
import { REQUIRED_SUBMISSIONS } from "@/lib/entries-constants";
import { MatrixScreen } from "./matrix-screen";

export const dynamic = "force-dynamic";

const EMPTY: BoardPayload = {
  version: "boot",
  total: 0,
  people: 0,
  unlocked: true,
  remaining: 0,
  required: REQUIRED_SUBMISSIONS,
  ownIds: [],
  ownEntries: [],
  entries: [],
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/**
 * The projected matrix. Flags so the room can be tuned without a redeploy:
 *   ?columns=5     how many functions are on screen at once
 *   ?notes=2       how many answers show inside one cell
 *   ?rotate=30     seconds between turns, 0 to hold still
 *   ?transport=poll   skip the live stream and poll instead
 */
export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const columnsPerPage = clamp(Number(read("columns")), 2, 10, 4);
  const notesPerCell = clamp(Number(read("notes")), 1, 6, 1);
  const rotateSeconds = clamp(Number(read("rotate")), 0, 600, 45);
  const forcePolling = read("transport") === "poll";

  let initial = EMPTY;
  try {
    initial = await buildBoardPayload({ visitorId: "", mode: "live", fresh: true });
  } catch (error) {
    // Never blank the projector. The client reconnects on its own.
    console.error("[/board/matrix] initial load failed", error);
  }

  return (
    <MatrixScreen
      initial={initial}
      columnsPerPage={columnsPerPage}
      notesPerCell={notesPerCell}
      rotateMs={rotateSeconds * 1000}
      forcePolling={forcePolling}
    />
  );
}
