"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BUCKETS, type BucketKey } from "@/lib/buckets";
import type { AdminEntry } from "@/lib/entries";
import { SEED_COOKIE_ID } from "@/lib/entries-constants";
import { displayFunctionLabel } from "@/lib/functions";
import styles from "./admin.module.css";

export type Selection = { bucket: BucketKey | null; fn: string | null };

type Props = {
  /** Visible entries only. A hidden entry does not count as covered. */
  entries: AdminEntry[];
  selection: Selection;
  onSelect: (next: Selection) => void;
};

/** How long a newly arrived note keeps its entrance animation. */
const ARRIVAL_MS = 1_600;

/**
 * The slide, live, with the words in it.
 *
 * Six task types down the side, every function the room has actually named
 * across the top, and inside each cell the tasks people wrote. The grid grows
 * as the room fills it: columns appear with new functions, cells get taller
 * with each answer, and new notes fade in where they land.
 *
 * The empty cells still carry the message. They are drawn, not collapsed.
 */
export function CoverageMatrix({ entries, selection, onSelect }: Props) {
  const { functions, byCell, rowTotals, colTotals, filled, cells } = useMemo(() => {
    const byCell = new Map<string, AdminEntry[]>();
    const byFunction = new Map<string, number>();
    const byBucket = new Map<BucketKey, number>();

    // Oldest first inside a cell, so new answers land at the bottom and the
    // ones already read do not jump around.
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

  if (functions.length === 0) {
    return (
      <section className={styles.matrixPanel}>
        <h2 className={styles.panelTitle}>Six tasks, and every function you have</h2>
        <p className={styles.panelEmpty}>
          The grid fills in as the room submits. Nothing yet, so seed a few examples below.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.matrixPanel}>
      <h2 className={styles.panelTitle}>Six tasks, and every function you have</h2>

      <div className={styles.matrixScroll}>
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th scope="col" className={styles.matrixCorner}>
                <span className="visually-hidden">Task type</span>
              </th>
              {functions.map((fn) => (
                <th key={fn} scope="col" className={styles.matrixColHead}>
                  <button
                    type="button"
                    className={styles.matrixHeadButton}
                    data-on={selection.fn === fn && selection.bucket === null ? "true" : "false"}
                    onClick={() =>
                      onSelect(
                        selection.fn === fn && selection.bucket === null
                          ? { bucket: null, fn: null }
                          : { bucket: null, fn },
                      )
                    }
                  >
                    {fn}
                    <span className={styles.headCount}>{colTotals.get(fn) ?? 0}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {BUCKETS.map((definition) => (
              <tr key={definition.key}>
                <th scope="row" className={styles.matrixRowHead}>
                  <button
                    type="button"
                    className={styles.matrixHeadButton}
                    data-on={
                      selection.bucket === definition.key && selection.fn === null ? "true" : "false"
                    }
                    onClick={() =>
                      onSelect(
                        selection.bucket === definition.key && selection.fn === null
                          ? { bucket: null, fn: null }
                          : { bucket: definition.key, fn: null },
                      )
                    }
                  >
                    {definition.label}
                    <span className={styles.headCount}>{rowTotals.get(definition.key) ?? 0}</span>
                  </button>
                </th>

                {functions.map((fn) => {
                  const list = byCell.get(`${definition.key}|${fn}`) ?? [];
                  return (
                    <td key={fn} className={styles.matrixCell}>
                      {/* The box lives inside the cell, not on it. A table cell
                          stretches to the tallest in its row, which would turn
                          every empty marker into a large void. */}
                      <div className={styles.cellBox} data-filled={list.length > 0 ? "true" : "false"}>
                        {list.map((entry) => (
                          <article
                            key={entry.id}
                            className={`${styles.note} ${
                              arriving.has(entry.id) ? styles.noteArrive : ""
                            }`}
                            data-example={
                              entry.submitter_cookie_id === SEED_COOKIE_ID ? "true" : "false"
                            }
                          >
                            {entry.task}
                          </article>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.matrixCaption}>
        {`${filled} of ${cells} cells filled. Nobody has looked at the rest.`}
      </p>
    </section>
  );
}
