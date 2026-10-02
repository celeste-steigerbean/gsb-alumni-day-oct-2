import "server-only";
import { createHash } from "node:crypto";

import type { BucketKey } from "./buckets";
import { query } from "./db";
import { SEED_COOKIE_ID } from "./entries-constants";
import { SEED_BATCH_SIZE, SEED_EXAMPLES } from "./seed-examples";

export type Entry = {
  id: string;
  created_at: string;
  bucket: BucketKey;
  function_label: string;
  task: string;
  hidden: boolean;
};

export type AdminEntry = Entry & { submitter_cookie_id: string };

export type BoardSnapshot = {
  /** Changes whenever the visible set of entries changes. */
  version: string;
  total: number;
  /** Distinct people behind the visible entries, examples excluded. */
  people: number;
  entries: Entry[];
  /**
   * Every entry's id by the phone that sent it, hidden ones included, newest
   * first. Server only: buildBoardPayload reads one phone's list out of it and
   * nothing else, so no submitter id ever reaches a browser.
   */
  idsByCookie: ReadonlyMap<string, string[]>;
};

export {
  TASK_MIN_LENGTH,
  TASK_MAX_LENGTH,
  RATE_LIMIT_PER_HOUR,
  REQUIRED_SUBMISSIONS,
  SEED_COOKIE_ID,
} from "./entries-constants";

type Row = {
  id: string;
  created_at: Date;
  bucket: BucketKey;
  function_label: string;
  task: string;
  hidden: boolean;
};

function toEntry(row: Row): Entry {
  return {
    id: String(row.id),
    created_at: row.created_at.toISOString(),
    bucket: row.bucket,
    function_label: row.function_label,
    task: row.task,
    hidden: row.hidden,
  };
}

/**
 * A short-lived cache in front of the board read. Sixty phones polling every
 * few seconds collapse into roughly one query per second per instance.
 *
 * It also answers "which of these are mine" for every phone. That used to be a
 * query of its own on every stream tick, uncached: sixty open phones made
 * about fifty queries a second with nothing happening, all four pool
 * connections busy, measured. The one read already fetched every row's
 * submitter, so it builds the answer for all of them at once.
 */
const CACHE_TTL_MS = 900;
let cached: { at: number; value: BoardSnapshot } | null = null;
/**
 * The read already on its way, shared. When the cache lapses, every stream
 * that ticks before the refresh returns would otherwise start an identical
 * query of its own; measured with sixty phones, that herd tripled the idle
 * query rate.
 */
let inflight: Promise<BoardSnapshot> | null = null;
/** Bumped by every write, so a read that started before it cannot cache. */
let generation = 0;

function versionOf(entries: Entry[]): string {
  if (entries.length === 0) return "empty";
  const hash = createHash("sha1");
  for (const entry of entries) hash.update(entry.id).update(",");
  return `${entries.length}-${hash.digest("hex").slice(0, 12)}`;
}

/** Every visible entry, newest first. */
export async function getBoardSnapshot(options?: { fresh?: boolean }): Promise<BoardSnapshot> {
  const now = Date.now();
  if (!options?.fresh && cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }
  // A fresh read, after a write, never rides on one that may have started
  // before the write landed.
  if (!options?.fresh && inflight) return inflight;

  const read = readSnapshot(now);
  if (!options?.fresh) {
    inflight = read;
    read.then(
      () => { if (inflight === read) inflight = null; },
      () => { if (inflight === read) inflight = null; },
    );
  }
  return read;
}

async function readSnapshot(now: number): Promise<BoardSnapshot> {
  const startedIn = generation;

  // Hidden rows too, for ownership only. Hiding somebody's answer takes it off
  // the board; it does not take back the unlock it earned them.
  const rows = await query<Row & { submitter_cookie_id: string }>(
    `SELECT id, created_at, bucket, function_label, task, hidden, submitter_cookie_id
       FROM entries
      ORDER BY id DESC`,
  );

  const visible = rows.filter((row) => !row.hidden);
  const entries = visible.map(toEntry);
  const people = new Set(
    visible
      .filter((row) => row.submitter_cookie_id !== SEED_COOKIE_ID)
      .map((row) => row.submitter_cookie_id),
  ).size;

  const idsByCookie = new Map<string, string[]>();
  for (const row of rows) {
    const list = idsByCookie.get(row.submitter_cookie_id);
    if (list) list.push(String(row.id));
    else idsByCookie.set(row.submitter_cookie_id, [String(row.id)]);
  }

  const value: BoardSnapshot = {
    version: versionOf(entries),
    total: entries.length,
    people,
    entries,
    idsByCookie,
  };
  // A write landed while this read was out: what it holds may predate that
  // write, so it answers its own callers but is not kept for anyone else.
  if (startedIn === generation) cached = { at: now, value };
  return value;
}

/** Call after any write so the next read does not serve a stale snapshot. */
export function invalidateBoardCache(): void {
  generation++;
  cached = null;
  inflight = null;
}

export async function getAdminEntries(): Promise<AdminEntry[]> {
  const rows = await query<Row & { submitter_cookie_id: string }>(
    `SELECT id, created_at, bucket, function_label, task, hidden, submitter_cookie_id
       FROM entries
      ORDER BY id DESC`,
  );
  return rows.map((row) => ({ ...toEntry(row), submitter_cookie_id: row.submitter_cookie_id }));
}

export async function countRecentForCookie(cookieId: string): Promise<number> {
  if (!cookieId) return 0;
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM entries
      WHERE submitter_cookie_id = $1
        AND created_at > now() - interval '1 hour'`,
    [cookieId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function insertEntry(input: {
  bucket: BucketKey;
  functionLabel: string;
  task: string;
  cookieId: string;
}): Promise<Entry> {
  const rows = await query<Row>(
    `INSERT INTO entries (bucket, function_label, task, submitter_cookie_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at, bucket, function_label, task, hidden`,
    [input.bucket, input.functionLabel, input.task, input.cookieId],
  );
  invalidateBoardCache();
  return toEntry(rows[0]);
}

export async function setEntryHidden(id: string, hidden: boolean): Promise<void> {
  await query(`UPDATE entries SET hidden = $2 WHERE id = $1`, [id, hidden]);
  invalidateBoardCache();
}

/**
 * Removes the examples outright rather than hiding them. They are props, not
 * anybody's answer, so leaving them in the export would pollute the record.
 */
export async function clearSeedEntries(): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM entries WHERE submitter_cookie_id = $1 RETURNING id`,
    [SEED_COOKIE_ID],
  );
  if (rows.length > 0) invalidateBoardCache();
  return rows.length;
}

export async function seedExamples(
  batch: number = SEED_BATCH_SIZE,
): Promise<{ inserted: number; seeded: number; available: number }> {
  const existing = await query<{ task: string }>(
    `SELECT task FROM entries WHERE submitter_cookie_id = $1`,
    [SEED_COOKIE_ID],
  );
  const already = new Set(existing.map((row) => row.task));

  // Only ever add examples that are not already in the table, so clicking
  // the button twice tops up rather than duplicating.
  const remaining = SEED_EXAMPLES.filter((example) => !already.has(example.task));
  const batchToAdd = remaining.slice(0, Math.max(0, batch));

  for (const example of batchToAdd) {
    await query(
      `INSERT INTO entries (bucket, function_label, task, submitter_cookie_id)
       VALUES ($1, $2, $3, $4)`,
      [example.bucket, example.functionLabel, example.task, SEED_COOKIE_ID],
    );
  }

  if (batchToAdd.length > 0) invalidateBoardCache();

  return {
    inserted: batchToAdd.length,
    seeded: already.size + batchToAdd.length,
    available: SEED_EXAMPLES.length,
  };
}
