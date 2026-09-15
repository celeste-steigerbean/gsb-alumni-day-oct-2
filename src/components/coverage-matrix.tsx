"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
   * "dashboard" scrolls and filters. "projection" fills the screen and turns
   * itself over on a timer, because nobody is going to walk over and scroll
   * a projector.
   */
  variant?: "dashboard" | "projection";
  selection?: Selection;
  onSelect?: (next: Selection) => void;
  /** Projection only. */
  columnsPerPage?: number;
  notesPerCell?: number;
  rotateMs?: number;
};

/** How long a newly arrived note keeps its entrance animation. */
const ARRIVAL_MS = 1_600;

/**
 * The slide, live, with the words in it.
 *
 * Six task types down the side, every function the room has actually named
 * across the top, and inside each cell the tasks people wrote.
 *
 * The empty cells carry the message. They are drawn, not collapsed.
 */
export function CoverageMatrix({
  entries,
  variant = "dashboard",
  selection = { bucket: null, fn: null },
  onSelect,
  columnsPerPage = 4,
  notesPerCell = 1,
  rotateMs = 45_000,
}: Props) {
  const projecting = variant === "projection";

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

  // Rotation. One counter drives both which columns show and which answers
  // surface inside a crowded cell, so a full turn brings everything forward.
  const [tick, setTick] = useState(0);
  const pageCount = projecting ? Math.max(1, Math.ceil(functions.length / columnsPerPage)) : 1;

  useEffect(() => {
    if (!projecting || rotateMs <= 0) return;
    const id = setInterval(() => setTick((value) => value + 1), rotateMs);
    return () => clearInterval(id);
  }, [projecting, rotateMs]);

  const shown = useMemo(() => {
    if (!projecting) return functions;
    const page = pageCount === 0 ? 0 : tick % pageCount;
    return functions.slice(page * columnsPerPage, page * columnsPerPage + columnsPerPage);
  }, [functions, projecting, tick, pageCount, columnsPerPage]);

  /** Rotate a crowded cell so its later answers get their turn on screen. */
  function windowFor(list: MatrixEntry[]): { visible: MatrixEntry[]; hidden: number } {
    if (!projecting || list.length <= notesPerCell) {
      return { visible: list, hidden: 0 };
    }
    const start = (tick * notesPerCell) % list.length;
    const visible = Array.from(
      { length: notesPerCell },
      (_, index) => list[(start + index) % list.length],
    );
    return { visible, hidden: list.length - notesPerCell };
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

  if (functions.length === 0) {
    return (
      <section className={styles.panel} data-variant={variant}>
        <h2 className={styles.title}>Six tasks, and every function you have</h2>
        <p className={styles.empty}>
          {projecting
            ? "Take out your phone. The grid fills in as you go."
            : "The grid fills in as the room submits. Nothing yet, so seed a few examples below."}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.panel} data-variant={variant}>
      <header className={styles.head}>
        <h2 className={styles.title}>Six tasks, and every function you have</h2>
        {projecting && pageCount > 1 ? (
          <span className={styles.pager}>
            {`${(tick % pageCount) + 1} of ${pageCount}`}
          </span>
        ) : null}
      </header>

      <div className={styles.scroll}>
        <table
          className={styles.matrix}
          style={projecting ? ({ "--cols": shown.length } as React.CSSProperties) : undefined}
        >
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
                      <div className={styles.box} data-filled={list.length > 0 ? "true" : "false"}>
                        {visible.map((entry) => (
                          <article
                            key={entry.id}
                            className={`${styles.note} ${
                              arriving.has(entry.id) ? styles.noteArrive : ""
                            }`}
                            data-example={entry.isExample ? "true" : "false"}
                          >
                            <span className={styles.noteText}>{entry.task}</span>
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

      <p className={styles.caption}>
        {`${filled} of ${cells} cells filled. Nobody has looked at the rest.`}
      </p>

      {projecting && rotateMs > 0 ? (
        // Restarts with each turn, so the room can see the next one coming.
        <span
          key={tick}
          className={styles.progress}
          style={{ animationDuration: `${rotateMs}ms` }}
          aria-hidden="true"
        />
      ) : null}
    </section>
  );
}
