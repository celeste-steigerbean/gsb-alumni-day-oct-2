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
import styles from "./admin.module.css";

/** The dashboard refreshes on its own so two devices stay in step. */
const REFRESH_MS = 4_000;
const STALE_AFTER_MS = 12_000;
const TOP_FUNCTIONS = 8;

type BucketFilter = BucketKey | "ALL";

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * A single-series magnitude bar. One hue carries the magnitude and the value
 * is labelled directly, so there is no legend and no second colour.
 */
function Bar({ name, value, max }: { name: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={styles.bar}>
      <span className={styles.barName} title={name}>
        {name}
      </span>
      <span className={styles.barValue}>{value}</span>
      <span className={styles.barTrack}>
        <span
          className={styles.barFill}
          data-empty={value === 0 ? "true" : "false"}
          style={{ width: `${value === 0 ? 0 : Math.max(pct, 3)}%` }}
        />
      </span>
    </div>
  );
}

export function AdminScreen({ initial }: { initial: AdminEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>("ALL");
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

  const bucketCounts = useMemo(() => {
    const counts = new Map<BucketKey, number>(BUCKETS.map((b) => [b.key, 0]));
    for (const entry of visible) {
      counts.set(entry.bucket, (counts.get(entry.bucket) ?? 0) + 1);
    }
    return BUCKETS.map((b) => ({ key: b.key, label: b.label, value: counts.get(b.key) ?? 0 }));
  }, [visible]);

  const bucketMax = Math.max(1, ...bucketCounts.map((b) => b.value));

  const topFunctions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of visible) {
      const name = displayFunctionLabel(entry.function_label);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_FUNCTIONS)
      .map(([name, value]) => ({ name, value }));
  }, [visible]);

  const functionMax = Math.max(1, ...topFunctions.map((f) => f.value));

  // Only name a leader when one bucket is actually ahead. Calling a three way
  // tie a leader would be wrong on a screen you read numbers off.
  const leader = useMemo(() => {
    const top = Math.max(0, ...bucketCounts.map((b) => b.value));
    if (top === 0) return null;
    const atTop = bucketCounts.filter((b) => b.value === top);
    return atTop.length === 1 ? atTop[0].label : null;
  }, [bucketCounts]);

  // ----------------------------------------------------------------- filter
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!showHidden && entry.hidden) return false;
      if (bucketFilter !== "ALL" && entry.bucket !== bucketFilter) return false;
      if (!needle) return true;
      return (
        entry.task.toLowerCase().includes(needle) ||
        displayFunctionLabel(entry.function_label).toLowerCase().includes(needle) ||
        bucketLabel(entry.bucket).toLowerCase().includes(needle)
      );
    });
  }, [entries, search, bucketFilter, showHidden]);

  const filtersActive = search.trim() !== "" || bucketFilter !== "ALL" || !showHidden;

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

      <section className={styles.panels}>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Where the room landed{leader ? `: ${leader} leads` : ""}
          </h2>
          <div className={styles.bars}>
            {bucketCounts.map((bucket) => (
              <Bar key={bucket.key} name={bucket.label} value={bucket.value} max={bucketMax} />
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Busiest functions{topFunctions.length > TOP_FUNCTIONS ? ` (top ${TOP_FUNCTIONS})` : ""}
          </h2>
          {topFunctions.length === 0 ? (
            <p className={styles.panelEmpty}>Nothing submitted yet.</p>
          ) : (
            <div className={styles.bars}>
              {topFunctions.map((fn) => (
                <Bar key={fn.name} name={fn.name} value={fn.value} max={functionMax} />
              ))}
            </div>
          )}
        </div>
      </section>

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
        <button
          type="button"
          className={styles.chip}
          data-on={bucketFilter === "ALL" ? "true" : "false"}
          onClick={() => setBucketFilter("ALL")}
        >
          All
          <span className={styles.chipCount}>{visible.length}</span>
        </button>
        {bucketCounts.map((bucket) => (
          <button
            key={bucket.key}
            type="button"
            className={styles.chip}
            data-on={bucketFilter === bucket.key ? "true" : "false"}
            onClick={() =>
              setBucketFilter((current) => (current === bucket.key ? "ALL" : bucket.key))
            }
          >
            {bucket.label}
            <span className={styles.chipCount}>{bucket.value}</span>
          </button>
        ))}
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
        <ul className={styles.list}>
          {filtered.map((entry) => (
            <li key={entry.id} className={styles.row} data-hidden={entry.hidden ? "true" : "false"}>
              <div className={styles.rowMeta}>
                <span className={styles.rowBucket}>{bucketLabel(entry.bucket)}</span>
                <span className={styles.rowFunction}>
                  {displayFunctionLabel(entry.function_label)}
                </span>
                <span className={styles.rowTime}>
                  {timeOnly(entry.created_at)}
                  {entry.submitter_cookie_id === SEED_COOKIE_ID ? (
                    <span className={styles.rowTag}> &middot; Example</span>
                  ) : null}
                </span>
              </div>

              <div className={styles.task}>{entry.task}</div>

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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
