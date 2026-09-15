"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { BUCKETS, bucketLabel, type BucketKey } from "@/lib/buckets";
import type { AdminEntry } from "@/lib/entries";
import { SEED_COOKIE_ID } from "@/lib/entries-constants";
import { displayFunctionLabel } from "@/lib/functions";
import { Wordmark } from "@/components/wordmark";
import {
  clearSeeds,
  refreshEntries,
  seedBoard,
  signOut,
  toggleHidden,
  type AdminResult,
} from "./actions";
import { CoverageMatrix, type Selection } from "./coverage-matrix";
import styles from "./admin.module.css";

/** The dashboard refreshes on its own so two devices stay in step. */
const REFRESH_MS = 4_000;
const STALE_AFTER_MS = 12_000;
const TOP_FUNCTIONS = 8;

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AdminScreen({ initial }: { initial: AdminEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Selection>({ bucket: null, fn: null });
  const [showHidden, setShowHidden] = useState(true);

  const [lastSync, setLastSync] = useState(Date.now());
  const lastSyncRef = useRef(Date.now());
  const [stale, setStale] = useState(false);

  function absorb(result: AdminResult) {
    if (result.ok) {
      setEntries(result.entries);
      setNote(result.note ?? null);
      setError(null);
      lastSyncRef.current = Date.now();
      setLastSync(lastSyncRef.current);
    } else {
      setError(result.message);
    }
  }

  useEffect(() => {
    const pull = () =>
      void refreshEntries().then((result) => {
        // A background pull refreshes data but never clobbers the note.
        if (result.ok) {
          setEntries(result.entries);
          setError(null);
          lastSyncRef.current = Date.now();
          setLastSync(lastSyncRef.current);
        } else {
          setError(result.message);
        }
      });

    const id = setInterval(pull, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && pull();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setStale(Date.now() - lastSyncRef.current > STALE_AFTER_MS),
      2_000,
    );
    return () => clearInterval(id);
  }, [lastSync]);

  // ---------------------------------------------------------------- summary
  const visible = useMemo(() => entries.filter((e) => !e.hidden), [entries]);

  const stats = useMemo(() => {
    const seeded = visible.filter((e) => e.submitter_cookie_id === SEED_COOKIE_ID).length;
    const people = new Set(
      entries
        .filter((e) => e.submitter_cookie_id !== SEED_COOKIE_ID)
        .map((e) => e.submitter_cookie_id),
    ).size;
    const functions = new Set(
      visible.map((e) => displayFunctionLabel(e.function_label).toLowerCase()),
    ).size;
    return {
      visible: visible.length,
      hidden: entries.length - visible.length,
      people,
      functions,
      seeded,
    };
  }, [entries, visible]);






  // ----------------------------------------------------------------- filter
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!showHidden && entry.hidden) return false;
      if (selection.bucket && entry.bucket !== selection.bucket) return false;
      if (selection.fn && displayFunctionLabel(entry.function_label) !== selection.fn) return false;
      if (!needle) return true;
      return (
        entry.task.toLowerCase().includes(needle) ||
        displayFunctionLabel(entry.function_label).toLowerCase().includes(needle) ||
        bucketLabel(entry.bucket).toLowerCase().includes(needle)
      );
    });
  }, [entries, search, selection, showHidden]);

  const filtersActive =
    search.trim() !== "" || selection.bucket !== null || selection.fn !== null || !showHidden;

  const selectionLabel = [
    selection.bucket ? bucketLabel(selection.bucket) : null,
    selection.fn,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Wordmark className={styles.mark} />
        <span className={styles.headRight}>
          <span className={styles.liveDot} data-stale={stale ? "true" : "false"} aria-hidden="true" />
          <button
            type="button"
            className={styles.tool}
            data-variant="quiet"
            onClick={() =>
              startTransition(async () => {
                await signOut();
                router.refresh();
              })
            }
          >
            Sign out
          </button>
        </span>
      </header>

      <h1 className={styles.title}>Session dashboard</h1>
      <p className={styles.lede}>
        Every answer the room has given, live. Hiding an entry takes it off the projected board
        within about two seconds and nothing is ever deleted.
      </p>

      <section className={styles.tiles} aria-label="Summary">
        <div className={styles.tile}>
          <span className={styles.tileValue}>{stats.visible}</span>
          <span className={styles.tileLabel}>On the board</span>
          {stats.seeded > 0 ? (
            <span className={styles.tileNote}>
              {stats.seeded} of these are seeded examples
            </span>
          ) : null}
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{stats.people}</span>
          <span className={styles.tileLabel}>Phones</span>
          <span className={styles.tileNote}>Distinct people who submitted</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{stats.functions}</span>
          <span className={styles.tileLabel}>Functions</span>
          <span className={styles.tileNote}>Distinct areas represented</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue} data-quiet={stats.hidden === 0 ? "true" : "false"}>
            {stats.hidden}
          </span>
          <span className={styles.tileLabel}>Hidden</span>
          <span className={styles.tileNote}>Still in the database and the export</span>
        </div>
      </section>

      <CoverageMatrix
        entries={visible}
        selection={selection}
        onSelect={setSelection}
      />

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.tool}
          disabled={pending}
          onClick={() => startTransition(async () => absorb(await seedBoard()))}
        >
          Seed three examples
        </button>
        <button
          type="button"
          className={styles.tool}
          data-variant="quiet"
          disabled={pending || stats.seeded === 0}
          onClick={() => startTransition(async () => absorb(await clearSeeds()))}
        >
          Hide the examples
        </button>
        <a className={styles.tool} href="/api/admin/export">
          Export CSV
        </a>
        <a className={styles.tool} data-variant="quiet" href="/board/live" target="_blank">
          Open board screen
        </a>
      </div>

      {note ? <p className={styles.note}>{note}</p> : null}
      {error ? <p className={styles.note}>{error}</p> : null}

      <div className={styles.filters}>
        <label className="visually-hidden" htmlFor="dash-search">
          Search answers
        </label>
        <input
          id="dash-search"
          className={styles.search}
          type="search"
          placeholder="Search a task, a function, a task type"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {selectionLabel ? (
          <button
            type="button"
            className={styles.chip}
            data-on="true"
            onClick={() => setSelection({ bucket: null, fn: null })}
          >
            {selectionLabel} &times;
          </button>
        ) : null}
        <button
          type="button"
          className={styles.chip}
          data-on={showHidden ? "true" : "false"}
          onClick={() => setShowHidden((current) => !current)}
        >
          {showHidden ? "Hidden shown" : "Hidden out"}
        </button>
      </div>

      <p className={styles.resultLine}>
        {filtered.length} {filtered.length === 1 ? "answer" : "answers"}
        {filtersActive ? ` of ${entries.length}` : ""}
      </p>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {entries.length === 0 ? "Nothing submitted yet." : "Nothing matches those filters."}
        </p>
      ) : (
        /* Grouped by the six task types, in the order the session teaches
           them, so the table reads the same way the slide does. */
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.colFunction}>Function</th>
                <th scope="col" className={styles.colTask}>The task</th>
                <th scope="col" className={styles.colTime}>Time</th>
                <th scope="col" className={styles.colAction}>
                  <span className="visually-hidden">Show or hide</span>
                </th>
              </tr>
            </thead>

            {BUCKETS.map((definition) => {
              const rows = filtered.filter((entry) => entry.bucket === definition.key);
              if (rows.length === 0) return null;
              return (
                <tbody key={definition.key}>
                  <tr className={styles.groupRow}>
                    <th scope="colgroup" colSpan={4}>
                      <span className={styles.groupName}>{definition.label}</span>
                      <span className={styles.groupHelper}>{definition.helper}</span>
                      <span className={styles.groupCount}>{rows.length}</span>
                    </th>
                  </tr>

                  {rows.map((entry) => (
                    <tr key={entry.id} data-hidden={entry.hidden ? "true" : "false"}>
                      <td className={styles.colFunction}>
                        {displayFunctionLabel(entry.function_label)}
                        {entry.submitter_cookie_id === SEED_COOKIE_ID ? (
                          <span className={styles.rowTag}> Example</span>
                        ) : null}
                      </td>
                      <td className={styles.colTask}>{entry.task}</td>
                      <td className={styles.colTime}>{timeOnly(entry.created_at)}</td>
                      <td className={styles.colAction}>
                        <button
                          type="button"
                          className={styles.toggle}
                          data-hidden={entry.hidden ? "true" : "false"}
                          disabled={busyId === entry.id}
                          onClick={() => {
                            setBusyId(entry.id);
                            // Optimistic, so the click feels instant on stage.
                            setEntries((current) =>
                              current.map((row) =>
                                row.id === entry.id ? { ...row, hidden: !row.hidden } : row,
                              ),
                            );
                            startTransition(async () => {
                              absorb(await toggleHidden(entry.id, !entry.hidden));
                              setBusyId(null);
                            });
                          }}
                        >
                          {entry.hidden ? "Show" : "Hide"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </main>
  );
}
