"use client";

import { useMemo } from "react";

import { BUCKETS, type BucketKey } from "@/lib/buckets";
import type { AdminEntry } from "@/lib/entries";
import { displayFunctionLabel } from "@/lib/functions";
import styles from "./admin.module.css";

export type Selection = { bucket: BucketKey | null; fn: string | null };

type Props = {
  /** Visible entries only. A hidden entry does not count as covered. */
  entries: AdminEntry[];
  selection: Selection;
  onSelect: (next: Selection) => void;
};

/**
 * The slide, live. Six task types down the side, the functions the room has
 * actually named across the top, and a dot where the two meet.
 *
 * The filled cells are not the point. The empty ones are: the grid shows at a
 * glance how much of their own organisation nobody has thought to point this
 * at. Every cell is a filter, so a dot that surprises you is one tap from the
 * entries behind it.
 */
export function CoverageMatrix({ entries, selection, onSelect }: Props) {
  const { functions, counts, rowTotals, colTotals, filled, cells } = useMemo(() => {
    const counts = new Map<string, number>();
    const byFunction = new Map<string, number>();
    const byBucket = new Map<BucketKey, number>();

    for (const entry of entries) {
      const fn = displayFunctionLabel(entry.function_label);
      counts.set(`${entry.bucket}|${fn}`, (counts.get(`${entry.bucket}|${fn}`) ?? 0) + 1);
      byFunction.set(fn, (byFunction.get(fn) ?? 0) + 1);
      byBucket.set(entry.bucket, (byBucket.get(entry.bucket) ?? 0) + 1);
    }

    // Busiest functions first, so the columns that carry the story come first
    // and the long tail falls off the right edge rather than the middle.
    const functions = [...byFunction.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);

    return {
      functions,
      counts,
      rowTotals: byBucket,
      colTotals: byFunction,
      filled: counts.size,
      cells: BUCKETS.length * functions.length,
    };
  }, [entries]);

  if (functions.length === 0) {
    return (
      <section className={styles.matrixPanel}>
        <h2 className={styles.panelTitle}>Six tasks, and every function you have</h2>
        <p className={styles.panelEmpty}>
          The grid fills in as the room submits. Nothing yet.
        </p>
      </section>
    );
  }

  const isSelected = (bucket: BucketKey, fn: string) =>
    selection.bucket === bucket && selection.fn === fn;

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
                  </button>
                </th>
              ))}
              <th scope="col" className={styles.matrixTotalHead}>
                All
              </th>
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
                  </button>
                </th>

                {functions.map((fn) => {
                  const count = counts.get(`${definition.key}|${fn}`) ?? 0;
                  return (
                    <td key={fn} className={styles.matrixCell}>
                      <button
                        type="button"
                        className={styles.cell}
                        data-filled={count > 0 ? "true" : "false"}
                        data-on={isSelected(definition.key, fn) ? "true" : "false"}
                        disabled={count === 0}
                        aria-label={`${definition.label}, ${fn}, ${count} ${
                          count === 1 ? "task" : "tasks"
                        }`}
                        onClick={() =>
                          onSelect(
                            isSelected(definition.key, fn)
                              ? { bucket: null, fn: null }
                              : { bucket: definition.key, fn },
                          )
                        }
                      >
                        {count > 0 ? (
                          <>
                            <span className={styles.dot} aria-hidden="true" />
                            {count > 1 ? (
                              <span className={styles.cellCount}>{count}</span>
                            ) : null}
                          </>
                        ) : null}
                      </button>
                    </td>
                  );
                })}

                <td className={styles.matrixTotal}>{rowTotals.get(definition.key) ?? 0}</td>
              </tr>
            ))}

            <tr className={styles.matrixTotalsRow}>
              <th scope="row" className={styles.matrixRowHead}>
                All
              </th>
              {functions.map((fn) => (
                <td key={fn} className={styles.matrixTotal}>
                  {colTotals.get(fn) ?? 0}
                </td>
              ))}
              <td className={styles.matrixTotal}>{entries.length}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className={styles.matrixCaption}>
        {`${filled} of ${cells} cells filled. Nobody has looked at the rest.`}
      </p>
    </section>
  );
}
