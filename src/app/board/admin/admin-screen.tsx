"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { bucketLabel } from "@/lib/buckets";
import type { AdminEntry } from "@/lib/entries";
import { SEED_COOKIE_ID } from "@/lib/entries-constants";
import { displayFunctionLabel } from "@/lib/functions";
import {
  clearSeeds,
  refreshEntries,
  seedBoard,
  signOut,
  toggleHidden,
  type AdminResult,
} from "./actions";
import styles from "./admin.module.css";

/** The admin list refreshes on its own so two devices stay in step. */
const REFRESH_MS = 5_000;

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

  function absorb(result: AdminResult) {
    if (result.ok) {
      setEntries(result.entries);
      setNote(result.note ?? null);
      setError(null);
    } else {
      setError(result.message);
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      void refreshEntries().then((result) => {
        // A background refresh should never clobber a note with a stale one.
        if (result.ok) {
          setEntries(result.entries);
          setError(null);
        } else {
          setError(result.message);
        }
      });
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const visible = entries.filter((entry) => !entry.hidden).length;
    const seeded = entries.filter(
      (entry) => entry.submitter_cookie_id === SEED_COOKIE_ID && !entry.hidden,
    ).length;
    const people = new Set(
      entries
        .filter((entry) => entry.submitter_cookie_id !== SEED_COOKIE_ID)
        .map((entry) => entry.submitter_cookie_id),
    ).size;
    return { visible, hidden: entries.length - visible, seeded, people };
  }, [entries]);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <span className={`wordmark ${styles.mark}`}>
          Steiger Bean <span className="dot">&bull;</span>
        </span>
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
      </header>

      <h1 className={styles.title}>Session control</h1>
      <p className={styles.lede}>
        Hiding an entry takes it off the projected board within about two seconds. Nothing is
        deleted.
      </p>

      <div className={styles.stats}>
        <span className={styles.stat}>
          <span className={styles.statValue}>{stats.visible}</span>
          <span className={styles.statLabel}>On the board</span>
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{stats.hidden}</span>
          <span className={styles.statLabel}>Hidden</span>
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{stats.people}</span>
          <span className={styles.statLabel}>Phones</span>
        </span>
      </div>

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
        <a className={styles.tool} href="/api/admin/export" style={{ borderBottom: undefined }}>
          Export CSV
        </a>
        <a className={styles.tool} data-variant="quiet" href="/board/live" target="_blank">
          Open board screen
        </a>
      </div>

      {note ? <p className={styles.note}>{note}</p> : null}
      {error ? <p className={styles.note}>{error}</p> : null}

      {entries.length === 0 ? (
        <p className={styles.empty}>Nothing submitted yet.</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.row} data-hidden={entry.hidden ? "true" : "false"}>
              <div>
                <div className={styles.meta}>
                  <span>{bucketLabel(entry.bucket)}</span>
                  <span>{displayFunctionLabel(entry.function_label)}</span>
                  <span className={styles.metaQuiet}>{timeOnly(entry.created_at)}</span>
                  {entry.submitter_cookie_id === SEED_COOKIE_ID ? (
                    <span className={styles.metaQuiet}>Example</span>
                  ) : null}
                </div>
                <div className={styles.task}>{entry.task}</div>
              </div>
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
