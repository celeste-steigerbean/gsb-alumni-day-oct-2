import "server-only";

import {
  getBoardSnapshot,
  getEntryIdsForCookie,
  type Entry,
} from "./entries";
import { REQUIRED_SUBMISSIONS } from "./entries-constants";

export type BoardPayload = {
  version: string;
  total: number;
  /** True once this visitor has met the submission quota, or on the live board. */
  unlocked: boolean;
  /** How many this visitor still owes before the board opens. */
  remaining: number;
  /** How many are required in total, so the UI never hardcodes it. */
  required: number;
  /** Ids belonging to this visitor, so their own cards can be marked. */
  ownIds: string[];
  /** This visitor's own entries, newest last. Never withheld: they wrote them. */
  ownEntries: Entry[];
  /** Every visible entry, newest first. Null while the board is still locked. */
  entries: Entry[] | null;
  /** The three newest entries, shown before a visitor has submitted. */
  samples: Entry[];
};

export const SAMPLE_COUNT = 3;

/**
 * Builds the payload both the poll endpoint and the SSE stream send.
 *
 * The full list is withheld until a visitor has added the required number of
 * tasks. That gate is a teaching device, not a security boundary: the same
 * data is on the projected screen, and mode "live" returns it outright.
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

  const ownSet = new Set(ownIds);
  const ownEntries = snapshot.entries
    .filter((entry) => ownSet.has(entry.id))
    .slice()
    .reverse();

  const unlocked = options.mode === "live" || ownIds.length >= REQUIRED_SUBMISSIONS;
  const remaining = Math.max(0, REQUIRED_SUBMISSIONS - ownIds.length);

  return {
    version: `${snapshot.version}:${unlocked ? "open" : `locked-${ownIds.length}`}`,
    total: snapshot.total,
    unlocked,
    remaining,
    required: REQUIRED_SUBMISSIONS,
    ownIds,
    ownEntries,
    entries: unlocked ? snapshot.entries : null,
    samples: snapshot.entries.slice(0, SAMPLE_COUNT),
  };
}
