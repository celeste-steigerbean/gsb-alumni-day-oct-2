import "server-only";

import {
  getBoardSnapshot,
  getEntryIdsForCookie,
  type Entry,
} from "./entries";

export type BoardPayload = {
  version: string;
  total: number;
  /** True once this visitor has submitted at least once, or on the live board. */
  unlocked: boolean;
  /** Ids belonging to this visitor, so their own cards can be marked. */
  ownIds: string[];
  /** Every visible entry, newest first. Null while the board is still locked. */
  entries: Entry[] | null;
  /** The three newest entries, shown before a visitor has submitted. */
  samples: Entry[];
};

export const SAMPLE_COUNT = 3;

/**
 * Builds the payload both the poll endpoint and the SSE stream send.
 *
 * The full list is withheld until a visitor submits. That gate is a
 * conversation device, not a security boundary: the same data is on the
 * projected screen, and mode "live" returns it outright.
 */
export async function buildBoardPayload(options: {
  visitorId: string;
  mode: "submit" | "live";
  fresh?: boolean;
}): Promise<BoardPayload> {
  const snapshot = await getBoardSnapshot({ fresh: options.fresh });

  const ownIds =
    options.mode === "live" || !options.visitorId
      ? []
      : await getEntryIdsForCookie(options.visitorId);

  const unlocked = options.mode === "live" || ownIds.length > 0;

  return {
    version: `${snapshot.version}:${unlocked ? ownIds.length : "locked"}`,
    total: snapshot.total,
    unlocked,
    ownIds,
    entries: unlocked ? snapshot.entries : null,
    samples: snapshot.entries.slice(0, SAMPLE_COUNT),
  };
}
