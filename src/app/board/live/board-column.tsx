"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Entry } from "@/lib/entries";
import { displayFunctionLabel } from "@/lib/functions";
import styles from "./live.module.css";

type Props = {
  name: string;
  helper: string;
  entries: Entry[];
  /** Ids that were not on the board a moment ago, so they can animate in. */
  arrivingIds: Set<string>;
  /** Loop speed in css pixels per second before the board scale is applied. */
  pixelsPerSecond: number;
};

/** Wait this long after the last change before restarting the scroll loop. */
const SETTLE_MS = 2_600;
/** No column should take longer than this to show everything once. */
const MAX_CYCLE_S = 150;

function Card({ entry, arriving }: { entry: Entry; arriving: boolean }) {
  return (
    <article className={`${styles.card} ${arriving ? styles.enter : ""}`}>
      <span className={styles.cardFunction}>{displayFunctionLabel(entry.function_label)}</span>
      <span className={styles.cardTask}>{entry.task}</span>
    </article>
  );
}

export function BoardColumn({ name, helper, entries, arrivingIds, pixelsPerSecond }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const segmentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [loop, setLoop] = useState<{ shift: number; duration: number } | null>(null);

  // Measure the stack against the space it has. Only an overflowing column
  // scrolls; a short one sits still.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const segment = segmentRef.current;
    if (!viewport || !segment) return;

    let frame = 0;

    const measure = () => {
      const available = viewport.clientHeight;
      const content = segment.scrollHeight;
      if (content <= available + 4) {
        setLoop((current) => (current === null ? current : null));
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(segment).rowGap || "0") || 0;
      const shift = Math.round(content + gap);
      // Long columns would otherwise take many minutes to come around, so
      // cap the cycle. Short overflows keep the slow drift.
      const raw = shift / Math.max(4, pixelsPerSecond);
      const duration = Math.round(Math.min(Math.max(raw, 18), MAX_CYCLE_S));

      // Keep the same object when nothing moved. A new identity here would
      // restart the scroll animation for no reason.
      setLoop((current) =>
        current && current.shift === shift && current.duration === duration
          ? current
          : { shift, duration },
      );
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport);
    observer.observe(segment);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [entries, pixelsPerSecond]);

  // Restart the loop from the top once the column has stopped changing, so a
  // burst of submissions keeps the newest cards in view instead of thrashing
  // the animation on every arrival.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !loop) return;

    track.style.animation = "none";
    const timer = window.setTimeout(() => {
      track.style.animation = "";
    }, SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [entries, loop]);

  const cards = entries.map((entry) => (
    <Card key={entry.id} entry={entry} arriving={arrivingIds.has(entry.id)} />
  ));

  return (
    <section className={styles.column}>
      <header className={styles.columnHead}>
        <h2 className={styles.columnName}>
          <span>{name}</span>
          <span className={styles.columnCount}>{entries.length || ""}</span>
        </h2>
        <p className={styles.columnHelper}>{helper}</p>
      </header>

      <div className={styles.viewport} ref={viewportRef}>
        <div
          ref={trackRef}
          className={styles.track}
          data-scrolling={loop ? "true" : "false"}
          style={
            loop
              ? ({
                  "--loop-shift": `-${loop.shift}px`,
                  "--loop-duration": `${loop.duration}s`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <div className={styles.segment} ref={segmentRef}>
            {entries.length === 0 ? (
              <p className={styles.columnEmpty}>Waiting for the room</p>
            ) : (
              cards
            )}
          </div>

          {loop ? (
            <div className={styles.segment} aria-hidden="true">
              {entries.map((entry) => (
                <Card key={`echo-${entry.id}`} entry={entry} arriving={false} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
