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
  /** Loop speed in design pixels per second before the board scale is applied. */
  pixelsPerSecond: number;
  /**
   * Held still by hand. The drift stops and the column is placed by whole
   * screenfuls instead.
   */
  paged: boolean;
  page: number;
  /** Tells the board how many screenfuls this column holds. */
  onPages: (pages: number) => void;
};

/** Wait this long after the last change before restarting the scroll loop. */
const SETTLE_MS = 2_600;
/** No column should take longer than this to show everything once. */
const MAX_CYCLE_S = 150;

/* Nothing on this board is fitted to a box. A card has no fixed height — it
   grows and its column scrolls — so a long task wraps rather than being cut,
   and a long function name does too. What was cutting them off at 720p was
   type that did not scale with the screen, which --k now handles. */
function Card({ entry, arriving }: { entry: Entry; arriving: boolean }) {
  return (
    <article className={`${styles.card} ${arriving ? styles.enter : ""}`}>
      <span className={styles.cardFunction}>{displayFunctionLabel(entry.function_label)}</span>
      <span className={styles.cardTask}>{entry.task}</span>
    </article>
  );
}

export function BoardColumn({
  name,
  helper,
  entries,
  arrivingIds,
  pixelsPerSecond,
  paged,
  page,
  onPages,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const segmentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [loop, setLoop] = useState<{ shift: number; duration: number } | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pages, setPages] = useState(1);

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

      setViewportHeight(available);
      // One design pixel, so the drift speed is read against the board's own
      // scale rather than the raw screen.
      const unit = Number.parseFloat(getComputedStyle(viewport).getPropertyValue("--k")) || 1;

      const screenfuls = Math.max(1, Math.ceil(content / Math.max(1, available)));
      setPages((current) => (current === screenfuls ? current : screenfuls));

      if (content <= available + 4) {
        setLoop((current) => (current === null ? current : null));
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(segment).rowGap || "0") || 0;
      const shift = Math.round(content + gap);
      // Long columns would otherwise take many minutes to come around, so
      // cap the cycle. Short overflows keep the slow drift.
      const raw = shift / Math.max(4, pixelsPerSecond * unit);
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

  useEffect(() => {
    onPages(pages);
  }, [pages, onPages]);

  // Restart the loop from the top once the column has stopped changing, so a
  // burst of submissions keeps the newest cards in view instead of thrashing
  // the animation on every arrival.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !loop || paged) return;

    track.style.animation = "none";
    const timer = window.setTimeout(() => {
      track.style.animation = "";
    }, SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [entries, loop, paged]);

  const cards = entries.map((entry) => (
    <Card key={entry.id} entry={entry} arriving={arrivingIds.has(entry.id)} />
  ));

  // A column shorter than the one being paged to just stays where it is,
  // rather than scrolling past its own last card into blank space.
  const offset = paged ? Math.min(page, pages - 1) * viewportHeight : 0;

  return (
    <section className={styles.column}>
      <header className={styles.columnHead}>
        <h2 className={styles.columnName}>
          <span className={styles.columnNameText}>{name}</span>
          <span className={styles.columnCount}>{entries.length || ""}</span>
        </h2>
        {/* Not fitted: these six sit in a row and have to match each other.
            Fitting each one separately grew the short ones and shrank the long
            ones, which staggered the header. They all scale with the board
            instead, which is what was cutting them off at 720p. */}
        <p className={styles.columnHelper}>{helper}</p>
      </header>

      <div className={styles.viewport} ref={viewportRef}>
        <div
          ref={trackRef}
          className={styles.track}
          data-scrolling={loop && !paged ? "true" : "false"}
          data-paged={paged ? "true" : "false"}
          style={
            paged
              ? ({ transform: `translate3d(0, ${-offset}px, 0)` } as React.CSSProperties)
              : loop
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

          {loop && !paged ? (
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
