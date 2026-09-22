"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

/**
 * How long the board stays where the presenter put it before the drift takes
 * over again. Long enough to read a screenful out loud, short enough that a
 * board left alone goes back to looking after itself.
 */
const HOLD_MS = 20_000;

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

  // Paging by hand. The columns drift on their own; these put the board where
  // the presenter wants it and then hand it back.
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState(false);
  const [pagesByColumn, setPagesByColumn] = useState<Record<string, number>>({});
  const releaseRef = useRef<number | null>(null);

  const pages = Math.max(1, ...Object.values(pagesByColumn));

  const reportPages = useMemo(() => {
    const cache: Record<string, (n: number) => void> = {};
    for (const definition of BUCKETS) {
      cache[definition.key] = (n: number) =>
        setPagesByColumn((current) =>
          current[definition.key] === n ? current : { ...current, [definition.key]: n },
        );
    }
    return cache;
  }, []);

  const turn = useCallback(
    (delta: number) => {
      setHeld(true);
      setPage((current) => {
        const count = Math.max(1, ...Object.values(pagesByColumn));
        return (current + delta + count) % count;
      });
      if (releaseRef.current) window.clearTimeout(releaseRef.current);
      releaseRef.current = window.setTimeout(() => {
        setHeld(false);
        setPage(0);
      }, HOLD_MS);
    },
    [pagesByColumn],
  );

  useEffect(
    () => () => {
      if (releaseRef.current) window.clearTimeout(releaseRef.current);
    },
    [],
  );

  // A clicker sends arrow keys, which is how this actually gets driven from
  // the front of a room.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") turn(1);
      else if (event.key === "ArrowLeft") turn(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [turn]);

  return (
    <div className={styles.stage} data-surface="dark" style={{ "--scale": scale } as React.CSSProperties}>
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

      {pages > 1 ? (
        <>
          <div className={styles.topZone} aria-hidden="true" />
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => turn(-1)}
              aria-label="Back a screen"
            >
              <span aria-hidden="true">{"\u2039"}</span>
            </button>
            <span className={styles.pageLabel}>{`Screen ${page + 1} of ${pages}`}</span>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => turn(1)}
              aria-label="On a screen"
            >
              <span aria-hidden="true">{"\u203A"}</span>
            </button>
            <span className={styles.pageHint}>
              {held ? "Held \u2014 drifting again shortly" : "Drifting"}
            </span>
          </div>
        </>
      ) : null}

      <div className={styles.columns}>
        {columns.map((column) => (
          <BoardColumn
            key={column.key}
            name={column.name}
            helper={column.helper}
            entries={column.entries}
            arrivingIds={arrivingIds}
            pixelsPerSecond={speed}
            paged={held}
            page={page}
            onPages={reportPages[column.key]}
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
