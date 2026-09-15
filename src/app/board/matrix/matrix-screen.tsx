"use client";

import { CoverageMatrix } from "@/components/coverage-matrix";
import type { BoardPayload } from "@/lib/board-payload";
import { useLiveBoard } from "@/lib/use-live-board";

type Props = {
  initial: BoardPayload;
  columnsPerPage: number;
  notesPerCell: number;
  rotateMs: number;
  forcePolling: boolean;
};

/**
 * The matrix, full screen, for the projector. No chrome, no cursor, and it
 * turns itself over on a timer so the columns and answers that do not fit
 * still get their turn in front of the room.
 */
export function MatrixScreen({
  initial,
  columnsPerPage,
  notesPerCell,
  rotateMs,
  forcePolling,
}: Props) {
  const { payload } = useLiveBoard({ mode: "live", initial, forcePolling });
  const view = payload ?? initial;

  return (
    <CoverageMatrix
      variant="projection"
      entries={view.entries ?? []}
      columnsPerPage={columnsPerPage}
      notesPerCell={notesPerCell}
      rotateMs={rotateMs}
    />
  );
}
