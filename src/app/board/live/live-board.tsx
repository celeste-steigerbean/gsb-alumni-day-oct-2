"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { BoardPayload } from "@/lib/board-payload";
import { BUCKETS } from "@/lib/buckets";
import { useLiveBoard } from "@/lib/use-live-board";
import { BoardColumn } from "./board-column";
import styles from "./live.module.css";

type Props = {
  initial: BoardPayload;
  scale: number;
  speed: number;
  forcePolling: boolean;
};

/** How long a card keeps its arrival animation. */
const ARRIVAL_MS = 1_400;

export function LiveBoard({ initial, scale, speed, forcePolling }: Props) {
  const { payload, status } = useLiveBoard({ mode: "live", initial, forcePolling });
  const view = payload ?? initial;

  const [arrivingIds, setArrivingIds] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string> | null>(null);

  // Mark ids that were not on the board on the previous frame.
  useEffect(() => {
    const current = new Set((view.entries ?? []).map((entry) => entry.id));

    if (seenRef.current === null) {
      seenRef.current = current;
      return;
    }

    const fresh = new Set<string>();
    for (const id of current) {
      if (!seenRef.current.has(id)) fresh.add(id);
    }
    seenRef.current = current;
    if (fresh.size === 0) return;

    setArrivingIds(fresh);
    const timer = window.setTimeout(() => setArrivingIds(new Set()), ARRIVAL_MS);
    return () => window.clearTimeout(timer);
  }, [view.entries]);

  const columns = useMemo(() => {
    const entries = view.entries ?? [];
    return BUCKETS.map((definition) => ({
      key: definition.key,
      name: definition.label,
      helper: definition.helper,
      // Newest first, so an arriving card lands at the top of its column.
      entries: entries.filter((entry) => entry.bucket === definition.key),
    }));
  }, [view.entries]);

  const isEmpty = (view.entries ?? []).length === 0;

  return (
    <div className={styles.stage} style={{ "--scale": scale } as React.CSSProperties}>
      <header className={styles.top}>
        <span className={`wordmark ${styles.mark}`}>
          Steiger Bean <span className="dot">&bull;</span>
        </span>
        <span className={styles.headline}>Six things this technology is good at</span>
        <span className={styles.tally}>
          <span className={styles.tallyNumber}>{view.total}</span>
          <span className={styles.tallyLabel}>
            {view.total === 1 ? "Task" : "Tasks"}
            <span className={styles.statusDot} data-status={status} aria-hidden="true" />
          </span>
        </span>
      </header>

      <div className={styles.columns}>
        {columns.map((column) => (
          <BoardColumn
            key={column.key}
            name={column.name}
            helper={column.helper}
            entries={column.entries}
            arrivingIds={arrivingIds}
            pixelsPerSecond={speed}
          />
        ))}
      </div>

      {isEmpty ? (
        <div className={styles.opening}>
          <div className={styles.openingTitle}>Take out your phone</div>
          <div className={styles.openingLine}>One task from your own company</div>
        </div>
      ) : null}
    </div>
  );
}
