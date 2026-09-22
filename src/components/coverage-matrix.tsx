"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { BUCKETS, type BucketKey } from "@/lib/buckets";
import { displayFunctionLabel } from "@/lib/functions";
import styles from "./coverage-matrix.module.css";

export type Selection = { bucket: BucketKey | null; fn: string | null };

export type MatrixEntry = {
  id: string;
  bucket: BucketKey;
  function_label: string;
  task: string;
  /** Seeded inspiration rather than somebody's answer. */
  isExample?: boolean;
};

type Props = {
  /** Visible entries only. A hidden entry does not count as covered. */
  entries: MatrixEntry[];
  /**
   * "dashboard" is the laptop: paper ground, clickable headings, arrows to
   * page sideways. "projection" fills the screen on the dark ground and also
   * turns itself over on a timer, because nobody walks over to a projector.
   */
  variant?: "dashboard" | "projection";
  selection?: Selection;
  onSelect?: (next: Selection) => void;
  columnsPerPage?: number;
  notesPerCell?: number;
  /** Projection only. 0 holds the page still. */
  rotateMs?: number;
};

/** How long a newly arrived note keeps its entrance animation. */
const ARRIVAL_MS = 1_600;

/**
 * How small a task is allowed to get so that all of it shows.
 *
 * The room's own screens have a 16px floor and keep it. This is a dense grid
 * on the presenter's laptop, read at desk distance, and the alternative to
 * shrinking is cutting the sentence in half — which is worse for a grid whose
 * entire job is showing what people actually wrote.
 */
const FIT = { dashboard: { min: 11, max: 16 } } as const;

/**
 * The projector's bounds scale with the screen it is thrown on.
 *
 * A projected image is stretched to the wall, so what matters is the share of
 * the picture a line of text takes, not its pixel count. Fixed bounds tuned
 * for 1080p clipped every note on a 720p projector; these give the same
 * proportions on both. At 1080 they work out to 14 and 24.
 */
function projectionFit(viewportHeight: number) {
  return {
    min: Math.max(11, Math.round(viewportHeight / 77)),
    max: Math.max(16, Math.round(viewportHeight / 45)),
  };
}

/**
 * A task, sized to its box.
 *
 * The note's slot has a definite height, so the text is shrunk until all of it
 * fits rather than clipped at a line count. Binary search over whole pixels:
 * five reflows for a range this size, and it only re-runs when the text or the
 * box actually changes.
 */
function FitText({ text, min, max }: { text: string; min: number; max: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;

    let lo = min;
    let hi = max;
    let best = min;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = `${mid}px`;
      if (host.scrollHeight <= host.clientHeight) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    el.style.fontSize = `${best}px`;
  }, [min, max]);

  useLayoutEffect(() => {
    fit();
    const host = ref.current?.parentElement;
    if (!host || typeof ResizeObserver === "undefined") return;
    // Coalesce to one measurement per frame: a page turn resizes every note.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [fit, text]);

  return (
    <span ref={ref} className={styles.noteText}>
      {text}
    </span>
  );
}

/**
 * The slide, live, with the words in it.
 *
 * Six task types down the side, the functions the room has named across the
 * top, and inside each cell the tasks people wrote.
 *
 * The empty cells carry the message. They are drawn, not collapsed.
 */
export function CoverageMatrix({
  entries,
  variant = "dashboard",
  selection = { bucket: null, fn: null },
  onSelect,
  columnsPerPage,
  notesPerCell,
  rotateMs = 45_000,
}: Props) {
  // The dashboard panel can blow itself up to fill the screen. It then behaves
  // exactly like the projected route, rotation included, so there is one
  // implementation of the projected grid rather than two that drift.
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const projecting = variant === "projection" || expanded;

  const columns = columnsPerPage ?? 4;
  const notes = notesPerCell ?? (projecting ? 1 : 2);

  const [screenHeight, setScreenHeight] = useState(1080);
  useEffect(() => {
    if (!projecting) return;
    const read = () => setScreenHeight(window.innerHeight);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [projecting]);

  const fit = projecting ? projectionFit(screenHeight) : FIT.dashboard;

  async function toggleExpanded(event: React.MouseEvent<HTMLButtonElement>) {
    const next = !expanded;
    setExpanded(next);

    // The button lives inside the bar that hides itself, and a focused button
    // holds that bar open through :focus-within. Drop focus on a click so the
    // chrome actually goes away; tabbing to it still reveals the bar.
    if (event.detail > 0) event.currentTarget.blur();

    // The panel covers the viewport on its own, so this only adds the win of
    // hiding the browser chrome. A refusal is not worth surfacing.
    try {
      if (next) await panelRef.current?.requestFullscreen?.();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Keep the expanded layout regardless.
    }
  }

  // Leaving fullscreen by Escape or the browser's own control has to bring the
  // panel back with it, or the page is stuck covered.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const { functions, byCell, rowTotals, colTotals, filled, cells } = useMemo(() => {
    const byCell = new Map<string, MatrixEntry[]>();
    const byFunction = new Map<string, number>();
    const byBucket = new Map<BucketKey, number>();

    // Oldest first inside a cell, so answers already read do not jump around.
    for (const entry of [...entries].reverse()) {
      const fn = displayFunctionLabel(entry.function_label);
      const key = `${entry.bucket}|${fn}`;
      const list = byCell.get(key);
      if (list) list.push(entry);
      else byCell.set(key, [entry]);
      byFunction.set(fn, (byFunction.get(fn) ?? 0) + 1);
      byBucket.set(entry.bucket, (byBucket.get(entry.bucket) ?? 0) + 1);
    }

    const functions = [...byFunction.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);

    return {
      functions,
      byCell,
      rowTotals: byBucket,
      colTotals: byFunction,
      filled: byCell.size,
      cells: BUCKETS.length * functions.length,
    };
  }, [entries]);

  // Paging. Both layouts page sideways now: the dashboard by hand, the
  // projection by hand and on a timer. `page` is which functions are on
  // screen; `tick` is which answers surface inside a crowded cell, so a full
  // turn of the projection brings everything forward.
  const [page, setPage] = useState(0);
  const [tick, setTick] = useState(0);
  // Bumped by a manual turn, which restarts the timer so a click is not
  // overtaken a moment later by the rotation.
  const [nudge, setNudge] = useState(0);

  const pageCount = Math.max(1, Math.ceil(functions.length / columns));

  // The room adds a function, or the dashboard filter narrows one away, and
  // the current page can fall off the end.
  useEffect(() => {
    setPage((current) => (current >= pageCount ? 0 : current));
  }, [pageCount]);

  const turn = useCallback(
    (delta: number) => {
      setPage((current) => (current + delta + pageCount) % pageCount);
      setNudge((value) => value + 1);
    },
    [pageCount],
  );

  useEffect(() => {
    if (!projecting || rotateMs <= 0 || pageCount <= 1) return;
    const id = setInterval(() => {
      setPage((current) => {
        const next = (current + 1) % pageCount;
        // One lap of the columns, then the crowded cells turn over too.
        if (next === 0) setTick((value) => value + 1);
        return next;
      });
    }, rotateMs);
    return () => clearInterval(id);
  }, [projecting, rotateMs, pageCount, nudge]);

  // Arrow keys move the grid wherever it is focused, which is how somebody
  // driving a projector from a clicker actually gets around.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (!panelRef.current?.contains(el ?? null) && !projecting) return;
      if (event.key === "ArrowRight") turn(1);
      else if (event.key === "ArrowLeft") turn(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [turn, projecting]);

  const shown = useMemo(
    () => functions.slice(page * columns, page * columns + columns),
    [functions, page, columns],
  );

  // How many notes the busiest cell in each row is actually showing. A row
  // where nobody has written anything does not need to be as tall as a row
  // with two answers in it, and six full height rows of mostly empty boxes
  // is a lot of nothing to scroll past.
  const rowSlots = useMemo(
    () =>
      BUCKETS.map((definition) => {
        let most = 0;
        for (const fn of shown) {
          const count = (byCell.get(`${definition.key}|${fn}`) ?? []).length;
          if (count > most) most = count;
        }
        return Math.max(1, Math.min(most, notes));
      }),
    [shown, byCell, notes],
  );

  // The projection keeps six equal rows: the structure is the point on a wall,
  // and it has a fixed height to divide up. The dashboard is a page you
  // scroll, so its rows are sized to their contents.
  const gridRows = projecting
    ? undefined
    : `auto ${rowSlots
        .map((n) => `calc(var(--slot-h) * ${n} + var(--gap) * ${n + 1})`)
        .join(" ")}`;

  /** Trim a cell to what its box holds, rotating the rest into view later. */
  function windowFor(list: MatrixEntry[]): { visible: MatrixEntry[]; hidden: number } {
    if (list.length <= notes) return { visible: list, hidden: 0 };
    if (!projecting) return { visible: list.slice(0, notes), hidden: list.length - notes };
    const start = (tick * notes) % list.length;
    const visible = Array.from({ length: notes }, (_, i) => list[(start + i) % list.length]);
    return { visible, hidden: list.length - notes };
  }

  // Fade in whatever was not here a moment ago, so the grid reads as filling.
  const [arriving, setArriving] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const current = new Set(entries.map((entry) => entry.id));
    if (seenRef.current === null) {
      seenRef.current = current;
      return;
    }
    const fresh = new Set<string>();
    for (const id of current) if (!seenRef.current.has(id)) fresh.add(id);
    seenRef.current = current;
    if (fresh.size === 0) return;
    setArriving(fresh);
    const timer = window.setTimeout(() => setArriving(new Set()), ARRIVAL_MS);
    return () => window.clearTimeout(timer);
  }, [entries]);

  const select = (next: Selection) => onSelect?.(next);
  const surface = projecting ? "dark" : undefined;

  if (functions.length === 0) {
    return (
      <section className={styles.panel} data-surface={surface} data-variant={variant} data-layout={variant}>
        <h2 className={styles.title}>Six tasks, and every function you have</h2>
        <p className={styles.empty}>
          {projecting
            ? "Take out your phone. The grid fills in as you go."
            : "The grid fills in as the room submits. Nothing yet, so seed a few examples below."}
        </p>
      </section>
    );
  }

  const first = page * columns + 1;
  const last = Math.min(page * columns + columns, functions.length);

  const pager =
    pageCount > 1 ? (
      <span className={styles.pager}>
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => turn(-1)}
          aria-label="Previous functions"
        >
          <span aria-hidden="true">{"‹"}</span>
        </button>
        <span className={styles.pageCount}>
          {`${first}–${last} of ${functions.length}`}
        </span>
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => turn(1)}
          aria-label="Next functions"
        >
          <span aria-hidden="true">{"›"}</span>
        </button>
      </span>
    ) : null;

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      data-surface={surface}
      data-variant={variant}
      data-layout={projecting ? "projection" : "dashboard"}
      style={{ "--cols": shown.length } as React.CSSProperties}
    >
      {projecting ? <div className={styles.topZone} aria-hidden="true" /> : null}

      <header className={styles.head}>
        <h2 className={styles.title}>Six tasks, and every function you have</h2>
        <span className={styles.headTools}>
          {pager}
          {variant === "dashboard" ? (
            <button type="button" className={styles.expand} onClick={toggleExpanded}>
              {expanded ? "Exit full screen" : "Full screen"}
            </button>
          ) : null}
        </span>
      </header>

      <div className={styles.scroll}>
        <table className={styles.matrix} style={gridRows ? { gridTemplateRows: gridRows } : undefined}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                <span className="visually-hidden">Task type</span>
              </th>
              {shown.map((fn) => (
                <th key={fn} scope="col" className={styles.colHead}>
                  {projecting ? (
                    <span className={styles.headLabel}>
                      {fn}
                      <span className={styles.headCount}>{colTotals.get(fn) ?? 0}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.headButton}
                      data-on={selection.fn === fn && selection.bucket === null ? "true" : "false"}
                      onClick={() =>
                        select(
                          selection.fn === fn && selection.bucket === null
                            ? { bucket: null, fn: null }
                            : { bucket: null, fn },
                        )
                      }
                    >
                      {fn}
                      <span className={styles.headCount}>{colTotals.get(fn) ?? 0}</span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {BUCKETS.map((definition) => (
              <tr key={definition.key}>
                <th scope="row" className={styles.rowHead}>
                  {projecting ? (
                    <span className={styles.headLabel}>
                      {definition.label}
                      <span className={styles.headCount}>{rowTotals.get(definition.key) ?? 0}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.headButton}
                      data-on={
                        selection.bucket === definition.key && selection.fn === null
                          ? "true"
                          : "false"
                      }
                      onClick={() =>
                        select(
                          selection.bucket === definition.key && selection.fn === null
                            ? { bucket: null, fn: null }
                            : { bucket: definition.key, fn: null },
                        )
                      }
                    >
                      {definition.label}
                      <span className={styles.headCount}>{rowTotals.get(definition.key) ?? 0}</span>
                    </button>
                  )}
                </th>

                {shown.map((fn) => {
                  const list = byCell.get(`${definition.key}|${fn}`) ?? [];
                  const { visible, hidden } = windowFor(list);
                  return (
                    <td key={fn} className={styles.cell}>
                      {/* The box lives inside the cell, not on it. A table cell
                          stretches to the tallest in its row, which would turn
                          every empty marker into a large void. */}
                      <div
                        className={styles.box}
                        data-filled={list.length > 0 ? "true" : "false"}
                        style={{ "--slots": Math.max(visible.length, 1) } as React.CSSProperties}
                      >
                        {visible.map((entry) => (
                          <article
                            key={entry.id}
                            className={`${styles.note} ${
                              arriving.has(entry.id) ? styles.noteArrive : ""
                            }`}
                            data-example={entry.isExample ? "true" : "false"}
                          >
                            <FitText text={entry.task} min={fit.min} max={fit.max} />
                          </article>
                        ))}
                        {hidden > 0 ? (
                          <span className={styles.more}>{`+${hidden} more`}</span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {projecting ? null : (
        <p className={styles.caption}>
          {`${filled} of ${cells} cells filled. Nobody has looked at the rest.`}
        </p>
      )}

      {projecting && rotateMs > 0 && pageCount > 1 ? (
        // Restarts with each turn, so the room can see the next one coming.
        <span
          key={`${page}-${nudge}`}
          className={styles.progress}
          style={{ animationDuration: `${rotateMs}ms` }}
          aria-hidden="true"
        />
      ) : null}
    </section>
  );
}
